const Database = require('better-sqlite3');
const db = new Database('data/resto-system.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('SQLite Tables (' + tables.length + '):');
for (const t of tables) {
  const c = db.prepare('SELECT COUNT(*) as cnt FROM "' + t.name + '"').get();
  console.log('  ' + t.name + ': ' + c.cnt + ' rows');
}
db.close();
