const Database = require('better-sqlite3');
const path = require('path');

function run() {
  const dbPath = path.resolve(process.cwd(), 'data', 'resto-system.db');
  console.log('Using DB:', dbPath);
  const db = new Database(dbPath);

  try {
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');

    // ========== Core tables ==========
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS master_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        name TEXT,
        level_id INTEGER,
        aktif INTEGER DEFAULT 1,
        isdelete INTEGER DEFAULT 0,
        email TEXT,
        password_hash TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure columns exist on master_users
    try {
      const cols = db.prepare("PRAGMA table_info('master_users')").all();
      const has = (n) => cols.some(c => String(c.name).toLowerCase() === String(n).toLowerCase());
      if (!has('email')) db.prepare('ALTER TABLE master_users ADD COLUMN email TEXT').run();
      if (!has('password_hash')) db.prepare('ALTER TABLE master_users ADD COLUMN password_hash TEXT').run();
      if (!has('aktif')) db.prepare('ALTER TABLE master_users ADD COLUMN aktif INTEGER DEFAULT 1').run();
      if (!has('isdelete')) db.prepare('ALTER TABLE master_users ADD COLUMN isdelete INTEGER DEFAULT 0').run();
      try { db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_master_users_email ON master_users(email)').run(); } catch {}
    } catch (e) { console.warn('master_users migration warn:', e.message); }

    // ========= Other master tables (minimal for safety) =========
    db.exec(`
      CREATE TABLE IF NOT EXISTS master_kategori (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        isdelete BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS master_spesifikasi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        isdelete BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS master_merk (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        isdelete BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS master_periode (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_active BOOLEAN DEFAULT 0,
        isdelete BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS master_customer (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        npwp TEXT,
        discount_percent REAL DEFAULT 0,
        term INTEGER DEFAULT 0,
        isdelete BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS master_supplier (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        npwp TEXT,
        isdelete BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS master_barang (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        kategori_id INTEGER,
        spesifikasi_id INTEGER,
        merk_id INTEGER,
        hpp REAL DEFAULT 0,
        jenis INTEGER DEFAULT 1,
        aktif BOOLEAN DEFAULT 1,
        tampil_menu BOOLEAN DEFAULT 0,
        photo_url TEXT,
        isdelete BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS barang_units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barang_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        ratio REAL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS barang_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barang_id INTEGER NOT NULL,
        unit_id INTEGER,
        price REAL NOT NULL DEFAULT 0,
        effective_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure extra columns (non-destructive)
    try {
      const mbCols = db.prepare("PRAGMA table_info('master_barang')").all();
      if (!mbCols.some(c=>c.name==='photo_url')) db.prepare('ALTER TABLE master_barang ADD COLUMN photo_url TEXT').run();
    } catch (e) { console.warn('master_barang.photo_url warn:', e.message); }

    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_number TEXT UNIQUE,
        customer_id INTEGER,
        customer_name TEXT,
        customer_code TEXT,
        subtotal REAL,
        discount_percent REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        service_charge_percent REAL DEFAULT 0,
        service_charge_amount REAL DEFAULT 0,
        total REAL,
        payment_method TEXT DEFAULT 'cash',
        payment_amount REAL,
        change_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'completed',
        card_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure additional transaction columns (non-destructive)
    try {
      const tcols = db.prepare("PRAGMA table_info('transactions')").all();
      const has = (n) => tcols.some(c => String(c.name).toLowerCase() === String(n).toLowerCase());
      if (!has('table_name')) db.prepare('ALTER TABLE transactions ADD COLUMN table_name TEXT').run();
      if (!has('waiter_name')) db.prepare('ALTER TABLE transactions ADD COLUMN waiter_name TEXT').run();
      if (!has('guest_count')) db.prepare('ALTER TABLE transactions ADD COLUMN guest_count INTEGER DEFAULT 0').run();
      if (!has('created_by')) db.prepare('ALTER TABLE transactions ADD COLUMN created_by TEXT').run();
      if (!has('cash_amount')) db.prepare('ALTER TABLE transactions ADD COLUMN cash_amount REAL DEFAULT 0').run();
      if (!has('debit_amount')) db.prepare('ALTER TABLE transactions ADD COLUMN debit_amount REAL DEFAULT 0').run();
      if (!has('credit_amount')) db.prepare('ALTER TABLE transactions ADD COLUMN credit_amount REAL DEFAULT 0').run();
      if (!has('is_return')) db.prepare('ALTER TABLE transactions ADD COLUMN is_return INTEGER DEFAULT 0').run();
      if (!has('reference_transaction_id')) db.prepare('ALTER TABLE transactions ADD COLUMN reference_transaction_id INTEGER').run();
      if (!has('return_reason')) db.prepare('ALTER TABLE transactions ADD COLUMN return_reason TEXT').run();
      // Kolom umum invoice/retur
      if (!has('tgl_nota')) db.prepare('ALTER TABLE transactions ADD COLUMN tgl_nota TEXT').run();
      if (!has('price_include_tax')) db.prepare('ALTER TABLE transactions ADD COLUMN price_include_tax INTEGER NOT NULL DEFAULT 0').run();
      if (!has('tax_rate_percent')) db.prepare('ALTER TABLE transactions ADD COLUMN tax_rate_percent REAL NOT NULL DEFAULT 11').run();
      if (!has('ppn_percent')) db.prepare('ALTER TABLE transactions ADD COLUMN ppn_percent REAL NOT NULL DEFAULT 0').run();
      if (!has('ppn_amount')) db.prepare('ALTER TABLE transactions ADD COLUMN ppn_amount REAL NOT NULL DEFAULT 0').run();
      if (!has('transaction_type')) db.prepare('ALTER TABLE transactions ADD COLUMN transaction_type INTEGER NOT NULL DEFAULT 1').run();
      if (!has('period_id')) db.prepare('ALTER TABLE transactions ADD COLUMN period_id INTEGER').run();
      if (!has('bank_id')) db.prepare('ALTER TABLE transactions ADD COLUMN bank_id INTEGER').run();
      if (!has('due_date')) db.prepare('ALTER TABLE transactions ADD COLUMN due_date TEXT').run();
      if (!has('payment_terms')) db.prepare('ALTER TABLE transactions ADD COLUMN payment_terms TEXT').run();
      if (!has('notes')) db.prepare('ALTER TABLE transactions ADD COLUMN notes TEXT').run();
      if (!has('service_charge_percent')) db.prepare('ALTER TABLE transactions ADD COLUMN service_charge_percent REAL NOT NULL DEFAULT 0').run();
      if (!has('service_charge_amount')) db.prepare('ALTER TABLE transactions ADD COLUMN service_charge_amount REAL NOT NULL DEFAULT 0').run();
      if (!has('warehouse_id')) db.prepare('ALTER TABLE transactions ADD COLUMN warehouse_id INTEGER NOT NULL DEFAULT 1').run();
      if (!has('table_id')) db.prepare('ALTER TABLE transactions ADD COLUMN table_id INTEGER').run();
      if (!has('resto_temp_id')) db.prepare('ALTER TABLE transactions ADD COLUMN resto_temp_id INTEGER').run();
      if (!has('Nm_cust') && !has('nm_cust')) db.prepare('ALTER TABLE transactions ADD COLUMN Nm_cust TEXT').run();
    } catch (e) { console.warn('transactions extra columns warn:', e.message); }

    // transaction_payments table & ensure change_amount column
    try {
      const tp = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transaction_payments'").get();
      if (!tp) {
        db.exec(`
          CREATE TABLE IF NOT EXISTS transaction_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER NOT NULL,
            method TEXT NOT NULL,
            amount REAL NOT NULL,
            bank_id INTEGER,
            card_number TEXT,
            notes TEXT,
            change_amount REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } else {
        const pcols = db.prepare("PRAGMA table_info('transaction_payments')").all();
        if (!pcols.some(c=>String(c.name).toLowerCase()==='change_amount')) {
          db.prepare('ALTER TABLE transaction_payments ADD COLUMN change_amount REAL DEFAULT 0').run();
        }
      }
    } catch (e) { console.warn('transaction_payments warn:', e.message); }

    // master_banks and owner_name column
    db.exec(`
      CREATE TABLE IF NOT EXISTS master_banks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_name TEXT NOT NULL,
        owner_name TEXT,
        account_number TEXT,
        isdelete BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // === Accounts (Chart of Accounts / COA) ===
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        parent_id INTEGER NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        level INTEGER NOT NULL DEFAULT 1,
        is_header INTEGER NOT NULL DEFAULT 0,
        normal_balance TEXT NOT NULL CHECK (normal_balance IN ('D','C')),
        is_active INTEGER NOT NULL DEFAULT 1,
        is_cash INTEGER NOT NULL DEFAULT 0,
        is_bank_account INTEGER NOT NULL DEFAULT 0,
        is_control_account INTEGER NOT NULL DEFAULT 0,
        posting_allowed INTEGER NOT NULL DEFAULT 1,
        currency TEXT DEFAULT 'IDR',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // === Account Mappings (Setting Perkiraan) ===
    db.exec(`
      CREATE TABLE IF NOT EXISTS account_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        map_group TEXT NOT NULL,
        map_key TEXT NOT NULL,
        account_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(map_group, map_key)
      );
    `);

    // user_barang_jenis mapping
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_barang_jenis (
        user_id INTEGER NOT NULL,
        jenis INTEGER NOT NULL,
        PRIMARY KEY (user_id, jenis)
      );
    `);

    // reservations and extra columns
    db.exec(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT UNIQUE NOT NULL,
        customer_name TEXT,
        phone TEXT,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        pax INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        dp_amount REAL,
        dp_paid INTEGER DEFAULT 0,
        notes TEXT,
        transfer_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // periode bookkeeping: status_buku + stock_period_snapshots
    try {
      const pcols = db.prepare("PRAGMA table_info('master_periode')").all();
      const hasStatusBuku = pcols.some(c => String(c.name).toLowerCase()==='status_buku');
      if (!hasStatusBuku) db.prepare("ALTER TABLE master_periode ADD COLUMN status_buku TEXT DEFAULT 'OPEN'").run();
      db.exec(`
        CREATE TABLE IF NOT EXISTS stock_period_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          periode_id INTEGER NOT NULL,
          barang_id INTEGER NOT NULL,
          qty_base_unit REAL NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(periode_id, barang_id)
        );
      `);
    } catch (e) { console.warn('periode bookkeeping warn:', e.message); }

    // === Opening Balances (Piutang & Hutang) ===
    // Catatan: period_id akan selalu 1 sesuai kebutuhan bisnis. Tanggal default hari pertama periode dihandle oleh layer aplikasi saat create.
    db.exec(`
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

    // === Indexes (safe if exist) ===
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_master_kategori_code ON master_kategori(code);
      CREATE INDEX IF NOT EXISTS idx_master_spesifikasi_code ON master_spesifikasi(code);
      CREATE INDEX IF NOT EXISTS idx_master_merk_code ON master_merk(code);
      CREATE INDEX IF NOT EXISTS idx_master_periode_code ON master_periode(code);
      CREATE INDEX IF NOT EXISTS idx_master_customer_code ON master_customer(code);
      CREATE INDEX IF NOT EXISTS idx_master_barang_code ON master_barang(code);
      CREATE INDEX IF NOT EXISTS idx_master_barang_jenis ON master_barang(jenis);
      CREATE INDEX IF NOT EXISTS idx_master_barang_aktif ON master_barang(aktif);
      CREATE INDEX IF NOT EXISTS idx_master_barang_tampil_menu ON master_barang(tampil_menu);
      CREATE INDEX IF NOT EXISTS idx_transactions_number ON transactions(transaction_number);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_tgl_nota ON transactions(tgl_nota);
      CREATE INDEX IF NOT EXISTS idx_transactions_table ON transactions(table_name);
      CREATE INDEX IF NOT EXISTS idx_transactions_waiter ON transactions(waiter_name);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);
      CREATE INDEX IF NOT EXISTS idx_transactions_is_return ON transactions(is_return);
      CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_transaction_id);
      CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code);
      CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);
      CREATE INDEX IF NOT EXISTS idx_account_mappings_group ON account_mappings(map_group);
      CREATE INDEX IF NOT EXISTS idx_account_mappings_key ON account_mappings(map_key);
      -- Opening balance indexes
      CREATE INDEX IF NOT EXISTS idx_ar_opening_period ON ar_opening_balances(period_id);
      CREATE INDEX IF NOT EXISTS idx_ar_opening_customer ON ar_opening_balances(customer_id);
      CREATE INDEX IF NOT EXISTS idx_ap_opening_period ON ap_opening_balances(period_id);
      CREATE INDEX IF NOT EXISTS idx_ap_opening_supplier ON ap_opening_balances(supplier_id);
    `);

    // Auto-seed admin jika belum ada user
    try {
      const cnt = db.prepare("SELECT COUNT(*) AS c FROM master_users WHERE COALESCE(isdelete,0)=0").get();
      if (!cnt || Number(cnt.c) === 0) {
        const crypto = require('crypto');
        let next = 1;
        const last = db.prepare('SELECT code FROM master_users ORDER BY id DESC LIMIT 1').get();
        if (last?.code && /\d{6}$/.test(last.code)) next = Math.max(next, Number(String(last.code).slice(-6)) + 1);
        const code = `USR/${String(next).padStart(6,'0')}`;
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.createHash('sha256').update(salt + '123456').digest('hex');
        const password_hash = `sha256:${salt}:${hash}`;
        db.prepare('INSERT INTO master_users(code,name,level_id,aktif,isdelete,email,password_hash) VALUES(?,?,?,?,?,?,?)')
          .run(code, 'Admin', null, 1, 0, 'admin@yopmail.com', password_hash);
        console.log('Seeded default admin: admin@yopmail.com / 123456');
      }
    } catch (e) { console.warn('admin seed warn:', e.message); }

    // Spatial columns for table layout (pos_x, pos_y, width, height, shape)
    try {
      const mjCols = db.prepare("PRAGMA table_info('master_meja')").all();
      const hasCol = (n: string) => mjCols.some(c => String(c.name).toLowerCase() === String(n).toLowerCase());
      if (!hasCol('pos_x')) db.prepare("ALTER TABLE master_meja ADD COLUMN pos_x REAL DEFAULT 0").run();
      if (!hasCol('pos_y')) db.prepare("ALTER TABLE master_meja ADD COLUMN pos_y REAL DEFAULT 0").run();
      if (!hasCol('width')) db.prepare("ALTER TABLE master_meja ADD COLUMN width REAL DEFAULT 120").run();
      if (!hasCol('height')) db.prepare("ALTER TABLE master_meja ADD COLUMN height REAL DEFAULT 100").run();
      if (!hasCol('shape')) db.prepare("ALTER TABLE master_meja ADD COLUMN shape TEXT DEFAULT 'rectangle'").run();
    } catch (e) { console.warn('master_meja spatial columns warn:', e.message); }

    console.log('Migrations applied successfully.');
  } finally {
    try { db.close(); } catch {}
  }
}

run();
