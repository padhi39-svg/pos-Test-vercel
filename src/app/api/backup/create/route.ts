import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'

function escapeVal(val: any): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  const s = String(val).replace(/'/g, "''")
  return `'${s}'`
}

function formatInsert(table: string, columns: string[], row: any, overriding: string): string {
  const vals = columns.map(c => escapeVal(row[c]))
  return `INSERT INTO "${table}" ("${columns.join('","')}")${overriding} VALUES (${vals.join(',')});`
}

async function getIdentityCols(pool: any, table: string): Promise<string[]> {
  const r = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_identity='YES'`,
    [table]
  )
  return r.rows.map((rr: any) => rr.column_name)
}

export async function POST(req: Request) {
  try {
    if (process.env.VERCEL) {
      return NextResponse.json({ error: 'Backup lokal tidak tersedia di Vercel. Gunakan pg_dump dari server.' }, { status: 503 })
    }
    if (!hasPermission(req as any, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat backup' }, { status: 403 })
    }

    const dataDir = path.join(process.cwd(), 'data')
    const backupsDir = path.join(dataDir, 'backups')
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupName = `backup-${timestamp}.sql`
    const destPath = path.join(backupsDir, backupName)

    const db = getDb()
    const pool = (db as any).$client
    if (!pool) {
      return NextResponse.json({ error: 'Koneksi database tidak tersedia' }, { status: 500 })
    }

    const lines: string[] = []
    lines.push('-- ========================================')
    lines.push(`-- Backup: ${new Date().toISOString()}`)
    lines.push('-- ========================================')
    lines.push('')

    // Get all user tables ordered by dependency (tables without FK first)
    const tablesRes = await pool.query(`
      SELECT t.table_name,
        COALESCE(
          (SELECT COUNT(*) FROM information_schema.table_constraints tc
           JOIN information_schema.constraint_column_usage ccu
             ON tc.constraint_name = ccu.constraint_name
           WHERE tc.table_schema = 'public'
             AND tc.table_name = t.table_name
             AND tc.constraint_type = 'FOREIGN KEY'),
          0
        ) AS fk_count
      FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY fk_count ASC, t.table_name ASC
    `)
    const tables = tablesRes.rows.map((r: any) => r.table_name)

    // Collect column info for all tables upfront
    const tableCols: Record<string, string[]> = {}
    for (const table of tables) {
      if (table.startsWith('_')) continue
      try {
        const colRes = await pool.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
          [table]
        )
        tableCols[table] = colRes.rows.map((r: any) => r.column_name)
      } catch { }
    }

    for (const table of tables) {
      const columns = tableCols[table]
      if (!columns || columns.length === 0) continue

      try {
        // DELETE existing data
        lines.push(`DELETE FROM "${table}";`)

        // Export data
        const identityCols = await getIdentityCols(pool, table)
        const overriding = identityCols.length > 0 ? ' OVERRIDING SYSTEM VALUE' : ''
        const dataRes = await pool.query(`SELECT * FROM "${table}" ORDER BY 1`)
        for (const row of dataRes.rows) {
          lines.push(formatInsert(table, columns, row, overriding))
        }
      } catch (e) {
        console.warn(`[Backup] Skipping data for table ${table}:`, e)
      }
    }

    // Reset all sequences at the end
    lines.push('')
    try {
      const seqRes = await pool.query(`
        SELECT sequence_name FROM information_schema.sequences
        WHERE sequence_schema = 'public'
      `)
      for (const seq of seqRes.rows) {
        try {
          lines.push(`SELECT setval('"${seq.sequence_name}"', COALESCE((SELECT MAX(substr(sequence_name, 1, 1)::int) FROM information_schema.sequences WHERE 1=0), 1), false);`)
        } catch {}
      }

      // Better: reset sequences based on actual table data
      const seqColsRes = await pool.query(`
        SELECT sequence_name,
               table_name,
               column_name
        FROM information_schema.columns c
        JOIN information_schema.sequences s
          ON pg_get_serial_sequence('"' || c.table_name || '"', c.column_name) = '"' || s.sequence_schema || '"."' || s.sequence_name || '"'
        WHERE c.table_schema = 'public'
      `)
      for (const row of seqColsRes.rows) {
        lines.push(`SELECT setval('"${row.sequence_name}"', COALESCE((SELECT MAX("${row.column_name}") FROM "${row.table_name}"), 1), true);`)
      }
    } catch (e) {
      console.warn('[Backup] Error resetting sequences:', e)
    }

    lines.push('')
    lines.push('-- Backup complete')

    fs.writeFileSync(destPath, lines.join('\n'), 'utf8')

    if (!fs.existsSync(destPath)) {
      return NextResponse.json({ error: 'File backup gagal disimpan' }, { status: 500 })
    }

    const backupSize = fs.statSync(destPath).size

    return NextResponse.json({
      success: true,
      file: backupName,
      size: backupSize,
      createdAt: new Date().toISOString(),
    })
  } catch (e: any) {
    console.error('Backup create error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to create backup' }, { status: 500 })
  }
}
