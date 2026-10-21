const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';
(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  // Test 1: "SO" with quotes
  try {
    const r = await c.query('SELECT id, number FROM "SO" ORDER BY id LIMIT 3');
    console.log('"SO" OK:', r.rows.length, 'rows');
  } catch(e) { console.log('"SO" ERROR:', e.message); }

  // Test 2: INTERVAL with transactions.created_at (TEXT column)
  try {
    const bridge = (sql, params) => { let idx=0; return {text: sql.replace(/\?/g, ()=>"$"+ ++idx), values: params}; };
    const q = bridge("SELECT id FROM transactions WHERE created_at >= (CURRENT_DATE - INTERVAL '1 day' * ?) LIMIT 1", [7]);
    const r = await c.query(q.text, q.values);
    console.log('INTERVAL+TEXT OK:', r.rows.length, 'rows');
  } catch(e) { console.log('INTERVAL+TEXT ERROR:', e.message); }

  // Test 3: ::date with bridge
  try {
    const bridge = (sql, params) => { let idx=0; return {text: sql.replace(/\?/g, ()=>"$"+ ++idx), values: params}; };
    const q = bridge("SELECT $1::date as d", ['2026-01-01']);
    const r = await c.query(q.text, q.values);
    console.log('::date OK:', r.rows[0].d);
  } catch(e) { console.log('::date ERROR:', e.message); }

  // Test 4: Query with ? but no params — bridge should NOT replace
  try {
    const bridge = (sql, params) => { if (!params||!params.length) return {text:sql,values:[]}; let idx=0; return {text: sql.replace(/\?/g, ()=>"$"+ ++idx), values: params}; };
    const q = bridge("SELECT 1 as n");
    console.log('No-params bridge:', q.text, q.values);
    const r = await c.query(q.text, q.values);
    console.log('No-params OK:', r.rows[0].n);
  } catch(e) { console.log('No-params ERROR:', e.message); }

  await c.end();
})();
