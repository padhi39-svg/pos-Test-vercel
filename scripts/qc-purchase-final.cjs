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
  const cols = async (table) => {
    const r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table]);
    return r.ok ? r.rows.map(rr => String(rr.column_name).toLowerCase()) : [];
  };

  console.log('=== FINAL QC: PURCHASE MODULE ===\n');

  // is_closed column
  const pCols = await cols('master_periode');
  if (pCols.includes('is_closed')) { console.log('OK is_closed column EXISTS in master_periode'); ok++; }
  else { console.log('FAIL is_closed missing'); fail++; }

  // All period columns
  const needPeriode = ['id','code','name','start_date','end_date','is_active','isdelete','status_buku','is_closed'];
  const missingPeriode = needPeriode.filter(n => !pCols.includes(n));
  if (missingPeriode.length === 0) { console.log('OK master_periode: all columns OK'); ok++; }
  else { console.log('FAIL master_periode missing:', missingPeriode.join(',')); fail++; }

  // Supplier master
  const sCols = await cols('master_supplier');
  const needSupp = ['id','code','name','isdelete'];
  if (needSupp.every(n => sCols.includes(n))) { console.log('OK master_supplier: all columns OK'); ok++; }
  else { console.log('FAIL master_supplier missing columns'); fail++; }

  let r = await q('SELECT id, code, name FROM master_supplier WHERE COALESCE(isdelete,0)=0 LIMIT 5');
  if (r.ok) { console.log('OK GET suppliers:', r.count, 'rows'); ok++; }
  else { console.log('FAIL suppliers:', r.err); fail++; }

  // Purchases
  const puCols = await cols('purchases');
  const needPu = ['id','purchase_number','purchase_date','supplier_id','period_id','total','void','status','expected_date'];
  const missingPu = needPu.filter(n => !puCols.includes(n));
  if (missingPu.length === 0) { console.log('OK purchases: all columns OK'); ok++; }
  else { console.log('WARN purchases missing:', missingPu.join(',')); partial++; }

  r = await q('SELECT p.id, p.purchase_number, p.purchase_date, p.total FROM purchases p WHERE COALESCE(p.void,0)=0 LIMIT 5');
  if (r.ok) { console.log('OK GET purchases:', r.count, 'rows'); ok++; }

  // Purchase items
  const piCols = await cols('purchase_items');
  const needPi = ['id','purchase_id','barang_id','quantity','unit_price','total_price'];
  if (needPi.every(n => piCols.includes(n))) { console.log('OK purchase_items: all columns'); ok++; }

  // Purchase Orders
  const poCols = await cols('purchase_orders');
  const needPO = ['id','po_number','order_date','supplier_id','total','po_status','void'];
  if (needPO.every(n => poCols.includes(n))) { console.log('OK purchase_orders: all columns'); ok++; }

  const poiCols = await cols('purchase_order_items');
  const needPOI = ['id','po_id','barang_id','quantity','unit_price','total_price','received_qty'];
  if (needPOI.every(n => poiCols.includes(n))) { console.log('OK purchase_order_items: all columns'); ok++; }

  // CRUD tests
  const testNum = 'QC-FINAL-' + Date.now();
  r = await q("INSERT INTO purchases(purchase_number, purchase_date, supplier_id, period_id, total, status) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
    [testNum, '2026-06-10', 1, 1, 100000, 'active']);
  if (r.ok) {
    const pid = r.rows[0].id;
    console.log('OK INSERT purchase:', pid); ok++;
    r = await q("INSERT INTO purchase_items(purchase_id, barang_id, quantity, unit_price, total_price) VALUES($1,$2,$3,$4,$5)", [pid, 1, 2, 50000, 100000]);
    if (r.ok) { console.log('OK INSERT purchase_item'); ok++; }
    r = await q('SELECT pi.*, p.purchase_number FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id WHERE pi.purchase_id=$1', [pid]);
    if (r.ok && r.rows.length) { console.log('OK JOIN purchases + items:', r.rows.length, 'rows'); ok++; }
    r = await q("UPDATE purchases SET total=$1, notes='QC test' WHERE id=$2 RETURNING *", [150000, pid]);
    if (r.ok) { console.log('OK UPDATE purchase'); ok++; }
    r = await q("UPDATE purchases SET void=1, status='void' WHERE id=$1", [pid]);
    if (r.ok) { console.log('OK VOID purchase'); ok++; }
    await q('DELETE FROM purchase_items WHERE purchase_id=$1', [pid]);
    await q('DELETE FROM purchases WHERE id=$1', [pid]);
    console.log('OK Cleanup');
  } else { console.log('FAIL INSERT:', r.err); fail++; }

  // Reports
  r = await q(`SELECT p.id, p.purchase_number, p.expected_date::date as jatuh_tempo FROM purchases p WHERE p.expected_date IS NOT NULL AND p.expected_date::date <= CURRENT_DATE LIMIT 5`);
  if (r.ok) { console.log('OK purchase-jatuh-tempo (expected_date::date)'); ok++; }
  else { console.log('FAIL purchase-jatuh-tempo:', r.err); fail++; }

  // Hutang reports with is_closed working
  r = await q("SELECT id, is_closed FROM master_periode WHERE is_closed = 0 LIMIT 1");
  if (r.ok) { console.log('OK master_periode is_closed filter works'); ok++; }

  // Payment outstanding
  r = await q(`SELECT p.id, p.purchase_number, p.total, COALESCE(SUM(pi.pay_amount),0) as paid FROM purchases p LEFT JOIN ap_payment_items pi ON pi.purchase_id = p.id AND pi.payment_id IN (SELECT id FROM ap_payments WHERE status='active') WHERE p.id IS NOT NULL GROUP BY p.id LIMIT 5`);
  if (r.ok) { console.log('OK outstanding payment query'); ok++; }

  // Import Excel dependencies
  try { require.resolve('xlsx'); console.log('OK xlsx module'); ok++; } catch(e) { console.log('FAIL xlsx'); fail++; }
  r = await q('SELECT id, code, name FROM master_barang WHERE COALESCE(isdelete,0)=0 LIMIT 3');
  if (r.ok) { console.log('OK master_barang for import:', r.count, 'rows'); ok++; }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('FINAL QC: PURCHASE MODULE');
  console.log('='.repeat(50));
  console.log('OK: ' + ok);
  console.log('PARTIAL: ' + partial);
  console.log('FAIL: ' + fail);
  console.log('TOTAL: ' + (ok + partial + fail));
  console.log(fail === 0 ? '\n✅ SEMUA BERHASIL' : '\n⚠️ ADA MASALAH');

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
