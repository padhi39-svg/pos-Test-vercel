const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');

console.log('=== DATA FOR ACCOUNTING ENGINE ===');
const sales = db.prepare("SELECT COUNT(*) as cnt FROM transactions WHERE COALESCE(void,0)=0 AND status IN ('completed','unpaid')").get();
console.log('Active sales:', sales.cnt);
const purchases = db.prepare("SELECT COUNT(*) as cnt FROM purchases WHERE void=0").get();
console.log('Active purchases:', purchases.cnt);
const ap = db.prepare("SELECT COUNT(*) as cnt FROM ap_payments WHERE void=0").get();
console.log('Active AP payments:', ap.cnt);
const ar = db.prepare("SELECT COUNT(*) as cnt FROM ar_payments WHERE void=0").get();
console.log('Active AR payments:', ar.cnt);
const cm = db.prepare("SELECT COUNT(*) as cnt FROM cash_mutations WHERE status='active'").get();
console.log('Active cash mutations:', cm.cnt);
const su = db.prepare("SELECT COUNT(*) as cnt FROM stock_usage WHERE void=0 AND status='approved'").get();
console.log('Approved stock usage:', su.cnt);
const mj = db.prepare("SELECT COUNT(*) as cnt FROM memorial_journals WHERE status='active'").get();
console.log('Active memorial journals:', mj.cnt);
const am = db.prepare('SELECT COUNT(*) as cnt FROM account_mappings').get();
console.log('account_mappings count:', am.cnt);

// Test: what would the neraca report see?
console.log('\n=== SIMULATE NERACA (Mei 2026) ===');
const period = db.prepare("SELECT * FROM master_periode WHERE code='202605'").get();
console.log('Period:', period.code, period.end_date);

// Load all entries from accounting engine
const { loadAllEntries } = require('./src/lib/accountingEntries');
try {
  const entries = loadAllEntries(db, '2000-01-01', period.end_date);
  console.log('Total entries:', entries.length);
  if (entries.length > 0) {
    const sample = entries.slice(0, 5);
    sample.forEach(e => console.log('  ', e.account_code, e.account_name, 'D:', e.debit, 'C:', e.credit, '|', e.description));
    console.log('...');
    // Summarize by account
    const byAcct = {};
    for (const e of entries) {
      const key = e.account_code + ' ' + e.account_name;
      byAcct[key] = byAcct[key] || { debit: 0, credit: 0 };
      byAcct[key].debit += e.debit;
      byAcct[key].credit += e.credit;
    }
    console.log('\nEntry summary by account:');
    for (const [k, v] of Object.entries(byAcct)) {
      if (v.debit || v.credit) console.log(`  ${k}: D=${v.debit.toLocaleString()} C=${v.credit.toLocaleString()}`);
    }
  }
} catch(e) {
  console.log('Error loading entries:', e.message);
}

db.close();
