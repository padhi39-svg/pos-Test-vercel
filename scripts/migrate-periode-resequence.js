// Resequence master_periode IDs chronologically and insert missing periods
// Desired: Jan 2023 -> Sep 2025 in order, then Oct 2025, Nov 2025, Dec 2025 (existing)
// Code format: YYYYMM e.g. 202301
// Safe migration: rebuild master_periode and remap FK references

const path = require('path')
const Database = require('better-sqlite3')

function monthNameID(n) {
  const arr = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  return arr[n-1]
}

function endOfMonth(yyyy, mm) {
  const d = new Date(yyyy, mm, 0) // day 0 of next month yields end of current
  const m = String(d.getMonth()+1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function startOfMonth(yyyy, mm) {
  return `${yyyy}-${String(mm).padStart(2, '0')}-01`
}

function buildCodes(fromY, fromM, toY, toM) {
  const list = []
  let y = fromY, m = fromM
  while (y < toY || (y === toY && m <= toM)) {
    list.push(`${y}${String(m).padStart(2, '0')}`)
    m++
    if (m === 13) { m = 1; y++ }
  }
  return list
}

function main() {
  const dbPath = path.resolve(process.cwd(), 'data/resto-system.db')
  const db = new Database(dbPath)
  try {
    db.pragma('journal_mode = WAL')
    db.pragma('busy_timeout = 5000')
    // Turn OFF FKs only during the migration window
    db.pragma('foreign_keys = OFF')

    const hasStatusBuku = (() => {
      try {
        const cols = db.prepare("PRAGMA table_info('master_periode')").all()
        return cols.some(c => String(c.name).toLowerCase() === 'status_buku')
      } catch { return false }
    })()

    const existing = db.prepare('SELECT id, code, name, start_date, end_date, is_active, '+(hasStatusBuku? 'status_buku':'\'OPEN\' AS status_buku')+' FROM master_periode').all()
    const byCode = new Map(existing.map(r => [String(r.code), r]))

    const desiredFirst = buildCodes(2023,1,2025,9) // Jan 2023 .. Sep 2025
    const tail = ['202510','202511','202512'] // Oct..Dec 2025
    const desired = [...desiredFirst, ...tail]

    db.transaction(() => {
      // Create new table with same schema (include status_buku if present)
      db.exec(`
        CREATE TABLE IF NOT EXISTS master_periode_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          is_active BOOLEAN DEFAULT FALSE,
          isdelete BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP${hasStatusBuku ? ',\n          status_buku TEXT DEFAULT \"OPEN\"' : ''}
        );
      `)

      const ins = db.prepare(`INSERT INTO master_periode_new (code, name, start_date, end_date, is_active${hasStatusBuku?', status_buku':''}) VALUES (?, ?, ?, ?, ?${hasStatusBuku?', ?':''})`)

      for (const code of desired) {
        const y = Number(code.slice(0,4))
        const m = Number(code.slice(4,6))
        const name = `${monthNameID(m)} ${y}`
        const sod = startOfMonth(y, m)
        const eom = endOfMonth(y, m)
        const ex = byCode.get(code)
        const isActive = ex ? Number(ex.is_active) ? 1 : 0 : 0
        const statusBuku = ex ? (ex.status_buku || 'OPEN') : 'OPEN'
        if (hasStatusBuku) ins.run(code, name, sod, eom, isActive, statusBuku)
        else ins.run(code, name, sod, eom, isActive)
      }

      // Build old->new id mapping by code
      const newRows = db.prepare('SELECT id, code FROM master_periode_new').all()
      const newByCode = new Map(newRows.map(r => [String(r.code), r.id]))
      const mapping = [] // {old_id, new_id}
      for (const r of existing) {
        const newId = newByCode.get(String(r.code))
        if (newId) mapping.push({ old_id: r.id, new_id: newId })
      }

      // Update referencing tables
      const hasSnapshots = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_period_snapshots'").get()
      if (hasSnapshots) {
        const upd = db.prepare('UPDATE stock_period_snapshots SET periode_id = ? WHERE periode_id = ?')
        for (const m of mapping) upd.run(m.new_id, m.old_id)
      }
      const hasSmCol = (() => { try { db.prepare('SELECT period_id FROM stock_movements LIMIT 1').get(); return true } catch { return false } })()
      if (hasSmCol) {
        const upd = db.prepare('UPDATE stock_movements SET period_id = ? WHERE period_id = ?')
        for (const m of mapping) upd.run(m.new_id, m.old_id)
      }
      const hasTxCol = (() => { try { db.prepare('SELECT period_id FROM transactions LIMIT 1').get(); return true } catch { return false } })()
      if (hasTxCol) {
        const upd = db.prepare('UPDATE transactions SET period_id = ? WHERE period_id = ?')
        for (const m of mapping) upd.run(m.new_id, m.old_id)
      }

      // Drop dependent views (if any) before swapping
      try { db.prepare('DROP VIEW IF EXISTS v_stock_movements_detail').run() } catch {}

      // Swap tables
      db.exec('DROP TABLE master_periode')
      db.exec('ALTER TABLE master_periode_new RENAME TO master_periode')

      // Recreate indexes
      db.exec('CREATE INDEX IF NOT EXISTS idx_master_periode_code ON master_periode(code)')
      if (hasStatusBuku) db.exec('CREATE INDEX IF NOT EXISTS idx_master_periode_status_buku ON master_periode(status_buku)')

      // Recreate dependent view
      try {
        db.prepare(`
          CREATE VIEW v_stock_movements_detail AS
          SELECT 
            sm.id,
            sm.ingredient_id,
            b.code as ingredient_code,
            b.name as ingredient_name,
            sm.warehouse_id,
            g.name as warehouse_name,
            sm.movement_type,
            sm.quantity,
            sm.unit,
            sm.reference_type,
            sm.reference_id,
            sm.period_id,
            p.name as period_name,
            sm.transaction_date,
            sm.notes,
            sm.created_at
          FROM stock_movements sm
          JOIN master_barang b ON sm.ingredient_id = b.id
          LEFT JOIN master_gudang g ON sm.warehouse_id = g.id
          LEFT JOIN master_periode p ON sm.period_id = p.id
          WHERE b.isdelete = 0
        `).run()
      } catch {}
    })()

    // Turn FKs back on
    db.pragma('foreign_keys = ON')
    console.log('Resequence master_periode completed successfully.')
  } catch (e) {
    console.error('Migration failed:', e)
    process.exitCode = 1
  } finally {
    try { db.close() } catch {}
  }
}

if (require.main === module) main()
