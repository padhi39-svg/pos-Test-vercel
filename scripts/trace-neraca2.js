const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');

// Load entries for Mei 2026
const startDate = '2000-01-01';
const asOf = '2026-05-31';

// --- Section 1: Memorial Journals ---
const mjRows = db.prepare(`
  SELECT j.journal_date as entry_date, j.journal_number as source_number, 
         'Jurnal Memorial' as source_type,
         j.notes as description,
         d.account_code, (SELECT name FROM accounts a WHERE a.id = d.account_id LIMIT 1) AS account_name,
         d.debit, d.credit, d.notes as line_notes
  FROM memorial_journals j
  JOIN memorial_journal_details d ON d.memorial_journal_id = j.id
  WHERE j.status = 'active'
    AND j.journal_date >= ? AND j.journal_date <= ?
  ORDER BY j.journal_date, j.id, d.line_no
`).all(startDate, asOf);
console.log('Memorial entries:', mjRows.length);
mjRows.forEach(r => console.log(`  ${r.account_code}: D=${r.debit} C=${r.credit}`));

// --- Section 3: Purchases ---
const purchases = db.prepare(`
  SELECT p.id, p.purchase_number as source_number, p.purchase_date as entry_date,
         'Pembelian' as source_type,
         COALESCE((SELECT s.name FROM master_supplier s WHERE s.id = p.supplier_id), '') as supplier_name,
         p.total, COALESCE(p.ppn_amount,0) as ppn_amount, p.subtotal
  FROM purchases p
  WHERE p.purchase_date >= ? AND p.purchase_date <= ?
    AND (p.is_return IS NULL OR p.is_return = 0)
    AND COALESCE(p.void, 0) = 0
  ORDER BY p.purchase_date, p.id
`).all(startDate, asOf);
console.log('\nPurchase entries:', purchases.length);

// Purchase items for inventory
const map = (() => {
  const rows = db.prepare(`SELECT map_group, map_key, account_id FROM account_mappings`).all();
  const m = {};
  for (const r of rows) {
    m[r.map_group] = m[r.map_group] || {};
    m[r.map_group][r.map_key] = Number(r.account_id);
  }
  return {
    persediaan_barang: m['barang']?.['persediaan_barang'] ?? null,
    hutang_dagang: m['supplier']?.['hutang_dagang'] ?? null,
    ppn_masukan: m['supplier']?.['ppn_masukan'] ?? null,
  };
})();

console.log('Mappings:', JSON.stringify(map));

for (const pr of purchases) {
  const total = Number(pr.total || 0);
  const ppnAmt = Number(pr.ppn_amount || 0);
  const invTotal = total - ppnAmt;
  
  // Purchase items
  const items = db.prepare(`
    SELECT pi.quantity, pi.unit_price, pi.total_price, b.account_id
    FROM purchase_items pi
    LEFT JOIN master_barang b ON b.id = pi.barang_id
    WHERE pi.purchase_id = ?
  `).all(pr.id);
  
  const invByAccount = {};
  let rawInvTotal = 0;
  for (const item of items) {
    const invId = item.account_id || map.persediaan_barang || 0;
    const lineTotal = Number(item.total_price || item.quantity * item.unit_price || 0);
    rawInvTotal += lineTotal;
    invByAccount[invId] = invByAccount[invId] || { id: invId, total: 0 };
    invByAccount[invId].total += lineTotal;
  }
  
  const ratio = rawInvTotal > 0 ? invTotal / rawInvTotal : 1;
  const invAccounts = Object.values(invByAccount);
  console.log(`\nPurchase #${pr.source_number}:`);
  for (const ia of invAccounts) {
    const iaAcc = db.prepare('SELECT code, name FROM accounts WHERE id = ?').get(ia.id);
    if (iaAcc) {
      const debit = Math.round(ia.total * ratio * 100) / 100;
      console.log(`  Inventory (${iaAcc.code}): D=${debit}`);
    }
  }
}

// --- Combined: find Persediaan entries ---
console.log('\n\n=== NERACA SIMULATION ===');
const allEntries = mjRows.map(r => ({
  account_code: r.account_code,
  debit: Number(r.debit||0),
  credit: Number(r.credit||0),
}));

// Add purchase entries
for (const pr of purchases) {
  const total = Number(pr.total || 0);
  const ppnAmt = Number(pr.ppn_amount || 0);
  const invTotal = total - ppnAmt;
  const items = db.prepare(`SELECT pi.total_price, b.account_id FROM purchase_items pi LEFT JOIN master_barang b ON b.id = pi.barang_id WHERE pi.purchase_id = ?`).all(pr.id);
  let rawInvTotal = 0;
  const invByAccount = {};
  for (const item of items) {
    const invId = item.account_id || map.persediaan_barang || 0;
    const lineTotal = Number(item.total_price || 0);
    rawInvTotal += lineTotal;
    invByAccount[invId] = invByAccount[invId] || { id: invId, total: 0 };
    invByAccount[invId].total += lineTotal;
  }
  const ratio = rawInvTotal > 0 ? invTotal / rawInvTotal : 1;
  for (const ia of Object.values(invByAccount)) {
    const iaAcc = db.prepare('SELECT code, name FROM accounts WHERE id = ?').get(ia.id);
    if (iaAcc) {
      allEntries.push({
        account_code: iaAcc.code,
        debit: Math.round(ia.total * ratio * 100) / 100,
        credit: 0,
      });
    }
  }
  // AP
  const apAcc = db.prepare('SELECT code, name FROM accounts WHERE id = ?').get(map.hutang_dagang);
  if (apAcc) {
    allEntries.push({ account_code: apAcc.code, debit: 0, credit: total });
  }
  // PPN
  if (map.ppn_masukan && ppnAmt > 0) {
    const ppnAcc = db.prepare('SELECT code, name FROM accounts WHERE id = ?').get(map.ppn_masukan);
    if (ppnAcc) {
      allEntries.push({ account_code: ppnAcc.code, debit: ppnAmt, credit: 0 });
    }
  }
}

// Calculate balances
const accounts = db.prepare("SELECT * FROM accounts WHERE is_active = 1").all();
const balances = {};
for (const a of accounts) balances[a.code] = 0;

for (const e of allEntries) {
  if (balances[e.account_code] !== undefined) {
    const acct = accounts.find(a => a.code === e.account_code);
    const nb = acct?.normal_balance || 'D';
    if (nb === 'D') balances[e.account_code] += e.debit - e.credit;
    else balances[e.account_code] += e.credit - e.debit;
  }
}

// Persediaan
console.log('130-001-01 balance:', balances['130-001-01']);
console.log('Total Aset (1*):', Object.keys(balances).filter(k=>k.startsWith('1')).reduce((s,k)=>s+balances[k],0));
console.log('Total Kewajiban (2*):', Object.keys(balances).filter(k=>k.startsWith('2')).reduce((s,k)=>s+balances[k],0));
console.log('Total Ekuitas (3*):', Object.keys(balances).filter(k=>k.startsWith('3')).reduce((s,k)=>s+balances[k],0));

// Show all balances non-zero
console.log('\nAll non-zero balances:');
for (const [code, bal] of Object.entries(balances)) {
  if (bal !== 0) console.log(`  ${code}: ${bal}`);
}

// Check barang account_id
console.log('\n=== BARANG ACCOUNTS ===');
const barangs = db.prepare('SELECT id, code, name, account_id FROM master_barang').all();
console.table(barangs);

// Check account 9 (130-001-01)
const acct9 = accounts.find(a => a.id === 9);
console.log('Account 9 (130-001-01):', JSON.stringify(acct9));

db.close();
