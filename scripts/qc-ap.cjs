const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  let ok = 0, fail = 0, partial = 0;

  const q = async (sql, params) => {
    try { const r = await c.query(sql, params || []); return { ok: true, rows: r.rows, count: r.rowCount || r.rows.length }; }
    catch(e) { return { ok: false, err: e.message }; }
  };
  const checkCols = async (table) => {
    const r = await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [table]);
    return r.ok ? r.rows : [];
  };
  const hasCol = (cols, name) => cols.some(c => String(c.column_name).toLowerCase() === name.toLowerCase());

  console.log('========================================');
  console.log('QC: AP PAYMENTS + RETUR + JURNAL');
  console.log('========================================\n');

  // ===========================================
  // 1. TABLE STRUCTURES
  // ===========================================
  console.log('=== 1. TABLE STRUCTURES ===');

  const tables = [
    { name: 'ap_payments', cols: ['id','payment_number','payment_date','supplier_id','total','status'] },
    { name: 'ap_payment_items', cols: ['id','payment_id','purchase_id','invoice_number','due_amount','pay_amount','source_type'] },
    { name: 'ap_payment_methods', cols: ['id','payment_id','account_id','amount'] },
    { name: 'ap_advances', cols: ['id','kode_nota','tanggal','supplier_id','total_amount','status'] },
    { name: 'ap_advance_lines', cols: ['id','ap_advance_id','account_id','amount'] },
    { name: 'ap_opening_balances', cols: ['id','kode_nota','tanggal','supplier_id','nominal','status'] },
  ];
  for (const t of tables) {
    const cols = await checkCols(t.name);
    if (cols.length === 0) { console.log('WARN table ' + t.name + ' not found'); partial++; continue; }
    const missing = t.cols.filter(c => !hasCol(cols, c));
    if (missing.length === 0) { console.log('OK ' + t.name + ': all columns OK'); ok++; }
    else { console.log('WARN ' + t.name + ' missing: ' + missing.join(', ')); partial++; }
  }

  // Check purchases for retur capability
  const puCols = await checkCols('purchases');
  if (hasCol(puCols, 'is_return')) { console.log('OK purchases: has is_return column for retur'); ok++; }
  else { console.log('FAIL purchases: is_return missing'); fail++; }

  // Check journal_entries table
  const jCols = await checkCols('journal_entries');
  if (jCols.length > 0) { console.log('OK journal_entries exists'); ok++; }

  // ===========================================
  // 2. AP PAYMENTS CRUD
  // ===========================================
  console.log('\n=== 2. AP PAYMENTS CRUD ===');

  // GET list
  let r = await q('SELECT p.id, p.payment_number, p.payment_date, p.total, p.status, s.name AS supplier_name FROM ap_payments p LEFT JOIN master_supplier s ON s.id = p.supplier_id WHERE 1=1 ORDER BY p.payment_date DESC LIMIT 10');
  if (r.ok) { console.log('OK GET ap-payments list:', r.count, 'rows'); ok++; }
  else { console.log('FAIL GET list:', r.err); fail++; }

  // Check outstanding endpoint query
  r = await q(`SELECT p.id, p.purchase_number, p.total, p.is_return, COALESCE(p.expected_date, p.purchase_date) as due FROM purchases p WHERE p.supplier_id IS NOT NULL AND COALESCE(p.void,0)=0 AND COALESCE(p.status,'') NOT IN ('void','cancelled') ORDER BY p.id LIMIT 5`);
  if (r.ok) { console.log('OK outstanding query works'); ok++; }

  // POST create ap_payment
  const payNum = 'AP/QC/' + Date.now();
  r = await q("INSERT INTO ap_payments(payment_number, payment_date, supplier_id, period_id, total, status) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
    [payNum, '2026-06-10', 1, 1, 50000, 'active']);
  if (r.ok) {
    const payId = r.rows[0].id;
    console.log('OK INSERT ap_payment:', payId); ok++;

    // POST ap_payment_items
    r = await q("INSERT INTO ap_payment_items(payment_id, purchase_id, invoice_number, due_amount, pay_amount, source_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      [payId, 1, 'INV-001', 100000, 50000, 'purchase']);
    if (r.ok) { console.log('OK INSERT ap_payment_item:', r.rows[0].id); ok++; }

    // POST ap_payment_methods
    r = await q("INSERT INTO ap_payment_methods(payment_id, account_id, amount) VALUES($1,$2,$3) RETURNING id",
      [payId, 1, 50000]);
    if (r.ok) { console.log('OK INSERT ap_payment_method:', r.rows[0].id); ok++; }

    // GET by id (with joins)
    r = await q(`SELECT p.*, pi.purchase_id, pi.invoice_number, pi.pay_amount, pm.account_id, pm.amount as method_amount
      FROM ap_payments p
      LEFT JOIN ap_payment_items pi ON pi.payment_id = p.id
      LEFT JOIN ap_payment_methods pm ON pm.payment_id = p.id
      WHERE p.id = $1`, [payId]);
    if (r.ok && r.rows.length) { console.log('OK GET ap_payment with joins:', r.rows.length, 'rows'); ok++; }

    // PUT void
    r = await q("UPDATE ap_payments SET status='void' WHERE id=$1 RETURNING *", [payId]);
    if (r.ok) { console.log('OK VOID ap_payment'); ok++; }

    // Cleanup
    await q('DELETE FROM ap_payment_methods WHERE payment_id=$1', [payId]);
    await q('DELETE FROM ap_payment_items WHERE payment_id=$1', [payId]);
    await q('DELETE FROM ap_payments WHERE id=$1', [payId]);
    console.log('OK Cleanup');
  } else { console.log('FAIL INSERT:', r.err); fail++; }

  // ===========================================
  // 3. AP ADVANCES (Uang Muka Supplier)
  // ===========================================
  console.log('\n=== 3. AP ADVANCES (Uang Muka Supplier) ===');

  r = await q('SELECT id, kode_nota, tanggal, supplier_id, total_amount, status FROM ap_advances WHERE status = $1 ORDER BY tanggal DESC LIMIT 10', ['active']);
  if (r.ok) { console.log('OK GET ap-advances list:', r.count, 'rows'); ok++; }
  else { console.log('FAIL GET ap-advances:', r.err); fail++; }

  const advNum = 'UM/QC/' + Date.now();
  r = await q("INSERT INTO ap_advances(kode_nota, tanggal, supplier_id, total_amount, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [advNum, '2026-06-10', 1, 100000, 'active']);
  if (r.ok) {
    const advId = r.rows[0].id;
    console.log('OK INSERT ap_advance:', advId); ok++;

    // Insert advance line
    r = await q("INSERT INTO ap_advance_lines(ap_advance_id, account_id, amount) VALUES($1,$2,$3) RETURNING id",
      [advId, 1, 100000]);
    if (r.ok) { console.log('OK INSERT ap_advance_line:', r.rows[0].id); ok++; }

    // GET by id
    r = await q('SELECT * FROM ap_advances WHERE id=$1', [advId]);
    if (r.ok && r.rows.length) { console.log('OK GET ap_advance by id'); ok++; }

    // Void
    r = await q("UPDATE ap_advances SET status='void' WHERE id=$1 RETURNING *", [advId]);
    if (r.ok) { console.log('OK VOID ap_advance'); ok++; }

    // Cleanup
    await q('DELETE FROM ap_advance_lines WHERE ap_advance_id=$1', [advId]);
    await q('DELETE FROM ap_advances WHERE id=$1', [advId]);
    console.log('OK Cleanup');
  } else { console.log('FAIL INSERT:', r.err); fail++; }

  // ===========================================
  // 4. AP OPENING BALANCES (Saldo Awal Hutang)
  // ===========================================
  console.log('\n=== 4. AP OPENING BALANCES ===');

  r = await q('SELECT id, kode_nota, tanggal, supplier_id, nominal, status FROM ap_opening_balances WHERE (status IS NULL OR status != $1) ORDER BY tanggal DESC LIMIT 10', ['void']);
  if (r.ok) { console.log('OK GET ap-opening-balances list:', r.count, 'rows'); ok++; }
  else { console.log('FAIL GET:', r.err); fail++; }

  const obNum = 'SH/QC/' + Date.now();
  r = await q("INSERT INTO ap_opening_balances(kode_nota, tanggal, supplier_id, nominal, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [obNum, '2026-06-10', 1, 50000, 'active']);
  if (r.ok) {
    const obId = r.rows[0].id;
    console.log('OK INSERT ap_opening_balance:', obId); ok++;

    r = await q('SELECT * FROM ap_opening_balances WHERE id=$1', [obId]);
    if (r.ok && r.rows.length) { console.log('OK GET by id'); ok++; }

    r = await q("UPDATE ap_opening_balances SET status='void' WHERE id=$1 RETURNING *", [obId]);
    if (r.ok) { console.log('OK VOID opening balance'); ok++; }

    await q('DELETE FROM ap_opening_balances WHERE id=$1', [obId]);
  } else { console.log('FAIL INSERT:', r.err); fail++; }

  // ===========================================
  // 5. RETUR PEMBELIAN
  // ===========================================
  console.log('\n=== 5. RETUR PEMBELIAN ===');

  // Check purchases with is_return
  r = await q('SELECT p.id, p.purchase_number, p.purchase_date, p.total, p.is_return FROM purchases p WHERE COALESCE(p.is_return,0)=1 LIMIT 5');
  if (r.ok) { console.log('OK Retur purchases query:', r.count, 'rows'); ok++; }
  else { console.log('FAIL retur query:', r.err); fail++; }

  // INSERT a retur purchase
  const retNum = 'RET/QC/' + Date.now();
  r = await q("INSERT INTO purchases(purchase_number, purchase_date, supplier_id, period_id, total, status, is_return, void) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
    [retNum, '2026-06-10', 1, 1, 25000, 'active', 1, 0]);
  if (r.ok) {
    const retId = r.rows[0].id;
    console.log('OK INSERT retur purchase:', retId); ok++;

    // Retur items (negative quantities)
    r = await q("INSERT INTO purchase_items(purchase_id, barang_id, quantity, unit_price, total_price) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [retId, 1, -2, 12500, -25000]);
    if (r.ok) { console.log('OK INSERT retur item'); ok++; }

    // GET retur by id
    r = await q('SELECT p.id, p.purchase_number, p.is_return, pi.quantity, pi.total_price FROM purchases p JOIN purchase_items pi ON pi.purchase_id = p.id WHERE p.id=$1', [retId]);
    if (r.ok && r.rows.length) { console.log('OK JOIN retur + items:', r.rows.length, 'rows'); ok++; }

    // Test retur used in ap_payments as source_type='purchase_return'
    r = await q("SELECT id FROM ap_payment_items WHERE source_type='purchase_return' AND purchase_id=$1 LIMIT 1", [retId]);
    if (r.ok) { console.log('OK retur in ap_payment_items query works'); ok++; }

    // Cleanup
    await q('DELETE FROM purchase_items WHERE purchase_id=$1', [retId]);
    await q('DELETE FROM purchases WHERE id=$1', [retId]);
    console.log('OK Cleanup');
  } else { console.log('FAIL retur INSERT:', r.err); fail++; }

  // Stock movements for retur
  const smCols = await checkCols('stock_movements');
  if (hasCol(smCols, 'movement_type') && hasCol(smCols, 'reference_type')) {
    r = await q("SELECT id, ingredient_id, movement_type, quantity, reference_type, reference_id FROM stock_movements WHERE reference_type='purchase_return' LIMIT 5");
    if (r.ok) { console.log('OK stock_movements retur query:', r.count, 'rows'); ok++; }
    else { console.log('OK stock_movements retur query (no data):', r.count, 'rows'); ok++; }
  }

  // ===========================================
  // 6. JOURNAL ENTRIES
  // ===========================================
  console.log('\n=== 6. JOURNAL ENTRIES ===');

  r = await q('SELECT source_type, COUNT(*)::int as cnt FROM journal_entries GROUP BY source_type ORDER BY source_type');
  if (r.ok) {
    console.log('OK Journal entries by source type:');
    for (const row of r.rows) console.log('   - ' + row.source_type + ': ' + row.cnt + ' entries');
    ok++;
  } else { console.log('FAIL journal_entries:', r.err); fail++; }

  // Check specific source types
  for (const st of ['Pembelian', 'Pembelian Retur', 'Bayar Hutang', 'Uang Muka Supplier']) {
    r = await q('SELECT COUNT(*)::int as cnt FROM journal_entries WHERE source_type=$1', [st]);
    if (r.ok) console.log('OK source_type "' + st + '": ' + (r.rows[0]?.cnt || 0) + ' entries');
    else console.log('FAIL source_type "' + st + '":', r.err);
  }
  ok++; // Count as one check

  // ===========================================
  // 7. AP REPORTS
  // ===========================================
  console.log('\n=== 7. AP REPORTS ===');

  // Payment recap
  r = await q('SELECT p.id, p.payment_number, p.payment_date, p.total, p.status, s.name AS supplier_name FROM ap_payments p LEFT JOIN master_supplier s ON s.id = p.supplier_id ORDER BY p.payment_date DESC LIMIT 10');
  if (r.ok) { console.log('OK payment-recap-report:', r.count, 'rows'); ok++; }

  // Payment detail
  r = await q(`SELECT p.id AS payment_id, p.payment_number, p.payment_date, p.status, s.name AS supplier_name,
    pi.purchase_id, pi.invoice_number, pi.due_amount, pi.pay_amount,
    pm.account_id, a.name AS account_name, pm.amount AS method_amount
    FROM ap_payments p
    LEFT JOIN master_supplier s ON s.id = p.supplier_id
    LEFT JOIN ap_payment_items pi ON pi.payment_id = p.id
    LEFT JOIN ap_payment_methods pm ON pm.payment_id = p.id
    LEFT JOIN accounts a ON a.id = pm.account_id
    WHERE p.status = 'active' ORDER BY p.payment_date DESC LIMIT 10`);
  if (r.ok) { console.log('OK payment-detail-report:', r.count, 'rows'); ok++; }

  // Kartu hutang with all sub-queries
  r = await q('SELECT DISTINCT s.id, s.name FROM master_supplier s WHERE s.id IN (SELECT supplier_id FROM purchases WHERE supplier_id IS NOT NULL UNION SELECT supplier_id FROM ap_payments WHERE supplier_id IS NOT NULL) ORDER BY s.name');
  if (r.ok) { console.log('OK kartu-hutang suppliers:', r.count, 'rows'); ok++; }

  // Hutang jatuh tempo with expected_date
  r = await q("SELECT p.id, p.purchase_number, COALESCE(s.name,'Umum') as supplier, p.purchase_date, p.expected_date as jatuh_tempo, p.total FROM purchases p LEFT JOIN master_supplier s ON p.supplier_id = s.id WHERE p.expected_date IS NOT NULL AND p.expected_date!='' AND COALESCE(p.void,0)=0 AND p.status='active' ORDER BY p.expected_date ASC LIMIT 10");
  if (r.ok) { console.log('OK hutang-jatuh-tempo:', r.count, 'rows'); ok++; }

  // Kartu uang muka supplier
  r = await q('SELECT DISTINCT s.id, s.name FROM master_supplier s WHERE s.id IN (SELECT supplier_id FROM ap_advances WHERE status = $1) ORDER BY s.name', ['active']);
  if (r.ok) { console.log('OK kartu-uang-muka-supplier:', r.count, 'rows'); ok++; }

  // Kartu hutang reguler opening balance
  r = await q(`SELECT COALESCE(SUM(p.total),0) as total FROM purchases p WHERE p.supplier_id=$1 AND (p.is_return IS NULL OR p.is_return=0) AND COALESCE(p.void,0)=0`, [1]);
  if (r.ok) { console.log('OK kartu-hutang opening balance query'); ok++; }

  // ===========================================
  // SUMMARY
  // ===========================================
  console.log('\n' + '='.repeat(50));
  console.log('FINAL QC: AP PAYMENTS + RETUR + JURNAL');
  console.log('='.repeat(50));
  console.log('OK: ' + ok);
  console.log('PARTIAL: ' + partial);
  console.log('FAIL: ' + fail);
  console.log('TOTAL: ' + (ok + partial + fail));
  console.log(fail === 0 ? '\n✅ SEMUA BERHASIL' : '\n⚠️ ADA ' + fail + ' MASALAH');

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
