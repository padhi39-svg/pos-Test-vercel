const {Client}=require('pg');
(async()=>{
  const c=new Client({connectionString:process.env.DATABASE_URL||'postgresql://postgres:postgres@localhost:5432/pos-web'});
  await c.connect();
  let r=await c.query("SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name='manufaktur_biaya' ORDER BY ordinal_position");
  r.rows.forEach(x=>console.log(x.column_name+' | default='+(x.column_default||'null')+' | nullable='+x.is_nullable));
  await c.end()
})();
