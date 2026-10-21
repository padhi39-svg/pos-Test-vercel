import { existsSync, mkdirSync, unlinkSync, readdirSync, statSync, openSync, writeSync, closeSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web'
const BACKUP_DIR = resolve(process.cwd(), 'data', 'backups')
const MAX_BACKUPS = 48
const LOG_FILE = resolve(process.cwd(), 'backups/backup.log')

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const line = `[${ts}] ${msg}`
  console.log(line)
  if (existsSync(BACKUP_DIR)) {
    try {
      const fd = openSync(LOG_FILE, 'a')
      writeSync(fd, line + '\n')
      closeSync(fd)
    } catch {}
  }
}

function escapeVal(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (v instanceof Date) return `'${v.toISOString()}'`
  return `'${String(v).replace(/'/g, "''")}'`
}

function cleanupBackups() {
  if (!existsSync(BACKUP_DIR)) return
  const allFiles = readdirSync(BACKUP_DIR)
  const sqlFiles = allFiles
    .filter(f => f.startsWith('pos-web-') && f.endsWith('.sql'))
    .map(f => ({ name: f, path: join(BACKUP_DIR, f), time: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time)
  if (sqlFiles.length <= MAX_BACKUPS) return
  for (const f of sqlFiles.slice(MAX_BACKUPS)) {
    try { unlinkSync(f.path); log(`Backup lama dihapus: ${f.name}`) }
    catch (e) { log(`Gagal hapus ${f.name}: ${e.message}`) }
  }
}

async function backup() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
    console.log(`Folder backup dibuat: ${BACKUP_DIR}`)
  }

  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    log('Memulai backup PostgreSQL...')

    const tablesRes = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    )
    const tables = tablesRes.rows.map(r => r.table_name)
    log(`Ditemukan ${tables.length} tabel`)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupPath = join(BACKUP_DIR, `pos-web-${timestamp}.sql`)
    const lines = []
    lines.push(`-- POS Web PostgreSQL Backup`)
    lines.push(`-- Generated: ${new Date().toISOString()}`)
    lines.push(`-- Tables: ${tables.length}`)
    lines.push('')

    let totalRows = 0
    for (const table of tables) {
      try {
        const colRes = await pool.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          [table]
        )
        const columns = colRes.rows.map(r => r.column_name)
        if (columns.length === 0) continue

        lines.push(`-- Table: ${table}`)
        lines.push(`DELETE FROM "${table}";`)

        const identityRes = await pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_identity='YES'`,
          [table]
        )
        const hasIdentity = identityRes.rows.length > 0
        const overriding = hasIdentity ? ' OVERRIDING SYSTEM VALUE' : ''

        const dataRes = await pool.query(`SELECT * FROM "${table}" ORDER BY 1`)
        if (dataRes.rows.length > 0) {
          const quoteCols = columns.map(c => `"${c}"`).join(',')
          for (const row of dataRes.rows) {
            const vals = columns.map(c => escapeVal(row[c])).join(',')
            lines.push(`INSERT INTO "${table}" (${quoteCols})${overriding} VALUES (${vals});`)
          }
        }
        totalRows += dataRes.rows.length
        log(`  ${table}: ${dataRes.rows.length} baris`)
      } catch (e) {
        log(`  ${table}: GAGAL - ${e.message}`)
      }
    }

    writeFileSync(backupPath, lines.join('\n'), 'utf8')
    const sizeMB = (statSync(backupPath).size / 1024 / 1024).toFixed(2)
    log(`Backup selesai: ${backupPath} (${sizeMB} MB, ${totalRows} baris)`)

    cleanupBackups()
    log('Backup selesai dengan sukses')
  } catch (e) {
    log(`ERROR: ${e.message}`)
    console.error(e)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

backup()
