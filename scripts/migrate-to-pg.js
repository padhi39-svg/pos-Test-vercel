const { Pool } = require('pg');
const Database = require('better-sqlite3');

const sqlitePath = 'data/resto-system.db';
const pgUrl = 'postgresql://postgres:postgres@localhost:5432/pos_web_dev';

function mapValue(val, pgType) {
  if (val === null || val === undefined) return null;
  if (pgType === 'boolean' || pgType.startsWith('bool')) {
    return val === true || val === 1 || val === '1' || val === 'true' ? true : false;
  }
  if (pgType === 'integer' || pgType.startsWith('int')) {
    const n = Number(val);
    return isNaN(n) ? null : n;
  }
  if (pgType === 'numeric' || pgType === 'real' || pgType.startsWith('double') || pgType.startsWith('float') || pgType === 'money') {
    const n = Number(val);
    return isNaN(n) ? null : n;
  }
  if (pgType.startsWith('timestamp') || pgType.startsWith('date')) {
    if (!val || val === '') return null;
    // SQLite dates are usually ISO strings
    const d = new Date(val);
    if (isNaN(d.getTime())) return val; // return as-is if can't parse
    return d.toISOString();
  }
  // text/varchar
  return String(val);
}

async function migrate() {
  console.log('Opening SQLite database...');
  const sqlite = new Database(sqlitePath);
  
  console.log('Connecting to PostgreSQL...');
  const pool = new Pool({ connectionString: pgUrl });
  
  // Get all common tables with data in SQLite
  const pgTablesRes = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
  );
  const pgTables = new Set(pgTablesRes.rows.map(r => r.table_name));
  
  const sqliteTables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(r => r.name)
    .filter(t => t !== 'sqlite_sequence');
  
  const tablesToMigrate = sqliteTables.filter(t => pgTables.has(t));
  
  console.log('Tables to migrate: ' + tablesToMigrate.length);
  
  // Get column info for each PG table
  const pgColMap = {};
  for (const tbl of tablesToMigrate) {
    const cols = (await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
      [tbl]
    )).rows;
    pgColMap[tbl] = cols;
  }
  
  // Start transaction with FK bypass
  await pool.query('SET session_replication_role = replica');
  
  let totalRows = 0;
  let totalErrors = 0;
  
  try {
    for (const tbl of tablesToMigrate) {
      const pgCols = pgColMap[tbl];
      const sqliteColsRaw = sqlite.prepare('PRAGMA table_info("' + tbl + '")').all();
      const sqliteNames = sqliteColsRaw.map(r => r.name);
      
      // Get common columns
      const commonCols = pgCols.filter(pc => sqliteNames.includes(pc.column_name));
      
      // Handle column name mapping for known differences
      const colMap = [];
      for (const pc of commonCols) {
        let sqliteName = pc.column_name;
        // Special mapping: some tables have different naming
        if (tbl === 'transactions' && pc.column_name === 'nm_cust' && sqliteNames.includes('Nm_cust')) {
          sqliteName = 'Nm_cust';
        }
        colMap.push({ pgName: pc.column_name, sqliteName, pgType: pc.data_type });
      }
      
      if (colMap.length === 0) {
        console.log('  SKIP ' + tbl + ': no common columns');
        continue;
      }
      
      // Read data from SQLite
      const rows = sqlite.prepare('SELECT * FROM "' + tbl + '" ORDER BY 1').all();
      if (rows.length === 0) continue;
      
      console.log('  Migrating ' + tbl + ': ' + rows.length + ' rows...');
      
      // Insert in batches
      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        // Build insert query
        const pgColNames = colMap.map(c => '"' + c.pgName + '"');
        const placeholders = colMap.map((_, ci) => '$' + (ci + 1));
        
        // Create multi-row INSERT
        const allValues = [];
        const allParams = [];
        let paramIdx = 1;
        
        for (const row of batch) {
          const rowParams = colMap.map(c => mapValue(row[c.sqliteName], c.pgType));
          allParams.push(...rowParams);
          allValues.push('(' + colMap.map((_, ci) => '$' + (paramIdx++)) + ')');
        }
        
        const insertSql = 'INSERT INTO "' + tbl + '" (' + pgColNames.join(',') + ') VALUES ' + allValues.join(',') + ' ON CONFLICT DO NOTHING';
        
        try {
          await pool.query(insertSql, allParams);
          totalRows += batch.length;
        } catch (e) {
          // Fall back to single-row inserts
          for (const row of batch) {
            const singleParams = colMap.map(c => mapValue(row[c.sqliteName], c.pgType));
            try {
              await pool.query(
                'INSERT INTO "' + tbl + '" (' + pgColNames.join(',') + ') VALUES (' + placeholders.join(',') + ') ON CONFLICT DO NOTHING',
                singleParams
              );
              totalRows++;
            } catch (e2) {
              totalErrors++;
              if (totalErrors <= 5) {
                console.error('    Error on ' + tbl + ' row: ' + e2.message.substring(0, 100));
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await pool.query('SET session_replication_role = default');
  }
  
  console.log('\n=== Migration Complete ===');
  console.log('Total rows migrated: ' + totalRows);
  console.log('Total errors: ' + totalErrors);
  
  sqlite.close();
  await pool.end();
}

migrate().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
