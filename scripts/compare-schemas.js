const { Pool } = require('pg');
const Database = require('better-sqlite3');
const sqlite = new Database('data/resto-system.db');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/pos_web_dev' });

async function main() {
  const pgTablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
  const pgTables = new Set(pgTablesRes.rows.map(r => r.table_name));
  
  const sqliteTables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
  
  console.log('=== Table comparison ===');
  console.log('In both:', sqliteTables.filter(t => pgTables.has(t)).length);
  console.log('SQLite only:', sqliteTables.filter(t => !pgTables.has(t)));
  console.log('PostgreSQL only:', [...pgTables].filter(t => !sqliteTables.includes(t)));
  
  // Compare columns for all common tables
  let totalOk = 0, totalDiff = 0;
  for (const tbl of sqliteTables) {
    if (!pgTables.has(tbl) || tbl === 'sqlite_sequence') continue;
    
    const pgCols = (await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [tbl])).rows;
    const sqliteColsRaw = sqlite.prepare('PRAGMA table_info("' + tbl + '")').all();
    
    const pgNames = pgCols.map(r => r.column_name);
    const sqliteNames = sqliteColsRaw.map(r => r.name);
    
    const common = pgNames.filter(c => sqliteNames.includes(c));
    const pgOnly = pgNames.filter(c => !sqliteNames.includes(c));
    const sqliteOnly = sqliteNames.filter(c => !pgNames.includes(c));
    
    if (pgOnly.length > 0 || sqliteOnly.length > 0) {
      totalDiff++;
      console.log('\nTable: ' + tbl);
      if (pgOnly.length > 0) console.log('  PG only cols: ' + pgOnly.join(', '));
      if (sqliteOnly.length > 0) console.log('  SQLite only cols: ' + sqliteOnly.join(', '));
    } else {
      totalOk++;
    }
  }
  console.log('\n=== Summary ===');
  console.log('Tables with identical columns: ' + totalOk);
  console.log('Tables with column differences: ' + totalDiff);
  
  sqlite.close();
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
