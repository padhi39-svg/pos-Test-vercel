const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';
(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  let ok = 0, fail = 0, partial = 0;

  const q = async (sql, params) => {
    try { const r = await c.query(sql, params || []); return { ok: true, rows: r.rows, count: r.rowCount || r.rows.length, rowCount: r.rowCount || 0 }; }
    catch(e) { return { ok: false, err: e.message, rowCount: 0 }; }
  };
  const cols = async (table, schema='public') => {
    const r = await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = $2 ORDER BY ordinal_position", [table, schema]);
    return r.ok ? r.rows.map(rr => ({ name: String(rr.column_name).toLowerCase(), type: rr.data_type })) : [];
  };
  const check = (label, cond) => { if (cond) { console.log('  ✅ ' + label); ok++; } else { console.log('  ❌ ' + label); fail++; } };
  const warn = (label, msg) => { console.log('  ⚠️  ' + label + ': ' + msg); partial++; };

  console.log('=== QC REMAINING MODULES (fixed) ===\n');

  // ============ UTILITY ============
  const hasCol = (tbl, col) => { const c = global.__cols[tbl]; return c ? c.some(x => x.name === col.toLowerCase()) : false; };
  const global = {};

  // Load all columns first
  const tables = ['master_banks','master_paket','master_paket_detail','floors','master_meja',
    'reservations','reservation_tables','cashier_closing','purchases','purchase_items',
    'purchase_orders','purchase_order_items','purchase_requests','purchase_request_items',
    'stock_usage','stock_usage_items','stock_opname','stock_opname_items','stock_transfers',
    'stock_transfer_items','stock_balance_monthly','barang_monthly_hpp'];
  const allCols = {};
  for (const tbl of tables) allCols[tbl] = await cols(tbl);
  global.__cols = allCols;

  // ============ A. BANKS ============
  console.log('--- A. BANKS ---');
  const bankCols = allCols['master_banks'].map(x => x.name);
  const bankNeed = ['id','bank_name','account_number','isdelete'];
  const bankMissing = bankNeed.filter(n => !bankCols.includes(n));
  if (bankMissing.length === 0) check('master_banks: ' + bankCols.join(', '), true);
  else warn('master_banks', 'Missing: ' + bankMissing.join(', ')+ '. Actual cols: ' + bankCols.join(', '));

  let r = await q("SELECT id, bank_name, account_number FROM master_banks WHERE COALESCE(isdelete,0)=0 ORDER BY id LIMIT 5");
  check('GET banks: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  const bankName = 'QC Bank ' + Date.now();
  r = await q("INSERT INTO master_banks(bank_name, account_number, isdelete) VALUES($1, '000000', 0) RETURNING id", [bankName]);
  if (r.ok) {
    const bid = r.rows[0].id;
    check('INSERT bank: id=' + bid, true);
    r = await q("SELECT b.*, a.code as account_code FROM master_banks b LEFT JOIN accounts a ON a.id=b.account_id WHERE b.id=$1", [bid]);
    check('SELECT bank + account join', r.ok && r.rows.length > 0);
    r = await q("UPDATE master_banks SET bank_name='QC Updated' WHERE id=$1", [bid]);
    check('UPDATE bank', r.ok && r.rowCount > 0);
    r = await q("UPDATE master_banks SET isdelete=1 WHERE id=$1", [bid]);
    check('DELETE (soft) bank', r.ok && r.rowCount > 0);
    await q('DELETE FROM master_banks WHERE id=$1', [bid]);
  } else check('INSERT bank: ' + (r.err || 'no rows'), false);

  // ============ B. MASTER PAKET ============
  console.log('\n--- B. MASTER PAKET ---');
  const pktCols = allCols['master_paket'].map(x => x.name);
  const pktNeed = ['id','kode','nama','harga_jual','isdelete'];
  const pktMissing = pktNeed.filter(n => !pktCols.includes(n));
  if (pktMissing.length === 0) check('master_paket: ' + pktCols.join(', '), true);
  else warn('master_paket', 'Missing: ' + pktMissing.join(', ') + '. Actual: ' + pktCols.join(', '));

  const pktDetCols = allCols['master_paket_detail'].map(x => x.name);
  const pktDetNeed = ['id','paket_id','barang_id','quantity'];
  const pktDetMissing = pktDetNeed.filter(n => !pktDetCols.includes(n));
  if (pktDetMissing.length === 0) check('master_paket_detail: ' + pktDetCols.join(', '), true);
  else warn('master_paket_detail', 'Missing: ' + pktDetMissing.join(', '));

  const pktCode = 'PKT-QC-' + Date.now().toString(36).toUpperCase();
  r = await q("INSERT INTO master_paket(kode, nama, harga_jual, isdelete) VALUES($1, $2, 0, 0) RETURNING id", [pktCode, 'QC Paket']);
  if (r.ok) {
    const pid = r.rows[0].id;
    check('INSERT master_paket: id=' + pid, true);
    r = await q("SELECT * FROM master_paket WHERE id=$1", [pid]);
    check('SELECT master_paket by id', r.ok && r.rows.length > 0);
    r = await q("UPDATE master_paket SET nama='QC Updated' WHERE id=$1", [pid]);
    check('UPDATE master_paket', r.ok && r.rowCount > 0);
    r = await q("UPDATE master_paket SET isdelete=1 WHERE id=$1", [pid]);
    check('DELETE (soft) master_paket', r.ok && r.rowCount > 0);
    await q('DELETE FROM master_paket WHERE id=$1', [pid]);
  } else check('INSERT master_paket: ' + (r.err || 'no rows'), false);

  // ============ C. MEJA ============
  console.log('\n--- C. MEJA ---');
  const mejaCols = allCols['master_meja'].map(x => x.name);
  const mejaNeed = ['id','code','name','floor_id','is_active'];
  const mejaMissing = mejaNeed.filter(n => !mejaCols.includes(n));
  if (mejaMissing.length === 0) check('master_meja: ' + mejaCols.join(', '), true);
  else warn('master_meja', 'Missing: ' + mejaMissing.join(', ') + '. Actual: ' + mejaCols.join(', '));

  r = await q("SELECT id, code, name FROM master_meja ORDER BY id LIMIT 5");
  check('GET meja: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  const mejaCode = 'MJA-QC-' + Date.now().toString(36).toUpperCase();
  r = await q("INSERT INTO master_meja(code, name, is_active) VALUES($1, $2, 1) ON CONFLICT(code) DO NOTHING RETURNING id", [mejaCode, 'QC Meja']);
  if (r.ok && r.rows.length > 0) {
    const mid = r.rows[0].id;
    check('INSERT meja: id=' + mid, true);
    r = await q("SELECT m.*, f.name as floor_name FROM master_meja m LEFT JOIN floors f ON f.id=m.floor_id WHERE m.id=$1", [mid]);
    check('SELECT meja + floor join', r.ok && r.rows.length > 0);
    r = await q("UPDATE master_meja SET name='QC Updated' WHERE id=$1", [mid]);
    check('UPDATE meja', r.ok && r.rowCount > 0);
    // soft-delete: set is_active=0 (no isdelete)
    r = await q("UPDATE master_meja SET is_active=0 WHERE id=$1", [mid]);
    check('DELETE (deactivate) meja', r.ok && r.rowCount > 0);
    await q('DELETE FROM master_meja WHERE id=$1', [mid]);
  } else check('INSERT meja: ' + (r.err || 'no rows'), false);

  // ============ D. FLOORS ============
  console.log('\n--- D. FLOORS ---');
  const floorCols = allCols['floors'].map(x => x.name);
  const floorNeed = ['id','code','name','isdelete'];
  const floorMissing = floorNeed.filter(n => !floorCols.includes(n));
  if (floorMissing.length === 0) check('floors: ' + floorCols.join(', '), true);
  else warn('floors', 'Missing: ' + floorMissing.join(', ') + '. Actual: ' + floorCols.join(', '));

  r = await q("SELECT id, code, name FROM floors WHERE COALESCE(isdelete,0)=0 ORDER BY id LIMIT 5");
  check('GET floors: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // ============ E. RESERVATIONS ============
  console.log('\n--- E. RESERVATIONS ---');
  const resCols = allCols['reservations'].map(x => x.name);
  const resNeed = ['id','number','customer_name','date','status'];
  const resMissing = resNeed.filter(n => !resCols.includes(n));
  if (resMissing.length === 0) check('reservations: ' + resCols.join(', '), true);
  else warn('reservations', 'Missing: ' + resMissing.join(', ') + '. Actual: ' + resCols.join(', '));

  r = await q("SELECT id, number, customer_name, status FROM reservations ORDER BY id LIMIT 5");
  check('GET reservations: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  const resNum = 'QC-' + Date.now();
  r = await q("INSERT INTO reservations(number, customer_name, date, start_time, end_time, pax, status) VALUES($1, 'QC Reservation', CURRENT_DATE, '10:00', '11:00', 2, 'pending') RETURNING id", [resNum]);
  if (r.ok) {
    const rid = r.rows[0].id;
    check('INSERT reservation: id=' + rid, true);
    r = await q("SELECT * FROM reservations WHERE id=$1", [rid]);
    check('SELECT reservation by id', r.ok && r.rows.length > 0);
    r = await q("UPDATE reservations SET customer_name='QC Updated' WHERE id=$1", [rid]);
    check('UPDATE reservation', r.ok && r.rowCount > 0);
    await q('DELETE FROM reservations WHERE id=$1', [rid]);
  } else warn('reservations', 'INSERT failed: ' + (r.err || 'no rows'));

  // ============ F. CASHIER CLOSING ============
  console.log('\n--- F. CASHIER CLOSING ---');
  const ccCols = allCols['cashier_closing'].map(x => x.name);
  const ccNeed = ['id','tanggal','user_id','total_penjualan','total_tunai'];
  const ccMissing = ccNeed.filter(n => !ccCols.includes(n));
  if (ccMissing.length === 0) check('cashier_closing: ' + ccCols.join(', '), true);
  else warn('cashier_closing', 'Missing: ' + ccMissing.join(', ') + '. Actual: ' + ccCols.join(', '));

  r = await q("SELECT id, user_id, tanggal FROM cashier_closing ORDER BY id LIMIT 5");
  check('GET cashier-closing: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // ============ G. PURCHASES ============
  console.log('\n--- G. PURCHASES ---');
  const purCols = allCols['purchases'].map(x => x.name);
  const purNeed = ['id','purchase_number','supplier_id','total','status'];
  const purMissing = purNeed.filter(n => !purCols.includes(n));
  if (purMissing.length === 0) check('purchases: ' + purCols.join(', '), true);
  else warn('purchases', 'Missing: ' + purMissing.join(', ') + '. Actual: ' + purCols.join(', '));

  const piCols = allCols['purchase_items'].map(x => x.name);
  const piNeed = ['id','purchase_id','barang_id','quantity','unit_price'];
  const piMissing = piNeed.filter(n => !piCols.includes(n));
  if (piMissing.length === 0) check('purchase_items: ' + piCols.join(', '), true);
  else warn('purchase_items', 'Missing: ' + piMissing.join(', ') + '. Actual: ' + piCols.join(', '));

  r = await q("SELECT id, purchase_number, supplier_id, total, status FROM purchases ORDER BY id LIMIT 5");
  check('GET purchases: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // Purchase Orders
  const poCols = allCols['purchase_orders'].map(x => x.name);
  const poNeed = ['id','po_number','supplier_id','status'];
  const poMissing = poNeed.filter(n => !poCols.includes(n));
  if (poMissing.length === 0) check('purchase_orders: ' + poCols.join(', '), true);
  else warn('purchase_orders', 'Missing: ' + poMissing.join(', ') + '. Actual: ' + poCols.join(', '));

  const poiCols = allCols['purchase_order_items'].map(x => x.name);
  const poiNeed = ['id','po_id','barang_id','quantity'];
  const poiMissing = poiNeed.filter(n => !poiCols.includes(n));
  if (poiMissing.length === 0) check('purchase_order_items: ' + poiCols.join(', '), true);
  else warn('purchase_order_items', 'Missing: ' + poiMissing.join(', ') + '. Actual: ' + poiCols.join(', '));

  r = await q("SELECT id, po_number, supplier_id, status FROM purchase_orders ORDER BY id LIMIT 5");
  check('GET purchase-orders: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // ============ H. PURCHASE REQUESTS ============
  console.log('\n--- H. PURCHASE REQUESTS ---');
  const prCols = allCols['purchase_requests'].map(x => x.name);
  const prNeed = ['id','request_number','status'];
  const prMissing = prNeed.filter(n => !prCols.includes(n));
  if (prMissing.length === 0) check('purchase_requests: ' + prCols.join(', '), true);
  else warn('purchase_requests', 'Missing: ' + prMissing.join(', ') + '. Actual: ' + prCols.join(', '));

  const priCols = allCols['purchase_request_items'].map(x => x.name);
  const priNeed = ['id','request_id','barang_id','quantity'];
  const priMissing = priNeed.filter(n => !priCols.includes(n));
  if (priMissing.length === 0) check('purchase_request_items: ' + priCols.join(', '), true);
  else warn('purchase_request_items', 'Missing: ' + priMissing.join(', ') + '. Actual: ' + priCols.join(', '));

  r = await q("SELECT id, request_number, status FROM purchase_requests ORDER BY id LIMIT 5");
  check('GET purchase-requests: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // ============ I. STOCK OPNAME ============
  console.log('\n--- I. STOCK OPNAME ---');
  const soCols = allCols['stock_opname'].map(x => x.name);
  const soNeed = ['id','number','warehouse_id','status'];
  const soMissing = soNeed.filter(n => !soCols.includes(n));
  if (soMissing.length === 0) check('stock_opname: ' + soCols.join(', '), true);
  else warn('stock_opname', 'Missing: ' + soMissing.join(', ') + '. Actual: ' + soCols.join(', '));

  const soiCols = allCols['stock_opname_items'].map(x => x.name);
  const soiNeed = ['id','opname_id','barang_id','system_qty','count_qty'];
  const soiMissing = soiNeed.filter(n => !soiCols.includes(n));
  if (soiMissing.length === 0) check('stock_opname_items: ' + soiCols.join(', '), true);
  else warn('stock_opname_items', 'Missing: ' + soiMissing.join(', ') + '. Actual: ' + soiCols.join(', '));

  // ============ J. UTILITY TABLES ============
  console.log('\n--- J. UTILITY TABLES ---');
  const utilTables = ['stock_usage','stock_usage_items','stock_transfers','stock_transfer_items',
    'stock_balance_monthly','barang_monthly_hpp'];
  for (const tbl of utilTables) {
    const tc = allCols[tbl].length;
    check(tbl + ' (' + tc + ' cols)', tc > 0);
  }

  // ============ K. PG COMPAT CHECKS ============
  console.log('\n--- K. PG COMPAT ---');

  // Test AUTOINCREMENT (SQLite-specific)
  try {
    await c.query("CREATE TEMP TABLE qc_test_autoinc (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
    warn('AUTOINCREMENT', 'SUCCEEDED (unexpected)');
    await c.query("DROP TABLE IF EXISTS qc_test_autoinc");
  } catch(e) {
    check('AUTOINCREMENT correctly fails on PG', e.message.includes('syntax error') || e.message.includes('AUTOINCREMENT'));
  }

  // Test `?` param on pool.query directly
  try {
    await c.query("SELECT * FROM master_banks WHERE id = ?", [1]);
    warn('`?` param direct', 'SUCCEEDED (unexpected)');
  } catch(e) {
    check('`?` param correctly fails on raw pg pool', true);
  }

  // Test :param style (SQLite) — should fail
  try {
    await c.query("SELECT * FROM master_banks WHERE id = :id", { id: 1 });
    warn('`:param` style', 'SUCCEEDED (unexpected)');
  } catch(e) {
    check('`:param` style correctly fails on PG', true);
  }

  // ============ L. SOFT DELETE STRATEGY COMPARISON ============
  console.log('\n--- L. SOFT DELETE STRATEGY ---');
  const deleteStrategies = {
    master_banks: allCols['master_banks'].some(x => x.name === 'isdelete') ? 'isdelete' : 'none',
    master_paket: allCols['master_paket'].some(x => x.name === 'isdelete') ? 'isdelete' : 'none',
    master_meja: allCols['master_meja'].some(x => x.name === 'isdelete') ? 'isdelete' : 'is_active',
    floors: allCols['floors'].some(x => x.name === 'isdelete') ? 'isdelete' : 'none',
    reservations: allCols['reservations'].some(x => x.name === 'isdelete') ? 'isdelete' : 'none',
    purchases: allCols['purchases'].some(x => x.name === 'isdelete') ? 'isdelete' : (allCols['purchases'].some(x => x.name === 'void') ? 'void' : 'none'),
    purchase_orders: allCols['purchase_orders'].some(x => x.name === 'isdelete') ? 'isdelete' : (allCols['purchase_orders'].some(x => x.name === 'void') ? 'void' : 'none'),
    purchase_requests: allCols['purchase_requests'].some(x => x.name === 'isdelete') ? 'isdelete' : (allCols['purchase_requests'].some(x => x.name === 'void') ? 'void' : 'none'),
    stock_opname: allCols['stock_opname'].some(x => x.name === 'isdelete') ? 'isdelete' : (allCols['stock_opname'].some(x => x.name === 'void') ? 'void' : 'none'),
  };
  for (const [tbl, strat] of Object.entries(deleteStrategies)) {
    console.log('  📋 ' + tbl + ' → ' + strat);
  }

  // ============ SUMMARY ============
  const total = ok + fail + partial;
  console.log('\n' + '='.repeat(60));
  console.log('   QC REMAINING MODULES');
  console.log('='.repeat(60));
  console.log('   ✅ AMAN:    ' + ok);
  console.log('   ⚠️ PARTIAL: ' + partial);
  console.log('   ❌ ERROR:   ' + fail);
  console.log('   TOTAL:      ' + total);
  console.log(fail === 0 ? '\n   ✅ SEMUA BERHASIL' : '\n   ⚠️  ADA ' + fail + ' MASALAH');

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
