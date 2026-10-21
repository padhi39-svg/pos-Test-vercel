const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  let ok = 0, fail = 0, partial = 0;

  const q = async (sql, params) => {
    try {
      const r = await c.query(sql, params || []);
      return { ok: true, rows: r.rows, count: r.rowCount || r.rows.length };
    } catch(e) { return { ok: false, err: e.message }; }
  };

  const checkCols = async (table, required) => {
    const r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table]);
    if (!r.ok) return { ok: false, missing: [], err: r.err };
    const names = r.rows.map(rr => String(rr.column_name).toLowerCase());
    const missing = required.filter(n => !names.includes(n));
    return { ok: missing.length === 0, names, missing };
  };

  console.log('========================================');
  console.log('QC PURCHASE MODULE');
  console.log('Target: ' + DB_URL);
  console.log('========================================');
  console.log('');

  // ===========================================
  // 1. SUPPLIER MASTER (Drizzle ORM)
  // ===========================================
  console.log('=== 1. SUPPLIER MASTER ===');
  let r = await checkCols('master_supplier', ['id','code','name','isdelete']);
  if (r.ok) { console.log('OK master_supplier table exists with required columns'); ok++; }
  else { console.log('FAIL master_supplier:', r.missing.join(', ')); fail++; }

  r = await q('SELECT id, code, name FROM master_supplier WHERE COALESCE(isdelete,0)=0 ORDER BY name LIMIT 10');
  if (r.ok) { console.log('OK GET supplier list:', r.count, 'rows'); ok++; }
  else { console.log('FAIL GET supplier list:', r.err); fail++; }

  // INSERT test supplier
  const testCode = 'SUPP-QC-' + Date.now();
  r = await q("INSERT INTO master_supplier(code, name) VALUES($1,$2) RETURNING id", [testCode, 'QC Test Supplier']);
  if (r.ok) {
    const sid = r.rows[0].id;
    console.log('OK POST create supplier:', sid); ok++;

    r = await q('SELECT * FROM master_supplier WHERE id=$1', [sid]);
    if (r.ok && r.rows.length) { console.log('OK GET supplier by id'); ok++; }
    else { console.log('FAIL GET supplier by id'); fail++; }

    r = await q("UPDATE master_supplier SET name=$1 WHERE id=$2 RETURNING *", ['QC Updated Supplier', sid]);
    if (r.ok) { console.log('OK PUT update supplier'); ok++; }
    else { console.log('FAIL PUT update:', r.err); fail++; }

    r = await q('UPDATE master_supplier SET isdelete=1 WHERE id=$1 RETURNING *', [sid]);
    if (r.ok) { console.log('OK DELETE (soft) supplier'); ok++; }
    else { console.log('FAIL DELETE:', r.err); fail++; }

    // Cleanup
    await q('DELETE FROM master_supplier WHERE id=$1', [sid]);
  } else {
    console.log('FAIL POST create supplier:', r.err);
    fail++;
  }

  // ===========================================
  // 2. PURCHASE ORDERS
  // ===========================================
  console.log('');
  console.log('=== 2. PURCHASE ORDERS (PO) ===');
  r = await checkCols('purchase_orders', ['id','po_number','order_date','supplier_id','total','po_status','void']);
  if (r.ok) { console.log('OK purchase_orders table has required columns'); ok++; }
  else { console.log('FAIL purchase_orders:', r.missing.join(', ')); fail++; }

  r = await checkCols('purchase_order_items', ['id','po_id','barang_id','quantity','unit_price','total_price','received_qty']);
  if (r.ok) { console.log('OK purchase_order_items table has required columns'); ok++; }
  else { console.log('FAIL purchase_order_items:', r.missing.join(', ')); fail++; }

  r = await q('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1', ['purchase_orders']);
  if (r.ok) {
    const dtCol = r.rows.find(c => String(c.column_name) === 'order_date');
    if (dtCol) {
      console.log('OK order_date type:', dtCol.data_type);
      if (dtCol.data_type === 'text' || dtCol.data_type === 'date') ok++;
      else partial++;
    }
  }

  r = await q('SELECT po.id, po.po_number, po.order_date FROM purchase_orders po WHERE COALESCE(po.void,0)=0 LIMIT 5');
  if (r.ok) { console.log('OK GET purchase orders list:', r.count, 'rows'); ok++; }
  else { console.log('FAIL GET purchase orders:', r.err); fail++; }

  // INSERT test PO
  const poNumber = 'PO/QC/' + Date.now();
  r = await q("INSERT INTO purchase_orders(po_number, order_date, supplier_id, total, po_status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [poNumber, '2026-06-10', 1, 100000, 'draft']);
  if (r.ok) {
    const poId = r.rows[0].id;
    console.log('OK POST create PO:', poId); ok++;

    r = await q('SELECT * FROM purchase_orders WHERE id=$1', [poId]);
    if (r.ok && r.rows.length) { console.log('OK GET PO by id'); ok++; }

    r = await q("UPDATE purchase_orders SET po_status=$1 WHERE id=$2 RETURNING *", ['approved', poId]);
    if (r.ok) { console.log('OK PUT update PO status'); ok++; }

    r = await q("INSERT INTO purchase_order_items(po_id, barang_id, quantity, unit_price, total_price) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [poId, 1, 10, 5000, 50000]);
    if (r.ok) { console.log('OK POST create PO item:', r.rows[0].id); ok++; }
    else { console.log('FAIL create PO item:', r.err); fail++; }

    // Cleanup
    await q('DELETE FROM purchase_order_items WHERE po_id=$1', [poId]);
    await q('DELETE FROM purchase_orders WHERE id=$1', [poId]);
    console.log('OK cleanup PO data');
  } else {
    console.log('FAIL POST create PO:', r.err);
    fail++;
  }

  // ===========================================
  // 3. PURCHASES (Pembelian)
  // ===========================================
  console.log('');
  console.log('=== 3. PURCHASES (Pembelian) ===');
  r = await checkCols('purchases', ['id','purchase_number','purchase_date','supplier_id','total','void','status']);
  if (r.ok) { console.log('OK purchases table has required columns'); ok++; }
  else { console.log('FAIL purchases:', r.missing.join(', ')); fail++; }

  r = await checkCols('purchase_items', ['id','purchase_id','barang_id','quantity','unit_price','total_price']);
  if (r.ok) { console.log('OK purchase_items table has required columns'); ok++; }
  else { console.log('FAIL purchase_items:', r.missing.join(', ')); fail++; }

  r = await q('SELECT p.id, p.purchase_number, p.purchase_date, p.total FROM purchases p WHERE COALESCE(p.void,0)=0 AND COALESCE(p.status,\'\') NOT IN (\'void\',\'cancelled\') LIMIT 10');
  if (r.ok) { console.log('OK GET purchases list:', r.count, 'rows'); ok++; }
  else { console.log('FAIL GET purchases:', r.err); fail++; }

  // INSERT test purchase
  const purchNumber = 'PBL/QC/' + Date.now();
  r = await q("INSERT INTO purchases(purchase_number, purchase_date, supplier_id, total, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [purchNumber, '2026-06-10', 1, 250000, 'active']);
  if (r.ok) {
    const pid = r.rows[0].id;
    console.log('OK POST create purchase:', pid); ok++;

    r = await q('SELECT * FROM purchases WHERE id=$1', [pid]);
    if (r.ok && r.rows.length) { console.log('OK GET purchase by id'); ok++; }

    r = await q("INSERT INTO purchase_items(purchase_id, barang_id, quantity, unit_price, total_price) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [pid, 1, 5, 50000, 250000]);
    if (r.ok) { console.log('OK POST create purchase item:', r.rows[0].id); ok++; }
    else { console.log('FAIL create purchase item:', r.err); fail++; }

    r = await q("UPDATE purchases SET total=$1 WHERE id=$2 RETURNING *", [250000, pid]);
    if (r.ok) { console.log('OK PUT update purchase'); ok++; }

    // Test void
    r = await q("UPDATE purchases SET void=1, status='void' WHERE id=$1 RETURNING *", [pid]);
    if (r.ok) { console.log('OK void purchase'); ok++; }

    // Outstanding check
    r = await q(`SELECT p.id, p.purchase_number, p.total, COALESCE(SUM(pi.pay_amount),0) as paid FROM purchases p LEFT JOIN ap_payment_items pi ON pi.purchase_id = p.id AND pi.payment_id IN (SELECT id FROM ap_payments WHERE status='active') WHERE p.id=$1 GROUP BY p.id`, [pid]);
    if (r.ok) { console.log('OK outstanding query'); ok++; }

    // Cleanup
    await q('DELETE FROM purchase_items WHERE purchase_id=$1', [pid]);
    await q('DELETE FROM purchases WHERE id=$1', [pid]);
    console.log('OK cleanup purchase data');
  } else {
    console.log('FAIL POST create purchase:', r.err);
    fail++;
  }

  // Check outstanding endpoint
  r = await q('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['ap_payment_items']);
  if (r.ok) {
    const names = r.rows.map(rr => String(rr.column_name).toLowerCase());
    if (names.includes('purchase_id') && names.includes('pay_amount')) {
      console.log('OK ap_payment_items structure'); ok++;
    } else { console.log('FAIL ap_payment_items missing columns'); fail++; }
  }

  // ===========================================
  // 4. PURCHASE REPORTS
  // ===========================================
  console.log('');
  console.log('=== 4. PURCHASE REPORTS ===');

  // Purchase jatuh tempo
  r = await checkCols('purchases', ['expected_date','due_date','payment_status']);
  if (r.ok) {
    const edCol = r.names.includes('expected_date') ? 'expected_date' : 'due_date';
    r = await q(`SELECT p.id, p.purchase_number, p.${edCol}::date FROM purchases p WHERE p.${edCol} IS NOT NULL AND p.${edCol}::date <= CURRENT_DATE AND COALESCE(p.void,0)=0 LIMIT 5`);
    if (r.ok) {
      console.log('OK purchase-jatuh-tempo query:', r.count, 'rows');
      ok++;
    } else {
      console.log('FAIL purchase-jatuh-tempo:', r.err);
      fail++;
    }
  } else {
    console.log('WARN purchases missing expected_date/due_date - report may return empty');
    partial++;
  }

  // Purchase recap
  r = await q(`SELECT p.id, p.purchase_number, DATE(COALESCE(p.purchase_date, p.created_at::text)) as tdate, COALESCE(s.name, '-') as supplier FROM purchases p LEFT JOIN master_supplier s ON p.supplier_id = s.id WHERE COALESCE(p.void,0)=0 LIMIT 5`);
  if (r.ok) { console.log('OK purchase-recap report:', r.count, 'rows'); ok++; }
  else { console.log('FAIL purchase-recap:', r.err); fail++; }

  // Purchase detail
  r = await q(`SELECT p.id as purchase_id, p.purchase_number, pi.barang_id, pi.quantity, pi.unit_price, pi.total_price FROM purchases p JOIN purchase_items pi ON p.id = pi.purchase_id WHERE COALESCE(p.void,0)=0 LIMIT 5`);
  if (r.ok) { console.log('OK purchase-detail report:', r.count, 'rows'); ok++; }
  else { console.log('FAIL purchase-detail:', r.err); fail++; }

  // ===========================================
  // 5. PO REPORTS
  // ===========================================
  console.log('');
  console.log('=== 5. PO REPORTS ===');

  r = await q(`SELECT po.id, po.po_number, DATE(po.order_date) as po_date, po.expected_date, COALESCE(s.name, po.supplier_name, '-') as supplier, po.po_status, po.total FROM purchase_orders po LEFT JOIN master_supplier s ON po.supplier_id = s.id WHERE COALESCE(po.void,0)=0 LIMIT 5`);
  if (r.ok) { console.log('OK PO recap report:', r.count, 'rows'); ok++; }
  else { console.log('FAIL PO recap:', r.err); fail++; }

  r = await q(`SELECT po.id as po_id, po.po_number, pi.barang_id, pi.quantity, pi.received_qty, (COALESCE(pi.quantity,0)-COALESCE(pi.received_qty,0)) as outstanding FROM purchase_orders po JOIN purchase_order_items pi ON po.id = pi.po_id WHERE COALESCE(po.void,0)=0 AND (COALESCE(pi.quantity,0)-COALESCE(pi.received_qty,0))>0 LIMIT 5`);
  if (r.ok) { console.log('OK PO outstanding report:', r.count, 'rows'); ok++; }
  else { console.log('FAIL PO outstanding:', r.err); fail++; }

  r = await q(`SELECT po.id, po.po_number, pi.received_qty FROM purchase_orders po JOIN purchase_order_items pi ON po.id = pi.po_id WHERE COALESCE(po.void,0)=0 AND COALESCE(pi.received_qty,0)>0 LIMIT 5`);
  if (r.ok) { console.log('OK PO realization report:', r.count, 'rows'); ok++; }
  else { console.log('FAIL PO realization:', r.err); fail++; }

  // ===========================================
  // 6. HUTANG REPORTS
  // ===========================================
  console.log('');
  console.log('=== 6. HUTANG / AP REPORTS ===');

  // Hutang jatuh tempo
  const dCol = (await checkCols('purchases', ['due_date'])).ok ? 'due_date' :
    (await checkCols('purchases', ['expected_date'])).ok ? 'expected_date' : null;
  if (dCol) {
    r = await q(`SELECT p.id, p.purchase_number, COALESCE(s.name,'Umum') as supplier, p.purchase_date, p.${dCol} as jatuh_tempo, p.total FROM purchases p LEFT JOIN master_supplier s ON p.supplier_id = s.id WHERE p.${dCol} IS NOT NULL AND p.${dCol}!='' AND COALESCE(p.void,0)=0 AND p.status='active' LIMIT 5`);
    if (r.ok) { console.log('OK hutang-jatuh-tempo report:', r.count, 'rows'); ok++; }
    else { console.log('FAIL hutang-jatuh-tempo:', r.err); fail++; }
  } else {
    console.log('WARN purchases has no due_date/expected_date');
    partial++;
  }

  // Kartu hutang - suppliers
  r = await q(`SELECT DISTINCT s.id, s.name FROM master_supplier s WHERE s.id IN (SELECT supplier_id FROM purchases WHERE supplier_id IS NOT NULL) ORDER BY s.name`);
  if (r.ok) { console.log('OK kartu-hutang suppliers:', r.count, 'rows'); ok++; }
  else { console.log('FAIL kartu-hutang suppliers:', r.err); fail++; }

  // Kartu hutang reguler
  r = await q(`SELECT p.purchase_date as tdate, p.purchase_number as source_number, 'pembelian' as description, p.total as debit, 0 as kredit FROM purchases p WHERE p.supplier_id=1 AND COALESCE(p.void,0)=0 AND p.total>0 LIMIT 5`);
  if (r.ok) { console.log('OK kartu-hutang reguler query:', r.count, 'rows'); ok++; }
  else { console.log('FAIL kartu-hutang reguler:', r.err); fail++; }

  // Kartu hutang per-transaksi
  r = await q(`SELECT p.id, p.purchase_date as tdate, p.purchase_number, p.total, COALESCE((SELECT name FROM master_supplier WHERE id=p.supplier_id),'') as supplier_name FROM purchases p WHERE (p.is_return IS NULL OR p.is_return=0) AND COALESCE(p.void,0)=0 ORDER BY p.purchase_date, p.id LIMIT 5`);
  if (r.ok) { console.log('OK kartu-hutang per-transaksi:', r.count, 'rows'); ok++; }
  else { console.log('FAIL kartu-hutang per-transaksi:', r.err); fail++; }

  // AP payment detail
  r = await q(`SELECT p.id AS payment_id, p.payment_number, p.payment_date, p.total, COALESCE(p.customer_name, c.name, 'Umum') as customer_name FROM ar_payments p LEFT JOIN master_customer c ON p.customer_id = c.id LIMIT 5`);
  if (r.ok) { console.log('OK payment-detail-ap-report:', r.count, 'rows'); ok++; }
  else { console.log('FAIL payment-detail-ap-report:', r.err); fail++; }

  // ===========================================
  // 7. IMPORT EXCEL - TABLE STRUCTURES
  // ===========================================
  console.log('');
  console.log('=== 7. IMPORT EXCEL ===');

  // Check template endpoints have required tables
  r = await q('SELECT id, code, name FROM master_supplier WHERE COALESCE(isdelete,0)=0 LIMIT 5');
  if (r.ok) { console.log('OK template supplier data:', r.count, 'rows'); ok++; }

  r = await q('SELECT id, code, name FROM master_barang WHERE COALESCE(isdelete,0)=0 LIMIT 5');
  if (r.ok) { console.log('OK template barang data:', r.count, 'rows'); ok++; }

  // xlsx module
  try {
    require.resolve('xlsx');
    console.log('OK xlsx module available for Excel export/import');
    ok++;
  } catch(e) {
    console.log('FAIL xlsx module NOT available');
    fail++;
  }

  // Check master_periode for import validation
  r = await checkCols('master_periode', ['id','name','start_date','end_date','is_closed','isdelete']);
  if (r.ok) { console.log('OK master_periode structure'); ok++; }
  else { console.log('FAIL master_periode:', r.missing.join(', ')); fail++; }

  // ===========================================
  // SUMMARY
  // ===========================================
  console.log('');
  console.log('='.repeat(50));
  console.log('HASIL QC PURCHASE MODULE');
  console.log('='.repeat(50));
  console.log('OK: ' + ok);
  console.log('PARTIAL: ' + partial);
  console.log('FAIL: ' + fail);
  console.log('TOTAL CHECKS: ' + (ok + partial + fail));
  console.log('');
  if (fail === 0) {
    console.log('STATUS: ✅ SEMUA BERHASIL');
  } else {
    console.log('STATUS: ⚠️ ADA ' + fail + ' MASALAH');
  }

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
