const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';
(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  // Test 1: SO table
  try {
    const r = await c.query("SELECT id, number FROM SO ORDER BY id LIMIT 3");
    console.log('SO OK:', r.rows.length, 'rows');
  } catch(e) { console.log('SO ERROR:', e.message); }

  // Test 2: INTERVAL '1 day' * $1
  try {
    const r = await c.query("SELECT (CURRENT_DATE - INTERVAL '1 day' * $1)::date as d", [7]);
    console.log('INTERVAL OK:', r.rows[0].d);
  } catch(e) { console.log('INTERVAL ERROR:', e.message); }

  // Test 3: $1::date
  try {
    const r = await c.query("SELECT $1::date as d", ['2026-01-01']);
    console.log('::date OK:', r.rows[0].d);
  } catch(e) { console.log('::date ERROR:', e.message); }

  await c.end();
})();
