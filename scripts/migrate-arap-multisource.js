const Database = require('better-sqlite3');
const path = require('path');

function ensureTable(db, createSql) {
  db.exec(createSql);
}

function ensureColumns(db, table, columns) {
  const cols = db.prepare(`PRAGMA table_info('${table}')`).all();
  const has = (n) => cols.some(c => String(c.name).toLowerCase() === String(n).toLowerCase());
  for (const col of columns) {
    if (!has(col.name)) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col.def}`).run();
    }
  }
}

function migrate() {
  const dbPath = path.resolve(process.cwd(), 'data', 'resto-system.db');
  console.log('Using DB:', dbPath);
  const db = new Database(dbPath);
  try {
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');

    // AR payments core
    ensureTable(db, `
      CREATE TABLE IF NOT EXISTS ar_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_number TEXT UNIQUE NOT NULL,
        payment_date TEXT NOT NULL,
        customer_id INTEGER NOT NULL,
        customer_name TEXT,
        period_id INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        subtotal REAL DEFAULT 0,
        total REAL DEFAULT 0,
        notes TEXT,
        user_create INTEGER,
        user_update INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ar_payments_customer ON ar_payments(customer_id);
      CREATE INDEX IF NOT EXISTS idx_ar_payments_period ON ar_payments(period_id);
    `);

    ensureTable(db, `
      CREATE TABLE IF NOT EXISTS ar_payment_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        sale_id INTEGER NOT NULL,
        invoice_number TEXT,
        due_amount REAL DEFAULT 0,
        pay_amount REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (payment_id) REFERENCES ar_payments(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ar_payment_items_payment ON ar_payment_items(payment_id);
      CREATE INDEX IF NOT EXISTS idx_ar_payment_items_sale ON ar_payment_items(sale_id);
    `);

    // Ensure multi-source columns on AR items
    ensureColumns(db, 'ar_payment_items', [
      { name: 'source_type', def: 'source_type TEXT' },
      { name: 'source_id', def: 'source_id INTEGER DEFAULT 0' },
    ]);

    ensureTable(db, `
      CREATE TABLE IF NOT EXISTS ar_payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        account_code TEXT,
        account_name TEXT,
        amount REAL DEFAULT 0,
        notes TEXT,
        FOREIGN KEY (payment_id) REFERENCES ar_payments(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ar_payment_methods_payment ON ar_payment_methods(payment_id);
    `);

    ensureTable(db, `
      CREATE TABLE IF NOT EXISTS ar_payment_extras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        account_code TEXT,
        account_name TEXT,
        notes TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        FOREIGN KEY (payment_id) REFERENCES ar_payments(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ar_payment_extras_payment ON ar_payment_extras(payment_id);
    `);

    // AP payments core
    ensureTable(db, `
      CREATE TABLE IF NOT EXISTS ap_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_number TEXT UNIQUE,
        payment_date TEXT,
        supplier_id INTEGER NOT NULL,
        period_id INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        subtotal REAL DEFAULT 0,
        total REAL DEFAULT 0,
        notes TEXT,
        user_create INTEGER,
        user_update INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ap_payments_supplier ON ap_payments(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_ap_payments_period ON ap_payments(period_id);
    `);

    ensureTable(db, `
      CREATE TABLE IF NOT EXISTS ap_payment_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        purchase_id INTEGER NOT NULL,
        invoice_number TEXT,
        due_amount REAL DEFAULT 0,
        pay_amount REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (payment_id) REFERENCES ap_payments(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ap_payment_items_payment ON ap_payment_items(payment_id);
      CREATE INDEX IF NOT EXISTS idx_ap_payment_items_purchase ON ap_payment_items(purchase_id);
    `);

    // Ensure multi-source columns on AP items
    ensureColumns(db, 'ap_payment_items', [
      { name: 'source_type', def: 'source_type TEXT' },
      { name: 'source_id', def: 'source_id INTEGER DEFAULT 0' },
    ]);

    ensureTable(db, `
      CREATE TABLE IF NOT EXISTS ap_payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        notes TEXT,
        FOREIGN KEY (payment_id) REFERENCES ap_payments(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ap_payment_methods_payment ON ap_payment_methods(payment_id);
    `);

    ensureTable(db, `
      CREATE TABLE IF NOT EXISTS ap_payment_extras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        notes TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        FOREIGN KEY (payment_id) REFERENCES ap_payments(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ap_payment_extras_payment ON ap_payment_extras(payment_id);
    `);

    // Opening balance tables were created in existing migrations; ensure presence just in case
    ensureTable(db, `
      CREATE TABLE IF NOT EXISTS ar_opening_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kode_nota TEXT NOT NULL UNIQUE,
        tanggal TEXT NOT NULL,
        customer_id INTEGER NOT NULL,
        nominal INTEGER NOT NULL DEFAULT 0,
        period_id INTEGER NOT NULL DEFAULT 1,
        catatan TEXT,
        status TEXT DEFAULT 'posted',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      );
    `);

    ensureTable(db, `
      CREATE TABLE IF NOT EXISTS ap_opening_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kode_nota TEXT NOT NULL UNIQUE,
        tanggal TEXT NOT NULL,
        supplier_id INTEGER NOT NULL,
        nominal INTEGER NOT NULL DEFAULT 0,
        period_id INTEGER NOT NULL DEFAULT 1,
        catatan TEXT,
        status TEXT DEFAULT 'posted',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      );
    `);

    // Helpful indexes for openings
    ensureTable(db, `
      CREATE INDEX IF NOT EXISTS idx_ar_opening_customer ON ar_opening_balances(customer_id);
      CREATE INDEX IF NOT EXISTS idx_ap_opening_supplier ON ap_opening_balances(supplier_id);
    `);

    console.log('AR/AP multi-source migrations applied successfully.');
  } finally {
    try { db.close(); } catch {}
  }
}

migrate();
