const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');

const dates = db.prepare("SELECT mutation_date, COUNT(*) as cnt FROM cash_mutations GROUP BY mutation_date ORDER BY mutation_date").all();
console.log('Cash mutation dates:');
dates.forEach(d => console.log('  ' + d.mutation_date + ': ' + d.cnt));

const badDates = dates.filter(d => {
  const parts = d.mutation_date.split('-');
  const day = parseInt(parts[2]);
  return day > 28;
});
if (badDates.length > 0) console.log('\nINVALID DATES FOUND:', JSON.stringify(badDates));
else console.log('\nAll dates valid!');

// Also check stock transfer dates
const stDates = db.prepare("SELECT tdate, COUNT(*) as cnt FROM stock_transfers GROUP BY tdate ORDER BY tdate").all();
console.log('\nStock transfer dates:');
stDates.forEach(d => console.log('  ' + d.tdate + ': ' + d.cnt));

const suDates = db.prepare("SELECT tdate, COUNT(*) as cnt FROM stock_usage WHERE void=0 GROUP BY tdate ORDER BY tdate").all();
console.log('\nStock usage dates:');
suDates.forEach(d => console.log('  ' + d.tdate + ': ' + d.cnt));

// Check stock balance summary
console.log('\n=== STOCK BALANCE SUMMARY ===');
const sb = db.prepare(`
  SELECT mb.name, sb.warehouse_id, sb.quantity 
  FROM stock_balance sb 
  JOIN master_barang mb ON mb.id=sb.ingredient_id 
  ORDER BY sb.ingredient_id, sb.warehouse_id
`).all();
console.table(sb);

const hasNegative = sb.filter(r => r.quantity < 0);
if (hasNegative.length > 0) console.log('\nWARNING: Some items have negative stock!');
else console.log('\nAll stock balances are non-negative.');

db.close();
