const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  let ok = 0, fail = 0, partial = 0;

  const q = async (sql, params) => {
    try {
      const r = await c.query(sql, params || []);
      return { ok: true, rows: r.rows };
    } catch(e) { return { ok: false, err: e.message }; }
  };

  console.log('=== RESERVATION CRUD ===');

  // Ensure tables exist
  for (const tbl of [
    `CREATE TABLE IF NOT EXISTS reservations (id SERIAL PRIMARY KEY, number TEXT UNIQUE NOT NULL, customer_name TEXT, pic TEXT, company TEXT, phone TEXT, date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, pax INTEGER NOT NULL, status TEXT DEFAULT 'pending', dp_amount REAL, dp_paid INTEGER DEFAULT 0, notes TEXT, transfer_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS master_meja (id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, floor_id INTEGER, zone TEXT, capacity INTEGER DEFAULT 2, is_active INTEGER DEFAULT 1, is_mergeable INTEGER DEFAULT 1, is_smoking INTEGER DEFAULT 0, notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS reservation_tables (id SERIAL PRIMARY KEY, reservation_id INTEGER NOT NULL, table_id INTEGER NOT NULL)`,
  ]) {
    const r = await q(tbl);
    if (!r.ok) { console.log('FAIL ensure table:', r.err); fail++; }
  }

  // Check columns
  let r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = 'reservations'");
  if (r.ok) {
    const names = r.rows.map(rr => String(rr.column_name).toLowerCase());
    const checks = ['pic','company','transfer_name','customer_name','start_time','end_time','pax','dp_amount','dp_paid'];
    let allOk = true;
    for (const chk of checks) {
      if (!names.includes(chk)) { console.log('FAIL missing column:', chk); allOk = false; fail++; }
    }
    if (allOk) { console.log('OK all reservations columns exist'); ok++; }
  }

  // GET list
  r = await q('SELECT * FROM reservations WHERE 1=1 ORDER BY id DESC LIMIT 10');
  if (r.ok) { console.log('OK GET list:', r.rows.length, 'rows'); ok++; }
  else { console.log('FAIL GET list:', r.err); fail++; }

  // INSERT test
  const testNumber = 'QC-TEST-' + Date.now();
  r = await q("INSERT INTO reservations(number, customer_name, date, start_time, end_time, pax) VALUES($1, $2, $3, $4, $5, $6) RETURNING id",
    [testNumber, 'Test Customer', '2026-06-10', '10:00', '11:00', 2]);
  if (r.ok) {
    const newId = r.rows[0].id;
    console.log('OK INSERT reservation:', newId);
    ok++;

    // GET single
    r = await q('SELECT * FROM reservations WHERE id=$1', [newId]);
    if (r.ok && r.rows.length) { console.log('OK GET single'); ok++; }
    else { console.log('FAIL GET single:', r.err); fail++; }

    // PUT update
    r = await q('UPDATE reservations SET customer_name=$1 WHERE id=$2 RETURNING *', ['Updated Customer', newId]);
    if (r.ok) { console.log('OK UPDATE reservation'); ok++; }
    else { console.log('FAIL UPDATE:', r.err); fail++; }

    // Status action - cancel
    r = await q('UPDATE reservations SET status=$1 WHERE id=$2 RETURNING *', ['canceled', newId]);
    if (r.ok) { console.log('OK status action cancel'); ok++; }
    else { console.log('FAIL status action:', r.err); fail++; }

    // Confirm action
    r = await q('UPDATE reservations SET status=$1 WHERE id=$2 RETURNING *', ['confirmed', newId]);
    if (r.ok) { console.log('OK status action confirm'); ok++; }
    else { console.log('FAIL status confirm:', r.err); fail++; }

    // Check-in
    r = await q('UPDATE reservations SET status=$1 WHERE id=$2 RETURNING *', ['seated', newId]);
    if (r.ok) { console.log('OK status action check_in'); ok++; }

    // Complete
    r = await q('UPDATE reservations SET status=$1 WHERE id=$2 RETURNING *', ['completed', newId]);
    if (r.ok) { console.log('OK status action complete'); ok++; }

    // DELETE clean up
    r = await q('DELETE FROM reservations WHERE id=$1', [newId]);
    if (r.ok) { console.log('OK DELETE reservation'); ok++; }
    else { console.log('FAIL DELETE:', r.err); fail++; }
  } else {
    console.log('FAIL INSERT reservation:', r.err);
    fail++;
  }

  // master_meja columns
  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = 'master_meja'");
  if (r.ok) {
    const names = r.rows.map(rr => String(rr.column_name).toLowerCase());
    const checks = ['code','name','capacity','is_active'];
    let allOk = true;
    for (const chk of checks) {
      if (!names.includes(chk)) { console.log('FAIL master_meja missing:', chk); allOk = false; fail++; }
    }
    if (allOk) { console.log('OK master_meja columns'); ok++; }
  }

  // reservation_tables columns
  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = 'reservation_tables'");
  if (r.ok) {
    const names = r.rows.map(rr => String(rr.column_name).toLowerCase());
    if (names.includes('reservation_id') && names.includes('table_id')) {
      console.log('OK reservation_tables columns'); ok++;
    } else { console.log('FAIL reservation_tables missing columns'); fail++; }
  }

  // JOIN query for tables
  r = await q(`SELECT m.* FROM reservation_tables rt JOIN master_meja m ON m.id = rt.table_id LIMIT 5`);
  if (r.ok) { console.log('OK JOIN reservation_tables + master_meja'); ok++; }

  // Conflict check query (overlapping reservations)
  r = await q(`SELECT r.*, rt.table_id FROM reservations r JOIN reservation_tables rt ON rt.reservation_id = r.id WHERE r.date = $1 AND r.status NOT IN ('canceled','completed','no_show') AND rt.table_id IN ($2)`,
    ['2026-06-10', 1]);
  if (r.ok) { console.log('OK conflict check query'); ok++; }

  console.log('\n=== PRE-ORDER MENUS ===');
  r = await q('SELECT id, code, name, hpp, jenis, kategori_id FROM master_barang WHERE COALESCE(isdelete,0)=0 AND COALESCE(aktif,1)=1 LIMIT 5');
  if (r.ok) { console.log('OK master_barang menu query:', r.rows.length, 'rows'); ok++; }
  else { console.log('FAIL master_barang:', r.err); fail++; }

  r = await q('SELECT id, name FROM master_kategori LIMIT 5');
  if (r.ok) { ok++; } else { console.log('FAIL master_kategori:', r.err); fail++; }

  r = await q('SELECT id, name, ratio FROM barang_units WHERE barang_id = 1 ORDER BY ratio ASC');
  if (r.ok) { ok++; } else { console.log('FAIL barang_units:', r.err); fail++; }

  r = await q("SELECT unit_id, price, effective_date FROM barang_prices WHERE barang_id = 1 AND effective_date::timestamp <= NOW() ORDER BY effective_date DESC");
  if (r.ok) { ok++; } else { console.log('FAIL barang_prices:', r.err); fail++; }

  console.log('\n=== IMPORT EXCEL ===');
  // Check purchases import-excel table columns
  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = 'purchases'");
  if (r.ok) {
    const pcols = r.rows.map(rr => String(rr.column_name).toLowerCase());
    const need = ['purchase_number','purchase_date','supplier_id','total','status'];
    let allOk = true;
    for (const n of need) {
      if (!pcols.includes(n)) { console.log('FAIL purchases missing:', n); allOk = false; fail++; }
    }
    if (allOk) { console.log('OK purchases table columns'); ok++; }
  }

  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_items'");
  if (r.ok) {
    const pcols = r.rows.map(rr => String(rr.column_name).toLowerCase());
    const need = ['purchase_id','barang_id','quantity','unit_price','total_price'];
    let allOk = true;
    for (const n of need) {
      if (!pcols.includes(n)) { console.log('FAIL purchase_items missing:', n); allOk = false; fail++; }
    }
    if (allOk) { console.log('OK purchase_items table columns'); ok++; }
  }

  // Check transactions import tables
  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions'");
  if (r.ok) {
    const cols = r.rows.map(rr => String(rr.column_name).toLowerCase());
    const need = ['transaction_number','customer_id','total','status','created_at'];
    let allOk = true;
    for (const n of need) {
      if (!cols.includes(n)) { console.log('FAIL transactions missing:', n); allOk = false; fail++; }
    }
    if (allOk) { console.log('OK transactions table columns for import'); ok++; }
  }

  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = 'transaction_items'");
  if (r.ok) {
    const cols = r.rows.map(rr => String(rr.column_name).toLowerCase());
    const need = ['transaction_id','barang_id','quantity','unit_price','total_price'];
    let allOk = true;
    for (const n of need) {
      if (!cols.includes(n)) { console.log('FAIL transaction_items missing:', n); allOk = false; fail++; }
    }
    if (allOk) { console.log('OK transaction_items table columns for import'); ok++; }
  }

  // xlsx module check
  try {
    require.resolve('xlsx');
    console.log('OK xlsx module is available');
    ok++;
  } catch(e) {
    console.log('FAIL xlsx module NOT available');
    fail++;
  }

  console.log('\n' + '='.repeat(50));
  console.log('HASIL QC RESERVASI & IMPORT EXCEL');
  console.log('='.repeat(50));
  console.log('OK: ' + ok);
  console.log('PARTIAL: ' + partial);
  console.log('FAIL: ' + fail);
  console.log('TOTAL CHECKS: ' + (ok + partial + fail));

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
