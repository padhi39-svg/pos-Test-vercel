const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');

console.log('=== DATA COUNTS PER MODULE ===');
const tables = [
  'transactions','transaction_items','transaction_payments',
  'purchases','purchase_items',
  'stock_transfers','stock_transfer_items',
  'stock_usage','stock_usage_items',
  'ar_payments','ar_payment_items','ar_payment_methods',
  'ap_payments','ap_payment_items','ap_payment_methods',
  'cash_mutations','cash_mutation_details',
  'memorial_journals','memorial_journal_details',
  'stock_movements','stock_balance',
];
for (const t of tables) {
  const cnt = db.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).get().cnt;
  console.log(`  ${t}: ${cnt}`);
}

console.log('\n=== STOCK BALANCE ===');
const sb = db.prepare(`
  SELECT sb.ingredient_id, mb.code, mb.name, sb.warehouse_id, sb.quantity, sb.avg_cost, sb.total_cost
  FROM stock_balance sb
  JOIN master_barang mb ON mb.id = sb.ingredient_id
  ORDER BY sb.ingredient_id, sb.warehouse_id
`).all();
console.table(sb);

console.log('\n=== TRANSACTIONS BY MONTH ===');
const txByMonth = db.prepare(`
  SELECT strftime('%Y-%m', tgl_nota) as month, COUNT(*) as cnt, SUM(total) as total
  FROM transactions
  GROUP BY month ORDER BY month
`).all();
console.table(txByMonth);

console.log('\n=== PURCHASES BY MONTH ===');
const prByMonth = db.prepare(`
  SELECT strftime('%Y-%m', purchase_date) as month, COUNT(*) as cnt, SUM(total) as total
  FROM purchases WHERE void=0
  GROUP BY month ORDER BY month
`).all();
console.table(prByMonth);

console.log('\n=== PURCHASE PAYMENT STATUS ===');
const payStatus = db.prepare("SELECT payment_status, COUNT(*) as cnt, SUM(total) as total FROM purchases GROUP BY payment_status").all();
console.table(payStatus);

console.log('\n=== STOCK MOVEMENTS BY TYPE ===');
const mvType = db.prepare("SELECT reference_type, movement_type, COUNT(*) as cnt, SUM(quantity) as qty FROM stock_movements GROUP BY reference_type, movement_type ORDER BY reference_type").all();
console.table(mvType);

console.log('\n=== MEMORIAL JOURNALS ===');
const mj = db.prepare('SELECT id, journal_number, journal_date, notes, total_debit, total_credit, status FROM memorial_journals ORDER BY id').all();
console.table(mj);

console.log('\n=== CASH MUTATIONS ===');
const cm = db.prepare('SELECT mutation_number, mutation_date, mutation_type, total_amount FROM cash_mutations WHERE status=\'active\' ORDER BY id').all();
console.table(cm);

console.log('\n=== AR/AP PAYMENTS ===');
const ar = db.prepare('SELECT payment_number, payment_date, customer_name, total FROM ar_payments WHERE void=0 ORDER BY id').all();
console.log('AR Payments:', ar.length);
const ap = db.prepare('SELECT payment_number, payment_date, supplier_id, total FROM ap_payments WHERE void=0 ORDER BY id').all();
console.log('AP Payments:', ap.length);

db.close();
