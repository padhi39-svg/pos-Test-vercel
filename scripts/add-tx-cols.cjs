const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';
(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  await c.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS void INTEGER DEFAULT 0');
  console.log('OK added void');

  await c.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type INTEGER DEFAULT 1');
  console.log('OK added transaction_type');

  await c.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_return INTEGER DEFAULT 0');
  console.log('OK added is_return');

  await c.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS period_id INTEGER');
  console.log('OK added period_id');

  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position");
  console.log('\nAll transactions columns:');
  for (const col of r.rows) console.log('  ' + col.column_name);

  await c.end();
  console.log('\n✅ Done');
})();
