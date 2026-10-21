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
    const r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema='public' ORDER BY ordinal_position", [table]);
    return r.ok ? r.rows.map(rr => String(rr.column_name).toLowerCase()) : [];
  };
  const check = (label, cond) => { if (cond) { console.log('  ✅ ' + label); ok++; } else { console.log('  ❌ ' + label); fail++; } };
  const warn = (label, msg) => { console.log('  ⚠️  ' + label + ': ' + msg); partial++; };

  console.log('=== QC REMAINING MODULES (batch final) ===\n');

  // ============ A. CASH MUTATIONS ============
  console.log('--- A. CASH MUTATIONS ---');
  for (const tbl of ['cash_mutations', 'cash_mutation_details']) {
    const c = await cols(tbl);
    check(tbl + ' (' + c.length + ' cols)', c.length > 0);
  }

  // ============ B. MEMORIAL JOURNALS ============
  console.log('\n--- B. MEMORIAL JOURNALS ---');
  for (const tbl of ['memorial_journals', 'memorial_journal_details']) {
    const c = await cols(tbl);
    check(tbl + ' (' + c.length + ' cols)', c.length > 0);
  }

  // ============ C. GOODS RECEIPTS ============
  console.log('\n--- C. GOODS RECEIPTS ---');
  for (const tbl of ['goods_receipts', 'goods_receipt_items']) {
    const c = await cols(tbl);
    check(tbl + ' (' + c.length + ' cols)', c.length > 0);
  }

  // ============ D. SALES ORDERS ============
  console.log('\n--- D. SALES ORDERS ---');
  for (const tbl of ['sales_order', 'sales_order_items']) {
    const c = await cols(tbl);
    check(tbl + ' (' + c.length + ' cols)', c.length > 0);
  }

  // ============ E. CLIENT SETTINGS ============
  console.log('\n--- E. CLIENT SETTINGS ---');
  const csCols = await cols('client_settings');
  check('client_settings (' + csCols.length + ' cols)', csCols.length > 0);

  // ============ F. SO / SODetail (legacy) ============
  console.log('\n--- F. SO / SODetail (legacy) ---');
  for (const tbl of ['SO', 'SODetail']) {
    const c = await cols(tbl);
    check(tbl + ' (' + c.length + ' cols)', c.length > 0);
  }

  // ============ G. STOCK BALANCE (init table) ============
  console.log('\n--- G. STOCK BALANCE ---');
  const sbCols = await cols('stock_balance');
  check('stock_balance (' + sbCols.length + ' cols)', sbCols.length > 0);

  // ============ H. CRUD VERIFICATION ============
  console.log('\n--- H. CRUD VERIFICATION ---');

  // Cash mutations
  let r = await q("SELECT id FROM cash_mutations ORDER BY id LIMIT 3");
  check('GET cash_mutations: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // Memorial journals
  r = await q("SELECT id FROM memorial_journals ORDER BY id LIMIT 3");
  check('GET memorial_journals: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // Goods receipts
  r = await q("SELECT id FROM goods_receipts ORDER BY id LIMIT 3");
  check('GET goods_receipts: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // Sales orders
  r = await q("SELECT id, so_number FROM sales_order ORDER BY id LIMIT 3");
  check('GET sales_order: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // Client settings
  r = await q("SELECT device_id, setting_key FROM client_settings ORDER BY device_id LIMIT 3");
  check('GET client_settings: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // SO (legacy)
  r = await q('SELECT id, number FROM "SO" ORDER BY id LIMIT 3');
  check('GET SO: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // Stock balance
  r = await q("SELECT id, ingredient_id, quantity FROM stock_balance ORDER BY id LIMIT 3");
  check('GET stock_balance: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // ============ I. PG COMPAT PATTERNS ============
  console.log('\n--- I. PG COMPAT ---');

  // ::date cast (used in fiscal, purchase-requests)
  r = await q("SELECT CURRENT_DATE::date as today");
  check('::date cast works', r.ok);

  // INTERVAL (used in dashboard/sales-trend)
  r = await q("SELECT (CURRENT_DATE - INTERVAL '1 day')::date as yesterday");
  check('INTERVAL works', r.ok);

  // information_schema with table_schema
  r = await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 1");
  check('information_schema.table_schema works', r.ok);

  // ============ J. RAW SQL WITH ? THROUGH BRIDGE ============
  console.log('\n--- J. BRIDGE VALIDATION ---');

  // Simulate the toPg() bridge
  const toPg = (sql, params) => {
    if (!params || params.length === 0) return { text: sql, values: [] };
    let idx = 0;
    return { text: sql.replace(/\?/g, () => `$${++idx}`), values: params };
  };

  // Test with goods-receipts/[id] pattern
  let bridge = toPg("SELECT * FROM goods_receipts WHERE id = ?", [1]);
  check('Bridge converts ? → $1', bridge.text.includes('$1'));

  // Test actual PG execution via bridge
  r = await q(bridge.text, bridge.values);
  check('Bridge output works with PG', r.ok);

  // Test with dashboard/sales-trend pattern
  bridge = toPg("SELECT (CURRENT_DATE - INTERVAL '1 day' * $1)::date as d", [7]);
  check('Bridge preserves INTERVAL + $N', bridge.text.includes('INTERVAL') && bridge.text.includes('$1'));
  r = await q(bridge.text, bridge.values);
  check('INTERVAL + $N works with PG', r.ok && r.rows[0].d);

  // Test with fiscal ::date pattern
  bridge = toPg("SELECT $1::date as d", ['2026-01-01']);
  check('Bridge preserves ::date with $N', bridge.text.includes('::date'));
  r = await q(bridge.text, bridge.values);
  check('$1::date works with PG', r.ok);

  // ============ SUMMARY ============
  const total = ok + fail + partial;
  console.log('\n' + '='.repeat(60));
  console.log('   QC REMAINING MODULES (BATCH FINAL)');
  console.log('='.repeat(60));
  console.log('   ✅ AMAN:    ' + ok);
  console.log('   ⚠️ PARTIAL: ' + partial);
  console.log('   ❌ ERROR:   ' + fail);
  console.log('   TOTAL:      ' + total);
  console.log(fail === 0 ? '\n   ✅ SEMUA BERHASIL' : '\n   ⚠️  ADA ' + fail + ' MASALAH');

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
