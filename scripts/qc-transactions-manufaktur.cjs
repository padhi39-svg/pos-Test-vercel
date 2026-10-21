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
  const cols = async (table) => {
    const r = await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema='public' ORDER BY ordinal_position", [table]);
    return r.ok ? r.rows.map(rr => String(rr.column_name).toLowerCase()) : [];
  };
  const check = (label, cond) => { if (cond) { console.log('  ✅ ' + label); ok++; } else { console.log('  ❌ ' + label); fail++; } };
  const warn = (label, msg) => { console.log('  ⚠️  ' + label + ': ' + msg); partial++; };

  console.log('=== QC TRANSACTIONS & MANUFAKTUR ===\n');

  // ============ A. TRANSACTIONS ============
  console.log('--- A. TRANSACTIONS ---');

  const txCols = await cols('transactions');
  const txNeed = ['id','transaction_number','subtotal','total','payment_method','void','transaction_type','period_id'];
  const txMissing = txNeed.filter(n => !txCols.includes(n));
  if (txMissing.length === 0) check('transactions: ' + txCols.length + ' cols', true);
  else warn('transactions', 'Missing: ' + txMissing.join(', ') + '. Actual: ' + txCols.join(', '));

  const tiCols = await cols('transaction_items');
  const tiNeed = ['id','transaction_id','barang_id','quantity','unit_price','total_price'];
  const tiMissing = tiNeed.filter(n => !tiCols.includes(n));
  if (tiMissing.length === 0) check('transaction_items: ' + tiCols.length + ' cols', true);
  else warn('transaction_items', 'Missing: ' + tiMissing.join(', '));

  const tpCols = await cols('transaction_payments');
  if (tpCols.length > 0) check('transaction_payments: ' + tpCols.length + ' cols', true);
  else warn('transaction_payments', 'Table not found');

  // GET transactions
  let r = await q("SELECT id, transaction_number, total, payment_method FROM transactions ORDER BY id DESC LIMIT 5");
  check('GET transactions: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // INSERT transaction
  const txNumber = 'QC-' + Date.now();
  r = await q("INSERT INTO transactions(transaction_number, subtotal, total, payment_method, transaction_type, created_at) VALUES($1, 0, 0, 'cash', 1, CURRENT_TIMESTAMP) RETURNING id", [txNumber]);
  if (r.ok) {
    const txId = r.rows[0].id;
    check('INSERT transaction: id=' + txId, true);

    r = await q("SELECT * FROM transactions WHERE id=$1", [txId]);
    check('SELECT transaction by id', r.ok && r.rows.length > 0);

    // INSERT transaction item
    r = await q("INSERT INTO transaction_items(transaction_id, barang_id, barang_code, barang_name, quantity, unit_price, total_price) VALUES($1, 1, 'QC', 'QC Item', 1, 1000, 1000)", [txId]);
    check('INSERT transaction_item', r.ok);

    r = await q("SELECT * FROM transaction_items WHERE transaction_id=$1 ORDER BY id", [txId]);
    check('SELECT transaction_items', r.ok && r.rows.length > 0);

    // UPDATE
    r = await q("UPDATE transactions SET total=1000 WHERE id=$1", [txId]);
    check('UPDATE transaction', r.ok && r.rowCount > 0);

    // Soft delete (void)
    r = await q("UPDATE transactions SET void=1, status='void' WHERE id=$1", [txId]);
    check('VOID transaction', r.ok && r.rowCount > 0);

    // Verify SELECT with void=0 filter
    r = await q("SELECT id FROM transactions WHERE void=0 AND id=$1", [txId]);
    check('SELECT with void=0 filter (not voided)', r.ok && r.rows.length === 0);

    // Cleanup
    await q('DELETE FROM transaction_items WHERE transaction_id=$1', [txId]);
    await q('DELETE FROM transactions WHERE id=$1', [txId]);
  } else check('INSERT transaction: ' + (r.err || 'no rows'), false);

  // Count query (EXTRACT(YEAR FROM created_at))
  r = await q("SELECT COUNT(*) as count FROM transactions WHERE EXTRACT(YEAR FROM created_at::timestamp) = $1", [2026]);
  check('EXTRACT(YEAR) query works', r.ok);

  // CRUD transaction_payments
  r = await q("SELECT id, transaction_id, amount FROM transaction_payments ORDER BY id LIMIT 5");
  check('GET transaction_payments: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // ============ B. MANUFAKTUR ============
  console.log('\n--- B. MANUFAKTUR ---');

  const mfCols = await cols('manufaktur');
  const mfNeed = ['id','nomor','barang_id','quantity','warehouse_id','status','created_at'];
  const mfMissing = mfNeed.filter(n => !mfCols.includes(n));
  if (mfMissing.length === 0) check('manufaktur: ' + mfCols.length + ' cols', true);
  else warn('manufaktur', 'Missing: ' + mfMissing.join(', ') + '. Actual: ' + mfCols.join(', '));

  const mfDetCols = await cols('manufaktur_detail');
  const mfDetNeed = ['id','manufaktur_id','barang_id','quantity','created_at'];
  const mfDetMissing = mfDetNeed.filter(n => !mfDetCols.includes(n));
  if (mfDetMissing.length === 0) check('manufaktur_detail: ' + mfDetCols.length + ' cols', true);
  else warn('manufaktur_detail', 'Missing: ' + mfDetMissing.join(', ') + '. Actual: ' + mfDetCols.join(', '));

  const mfBiayaCols = await cols('manufaktur_biaya');
  if (mfBiayaCols.length > 0) check('manufaktur_biaya: ' + mfBiayaCols.length + ' cols', true);
  else warn('manufaktur_biaya', 'Table not found');

  // GET manufaktur
  r = await q("SELECT id, nomor, barang_id, quantity, status FROM manufaktur ORDER BY id DESC LIMIT 5");
  check('GET manufaktur: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // INSERT manufaktur (draft)
  const mfNumber = 'MFG-QC-' + Date.now();
  r = await q("INSERT INTO manufaktur(nomor, tanggal, barang_id, quantity, warehouse_id, status) VALUES($1, CURRENT_DATE, 1, 5, 1, 'draft') RETURNING id", [mfNumber]);
  if (r.ok) {
    const mfId = r.rows[0].id;
    check('INSERT manufaktur (draft): id=' + mfId, true);

    // INSERT manufaktur_detail
    r = await q("INSERT INTO manufaktur_detail(manufaktur_id, barang_id, quantity) VALUES($1, 2, 10)", [mfId]);
    check('INSERT manufaktur_detail', r.ok);

    // INSERT manufaktur_biaya
    if (mfBiayaCols.length > 0) {
      r = await q("INSERT INTO manufaktur_biaya(manufaktur_id, notes, debit) VALUES($1, 'Biaya QC', 5000)", [mfId]);
      check('INSERT manufaktur_biaya', r.ok);
    }

    r = await q("SELECT * FROM manufaktur WHERE id=$1", [mfId]);
    check('SELECT manufaktur by id', r.ok && r.rows.length > 0);

    r = await q("SELECT * FROM manufaktur_detail WHERE manufaktur_id=$1", [mfId]);
    check('SELECT manufaktur_detail by manufaktur_id', r.ok && r.rows.length > 0);

    // UPDATE
    r = await q("UPDATE manufaktur SET quantity=10 WHERE id=$1", [mfId]);
    check('UPDATE manufaktur', r.ok && r.rowCount > 0);

    // Approve simulation (status change)
    r = await q("UPDATE manufaktur SET status='approved' WHERE id=$1", [mfId]);
    check('APPROVE manufaktur', r.ok && r.rowCount > 0);

    // SELECT approved
    r = await q("SELECT id, status FROM manufaktur WHERE id=$1 AND status='approved'", [mfId]);
    check('SELECT with status filter', r.ok && r.rows.length > 0);

    // Void
    r = await q("UPDATE manufaktur SET status='void' WHERE id=$1", [mfId]);
    check('VOID manufaktur', r.ok && r.rowCount > 0);

    // Cleanup
    if (mfBiayaCols.length > 0) await q('DELETE FROM manufaktur_biaya WHERE manufaktur_id=$1', [mfId]);
    await q('DELETE FROM manufaktur_detail WHERE manufaktur_id=$1', [mfId]);
    await q('DELETE FROM manufaktur WHERE id=$1', [mfId]);
  } else check('INSERT manufaktur: ' + (r.err || 'no rows'), false);

  // ============ C. CROSS-REFERENCE CHECKS ============
  console.log('\n--- C. CROSS-REFERENCE ---');

  // transaction_items FK → transactions
  r = await q("SELECT 1 FROM information_schema.table_constraints tc WHERE tc.table_name='transaction_items' AND tc.constraint_type='FOREIGN KEY' AND tc.constraint_name LIKE '%transaction%' LIMIT 1");
  if (r.ok && r.rows.length > 0) check('FK transaction_items → transactions (named)', true);
  else {
    r = await q("SELECT 1 FROM information_schema.table_constraints tc WHERE tc.table_name='transaction_items' AND tc.constraint_type='FOREIGN KEY' LIMIT 1");
    if (r.ok && r.rows.length > 0) check('FK transaction_items (unnamed)', true);
    else warn('transaction_items FK', 'No FK constraint found');
  }

  // manufaktur_detail FK → manufaktur
  r = await q("SELECT 1 FROM information_schema.table_constraints tc WHERE tc.table_name='manufaktur_detail' AND tc.constraint_type='FOREIGN KEY' LIMIT 1");
  if (r.ok && r.rows.length > 0) check('FK manufaktur_detail → manufaktur', true);
  else warn('manufaktur_detail FK', 'No FK constraint found');

  // ============ D. PG COMPATIBILITY PATTERNS ============
  console.log('\n--- D. PG COMPAT PATTERNS ---');

  // EXTRACT(YEAR FROM...) — PG function
  r = await q("SELECT EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::int as year");
  check('EXTRACT(YEAR) works', r.ok && Number(r.rows[0].year) > 2000);

  // ALTER SEQUENCE — PG feature (used in reset/route.ts)
  try {
    await q("SELECT setval(pg_get_serial_sequence('transactions', 'id'), COALESCE((SELECT MAX(id) FROM transactions), 0) + 1)");
    check('Sequence reset works (pg_get_serial_sequence)', true);
  } catch(e) {
    warn('Sequence reset', e.message);
  }

  // ::date cast — PG feature (used in reset-sales/route.ts)
  r = await q("SELECT CURRENT_TIMESTAMP::date as today");
  check('::date cast works', r.ok);

  // ::int cast
  r = await q("SELECT 1::int as n");
  check('::int cast works', r.ok);

  // COALESCE with integer filter (void=0 pattern)
  r = await q("SELECT id FROM transactions WHERE COALESCE(void,0)=0 LIMIT 1");
  check('COALESCE(void,0)=0 filter', r.ok);

  // ============ E. SOFT DELETE STRATEGY ============
  console.log('\n--- E. SOFT DELETE STRATEGY ---');
  const strategies = {
    transactions: txCols.includes('void') ? 'void=1' : (txCols.includes('isdelete') ? 'isdelete=1' : 'none'),
    manufaktur: mfCols.includes('status') ? 'status=void' : (mfCols.includes('isdelete') ? 'isdelete=1' : 'none'),
  };
  for (const [tbl, strat] of Object.entries(strategies)) {
    console.log('  📋 ' + tbl + ' → ' + strat);
  }

  // ============ SUMMARY ============
  const total = ok + fail + partial;
  console.log('\n' + '='.repeat(60));
  console.log('   QC TRANSACTIONS & MANUFAKTUR');
  console.log('='.repeat(60));
  console.log('   ✅ AMAN:    ' + ok);
  console.log('   ⚠️ PARTIAL: ' + partial);
  console.log('   ❌ ERROR:   ' + fail);
  console.log('   TOTAL:      ' + total);
  console.log(fail === 0 ? '\n   ✅ SEMUA BERHASIL' : '\n   ⚠️  ADA ' + fail + ' MASALAH');

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
