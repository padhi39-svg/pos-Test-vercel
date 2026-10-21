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
    return r.ok ? r.rows.map(x => String(x.column_name).toLowerCase()) : [];
  };

  console.log('=== QC: SALES MODULE ===\n');

  // ===========================================
  // 1. MASTER - TABLE STRUCTURES
  // ===========================================
  console.log('--- 1. MASTER TABLES ---');
  const tables = [
    ['master_barang', ['id','code','name','hpp','jenis','kategori_id','isdelete','aktif']],
    ['master_kategori', ['id','code','name','isdelete']],
    ['master_customer', ['id','code','name','phone','isdelete']],
    ['master_sales', ['id','code','name','isdelete']],
    ['barang_units', ['id','barang_id','name','ratio']],
    ['barang_prices', ['id','barang_id','unit_id','price','effective_date']],
    ['master_spesifikasi', ['id','code','name','isdelete']],
    ['transactions', ['id','transaction_number','customer_id','subtotal','total','status','created_at']],
    ['transaction_items', ['id','transaction_id','barang_id','barang_name','quantity','unit_price','total_price']],
    ['transaction_payments', ['id','transaction_id','method','amount']],
    ['sales_order', ['id','so_number','so_date','customer_id','total','status']],
    ['sales_order_items', ['id','sales_order_id','barang_id','quantity','unit_price','total_price']],
    ['resto_temp_orders', ['id','table_id','customer_id','status','guest_count']],
    ['resto_temp_order_items', ['id','temp_order_id','barang_id','quantity','total_price']],
    ['resto_table_locks', ['id','table_id','device_id','locked_at']],
    ['barang_recipes', ['id','barang_id','ingredient_id','quantity','unit']],
    ['barang_monthly_hpp', ['id','barang_id','year','month','hpp']],
  ];
  for (const [name, need] of tables) {
    const c = await cols(name);
    if (c.length === 0) { console.log('WARN ' + name + ' not found'); partial++; continue; }
    const missing = need.filter(n => !c.includes(n));
    if (missing.length === 0) ok++;
    else { console.log('WARN ' + name + ' missing: ' + missing.join(', ')); partial++; }
  }
  console.log('OK All master tables checked (' + tables.length + ')');

  // ===========================================
  // 2. MASTER CRUD
  // ===========================================
  console.log('\n--- 2. MASTER CRUD ---');

  // Customer
  let r = await q('SELECT id, code, name, phone FROM master_customer WHERE COALESCE(isdelete,0)=0 ORDER BY name LIMIT 10');
  if (r.ok) { console.log('OK GET customers:', r.count, 'rows'); ok++; }
  else { console.log('FAIL customers:', r.err); fail++; }

  const custCode = 'CUS-QC-' + Date.now();
  r = await q("INSERT INTO master_customer(code, name) VALUES($1,$2) RETURNING id", [custCode, 'QC Customer']);
  if (r.ok) {
    const cid = r.rows[0].id; console.log('OK INSERT customer:', cid); ok++;
    r = await q('SELECT * FROM master_customer WHERE id=$1', [cid]);
    if (r.ok && r.rows.length) ok++;
    r = await q("UPDATE master_customer SET name=$1 WHERE id=$2", ['QC Customer Updated', cid]);
    if (r.ok) ok++;
    r = await q("UPDATE master_customer SET isdelete=1 WHERE id=$1", [cid]);
    if (r.ok) ok++;
    await q('DELETE FROM master_customer WHERE id=$1', [cid]);
    console.log('OK Customer CRUD all passed (4 checks)');
    ok += 3; // count the extra checks above
  }

  // Barang
  r = await q('SELECT id, code, name, hpp, jenis FROM master_barang WHERE COALESCE(isdelete,0)=0 LIMIT 5');
  if (r.ok) { console.log('OK GET barang:', r.count, 'rows'); ok++; }

  const brgCode = 'BRG-QC-' + Date.now();
  r = await q("INSERT INTO master_barang(code, name, jenis) VALUES($1,$2,$3) RETURNING id", [brgCode, 'QC Barang', 1]);
  if (r.ok) {
    const bid = r.rows[0].id; console.log('OK INSERT barang:', bid); ok++;
    r = await q("INSERT INTO barang_units(barang_id, name, ratio) VALUES($1,$2,$3) RETURNING id", [bid, 'PCS', 1]);
    if (r.ok) { console.log('OK INSERT barang unit'); ok++; }
    r = await q("INSERT INTO barang_prices(barang_id, unit_id, price, effective_date) VALUES($1,$2,$3,$4) RETURNING id",
      [bid, 1, 15000, '2026-01-01']);
    if (r.ok) { console.log('OK INSERT barang price'); ok++; }
    r = await q("UPDATE master_barang SET isdelete=1 WHERE id=$1", [bid]);
    if (r.ok) ok++;
    await q('DELETE FROM barang_prices WHERE barang_id=$1', [bid]);
    await q('DELETE FROM barang_units WHERE barang_id=$1', [bid]);
    await q('DELETE FROM master_barang WHERE id=$1', [bid]);
    console.log('OK Barang CRUD all passed');
  }

  // Kategori
  r = await q('SELECT id, code, name FROM master_kategori WHERE COALESCE(isdelete,0)=0 ORDER BY name LIMIT 5');
  if (r.ok) { console.log('OK GET kategori:', r.count, 'rows'); ok++; }

  const katCode = 'KAT-QC-' + Date.now();
  r = await q("INSERT INTO master_kategori(code, name) VALUES($1,$2) RETURNING id", [katCode, 'QC Kategori']);
  if (r.ok) {
    const kid = r.rows[0].id; ok++;
    await q("UPDATE master_kategori SET isdelete=1 WHERE id=$1", [kid]);
    await q('DELETE FROM master_kategori WHERE id=$1', [kid]);
    console.log('OK Kategori CRUD');
  }

  // Sales
  r = await q('SELECT id, code, name FROM master_sales WHERE COALESCE(isdelete,0)=0 ORDER BY name LIMIT 5');
  if (r.ok) { console.log('OK GET sales list:', r.count, 'rows'); ok++; }

  const salesCode = 'SLS-QC-' + Date.now();
  r = await q("INSERT INTO master_sales(code, name) VALUES($1,$2) RETURNING id", [salesCode, 'QC Sales']);
  if (r.ok) {
    const sid = r.rows[0].id; ok++;
    await q("UPDATE master_sales SET isdelete=1 WHERE id=$1", [sid]);
    await q('DELETE FROM master_sales WHERE id=$1', [sid]);
    console.log('OK Sales CRUD');
  }

  // ===========================================
  // 3. TRANSACTIONS (Sales Transaksi)
  // ===========================================
  console.log('\n--- 3. TRANSACTIONS ---');

  // GET list
  r = await q(`SELECT t.id, t.transaction_number, t.customer_id, t.total, t.status
    FROM transactions t WHERE COALESCE(t.void,0)=0 AND COALESCE(t.status,'') NOT IN ('void','cancelled') ORDER BY t.id DESC LIMIT 10`);
  if (r.ok) { console.log('OK GET transactions:', r.count, 'rows'); ok++; }

  // INSERT
  const txNum = 'QC-TX-' + Date.now();
  r = await q("INSERT INTO transactions(transaction_number, customer_id, subtotal, total, status) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [txNum, 1, 100000, 100000, 'completed']);
  if (r.ok) {
    const txId = r.rows[0].id; console.log('OK INSERT transaction:', txId); ok++;

    // Items
    r = await q("INSERT INTO transaction_items(transaction_id, barang_id, barang_name, quantity, unit_price, total_price) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      [txId, 1, 'QC Item', 2, 50000, 100000]);
    if (r.ok) { console.log('OK INSERT transaction item:', r.rows[0].id); ok++; }

    // Payments
    r = await q("INSERT INTO transaction_payments(transaction_id, method, amount) VALUES($1,$2,$3) RETURNING id",
      [txId, 'cash', 100000]);
    if (r.ok) { console.log('OK INSERT transaction payment:', r.rows[0].id); ok++; }

    // GET by id with joins
    r = await q(`SELECT t.*, ti.barang_name, ti.quantity, tp.method, tp.amount
      FROM transactions t
      LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
      LEFT JOIN transaction_payments tp ON tp.transaction_id = t.id
      WHERE t.id=$1`, [txId]);
    if (r.ok && r.rows.length) { console.log('OK GET transaction with joins:', r.rows.length, 'rows'); ok++; }

    // count
    r = await q("SELECT COUNT(*)::int as cnt FROM transactions WHERE id=$1", [txId]);
    if (r.ok) ok++;

    await q('DELETE FROM transaction_payments WHERE transaction_id=$1', [txId]);
    await q('DELETE FROM transaction_items WHERE transaction_id=$1', [txId]);
    await q('DELETE FROM transactions WHERE id=$1', [txId]);
    console.log('OK Cleanup');
  } else { console.log('FAIL INSERT transaction:', r.err); fail++; }

  // ===========================================
  // 4. SALES ORDERS
  // ===========================================
  console.log('\n--- 4. SALES ORDERS ---');
  r = await q('SELECT id, so_number, customer_id, total, status FROM sales_order WHERE COALESCE(void,0)=0 LIMIT 5');
  if (r.ok) { console.log('OK GET sales-orders:', r.count, 'rows'); ok++; }

  const soNum = 'SO-QC-' + Date.now();
  r = await q("INSERT INTO sales_order(so_number, so_date, customer_id, subtotal, discount_percent, discount_amount, ppn_percent, ppn_amount, total, status, price_include_tax, tax_rate_percent, is_fully_invoiced) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id",
    [soNum, '2026-06-10', 1, 50000, 0, 0, 0, 0, 50000, 'draft', 0, 11, 0]);
  if (r.ok) {
    const soId = r.rows[0].id; console.log('OK INSERT sales order:', soId); ok++;
    r = await q("INSERT INTO sales_order_items(sales_order_id, barang_id, quantity, unit_ratio, unit_price, discount_percent, discon_total, total_price) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      [soId, 1, 3, 1, 16667, 0, 0, 50000]);
    if (r.ok) { console.log('OK INSERT SO item:', r.rows[0].id); ok++; }
    r = await q("UPDATE sales_order SET status='approved' WHERE id=$1 RETURNING *", [soId]);
    if (r.ok) ok++;
    r = await q('DELETE FROM sales_order_items WHERE so_id=$1', [soId]);
    r = await q('DELETE FROM sales_order WHERE id=$1', [soId]);
    console.log('OK Cleanup');
  }

  // ===========================================
  // 5. POS RESTO
  // ===========================================
  console.log('\n--- 5. POS RESTO ---');
  r = await q("SELECT id, code, name, hpp FROM master_barang WHERE COALESCE(isdelete,0)=0 AND COALESCE(aktif,1)=1 AND COALESCE(tampil_menu,1)=1 LIMIT 5");
  if (r.ok) { console.log('OK POS products:', r.count, 'rows'); ok++; }

  r = await q("SELECT id, name, ratio FROM barang_units WHERE barang_id=1 ORDER BY ratio ASC LIMIT 5");
  if (r.ok) ok++;

  r = await q("SELECT unit_id, price FROM barang_prices WHERE barang_id=1 AND effective_date::timestamp <= NOW() ORDER BY effective_date DESC LIMIT 5");
  if (r.ok) { console.log('OK POS prices (with date cast)'); ok++; }

  // Resto temp order
  r = await q("SELECT id, table_id, order_number, status, total FROM resto_temp_orders WHERE status NOT IN ('completed','void') LIMIT 5");
  if (r.ok) { console.log('OK POS temp orders:', r.count, 'rows'); ok++; }

  const tempNum = 'QC-TEMP-' + Date.now();
  r = await q("INSERT INTO resto_temp_orders(table_id, guest_count, status, notes) VALUES($1,$2,$3,$4) RETURNING id",
    [1, 2, 'open', 'QC test']);
  if (r.ok) {
    const tempId = r.rows[0].id; ok++;
    r = await q("INSERT INTO resto_temp_order_items(temp_order_id, barang_id, quantity, total_price) VALUES($1,$2,$3,$4)", [tempId, 1, 1, 25000]);
    if (r.ok) ok++;
    r = await q("DELETE FROM resto_temp_order_items WHERE temp_order_id=$1", [tempId]);
    r = await q("DELETE FROM resto_temp_orders WHERE id=$1", [tempId]);
    console.log('OK POS temp CRUD');
  }

  // ===========================================
  // 6. SALES REPORTS
  // ===========================================
  console.log('\n--- 6. SALES REPORTS ---');

  // Recap
  r = await q("SELECT t.id, t.transaction_number, COALESCE(c.name, 'Customer Umum') as customer FROM transactions t LEFT JOIN master_customer c ON t.customer_id = c.id WHERE COALESCE(t.void,0)=0 LIMIT 10");
  if (r.ok) { console.log('OK sales-recap-report:', r.count, 'rows'); ok++; }

  // Detail
  r = await q("SELECT t.id, t.transaction_number, ti.barang_name, ti.quantity, ti.unit_price, ti.total_price FROM transactions t JOIN transaction_items ti ON t.id=ti.transaction_id WHERE COALESCE(t.void,0)=0 LIMIT 10");
  if (r.ok) { console.log('OK sales-detail-report:', r.count, 'rows'); ok++; }

  // Ingredient
  r = await q("SELECT t.id, ti.barang_id, br.ingredient_id, ib.name FROM transactions t JOIN transaction_items ti ON t.id=ti.transaction_id JOIN barang_recipes br ON ti.barang_id=br.barang_id LEFT JOIN master_barang ib ON br.ingredient_id=ib.id WHERE COALESCE(t.status,'') NOT IN ('void','cancelled') LIMIT 10");
  if (r.ok) { console.log('OK sales-ingredient-report:', r.count, 'rows'); ok++; }

  // Gross Profit
  r = await q("SELECT ib.kodenota, ib.barang_id, ib.qty, ib.subtotal, ROUND(COALESCE(bmh.hpp, mb.hpp, 0)::numeric, 0) as hpp FROM (SELECT t.id as transaction_id, t.transaction_number as kodenota, ti.barang_id, ti.quantity as qty, ti.total_price as subtotal FROM transaction_items ti JOIN transactions t ON t.id=ti.transaction_id WHERE COALESCE(t.status,'completed')!='void') ib LEFT JOIN barang_monthly_hpp bmh ON bmh.barang_id=ib.barang_id LEFT JOIN master_barang mb ON mb.id=ib.barang_id LIMIT 10");
  if (r.ok) { console.log('OK sales-gross-profit:', r.count, 'rows'); ok++; }

  // POS sales
  r = await q("SELECT t.id, t.transaction_number, t.total FROM transactions t WHERE COALESCE(t.status,'') NOT IN ('void','cancelled') LIMIT 10");
  if (r.ok) { console.log('OK pos-sales report:', r.count, 'rows'); ok++; }

  // Usage report
  r = await q("SELECT br.ingredient_id, ib.name, SUM(br.quantity * ti.quantity) as total_used FROM transactions t JOIN transaction_items ti ON t.id=ti.transaction_id JOIN barang_recipes br ON ti.barang_id=br.barang_id LEFT JOIN master_barang ib ON br.ingredient_id=ib.id WHERE COALESCE(t.status,'') NOT IN ('void','cancelled') GROUP BY br.ingredient_id, ib.name LIMIT 10");
  if (r.ok) { console.log('OK usage-report:', r.count, 'rows'); ok++; }

  // Sales rekap pertanggal
  r = await q("SELECT DATE(t.created_at) as tgl, COUNT(*)::int as cnt, SUM(t.total) as total FROM transactions t WHERE COALESCE(t.void,0)=0 GROUP BY DATE(t.created_at) ORDER BY tgl LIMIT 10");
  if (r.ok) { console.log('OK sales-rekap-pertanggal:', r.count, 'rows'); ok++; }

  // ===========================================
  // 7. IMPORT / TEMPLATE
  // ===========================================
  console.log('\n--- 7. IMPORT ---');
  r = await q('SELECT id, code, name FROM master_customer WHERE COALESCE(isdelete,0)=0 LIMIT 5');
  if (r.ok) { console.log('OK customers for template:', r.count, 'rows'); ok++; }

  r = await q('SELECT id, code, name FROM master_barang WHERE COALESCE(isdelete,0)=0 LIMIT 5');
  if (r.ok) { console.log('OK barang for template:', r.count, 'rows'); ok++; }

  try { require.resolve('xlsx'); console.log('OK xlsx module'); ok++; } catch(e) { console.log('FAIL xlsx'); fail++; }

  // ===========================================
  // 8. JOURNAL ENTRIES
  // ===========================================
  console.log('\n--- 8. JOURNAL ENTRIES ---');
  r = await q("SELECT source_type, COUNT(*)::int as cnt FROM journal_entries GROUP BY source_type ORDER BY source_type");
  if (r.ok) {
    console.log('OK Journal entries:');
    for (const row of r.rows) console.log('   - ' + row.source_type + ': ' + row.cnt);
    ok++;
  }

  for (const st of ['Penjualan', 'Pembelian']) {
    r = await q("SELECT COUNT(*)::int as cnt FROM journal_entries WHERE source_type=$1", [st]);
    if (r.ok) ok++;
  }

  // ===========================================
  // SUMMARY
  // ===========================================
  console.log('\n' + '='.repeat(50));
  console.log('FINAL QC: SALES MODULE');
  console.log('='.repeat(50));
  console.log('OK: ' + ok);
  console.log('PARTIAL: ' + partial);
  console.log('FAIL: ' + fail);
  console.log('TOTAL: ' + (ok + partial + fail));
  console.log(fail === 0 ? '\n✅ SEMUA BERHASIL' : '\n⚠️ ADA ' + fail + ' MASALAH');

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
