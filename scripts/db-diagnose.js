const Database = require('better-sqlite3');
const path = require('path');

(function main(){
  const argPath = process.argv[2];
  const dbPath = argPath ? path.resolve(process.cwd(), argPath) : path.resolve(process.cwd(), 'data', 'resto-system.db');
  console.log('DB Path:', dbPath);
  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch (e) {
    console.log('Open error:', e.message);
    process.exit(0);
  }
  try {
    const ic = db.prepare('PRAGMA integrity_check').get();
    console.log('integrity_check:', Object.values(ic)[0]);
  } catch (e) {
    console.log('integrity_check error:', e.message);
  }
  try {
    const tbls = db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    console.log('tables count:', tbls.length);
    for (const t of tbls) {
      console.log(`${t.type}:${t.name}`);
    }
  } catch (e) {
    console.log('list tables error:', e.message);
  }
  function cols(t){
    try {
      const c = db.prepare(`PRAGMA table_info(${t})`).all();
      console.log(`columns ${t}:`, c.map(x=>x.name).join(','));
    } catch (e) {
      console.log(`columns ${t} error:`, e.message);
    }
  }
  cols('master_users');
  cols('sessions');
  db.close();
})();
