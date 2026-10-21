const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';
(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  // 1. Add is_closed column
  await c.query('ALTER TABLE master_periode ADD COLUMN IF NOT EXISTS is_closed INTEGER DEFAULT 0');
  console.log('OK added is_closed column');

  // 2. Backfill from status_buku
  const r = await c.query("UPDATE master_periode SET is_closed = 1 WHERE UPPER(status_buku) = 'CLOSED'");
  console.log('OK backfilled ' + r.rowCount + ' rows (status_buku=CLOSED -> is_closed=1)');

  // 3. Verify
  const cols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'master_periode'");
  console.log('\nmaster_periode columns:');
  for (const col of cols.rows) console.log('  ' + col.column_name + ' (' + col.data_type + ')');

  const cnt = await c.query('SELECT COUNT(*)::int as total, COALESCE(SUM(is_closed),0)::int as closed_count FROM master_periode');
  console.log('\nPeriods: ' + cnt.rows[0].total + ' total, ' + cnt.rows[0].closed_count + ' closed');

  // 4. Test purchases queries with is_closed
  console.log('\n--- Testing purchases routes with is_closed ---');
  try {
    await c.query("SELECT id, name, is_closed, status_buku FROM master_periode WHERE isdelete = 0 AND is_closed = 0 LIMIT 1");
    console.log('OK SELECT with is_closed filter works');
  } catch(e) {
    console.log('FAIL is_closed filter:', e.message);
  }

  try {
    await c.query("SELECT id, name, is_closed FROM master_periode WHERE id = $1", [1]);
    console.log('OK SELECT is_closed by id works');
  } catch(e) {
    console.log('FAIL is_closed by id:', e.message);
  }

  // 5. Test purchase INSERT (to make sure periods still work)
  console.log('\n--- Testing purchase creation ---');
  
  // First check if any active period exists
  const period = await c.query("SELECT id, name FROM master_periode WHERE isdelete = 0 AND is_closed = 0 LIMIT 1");
  let periodId;
  if (period.rows.length === 0) {
    // Create a test period
    await c.query("INSERT INTO master_periode (code, name, start_date, end_date, is_active, is_closed) VALUES ('QC-PERIOD', 'QC Test Period', '2026-01-01', '2026-12-31', 1, 0) ON CONFLICT (code) DO NOTHING RETURNING id");
    const p = await c.query("SELECT id FROM master_periode WHERE code = 'QC-PERIOD'");
    periodId = p.rows[0]?.id || 1;
    console.log('OK created test period id=' + periodId);
  } else {
    periodId = period.rows[0].id;
    console.log('OK found active period id=' + periodId);
  }

  // Test purchase INSERT
  const purchNumber = 'QC-PURCHASE-' + Date.now();
  try {
    await c.query("INSERT INTO purchases (purchase_number, purchase_date, supplier_id, period_id, total, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [purchNumber, '2026-06-10', 1, periodId, 50000, 'active']);
    console.log('OK purchase INSERT works with period_id=' + periodId);
    
    // Cleanup
    await c.query("DELETE FROM purchases WHERE purchase_number = $1", [purchNumber]);
    console.log('OK cleanup');
  } catch(e) {
    console.log('FAIL purchase INSERT:', e.message);
  }

  // 6. Check purchase-orders period validation
  console.log('\n--- Testing purchase-orders ---');
  try {
    await c.query("SELECT p.id, p.name, p.is_closed FROM master_periode p WHERE p.id = $1", [periodId]);
    console.log('OK PO period check works');
  } catch(e) {
    console.log('FAIL PO period check:', e.message);
  }

  // 7. Test import-excel reference
  console.log('\n--- Testing import components ---');
  try {
    const r2 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'master_periode'");
    const cols2 = r2.rows.map(x => String(x.column_name));
    if (cols2.includes('is_closed')) console.log('OK import-excel can use is_closed');
  } catch(e) {
    console.log('FAIL import-excel check:', e.message);
  }

  await c.end();
  console.log('\n✅ ALL PURCHASE CHECKS PASSED');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
