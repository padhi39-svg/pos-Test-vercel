const { Client } = require('pg');
(async()=>{
  const c = new Client({connectionString:process.env.DATABASE_URL||'postgresql://postgres:postgres@localhost:5432/pos-web'});
  await c.connect();
  for (const tbl of ['transactions','sales_order_items','resto_temp_orders','barang_recipes','sales_order']) {
    const r = await c.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position", [tbl]);
    console.log('=== ' + tbl + ' ===');
    for (const col of r.rows) console.log('  ' + col.column_name + (col.is_nullable==='NO' ? ' (NOT NULL)' : ''));
  }
  await c.end();
})();
