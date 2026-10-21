const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');
console.log('=== Piutang transactions ===');
const piutang = db.prepare("SELECT id, transaction_number, customer_id, total, payment_amount, status, tgl_nota, payment_method FROM transactions WHERE payment_method='piutang' ORDER BY id").all();
console.table(piutang);
console.log('Count:', piutang.length);

console.log('\n=== Transactions void check ===');
const cols = db.prepare("SELECT cid, name, dflt_value FROM pragma_table_info('transactions') ORDER BY cid").all();
const voidCol = cols.find(c => c.name === 'void');
console.log('void column:', voidCol);

console.log('\n=== ar_payments table ===');
const arCount = db.prepare('SELECT COUNT(*) as cnt FROM ar_payments').get();
console.log('ar_payments count:', arCount.cnt);

console.log('\n=== ar_payment_items columns ===');
const arItems = db.prepare("SELECT cid, name FROM pragma_table_info('ar_payment_items') ORDER BY cid").all();
arItems.forEach(c => console.log('  ' + c.cid + ': ' + c.name));

console.log('\n=== ar_payment_methods columns ===');
const arMethods = db.prepare("SELECT cid, name FROM pragma_table_info('ar_payment_methods') ORDER BY cid").all();
arMethods.forEach(c => console.log('  ' + c.cid + ': ' + c.name));

console.log('\n=== ar_payment_extras columns ===');
const arExtras = db.prepare("SELECT cid, name FROM pragma_table_info('ar_payment_extras') ORDER BY cid").all();
arExtras.forEach(c => console.log('  ' + c.cid + ': ' + c.name));

console.log('\n=== ap_payment_items columns ===');
const apItems = db.prepare("SELECT cid, name FROM pragma_table_info('ap_payment_items') ORDER BY cid").all();
apItems.forEach(c => console.log('  ' + c.cid + ': ' + c.name));

db.close();
