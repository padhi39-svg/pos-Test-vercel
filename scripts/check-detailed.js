const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');

console.log('=== MASTER INGREDIENT ===');
try {
  const ig = db.prepare('SELECT * FROM master_ingredient').all();
  console.table(ig);
} catch(e) { console.log('No master_ingredient table or error:', e.message); }

console.log('\n=== BARANG RECIPES ===');
try {
  const r = db.prepare('SELECT * FROM barang_recipes').all();
  console.table(r);
} catch(e) { console.log('No barang_recipes table or error:', e.message); }

console.log('\n=== MASTER BARANG ===');
const mb = db.prepare('SELECT id, code, name, hpp, jenis FROM master_barang').all();
console.table(mb);

console.log('\n=== BARANG UNITS ===');
const bu = db.prepare('SELECT * FROM barang_units').all();
console.table(bu);

console.log('\n=== BARANG PRICES ===');
const bp = db.prepare('SELECT * FROM barang_prices').all();
console.table(bp);

console.log('\n=== STOCK MOVEMENTS ===');
const sm = db.prepare('SELECT * FROM stock_movements').all();
console.table(sm);

console.log('\n=== STOCK BALANCE ===');
const sb = db.prepare('SELECT * FROM stock_balance').all();
console.table(sb);

console.log('\n=== EXISTING TRANSACTIONS ===');
const tx = db.prepare("SELECT id, transaction_number, customer_id, subtotal, total, status, tgl_nota, payment_method, warehouse_id, period_id FROM transactions").all();
console.table(tx);
const txi = db.prepare('SELECT * FROM transaction_items').all();
console.table(txi);
const txp = db.prepare('SELECT * FROM transaction_payments').all();
console.table(txp);

console.log('\n=== EXISTING PURCHASES ===');
const pr = db.prepare('SELECT id, purchase_number, supplier_id, warehouse_id, purchase_date, subtotal, total, status, void, paid_amount FROM purchases').all();
console.table(pr);
const pr2 = db.prepare('SELECT * FROM purchase_items').all();
console.table(pr2);

console.log('\n=== EXISTING STOCK TRANSFERS ===');
const st = db.prepare('SELECT * FROM stock_transfers').all();
console.table(st);
const st2 = db.prepare('SELECT * FROM stock_transfer_items').all();
console.table(st2);

console.log('\n=== EXISTING STOCK USAGE ===');
const su = db.prepare('SELECT * FROM stock_usage').all();
console.table(su);
const su2 = db.prepare('SELECT * FROM stock_usage_items').all();
console.table(su2);

console.log('\n=== EXISTING MEMORIAL JOURNALS ===');
const mj = db.prepare('SELECT * FROM memorial_journals').all();
console.table(mj);
const mjd = db.prepare('SELECT * FROM memorial_journal_details').all();
console.table(mjd);

console.log('\n=== ACCOUNT MAPPINGS ===');
const am = db.prepare('SELECT * FROM account_mappings').all();
console.table(am);

console.log('\n=== MASTER CUSTOMER ===');
const mc = db.prepare('SELECT * FROM master_customer').all();
console.table(mc);

console.log('\n=== MASTER SUPPLIER ===');
const ms = db.prepare('SELECT * FROM master_supplier').all();
console.table(ms);

console.log('\n=== MASTER GUDANG ===');
const mg = db.prepare('SELECT * FROM master_gudang').all();
console.table(mg);

console.log('\n=== MASTER BANKS ===');
const mbank = db.prepare('SELECT * FROM master_banks').all();
console.table(mbank);

console.log('\n=== MASTER PERIODE ===');
const mp = db.prepare('SELECT * FROM master_periode').all();
console.table(mp);

console.log('\n=== ALL ACCOUNTS (non-header) ===');
const accts = db.prepare("SELECT id, code, name, level, is_header, normal_balance, is_cash, is_bank_account FROM accounts WHERE is_header=0 OR is_cash=1 OR is_bank_account=1 ORDER BY code").all();
console.table(accts);

db.close();
