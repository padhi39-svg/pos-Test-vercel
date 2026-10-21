const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const args = process.argv.slice(2)
const wantFix = args.includes('--fix')
const wantBackup = args.includes('--backup')

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(process.cwd(), 'data', 'resto-system.db')

const exists = fs.existsSync(dbPath)
if (!exists) {
  console.error('❌ DB file tidak ditemukan:', dbPath)
  process.exit(1)
}

if (wantBackup) {
  const dir = path.dirname(dbPath)
  const base = path.basename(dbPath)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  const backupPath = path.join(dir, `${base}.bak.${stamp}`)
  fs.copyFileSync(dbPath, backupPath)
  console.log('✅ Backup dibuat:', backupPath)
}

const db = new Database(dbPath)

db.pragma('foreign_keys = ON')

const tableExists = (name) => {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(name)
  return !!row
}

const getCols = (table) => {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all()
    return new Set(rows.map(r => String(r.name)))
  } catch {
    return new Set()
  }
}

const createTable = (name, sql) => {
  if (tableExists(name)) return { created: false }
  if (!wantFix) return { created: false, missing: true }
  db.exec(sql)
  return { created: true }
}

const ensureColumn = (table, col, alterSql) => {
  const cols = getCols(table)
  if (cols.has(col)) return { added: false }
  if (!wantFix) return { added: false, missing: true }
  db.exec(alterSql)
  return { added: true }
}

const report = {
  dbPath,
  mode: wantFix ? 'fix' : 'check',
  missingTables: [],
  missingColumns: [],
  createdTables: [],
  addedColumns: [],
}

// Minimal schema yang paling sering dipakai untuk mencegah error runtime
// (ini bukan full schema aplikasi, tapi fokus pada tabel/kolom kritikal transaksi & modul baru)
const expectedTables = [
  {
    name: 'transactions',
    createSql: `
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_number TEXT UNIQUE NOT NULL,
        customer_id INTEGER,
        customer_name TEXT,
        customer_code TEXT,
        subtotal REAL NOT NULL DEFAULT 0,
        discount_percent REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        service_charge_percent REAL DEFAULT 0,
        service_charge_amount REAL DEFAULT 0,
        ppn_percent REAL DEFAULT 0,
        ppn_amount REAL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        payment_amount REAL,
        change_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'completed',
        tgl_nota TEXT,
        transaction_type INTEGER DEFAULT 1,
        period_id INTEGER,
        warehouse_id INTEGER DEFAULT 1,
        table_id INTEGER,
        due_date TEXT,
        payment_terms TEXT,
        notes TEXT,
        price_include_tax INTEGER DEFAULT 0,
        tax_rate_percent REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `,
    requiredColumns: [
      // core
      'transaction_number','subtotal','discount_amount','ppn_amount','total','status','created_at','updated_at',
      // service charge (POS)
      'service_charge_percent','service_charge_amount',
      // tanggal nota
      'tgl_nota',
      // compat
      'transaction_type','period_id','warehouse_id','table_id',
    ],
    addColumnSql: {
      tgl_nota: `ALTER TABLE transactions ADD COLUMN tgl_nota TEXT`,
      discount_percent: `ALTER TABLE transactions ADD COLUMN discount_percent REAL DEFAULT 0`,
      discount_amount: `ALTER TABLE transactions ADD COLUMN discount_amount REAL DEFAULT 0`,
      service_charge_percent: `ALTER TABLE transactions ADD COLUMN service_charge_percent REAL NOT NULL DEFAULT 0`,
      service_charge_amount: `ALTER TABLE transactions ADD COLUMN service_charge_amount REAL NOT NULL DEFAULT 0`,
      ppn_percent: `ALTER TABLE transactions ADD COLUMN ppn_percent REAL NOT NULL DEFAULT 0`,
      ppn_amount: `ALTER TABLE transactions ADD COLUMN ppn_amount REAL NOT NULL DEFAULT 0`,
      transaction_type: `ALTER TABLE transactions ADD COLUMN transaction_type INTEGER NOT NULL DEFAULT 1`,
      period_id: `ALTER TABLE transactions ADD COLUMN period_id INTEGER`,
      warehouse_id: `ALTER TABLE transactions ADD COLUMN warehouse_id INTEGER NOT NULL DEFAULT 1`,
      table_id: `ALTER TABLE transactions ADD COLUMN table_id INTEGER`,
      due_date: `ALTER TABLE transactions ADD COLUMN due_date TEXT`,
      payment_terms: `ALTER TABLE transactions ADD COLUMN payment_terms TEXT`,
      notes: `ALTER TABLE transactions ADD COLUMN notes TEXT`,
      price_include_tax: `ALTER TABLE transactions ADD COLUMN price_include_tax INTEGER NOT NULL DEFAULT 0`,
      tax_rate_percent: `ALTER TABLE transactions ADD COLUMN tax_rate_percent REAL NOT NULL DEFAULT 0`,
    }
  },
  {
    name: 'transaction_items',
    createSql: `
      CREATE TABLE IF NOT EXISTS transaction_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        barang_id INTEGER,
        barang_code TEXT,
        barang_name TEXT,
        quantity REAL DEFAULT 0,
        unit_name TEXT DEFAULT 'PCS',
        unit_ratio REAL DEFAULT 1,
        unit_price REAL DEFAULT 0,
        discount_percent REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        discon_total REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        modifier TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `,
    requiredColumns: ['transaction_id','quantity','unit_price','discon_total','total_price'],
    addColumnSql: {
      unit_name: `ALTER TABLE transaction_items ADD COLUMN unit_name TEXT DEFAULT 'PCS'`,
      unit_ratio: `ALTER TABLE transaction_items ADD COLUMN unit_ratio REAL DEFAULT 1`,
      unit_price: `ALTER TABLE transaction_items ADD COLUMN unit_price REAL DEFAULT 0`,
      discount_percent: `ALTER TABLE transaction_items ADD COLUMN discount_percent REAL DEFAULT 0`,
      discount_amount: `ALTER TABLE transaction_items ADD COLUMN discount_amount REAL DEFAULT 0`,
      discon_total: `ALTER TABLE transaction_items ADD COLUMN discon_total REAL DEFAULT 0`,
      total_price: `ALTER TABLE transaction_items ADD COLUMN total_price REAL DEFAULT 0`,
      modifier: `ALTER TABLE transaction_items ADD COLUMN modifier TEXT`,
    }
  },
  {
    name: 'transaction_payments',
    createSql: `
      CREATE TABLE IF NOT EXISTS transaction_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        method TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        bank_id INTEGER,
        card_number TEXT,
        notes TEXT,
        change_amount REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `,
    requiredColumns: ['transaction_id','method','amount'],
    addColumnSql: {
      change_amount: `ALTER TABLE transaction_payments ADD COLUMN change_amount REAL DEFAULT 0`,
    }
  },
  // Modul keuangan yang baru
  {
    name: 'ar_opening_balances',
    createSql: `
      CREATE TABLE IF NOT EXISTS ar_opening_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kode_nota TEXT UNIQUE NOT NULL,
        tanggal TEXT NOT NULL,
        customer_id INTEGER,
        customer_code TEXT,
        customer_name TEXT,
        nominal REAL DEFAULT 0,
        period_id INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `,
    requiredColumns: ['kode_nota','tanggal','nominal','period_id','status'],
    addColumnSql: {}
  },
  {
    name: 'ap_opening_balances',
    createSql: `
      CREATE TABLE IF NOT EXISTS ap_opening_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kode_nota TEXT UNIQUE NOT NULL,
        tanggal TEXT NOT NULL,
        supplier_id INTEGER,
        supplier_code TEXT,
        supplier_name TEXT,
        nominal REAL DEFAULT 0,
        period_id INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `,
    requiredColumns: ['kode_nota','tanggal','nominal','period_id','status'],
    addColumnSql: {}
  },
  {
    name: 'ar_advances',
    createSql: `
      CREATE TABLE IF NOT EXISTS ar_advances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kode_nota TEXT UNIQUE NOT NULL,
        tanggal TEXT NOT NULL,
        customer_id INTEGER,
        customer_code TEXT,
        customer_name TEXT,
        notes TEXT,
        total REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `,
    requiredColumns: ['kode_nota','tanggal','total','status'],
    addColumnSql: {}
  },
  {
    name: 'ar_advance_lines',
    createSql: `
      CREATE TABLE IF NOT EXISTS ar_advance_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        advance_id INTEGER NOT NULL,
        account_id INTEGER,
        account_code TEXT,
        account_name TEXT,
        notes TEXT,
        nominal REAL DEFAULT 0
      );
    `,
    requiredColumns: ['advance_id','nominal'],
    addColumnSql: {}
  },
  {
    name: 'ap_advances',
    createSql: `
      CREATE TABLE IF NOT EXISTS ap_advances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kode_nota TEXT UNIQUE NOT NULL,
        tanggal TEXT NOT NULL,
        supplier_id INTEGER,
        supplier_code TEXT,
        supplier_name TEXT,
        notes TEXT,
        total REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `,
    requiredColumns: ['kode_nota','tanggal','total','status'],
    addColumnSql: {}
  },
  {
    name: 'ap_advance_lines',
    createSql: `
      CREATE TABLE IF NOT EXISTS ap_advance_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        advance_id INTEGER NOT NULL,
        account_id INTEGER,
        account_code TEXT,
        account_name TEXT,
        notes TEXT,
        nominal REAL DEFAULT 0
      );
    `,
    requiredColumns: ['advance_id','nominal'],
    addColumnSql: {}
  },
]

try {
  for (const t of expectedTables) {
    const res = createTable(t.name, t.createSql)
    if (res.missing) report.missingTables.push(t.name)
    if (res.created) report.createdTables.push(t.name)

    // Ensure columns
    if (tableExists(t.name)) {
      const colsNow = getCols(t.name)
      for (const col of (t.requiredColumns || [])) {
        if (!colsNow.has(col)) {
          report.missingColumns.push({ table: t.name, column: col })
          const alter = t.addColumnSql && t.addColumnSql[col]
          if (alter) {
            const r2 = ensureColumn(t.name, col, alter)
            if (r2.added) report.addedColumns.push({ table: t.name, column: col })
          }
        }
      }
    }
  }

  console.log('\n=== DB Schema Audit Report ===')
  console.log('DB:', report.dbPath)
  console.log('Mode:', report.mode)
  console.log('Missing tables:', report.missingTables.length)
  if (report.missingTables.length) console.table(report.missingTables)
  console.log('Missing columns:', report.missingColumns.length)
  if (report.missingColumns.length) console.table(report.missingColumns)
  if (wantFix) {
    console.log('Created tables:', report.createdTables.length)
    if (report.createdTables.length) console.table(report.createdTables)
    console.log('Added columns:', report.addedColumns.length)
    if (report.addedColumns.length) console.table(report.addedColumns)
  }

  // Exit codes: 0 = OK, 2 = missing found
  const hasMissing = report.missingTables.length > 0 || report.missingColumns.length > 0
  process.exit(hasMissing ? 2 : 0)
} catch (e) {
  console.error('❌ Audit error:', e && e.message ? e.message : e)
  process.exit(1)
} finally {
  try { db.close() } catch {}
}
