const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');

// Simulate what loadAllEntries + neraca would compute
const allEntries = [];

// Helper
function add(source, num, desc, code, name, debit, credit) {
  allEntries.push({ code, name, debit, credit, source, num, desc });
}

function accCode(id) {
  if (!id) return { code: null, name: null };
  const a = db.prepare('SELECT code, name FROM accounts WHERE id=?').get(id);
  return a || { code: null, name: null };
}

// Load account_mappings
const rows2 = db.prepare('SELECT map_group, map_key, account_id FROM account_mappings').all();
const m = {};
for (const r of rows2) {
  m[r.map_group] = m[r.map_group] || {};
  m[r.map_group][r.map_key] = Number(r.account_id);
}
const aof = (g, k) => m[g]?.[k] ?? null;
const map = {
  piutang_dagang: aof('pelanggan', 'piutang_dagang'),
  penjualan_barang: aof('pelanggan', 'penjualan_barang'),
  hpp: aof('pelanggan', 'hpp'),
  persediaan_barang: aof('barang', 'persediaan_barang'),
  hutang_dagang: aof('supplier', 'hutang_dagang'),
  potongan_penjualan: aof('pelanggan', 'potongan_penjualan'),
  ppn_keluaran: aof('pelanggan', 'ppn_keluaran'),
  ppn_masukan: aof('supplier', 'ppn_masukan'),
  service_charge: aof('pelanggan', 'service_charge'),
  default_cash_account: aof('pelanggan', 'default_cash_account'),
};

// Section 1: Memorial Journals
const mjs = db.prepare("SELECT j.id, j.journal_number, j.journal_date, j.notes, d.account_code, d.notes as dnotes, d.debit, d.credit FROM memorial_journals j JOIN memorial_journal_details d ON d.memorial_journal_id=j.id WHERE j.status='active' ORDER BY j.id, d.line_no").all();
for (const mj of mjs) {
  add('Jurnal Memorial', mj.journal_number, mj.notes, mj.account_code, '', mj.debit, mj.credit);
}

// Section 2: Sales
const sales = db.prepare("SELECT t.id, t.transaction_number, COALESCE(t.transaction_date, t.tgl_nota, SUBSTR(t.created_at,1,10)) as tdate, t.total, t.subtotal, t.discount_amount, t.ppn_amount, t.customer_name, t.customer_id FROM transactions t WHERE COALESCE(t.status,'') NOT IN ('void','cancelled') ORDER BY tdate, t.id").all();
for (const s of sales) {
  const total = Number(s.total || 0);
  const subtotal = Number(s.subtotal || 0);
  const discAmt = Number(s.discount_amount || 0);
  const ppnAmt = Number(s.ppn_amount || 0);
  const arAcc = accCode(map.piutang_dagang);
  const revAcc = accCode(map.penjualan_barang);
  const discAcc = accCode(map.potongan_penjualan);
  const ppnKelAcc = accCode(map.ppn_keluaran);
  if (arAcc.code) add('Penjualan', s.transaction_number, s.customer_name, arAcc.code, arAcc.name, total, 0);
  if (revAcc.code) add('Penjualan', s.transaction_number, s.customer_name, revAcc.code, revAcc.name, 0, subtotal);
  if (discAcc.code && discAmt > 0) add('Penjualan', s.transaction_number, 'Disc', discAcc.code, discAcc.name, discAmt, 0);
  if (ppnKelAcc.code && ppnAmt > 0) add('Penjualan', s.transaction_number, 'PPN', ppnKelAcc.code, ppnKelAcc.name, 0, ppnAmt);
  // HPP
  if (map.hpp && map.persediaan_barang) {
    const cogsRow = db.prepare("SELECT COALESCE(SUM(cogs_total),0) as total FROM transaction_items WHERE transaction_id=? AND COALESCE(cogs_total,0)>0").get(s.id);
    const cogsTotal = Number(cogsRow?.total || 0);
    if (cogsTotal > 0) {
      const hppAcc = accCode(map.hpp);
      const persAcc = accCode(map.persediaan_barang);
      if (hppAcc.code && persAcc.code) {
        add('Penjualan', s.transaction_number, 'HPP', hppAcc.code, hppAcc.name, cogsTotal, 0);
        add('Penjualan', s.transaction_number, 'Persediaan', persAcc.code, persAcc.name, 0, cogsTotal);
      }
    }
  }
  // Auto AR payment
  const tps = db.prepare("SELECT method, amount, account_id FROM transaction_payments WHERE transaction_id=?").all(s.id);
  if (tps.length > 0 && arAcc.code) {
    const allHave = tps.every(tp => tp.account_id != null);
    if (allHave) {
      const existing = db.prepare("SELECT COUNT(*) as cnt FROM ar_payment_items pai JOIN ar_payments ap ON ap.id=pai.payment_id AND ap.status='active' WHERE pai.sale_id=?").get(s.id);
      if (!existing?.cnt) {
        add('Terima Piutang', s.transaction_number, s.customer_name, arAcc.code, arAcc.name, 0, total);
        for (const tp of tps) {
          const tpAcc = accCode(Number(tp.account_id));
          if (tpAcc.code) add('Terima Piutang', s.transaction_number, tp.method, tpAcc.code, tpAcc.name, Number(tp.amount||0), 0);
        }
      }
    }
  }
}

// Section 3: Purchases
const purchases = db.prepare("SELECT p.id, p.purchase_number, p.purchase_date as tdate, p.total, COALESCE(p.ppn_amount,0) as ppn_amount, p.supplier_id, COALESCE((SELECT s.name FROM master_supplier s WHERE s.id=p.supplier_id),'') as supplier_name FROM purchases p WHERE (p.is_return IS NULL OR p.is_return=0) AND COALESCE(p.void,0)=0 ORDER BY p.purchase_date, p.id").all();
for (const pr of purchases) {
  const total = Number(pr.total || 0);
  const ppnAmt = Number(pr.ppn_amount || 0);
  const invTotal = total - ppnAmt;
  if (total <= 0) continue;
  const apAcc = accCode(map.hutang_dagang);
  const ppnMasAcc = accCode(map.ppn_masukan);
  if (map.persediaan_barang) {
    const invAcc = accCode(map.persediaan_barang);
    if (invAcc.code) add('Pembelian', pr.purchase_number, pr.supplier_name, invAcc.code, invAcc.name, Math.round(invTotal*100)/100, 0);
  }
  if (ppnMasAcc.code && ppnAmt > 0) add('Pembelian', pr.purchase_number, 'PPN', ppnMasAcc.code, ppnMasAcc.name, Math.round(ppnAmt*100)/100, 0);
  if (apAcc.code) add('Pembelian', pr.purchase_number, pr.supplier_name, apAcc.code, apAcc.name, 0, total);
}

// Section 4: AP Payments
const apPays = db.prepare("SELECT p.id, p.payment_number, p.payment_date, p.supplier_id, COALESCE((SELECT s.name FROM master_supplier s WHERE s.id=p.supplier_id),'') as name FROM ap_payments p WHERE p.status='active' ORDER BY p.payment_date, p.id").all();
for (const ap of apPays) {
  const apAcc = accCode(map.hutang_dagang);
  const methods = db.prepare("SELECT account_id, amount FROM ap_payment_methods WHERE payment_id=?").all(ap.id);
  const extras = db.prepare("SELECT account_id, debit, credit FROM ap_payment_extras WHERE payment_id=?").all(ap.id);
  const items = db.prepare("SELECT pay_amount, remarks, source_type FROM ap_payment_items WHERE payment_id=?").all(ap.id);
  for (const it of items) {
    const payAmt = Number(it.pay_amount || 0);
    if (apAcc.code) add('Bayar Hutang', ap.payment_number, it.remarks || '', apAcc.code, apAcc.name, payAmt, 0);
  }
  for (const mtd of methods) {
    const mtdAcc = accCode(Number(mtd.account_id));
    if (mtdAcc.code) add('Bayar Hutang', ap.payment_number, 'via', mtdAcc.code, mtdAcc.name, 0, Number(mtd.amount||0));
  }
  for (const ext of extras) {
    const extAcc = accCode(Number(ext.account_id));
    if (extAcc.code) {
      if (Number(ext.debit||0) > 0) add('Bayar Hutang', ap.payment_number, 'extra', extAcc.code, extAcc.name, Number(ext.debit||0), 0);
      if (Number(ext.credit||0) > 0) add('Bayar Hutang', ap.payment_number, 'extra', extAcc.code, extAcc.name, 0, Number(ext.credit||0));
    }
  }
}

// Section 5: AR Payments
const arPays = db.prepare("SELECT p.id, p.payment_number, p.payment_date, p.customer_name, p.total FROM ar_payments p WHERE p.status='active' ORDER BY p.payment_date, p.id").all();
for (const ar of arPays) {
  const total = Number(ar.total || 0);
  const arAcc = accCode(map.piutang_dagang);
  const methods = db.prepare("SELECT account_id, amount FROM ar_payment_methods WHERE payment_id=?").all(ar.id);
  const extras = db.prepare("SELECT account_id, debit, credit FROM ar_payment_extras WHERE payment_id=?").all(ar.id);
  if (arAcc.code) add('Terima Piutang', ar.payment_number, ar.customer_name, arAcc.code, arAcc.name, 0, total);
  for (const mtd of methods) {
    const mtdAcc = accCode(Number(mtd.account_id));
    if (mtdAcc.code) add('Terima Piutang', ar.payment_number, 'via', mtdAcc.code, mtdAcc.name, Number(mtd.amount||0), 0);
  }
  for (const ext of extras) {
    const extAcc = accCode(Number(ext.account_id));
    if (extAcc.code) {
      if (Number(ext.debit||0) > 0) add('Terima Piutang', ar.payment_number, 'extra', extAcc.code, extAcc.name, Number(ext.debit||0), 0);
      if (Number(ext.credit||0) > 0) add('Terima Piutang', ar.payment_number, 'extra', extAcc.code, extAcc.name, 0, Number(ext.credit||0));
    }
  }
}

// Section 6: Cash Mutations
const cms = db.prepare("SELECT id, mutation_number, mutation_date, cash_account_code, mutation_type, total_amount, notes FROM cash_mutations WHERE status='active' ORDER BY id").all();
for (const cm of cms) {
  const total = Number(cm.total_amount || 0);
  const details = db.prepare("SELECT account_code, amount FROM cash_mutation_details WHERE cash_mutation_id=? ORDER BY line_no").all(cm.id);
  if (cm.mutation_type === 'MASUK') {
    add('Mutasi Kas', cm.mutation_number, cm.notes, cm.cash_account_code, '', total, 0);
    for (const det of details) add('Mutasi Kas', cm.mutation_number, det.notes || '', det.account_code, '', 0, Number(det.amount||0));
  } else {
    add('Mutasi Kas', cm.mutation_number, cm.notes, cm.cash_account_code, '', 0, total);
    for (const det of details) add('Mutasi Kas', cm.mutation_number, det.notes || '', det.account_code, '', Number(det.amount||0), 0);
  }
}

// Section 9: Stock Usage
const usages = db.prepare("SELECT u.id, u.number, u.tdate FROM stock_usage u WHERE u.status='approved' AND (u.void IS NULL OR u.void=0) ORDER BY u.tdate, u.id").all();
for (const u of usages) {
  const items2 = db.prepare("SELECT SUM(COALESCE(cogs_total,0)) as total FROM stock_usage_items WHERE usage_id=?").get(u.id);
  const cogsTotal = Number(items2?.total || 0);
  if (cogsTotal > 0) {
    const hppAcc = accCode(map.hpp);
    const persAcc = accCode(map.persediaan_barang);
    if (hppAcc.code && persAcc.code) {
      add('Pemakaian Stok', u.number, '', hppAcc.code, hppAcc.name, cogsTotal, 0);
      add('Pemakaian Stok', u.number, '', persAcc.code, persAcc.name, 0, cogsTotal);
    }
  }
}

// === ANALYSIS ===
console.log('Total entries:', allEntries.length);
let totalDebit = 0, totalCredit = 0;
for (const e of allEntries) {
  totalDebit += e.debit;
  totalCredit += e.credit;
  // Also track by first digit of code
}
console.log('Total Debit:', totalDebit.toLocaleString());
console.log('Total Credit:', totalCredit.toLocaleString());
console.log('Diff:', (totalDebit - totalCredit).toLocaleString());

// By category
const cats = { '1':0, '2':0, '3':0, '4':0, '5':0, '6':0, '7':0, '8':0, 'other':0 };
for (const e of allEntries) {
  const prefix = (e.code || 'x')[0];
  const cat = '12345678'.includes(prefix) ? prefix : 'other';
  const normBalance = { '1':'D', '2':'C', '3':'C', '4':'C', '5':'D', '6':'D', '7':'C', '8':'D' }[prefix] || 'D';
  const bal = normBalance === 'D' ? e.debit - e.credit : e.credit - e.debit;
  cats[cat] = (cats[cat] || 0) + bal;
}

console.log('\nBalance by category:');
for (const [k, v] of Object.entries(cats)) {
  if (Math.abs(v) > 0.01) console.log(`  ${k}: ${v.toLocaleString()}`);
}

// Total aset vs kewajiban+ekuitas+laba
const totalAset = cats['1'];
const totalKewajiban = cats['2'];
const totalEkuitas = cats['3'];
const labaBersih = cats['4'] + cats['5'] + cats['6'] + cats['7'] + cats['8'];
console.log('\ntotalAset:', totalAset.toLocaleString());
console.log('totalKewajiban:', totalKewajiban.toLocaleString());
console.log('totalEkuitas:', totalEkuitas.toLocaleString());
console.log('labaBersih (4+5+6+7+8):', labaBersih.toLocaleString());
console.log('Kewajiban+Ekuitas+Laba:', (totalKewajiban + totalEkuitas + labaBersih).toLocaleString());
console.log('Selisih:', (totalAset - (totalKewajiban + totalEkuitas + labaBersih)).toLocaleString());

// Show entries for codes that don't match any account
const accountCodes = new Set(db.prepare("SELECT code FROM accounts WHERE is_header=0").all().map(r => r.code));
const missing = allEntries.filter(e => !accountCodes.has(e.code));
if (missing.length > 0) {
  console.log('\n=== Entries with codes not in COA ===');
  for (const e of missing) console.log(`  ${e.code} (${e.name}): D=${e.debit} C=${e.credit} - ${e.source} ${e.num}`);
}

// Show entries grouped by code
console.log('\n=== Balance by account code ===');
const byCode = {};
for (const e of allEntries) {
  const code = e.code || 'NOCODE';
  byCode[code] = byCode[code] || { debit: 0, credit: 0 };
  byCode[code].debit += e.debit;
  byCode[code].credit += e.credit;
}
for (const [code, v] of Object.entries(byCode)) {
  const bal = v.debit - v.credit;
  if (Math.abs(bal) > 0.01) console.log(`  ${code}: D=${v.debit.toLocaleString()} C=${v.credit.toLocaleString()} Net=${bal.toLocaleString()}`);
}

db.close();
