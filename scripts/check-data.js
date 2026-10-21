const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');

console.log('=== STOCK BALANCE ===');
const sb = db.prepare('SELECT sb.*, mb.code, mb.name FROM stock_balance sb LEFT JOIN master_barang mb ON mb.id = sb.ingredient_id ORDER BY sb.ingredient_id, sb.warehouse_id').all();
console.table(sb);

console.log('\n=== MEMORIAL JOURNALS ===');
const mj = db.prepare('SELECT id, journal_number, journal_date, notes, total_debit, total_credit, status FROM memorial_journals ORDER BY id').all();
console.table(mj);

console.log('\n=== MEMORIAL JOURNAL DETAILS ===');
const mjd = db.prepare('SELECT d.id, d.memorial_journal_id, d.account_code, d.notes, d.debit, d.credit FROM memorial_journal_details d ORDER BY d.memorial_journal_id, d.line_no').all();
console.table(mjd);

console.log('\n=== PURCHASES ===');
const pr = db.prepare('SELECT id, purchase_number, purchase_date, subtotal, discount_percent, discount_amount, ppn_percent, ppn_amount, total, void FROM purchases ORDER BY id').all();
console.table(pr);

console.log('\n=== PURCHASE ITEMS ===');
const pi = db.prepare('SELECT pi.*, mb.code, mb.name FROM purchase_items pi LEFT JOIN master_barang mb ON mb.id = pi.barang_id ORDER BY pi.id').all();
console.table(pi);

console.log('\n=== TRANSACTIONS ===');
const tx = db.prepare('SELECT id, transaction_number, transaction_date, subtotal, total, status FROM transactions ORDER BY id').all();
console.table(tx);

console.log('\n=== STOCK MOVEMENTS ===');
const sm = db.prepare('SELECT * FROM stock_movements ORDER BY id').all();
console.table(sm);

console.log('\n=== PERIODS ===');
const per = db.prepare('SELECT id, code, name, start_date, end_date, is_active FROM master_periode ORDER BY id').all();
console.table(per);

db.close();
