const Database = require('better-sqlite3');
const path = require('path');

function run() {
  const dbPath = path.resolve(process.cwd(), 'data', 'resto-system.db');
  console.log('Using DB:', dbPath);
  const db = new Database(dbPath);

  try {
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');

    // Ensure accounts table exists
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

    const cnt = db.prepare('SELECT COUNT(*) AS c FROM accounts').get();
    if (Number(cnt.c) > 0) {
      console.log('accounts already has data, skipping seed');
      return;
    }

    console.log('Seeding Indonesian COA (minimal template)...');

    const byCode = new Map();
    const insert = db.prepare(`
      INSERT INTO accounts (code, name, parent_id, level, is_header, normal_balance, is_active, posting_allowed, currency)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'IDR')
    `);
    const getIdByCode = (code) => byCode.get(code);

    function add(code, name, parentCode, level, isHeader, normalBalance) {
      const parentId = parentCode ? getIdByCode(parentCode) : null;
      const res = insert.run(code, name, parentId || null, level, isHeader ? 1 : 0, normalBalance, isHeader ? 0 : 1);
      byCode.set(code, Number(res.lastInsertRowid));
    }

    // 1 ASET
    add('100-000-00', 'ASET', null, 1, true, 'D');
    add('110-000-00', 'ASET LANCAR', '100-000-00', 2, true, 'D');
    add('111-000-00', 'KAS & BANK', '110-000-00', 3, true, 'D');
    add('111-001-01', 'Kas Kecil', '111-000-00', 4, false, 'D'); // detail
    add('111-002-01', 'Bank BCA', '111-000-00', 4, false, 'D'); // detail
    add('120-000-00', 'PIUTANG USAHA', '110-000-00', 3, true, 'D');
    add('120-001-01', 'Piutang Dagang', '120-000-00', 4, false, 'D');
    add('130-000-00', 'PERSEDIAAN', '110-000-00', 3, true, 'D');
    add('130-001-01', 'Persediaan Barang', '130-000-00', 4, false, 'D');
    add('150-000-00', 'ASET TIDAK LANCAR', '100-000-00', 2, true, 'D');
    add('151-000-00', 'ASET TETAP', '150-000-00', 3, true, 'D');
    add('151-001-01', 'Peralatan', '151-000-00', 4, false, 'D');
    add('159-001-01', 'Akumulasi Penyusutan', '151-000-00', 4, false, 'C');

    // 2 KEWAJIBAN
    add('200-000-00', 'KEWAJIBAN', null, 1, true, 'C');
    add('210-000-00', 'KEWAJIBAN LANCAR', '200-000-00', 2, true, 'C');
    add('210-001-01', 'Utang Usaha', '210-000-00', 3, false, 'C');

    // 3 EKUITAS
    add('300-000-00', 'EKUITAS', null, 1, true, 'C');
    add('310-000-00', 'MODAL', '300-000-00', 2, true, 'C');
    add('310-001-01', 'Modal Disetor', '310-000-00', 3, false, 'C');
    add('390-001-01', 'Laba Ditahan', '300-000-00', 2, false, 'C');

    // 4 PENDAPATAN
    add('400-000-00', 'PENDAPATAN', null, 1, true, 'C');
    add('410-000-00', 'PENJUALAN', '400-000-00', 2, true, 'C');
    add('410-001-01', 'Penjualan', '410-000-00', 3, false, 'C');

    // 5 HPP
    add('500-000-00', 'HARGA POKOK PENJUALAN', null, 1, true, 'D');
    add('510-000-00', 'HPP', '500-000-00', 2, true, 'D');
    add('510-001-01', 'Harga Pokok Penjualan', '510-000-00', 3, false, 'D');

    // 6 BEBAN
    add('600-000-00', 'BEBAN OPERASIONAL', null, 1, true, 'D');
    add('610-000-00', 'BEBAN', '600-000-00', 2, true, 'D');
    add('610-001-01', 'Beban Gaji', '610-000-00', 3, false, 'D');
    add('610-002-01', 'Beban Sewa', '610-000-00', 3, false, 'D');
    add('610-003-01', 'Beban Listrik & Air', '610-000-00', 3, false, 'D');

    // 7 & 8 (opsional, kosongkan sebagai header)
    add('700-000-00', 'PENDAPATAN LAIN-LAIN', null, 1, true, 'C');
    add('800-000-00', 'BEBAN LAIN-LAIN', null, 1, true, 'D');

    console.log('Seed COA selesai.');
  } finally {
    try { db.close(); } catch {}
  }
}

run();
