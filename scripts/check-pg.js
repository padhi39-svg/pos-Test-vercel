const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/pos_web_dev' });

async function main() {
  try {
    const res = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log('PostgreSQL tables:', res.rows.map(r => r.table_name).join(', '));
    console.log('Table count:', res.rows.length);

    for (const r of res.rows) {
      const cnt = await pool.query(`SELECT COUNT(*) as cnt FROM "${r.table_name}"`);
      console.log(`  ${r.table_name}: ${cnt.rows[0].cnt} rows`);
    }
    console.log('\nMigration status: check if drizzle_migrations table exists...');
    const migRes = await pool.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '__drizzle_migrations')
    `);
    console.log('Has migrations:', migRes.rows[0].exists);
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}
main();
