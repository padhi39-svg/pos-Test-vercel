const { Client } = require('pg');
(async()=>{
  const c = new Client({connectionString:process.env.DATABASE_URL||'postgresql://postgres:postgres@localhost:5432/pos-web'});
  await c.connect();
  
  let r = await c.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='cash_mutations' ORDER BY ordinal_position");
  console.log('=== cash_mutations columns ===');
  for (const col of r.rows) console.log('  ' + col.column_name + ' (' + col.data_type + ') nullable=' + col.is_nullable + ' default=' + (col.column_default||'none'));

  r = await c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='cash_mutation_details' ORDER BY ordinal_position");
  console.log('\n=== cash_mutation_details columns ===');
  for (const col of r.rows) console.log('  ' + col.column_name + ' (' + col.data_type + ') nullable=' + col.is_nullable);

  r = await c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='memorial_journal_details' ORDER BY ordinal_position");
  console.log('\n=== memorial_journal_details columns ===');
  for (const col of r.rows) console.log('  ' + col.column_name + ' (' + col.data_type + ') nullable=' + col.is_nullable);

  await c.end();
})();
