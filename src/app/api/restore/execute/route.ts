import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'
import { checkSchema } from '@/db/check'
import { syncSchema } from '@/db/sync'

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

export async function POST(req: Request) {
  try {
    if (process.env.VERCEL) {
      return NextResponse.json({ error: 'Restore lokal tidak tersedia di Vercel' }, { status: 503 })
    }
    if (!hasPermission(req as any, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses restore database' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({})) as {
      tempFile?: string
      backupName?: string
      confirm?: boolean
    }

    if (!body?.confirm) {
      return NextResponse.json({ error: 'Konfirmasi diperlukan' }, { status: 400 })
    }

    const dataDir = path.join(process.cwd(), 'data')
    const backupsDir = path.join(dataDir, 'backups')
    const restoreDir = path.join(dataDir, 'restore')
    ensureDir(dataDir)
    ensureDir(backupsDir)
    ensureDir(restoreDir)

    let sourcePath = ''
    if (body.tempFile) {
      sourcePath = path.join(restoreDir, path.basename(body.tempFile))
    } else if (body.backupName) {
      sourcePath = path.join(backupsDir, path.basename(body.backupName))
    } else {
      return NextResponse.json({ error: 'tempFile atau backupName wajib diisi' }, { status: 400 })
    }

    if (!fs.existsSync(sourcePath)) {
      return NextResponse.json({ error: 'File sumber tidak ditemukan' }, { status: 404 })
    }

    // Reject binary/non-SQL files
    const rawBuf = fs.readFileSync(sourcePath)
    const header = rawBuf.subarray(0, 5).toString('utf8')
    if (header === 'PGDMP') {
      return NextResponse.json({
        error: 'Format file tidak didukung. Hanya file .sql (plain text) yang dapat direstore.'
      }, { status: 400 })
    }

    const db = getDb()
    const pool = (db as any).$client
    if (!pool) {
      return NextResponse.json({ error: 'Koneksi database tidak tersedia' }, { status: 500 })
    }

    async function getIdentityCols(table: string): Promise<string[]> {
      const r = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_identity='YES'`,
        [table]
      )
      return r.rows.map((rr: any) => rr.column_name)
    }

    // Create auto-backup before restore
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    let previousBackup: string | null = null
    try {
      previousBackup = `auto-before-restore-${ts}.sql`
      const autoPath = path.join(backupsDir, previousBackup)

      const tablesRes = await pool.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`
      )
      const tables = tablesRes.rows.map((r: any) => r.table_name)
      const autoLines: string[] = []
      autoLines.push(`-- Auto-backup before restore: ${new Date().toISOString()}`)
      for (const table of tables) {
        try {
          const colRes = await pool.query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
            [table]
          )
          const columns = colRes.rows.map((r: any) => r.column_name)
          if (columns.length === 0) continue
          const identityCols = await getIdentityCols(table)
          const overriding = identityCols.length > 0 ? ' OVERRIDING SYSTEM VALUE' : ''
          const dataRes = await pool.query(`SELECT * FROM "${table}" ORDER BY 1`)
          for (const row of dataRes.rows) {
            const vals = columns.map((c: string) => {
              const v = row[c]
              if (v === null || v === undefined) return 'NULL'
              if (typeof v === 'number') return String(v)
              return `'${String(v).replace(/'/g, "''")}'`
            })
            autoLines.push(`INSERT INTO "${table}" ("${columns.join('","')}")${overriding} VALUES (${vals.join(',')});`)
          }
        } catch { continue }
      }
      fs.writeFileSync(autoPath, autoLines.join('\n'), 'utf8')
    } catch (e) {
      console.warn('Auto-backup before restore failed:', e)
      previousBackup = null
    }

    // Execute restore SQL (9 langkah)
    // 1. Sync schema ke current code structure
    // 2. Scan INSERT INTO → pastikan semua table/column referensi ada
    // 3. Drop NOT NULL sementara untuk kolom tanpa default
    // 4. Tambahkan OVERRIDING SYSTEM VALUE ke setiap INSERT
    // 5. Replace GENERATED ALWAYS → BY DEFAULT di CREATE TABLE/ALTER
    // 6. Alter existing identity ke BY DEFAULT (fallback COPY)
    // 7. Execute SQL dengan session_replication_role = replica
    // 8. Set NOT NULL kembali
    // 9. Kembalikan SEMUA identity ke GENERATED ALWAYS + sync sequence
    try {
      let sql = fs.readFileSync(sourcePath, 'utf8')

      // Auto-fix: replace JavaScript Date string format
      const monthMap: Record<string, string> = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'}
      sql = sql.replace(
        /'(\w{3}) (\d{2}) (\d{4}) (\d{2}:\d{2}:\d{2}) GMT[+-]\d{4} \([^)]+\)'/g,
        (_, mon: string, dd: string, yyyy: string, time: string) =>
          `'${yyyy}-${monthMap[mon] || '??'}-${dd} ${time}'`
      )

      // [1] Sync schema ke current code structure SEBELUM restore
      try {
        const preDiff = await checkSchema()
        if (!preDiff.ok) {
          const preSync = await syncSchema(true)
          if (preSync.tablesCreated > 0 || preSync.columnsAdded > 0) {
            console.log(`Schema sync before restore: ${preSync.tablesCreated} tables, ${preSync.columnsAdded} columns added`)
          }
        }
      } catch (e) {
        console.warn('Pre-restore schema sync warning:', e)
      }

      // [2] Scan SQL file: extract semua INSERT INTO "table" ("col1","col2",...) VALUES (...)
      //     lalu pastikan semua table & column yang direferensi sudah ada di DB
      const insertRegex = /INSERT\s+INTO\s+"([^"]+)"\s*\(([^)]+)\)/gi
      const tableColumns = new Map<string, Set<string>>()
      let match: RegExpExecArray | null
      while ((match = insertRegex.exec(sql)) !== null) {
        const tableName = match[1]
        const cols = match[2].split(',').map(c => c.trim().replace(/^"|"$/g, '')).filter(Boolean)
        if (!tableColumns.has(tableName)) {
          tableColumns.set(tableName, new Set())
        }
        for (const col of cols) {
          tableColumns.get(tableName)!.add(col)
        }
      }

      // Extract juga CREATE TABLE untuk detect table yang bakal dibuat oleh SQL itu sendiri
      const createdTables = new Set<string>()
      const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([^"\s(]+)"?/gi
      while ((match = createRegex.exec(sql)) !== null) {
        createdTables.add(match[1].replace(/"/g, ''))
      }

      // Untuk setiap (table, column) dari INSERT, pastikan sudah ada
      for (const [tableName, columns] of tableColumns) {
        // Skip table yang akan dibuat langsung oleh SQL file
        if (createdTables.has(tableName)) continue

        // Cek apakah table ada
        const tableCheck = await pool.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)`,
          [tableName]
        )
        if (!tableCheck.rows[0]?.exists) {
          await pool.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (__dummy TEXT)`)
          console.log(`Auto-created table "${tableName}" referenced in backup SQL`)
        }

        // Cek setiap column
        for (const colName of columns) {
          const colCheck = await pool.query(
            `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2)`,
            [tableName, colName]
          )
          if (!colCheck.rows[0]?.exists) {
            await pool.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${colName}" TEXT`)
            console.log(`Auto-added column "${tableName}"."${colName}" (TEXT) for restore compatibility`)
          }
        }
      }

      // [3] Drop NOT NULL sementara untuk kolom tanpa default
      const notNullCols = await pool.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema='public'
           AND is_nullable='NO'
           AND column_default IS NULL`
      )
      const notNullPairs: { table: string; column: string }[] = notNullCols.rows.map(
        (r: any) => ({ table: r.table_name, column: r.column_name })
      )
      for (const nn of notNullPairs) {
        await pool.query(`ALTER TABLE "${nn.table}" ALTER COLUMN "${nn.column}" DROP NOT NULL`)
      }

      // [4] Tambahkan OVERRIDING SYSTEM VALUE ke setiap INSERT yang belum punya
      //     (ini bypass identity column, aman untuk GENERATED ALWAYS / BY DEFAULT)
      let modifiedSql = sql.replace(
        /INSERT\s+INTO\s+("[^"]+"|\w+)\s*(\([^)]*\))(?!\s*OVERRIDING)/gi,
        'INSERT INTO $1$2 OVERRIDING SYSTEM VALUE'
      )

      // [5] Replace GENERATED ALWAYS → GENERATED BY DEFAULT untuk CREATE TABLE/ALTER TABLE ADD
      modifiedSql = modifiedSql.replace(
        /GENERATED\s+ALWAYS\s+AS\s+IDENTITY/gi,
        'GENERATED BY DEFAULT AS IDENTITY'
      )

      // [6] Alter existing identity columns ke BY DEFAULT (fallback untuk COPY, dll)
      const existingIdentity = await pool.query(
        `SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema='public' AND is_identity='YES' AND identity_generation='ALWAYS'`
      )
      const existingIdCols: { table: string; column: string }[] = existingIdentity.rows.map(
        (r: any) => ({ table: r.table_name, column: r.column_name })
      )
      const preAlters = existingIdCols.map(
        ic => `ALTER TABLE "${ic.table}" ALTER COLUMN "${ic.column}" SET GENERATED BY DEFAULT;`
      )
      if (preAlters.length > 0) {
        await pool.query(preAlters.join('\n'))
      }

      // [7] Execute modified SQL
      await pool.query(['SET session_replication_role = replica;', modifiedSql, 'SET session_replication_role = default;'].join('\n'))

      // [8] Set NOT NULL kembali
      for (const nn of notNullPairs) {
        try {
          await pool.query(`ALTER TABLE "${nn.table}" ALTER COLUMN "${nn.column}" SET NOT NULL`)
        } catch (e2) {
          console.warn(`Cannot restore NOT NULL on "${nn.table}"."${nn.column}" — possible NULL values in restored data:`, e2)
        }
      }

      // [9] Kembalikan SEMUA identity columns ke GENERATED ALWAYS + sync sequence
      const allIdentity = await pool.query(
        `SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema='public' AND is_identity='YES' AND identity_generation='BY DEFAULT'`
      )
      const allIdCols: { table: string; column: string }[] = allIdentity.rows.map(
        (r: any) => ({ table: r.table_name, column: r.column_name })
      )
      const postAlters = allIdCols.map(
        ic => `ALTER TABLE "${ic.table}" ALTER COLUMN "${ic.column}" SET GENERATED ALWAYS;`
      )
      const syncSeqs = allIdCols.map(
        ic => `SELECT setval(pg_get_serial_sequence('${ic.table}','${ic.column}'), COALESCE((SELECT max("${ic.column}") FROM "${ic.table}"), 1))`
      )
      if (postAlters.length > 0) {
        await pool.query([...postAlters, ...syncSeqs].join('\n'))
      }
    } catch (e: any) {
      return NextResponse.json({
        error: 'Gagal restore database: ' + (e?.message || e),
        previousBackup,
      }, { status: 500 })
    }

    // Auto check & sync schema SETELAH restore
    let schemaResult: { ok: boolean; tablesAdded?: number; columnsAdded?: number; syncErrors?: string[] } = { ok: true }
    try {
      const diff = await checkSchema()
      if (!diff.ok) {
        const sync = await syncSchema(true)
        schemaResult = {
          ok: sync.success && diff.missingTables.length === 0 && diff.missingColumns.length === 0,
          tablesAdded: sync.tablesCreated,
          columnsAdded: sync.columnsAdded,
          syncErrors: sync.errors.length > 0 ? sync.errors : undefined,
        }
        if (sync.tablesCreated > 0 || sync.columnsAdded > 0) {
          const recheck = await checkSchema()
          schemaResult.ok = recheck.ok
        }
      } else {
        const diff2 = await checkSchema()
        schemaResult.ok = diff2.ok
      }
    } catch (e) {
      schemaResult = { ok: false, syncErrors: ['Gagal sync schema: ' + (e as Error).message] }
    }

    return NextResponse.json({ success: true, previousBackup, schemaResult })
  } catch (e: any) {
    console.error('Restore execute error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to execute restore' }, { status: 500 })
  }
}
