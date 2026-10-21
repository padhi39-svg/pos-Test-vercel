const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');

const tables = ['transaction_items','stock_movements','purchase_items','stock_transfer_items',
  'stock_usage_items','ap_payments','ar_payments','cash_mutations','memorial_journals'];

for (const t of tables) {
  const cols = db.prepare(`SELECT cid, name, type, dflt_value FROM pragma_table_info('${t}') ORDER BY cid`).all();
  console.log(`\n=== ${t} ===`);
  cols.forEach(c => console.log(`  ${c.cid}: ${c.name} (${c.type}) default=${c.dflt_value}`));
}
db.close();
