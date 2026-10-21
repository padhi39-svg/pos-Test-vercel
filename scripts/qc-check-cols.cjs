const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web' });
  await c.connect();
  
  let r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'purchases'");
  console.log('=== purchases columns ===');
  for (const col of r.rows) console.log('  ' + col.column_name + ' (' + col.data_type + ')');
  
  r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'master_periode'");
  console.log('\n=== master_periode columns ===');
  for (const col of r.rows) console.log('  ' + col.column_name + ' (' + col.data_type + ')');
  
  r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounts'");
  console.log('\n=== accounts columns ===');
  for (const col of r.rows) console.log('  ' + col.column_name + ' (' + col.data_type + ')');

  await c.end();
})();
