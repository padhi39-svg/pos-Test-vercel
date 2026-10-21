const {Client} = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';
(async()=>{
  const c = new Client({connectionString: DB_URL});
  await c.connect();
  let r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='master_users' ORDER BY ordinal_position");
  console.log('=== master_users columns ===');
  r.rows.forEach(x => console.log('  ' + x.column_name + ' (' + x.data_type + ')'));
  r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='settings' ORDER BY ordinal_position");
  console.log('=== settings columns ===');
  r.rows.forEach(x => console.log('  ' + x.column_name + ' (' + x.data_type + ')'));
  r = await c.query("SELECT id, code, name, email FROM master_users WHERE COALESCE(isdelete,0)=0");
  console.log('=== users ===');
  r.rows.forEach(x => console.log('  ' + x.id + ' ' + x.code + ' ' + x.name + ' ' + x.email));
  await c.end();
})();
