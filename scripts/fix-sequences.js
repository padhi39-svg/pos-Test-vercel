const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/pos_web_dev' });

async function main() {
  // Find all sequences and reset them based on actual max values
  const seqRes = await pool.query(`
    SELECT 
      s.relname AS sequence_name,
      t.relname AS table_name,
      a.attname AS column_name
    FROM pg_class s
    JOIN pg_depend d ON d.objid = s.oid AND d.deptype = 'a'
    JOIN pg_class t ON t.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    WHERE s.relkind = 'S'
    ORDER BY t.relname, a.attname
  `);

  console.log('Fixing sequences...');
  let fixed = 0;
  for (const row of seqRes.rows) {
    try {
      const maxRes = await pool.query(
        `SELECT COALESCE(MAX("${row.column_name}"), 1) as max_id FROM "${row.table_name}"`
      );
      const maxId = maxRes.rows[0].max_id;
      await pool.query(`SELECT setval('"${row.sequence_name}"', ${maxId}, true)`);
      console.log(`  ${row.table_name}.${row.column_name}: set to ${maxId}`);
      fixed++;
    } catch (e) {
      console.warn(`  ${row.table_name}.${row.column_name}: error - ${e.message}`);
    }
  }
  console.log(`\nFixed ${fixed} sequences`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
