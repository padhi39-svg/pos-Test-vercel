import { existsSync, copyFileSync, unlinkSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { createInterface } from 'readline'
import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web'
const BACKUP_DIRS = [resolve(process.cwd(), 'data', 'backups'), resolve(process.cwd(), 'backups')]

const args = process.argv.slice(2)
const forceFlag = args.includes('--force')
const listOnly = args.includes('--list')

const BOLD = '\x1b[1m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const RESET = '\x1b[0m'

function info(msg) { console.log(`  ${msg}`) }
function ok(msg)   { console.log(`  ${GREEN}${msg}${RESET}`) }
function warn(msg) { console.log(`  ${YELLOW}${msg}${RESET}`) }
function fail(msg) { console.log(`  ${RED}${msg}${RESET}`) }

function prompt(query) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(query, a => { rl.close(); resolve(a.trim()) }))
}

function listBackups() {
  const files = []
  for (const dir of BACKUP_DIRS) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.sql') && !f.startsWith('pre-restore-') && !f.startsWith('auto-before-restore-')) {
        const fp = join(dir, f)
        files.push({ name: f, path: fp, time: statSync(fp).mtimeMs, dir })
      }
    }
  }
  return files.sort((a, b) => b.time - a.time)
}

function formatDate(ms) {
  const d = new Date(ms)
  return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
}

function fmtSize(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

async function selectBackup() {
  const files = listBackups()
  if (files.length === 0) {
      console.log(`\n${RED}Tidak ada backup ditemukan di: ${BACKUP_DIRS.join(', ')}${RESET}`)
    process.exit(1)
  }

  console.log(`\n${BOLD}Pilih file backup:${RESET}\n`)
  files.forEach((f, i) => {
    const label = i === 0 ? ' (terbaru)' : ''
    console.log(`  ${i + 1}. ${f.name}  ${fmtSize(statSync(f.path).size)}  ${formatDate(f.time)}${label}`)
  })
  console.log(`  0. Batal\n`)

  const answer = await prompt(`  Pilih nomor [1-${files.length}]: `)
  const idx = parseInt(answer, 10)
  if (!answer || idx === 0) { console.log('  Dibatalkan.'); process.exit(0) }
  if (isNaN(idx) || idx < 1 || idx > files.length) {
    console.log(`\n${RED}Pilihan tidak valid${RESET}`)
    process.exit(1)
  }
  return files[idx - 1]
}

async function verifyRestore(pool) {
  info('Memverifikasi database hasil restore...')
  try {
    const tablesRes = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    )
    const tables = tablesRes.rows.map(r => r.table_name)
    let totalRows = 0
    for (const table of tables) {
      try {
        const r = await pool.query(`SELECT COUNT(*) as c FROM "${table}"`)
        totalRows += parseInt(r.rows[0].c, 10)
      } catch {}
    }
    ok(`Database hasil restore OK: ${tables.length} tabel, ${totalRows} baris`)
    return true
  } catch (e) {
    fail(`Gagal verifikasi database: ${e.message}`)
    return false
  }
}

async function main() {
  const argPath = args.find(a => !a.startsWith('--'))

  if (listOnly) {
    const files = listBackups()
    if (files.length === 0) {
      console.log('Tidak ada backup.')
    } else {
      console.log(`\n${BOLD}Backup tersedia:${RESET}\n`)
      files.forEach((f, i) => {
        const size = fmtSize(statSync(f.path).size)
        console.log(`  ${i + 1}. ${f.name}  ${size}  ${formatDate(f.time)}`)
      })
    }
    process.exit(0)
  }

  const selected = argPath
    ? { name: argPath.replace(/^.*[/\\]/, ''), path: resolve(argPath) }
    : await selectBackup()

  console.log(`\n  ${BOLD}Backup:${RESET} ${selected.name}`)
  console.log(`  ${BOLD}Database:${RESET} ${DATABASE_URL.replace(/\/\/.*@/, '//user:pass@')}`)

  if (!existsSync(selected.path)) {
    fail(`File tidak ditemukan: ${selected.path}`)
    process.exit(1)
  }

  // Parse & validate SQL backup
  info('Memeriksa file backup...')
  const sql = readFileSync(selected.path, 'utf8')
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'))
  const insertTables = [...new Set(
    statements.filter(s => s.toUpperCase().startsWith('INSERT INTO'))
      .map(s => { const m = s.match(/INSERT\s+INTO\s+"?(\w+)"?\s/i); return m ? m[1] : null })
      .filter(Boolean)
  )]
  info(`Ditemukan ${insertTables.length} tabel dengan data dalam backup`)

  if (!forceFlag) {
    const ok2 = await prompt(`  Yakin akan merestore ${selected.name}? Semua data saat ini akan diganti. (y/n): `)
    if (ok2.toLowerCase() !== 'y' && ok2.toLowerCase() !== 'yes') {
      fail('Restore dibatalkan.')
      process.exit(0)
    }
  }

  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    // Auto-backup current data
    info('Membuat auto-backup data saat ini...')
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const preRestorePath = join(BACKUP_DIRS[0], `pre-restore-${ts}.sql`)
    const autoLines = []
    autoLines.push(`-- Pre-restore auto-backup: ${new Date().toISOString()}`)

    const tablesRes = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    )
    const allTables = tablesRes.rows.map(r => r.table_name)
    for (const table of allTables) {
      try {
        const colRes = await pool.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          [table]
        )
        const columns = colRes.rows.map(r => r.column_name)
        if (columns.length === 0) continue
        const identityRes = await pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_identity='YES'`,
          [table]
        )
        const overriding = identityRes.rows.length > 0 ? ' OVERRIDING SYSTEM VALUE' : ''
        const dataRes = await pool.query(`SELECT * FROM "${table}" ORDER BY 1`)
        if (dataRes.rows.length === 0) continue
        for (const row of dataRes.rows) {
          const vals = columns.map(c => {
            const v = row[c]
            if (v === null || v === undefined) return 'NULL'
            if (typeof v === 'number') return String(v)
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
            if (v instanceof Date) return `'${v.toISOString()}'`
            return `'${String(v).replace(/'/g, "''")}'`
          })
          autoLines.push(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(',')})${overriding} VALUES (${vals.join(',')});`)
        }
      } catch {}
    }
    writeFileSync(preRestorePath, autoLines.join('\n'), 'utf8')
    ok(`Auto-backup disimpan: ${preRestorePath}`)

    // Execute restore
    info('Merestore database...')
    await pool.query('BEGIN')

    // Disable triggers
    for (const table of allTables) {
      try { await pool.query(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`) } catch {}
    }

    try {
      // Clear existing data
      for (const table of allTables) {
        try { await pool.query(`DELETE FROM "${table}"`) } catch {}
      }

      // Execute restore statements
      let executed = 0
      for (const stmt of statements) {
        try {
          await pool.query(stmt)
          executed++
        } catch (e) {
          warn(`Statement skipped: ${stmt.slice(0, 80)}... Error: ${e.message}`)
        }
      }
      info(`${executed} statement berhasil dieksekusi`)
    } finally {
      for (const table of allTables) {
        try { await pool.query(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`) } catch {}
      }
    }

    await pool.query('COMMIT')
    ok('Database berhasil direstore')

    await verifyRestore(pool)
  } catch (e) {
    try { await pool.query('ROLLBACK') } catch {}
    fail(`Restore gagal: ${e.message}`)
    console.error(e)
    process.exit(1)
  } finally {
    await pool.end()
  }

  console.log(`\n${GREEN}${BOLD}✔ Restore selesai!${RESET}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})


