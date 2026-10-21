/**
 * SEED DATA 3 BULAN (Maret - Mei 2026)
 * Semua modul: Pembelian, Penjualan, Transfer Stok, Stock Usage,
 * AP Payment, AR Payment, Cash Mutation, Jurnal Memorial
 * @see src/app/api/ for each module's route handler
 */

const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');

// ============================================================
// HELPERS
// ============================================================
const seqStmt = db.prepare("SELECT COALESCE(MAX(seq),0)+1 as n FROM sqlite_sequence WHERE name=?");
const updSeqStmt = db.prepare("INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?,?)");

function nextNumber(table, prefix, year) {
  const row = seqStmt.get(table);
  const n = row ? row.n : 1;
  updSeqStmt.run(table, n);
  return `${prefix}/${year}/${String(n).padStart(6,'0')}`;
}

function findPeriodId(dateStr) {
  const month = dateStr.substring(5,7);
  const year = dateStr.substring(0,4);
  const code = `${year}${month}`;
  const p = db.prepare('SELECT id FROM master_periode WHERE code=?').get(code);
  return p ? p.id : null;
}

// ============================================================
// 1. CREATE MISSING PERIODS
// ============================================================
console.log('=== 1. CREATING PERIODS ===');
const existingPeriods = db.prepare('SELECT code FROM master_periode').all().map(p=>p.code);
const periods = [
  { code:'202603', name:'Maret 2026', start:'2026-03-01', end:'2026-03-31' },
  { code:'202604', name:'April 2026', start:'2026-04-01', end:'2026-04-30' },
];
for (const p of periods) {
  if (!existingPeriods.includes(p.code)) {
    db.prepare(`INSERT INTO master_periode (code, name, start_date, end_date, is_active, isdelete, status_buku, is_closed)
      VALUES (?,?,?,?,0,0,'OPEN',0)`).run(p.code, p.name, p.start, p.end);
    console.log(`  Created period: ${p.name}`);
  } else {
    console.log(`  Period exists: ${p.name}`);
  }
}

// ============================================================
// DATA PINDAHAN
// ============================================================
const barangIds = [1,2,3,4,5];
const warehouseIds = [1,2,3];
const customerIds = [1,2];   // 1=Umum, 2=Portal
const supplierIds = [1,2];   // 1=Umum, 2=Global Indotech
const userId = 1;            // admin

// Cash & Bank accounts
const KAS_BESAR = 4;
const KAS_KECIL = 38;
const BANK_BCA = 5;
const PIUTANG = 7;
const PERSEDIAAN = 9;
const HUTANG = 45;
const PENJUALAN = 23;
const HPP = 26;
const PPN_MASUKAN = 50;
const PPN_KELUARAN = 52;
const MODAL = 19;

// Barang data
const barang = {
  1: { name:'Kaspersky 3 User Licensi', code:'KAV3USER', hpp:275000, price:450000 },
  2: { name:'Epson Tmu-220 D', code:'TMU-220', hpp:2400000, price:2575000 },
  3: { name:'Tenda Sg105 Desktop Switch Gygabyte', code:'TSG105', hpp:130000, price:250000 },
  4: { name:'Tenda Ac6/ac1200 Wall Killer Gygabyte', code:'TAC61200', hpp:300000, price:375000 },
  5: { name:'Tenda Tx2 Pro Gygabyte', code:'TTX2PRO', hpp:500000, price:650000 },
};

// ============================================================
// MONTHLY DATA GENERATORS
// ============================================================
const months = [
  { periodId: findPeriodId('2026-03-01'), year:'2026', month:'03', prefix:'Mar' },
  { periodId: findPeriodId('2026-04-01'), year:'2026', month:'04', prefix:'Apr' },
  { periodId: findPeriodId('2026-05-01'), year:'2026', month:'05', prefix:'Mei' },
];

console.log('\n=== 2. SEEDING TRANSACTIONS ===\n');

// ============================================================
// PURCHASES (Pembelian)
// ============================================================
console.log('--- Purchases ---');
const insPurchase = db.prepare(`INSERT INTO purchases 
  (purchase_number, supplier_id, warehouse_id, purchase_date, invoice_number, period_id,
   subtotal, discount_percent, discount_amount, ppn_percent, ppn_amount, total,
   payment_status, paid_amount, is_return, status, void, notes, created_at, updated_at, user_create)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'Belum Bayar',0,0,'active',0,?,datetime('now'),datetime('now'),?)`);

const insPurchaseItem = db.prepare(`INSERT INTO purchase_items
  (purchase_id, barang_id, quantity, unit_name, unit_ratio, unit_price, discount_percent, discount_amount, total_price, created_at, updated_at)
  VALUES (?,?,?,'pcs',1,?,0,0,?,datetime('now'),datetime('now'))`);

const insStockMovement = db.prepare(`INSERT INTO stock_movements
  (ingredient_id, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, notes, created_at, transaction_date, unit_cost, total_cost, period_id, updated_at)
  VALUES (?,?,'in',?,'pcs','purchase',?,?,datetime('now'),?,?,?,?,datetime('now'))`);

function updateStockBalance(ingredientId, warehouseId, qty, unitCost) {
  const existing = db.prepare('SELECT * FROM stock_balance WHERE ingredient_id=? AND warehouse_id=?').get(ingredientId, warehouseId);
  if (existing) {
    const oldQty = Number(existing.quantity);
    const oldCost = Number(existing.total_cost);
    const newQty = oldQty + qty;
    const newCost = oldCost + (qty * unitCost);
    const avgCost = newQty > 0 ? newCost / newQty : 0;
    db.prepare('UPDATE stock_balance SET quantity=?, avg_cost=?, total_cost=?, updated_at=datetime(\'now\') WHERE ingredient_id=? AND warehouse_id=?')
      .run(newQty, avgCost, newCost, ingredientId, warehouseId);
  } else {
    const avgCost = qty > 0 ? (qty * unitCost) / qty : 0;
    db.prepare('INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, avg_cost, total_cost, unit, created_at, updated_at) VALUES (?,?,?,?,?,\'pcs\',datetime(\'now\'),datetime(\'now\'))')
      .run(ingredientId, warehouseId, qty, avgCost, qty * unitCost);
  }
}

const purchaseTpls = [
  // [supplier, items:{barangId, qty, price}, ppn%]
  { items: [[1,3,270000],[2,1,2350000]], ppn:11 },
  { items: [[3,5,125000],[4,3,290000]], ppn:11 },
  { items: [[5,2,480000],[1,2,270000]], ppn:11 },
  { items: [[2,1,2350000],[3,3,125000],[4,2,290000]], ppn:11 },
];
const daysInMonth = [5, 12, 19, 26];

for (const m of months) {
  for (let i = 0; i < purchaseTpls.length; i++) {
    const tpl = purchaseTpls[i];
    const day = daysInMonth[i];
    const dateStr = `2026-${m.month}-${String(day).padStart(2,'0')}`;
    const num = nextNumber('purchases', 'PB', m.year);
    const supplierId = i % 2 === 0 ? 2 : 1; // alternate suppliers
    
    // Calculate
    let subtotal = 0;
    for (const it of tpl.items) {
      subtotal += it[1] * it[2];
    }
    const ppnPercent = tpl.ppn;
    const ppnAmount = Math.round(subtotal * ppnPercent / 100);
    const total = subtotal + ppnAmount;

    // Create purchase
    const r = insPurchase.run(num, supplierId, 1, dateStr, `INV-${num}`, m.periodId,
      subtotal, 0, 0, ppnPercent, ppnAmount, total,
      `Pembelian ${m.prefix} batch ${i+1}`, userId);
    const purchaseId = r.lastInsertRowid;

    // Create items + stock movements
    for (const it of tpl.items) {
      const [barangId, qty, unitPrice] = it;
      const totalPrice = qty * unitPrice;
      insPurchaseItem.run(purchaseId, barangId, qty, unitPrice, totalPrice);
      
      // Stock movement IN
      insStockMovement.run(barangId, 1, qty, purchaseId, `Purchase ${num}`, dateStr, unitPrice, qty * unitPrice, m.periodId);
      
      // Update stock balance
      updateStockBalance(barangId, 1, qty, unitPrice);
    }

    console.log(`  ${m.prefix}: ${num} (supplier=${supplierId}, Rp${total.toLocaleString()})`);
  }
}

// ============================================================
// SALES (Penjualan)
// ============================================================
console.log('\n--- Sales ---');
const insTransaction = db.prepare(`INSERT INTO transactions
  (transaction_number, customer_id, customer_name, subtotal, discount_percent, discount_amount, 
   service_charge_percent, service_charge_amount, ppn_percent, ppn_amount, total,
   payment_method, payment_amount, change_amount, status, tgl_nota, transaction_type, period_id, 
   warehouse_id, user_create, created_at, updated_at, notes)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'completed',?,?,?,?,?,datetime('now'),datetime('now'),?)`);

const insTransactionItem = db.prepare(`INSERT INTO transaction_items
  (transaction_id, barang_id, barang_code, barang_name, quantity, unit_name, unit_ratio, unit_price,
   discount_percent, discount_amount, discon_total, total_price, cogs_unit, cogs_total, created_at, updated_at)
  VALUES (?,?,?,?,1,'pcs',1,?,0,0,0,?,?,?,datetime('now'),datetime('now'))`);

const insTransPayment = db.prepare(`INSERT INTO transaction_payments 
  (transaction_id, method, amount, account_id, created_at)
  VALUES (?,?,?,?,datetime('now'))`);

// Stock movement for sales (OUT)
const insSaleMovement = db.prepare(`INSERT INTO stock_movements
  (ingredient_id, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, notes, created_at, transaction_date, unit_cost, total_cost, period_id, updated_at)
  VALUES (?,?,'out',?,'pcs','sale',?,?,datetime('now'),?,?,?,?,datetime('now'))`);

const saleTpls = [
  { items: [[1,1,450000],[3,1,250000]], cust:1, pay:'cash', discPct:0, discAmt:0 },
  { items: [[4,1,375000],[5,1,650000]], cust:2, pay:'piutang', discPct:2, discAmt:0 },
  { items: [[2,1,2575000],[1,1,450000]], cust:1, pay:'cash', discPct:0, discAmt:0 },
  { items: [[3,2,250000],[4,1,375000]], cust:2, pay:'transfer', discPct:0, discAmt:0 },
];

for (const m of months) {
  for (let i = 0; i < saleTpls.length; i++) {
    const tpl = saleTpls[i];
    const day = daysInMonth[i];
    const dateStr = `2026-${m.month}-${String(day).padStart(2,'0')}`;
    const num = nextNumber('transactions', 'JL', m.year);
    const cust = tpl.cust === 1 ? {id:1, name:'Umum'} : {id:2, name:'Portal'};

    let subtotal = 0;
    const ppnPct = 11;
    let ppnAmount = 0;
    for (const it of tpl.items) {
      const lineTotal = it[1] * it[2];
      subtotal += lineTotal;
    }
    ppnAmount = Math.round(subtotal * ppnPct / 100);
    const total = subtotal + ppnAmount;
    const paymentAmount = tpl.pay === 'piutang' ? 0 : total;

    insTransaction.run(num, cust.id, cust.name, subtotal, tpl.discPct, tpl.discAmt,
      0, 0, ppnPct, ppnAmount, total,
      tpl.pay, paymentAmount, 0, dateStr, 3, m.periodId, 1, userId, `Sales ${m.prefix} batch ${i+1}`);
    const txId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    // Payment record
    if (tpl.pay === 'cash' || tpl.pay === 'transfer') {
      insTransPayment.run(txId, tpl.pay, paymentAmount, KAS_BESAR);
    }

    // Items + stock OUT
    for (const it of tpl.items) {
      const [barangId, qty, unitPrice] = it;
      const totalPrice = qty * unitPrice;

      // Get current avg cost from stock_balance
      const bal = db.prepare('SELECT * FROM stock_balance WHERE ingredient_id=? AND warehouse_id=1').get(barangId);
      const cogsUnit = bal ? Number(bal.avg_cost) : barang[barangId].hpp;
      const cogsTotal = cogsUnit * qty;

      insTransactionItem.run(txId, barangId, barang[barangId].code, barang[barangId].name,
        unitPrice, totalPrice, cogsUnit, cogsTotal);

      // Stock OUT movement
      insSaleMovement.run(barangId, 1, qty, txId, `Sale ${num}`, dateStr, cogsUnit, cogsTotal, m.periodId);

      // Update stock balance
      const existingBal = bal;
      if (existingBal) {
        const oldQty = Number(existingBal.quantity);
        const oldCost = Number(existingBal.total_cost);
        const newQty = oldQty - qty;
        const removedCost = cogsUnit * qty;
        const newCost = oldCost - removedCost;
        const avgCost = newQty > 0 ? newCost / newQty : 0;
        const finalAvg = avgCost > 0 ? avgCost : 0;
        db.prepare('UPDATE stock_balance SET quantity=?, avg_cost=?, total_cost=?, updated_at=datetime(\'now\') WHERE ingredient_id=? AND warehouse_id=?')
          .run(newQty, finalAvg, newCost, barangId, 1);
      }
    }

    console.log(`  ${m.prefix}: ${num} (cust=${cust.name}, Rp${total.toLocaleString()}, pay=${tpl.pay})`);
  }
}

// ============================================================
// STOCK TRANSFERS
// ============================================================
console.log('\n--- Stock Transfers ---');
const insTransfer = db.prepare(`INSERT INTO stock_transfers
  (number, tdate, from_warehouse_id, to_warehouse_id, notes, void, period_id, user_create, created_at, updated_at)
  VALUES (?,?,?,?,?,0,?,?,datetime('now'),datetime('now'))`);

const insTransferItem = db.prepare(`INSERT INTO stock_transfer_items
  (transfer_id, barang_id, qty, unit_id, unit_ratio, qty_total, created_at, updated_at)
  VALUES (?,?,?,null,1,?,datetime('now'),datetime('now'))`);

const insTransferMovement = db.prepare(`INSERT INTO stock_movements
  (ingredient_id, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, notes, created_at, transaction_date, unit_cost, total_cost, period_id, updated_at)
  VALUES (?,?,?,?,'pcs','stock_transfer',?,?,datetime('now'),?,?,?,?,datetime('now'))`);

const transferTpls = [
  { from:1, to:3, items:[[1,1],[3,1]] },
  { from:1, to:2, items:[[4,1],[5,1]] },
  { from:2, to:1, items:[[5,1]] },
  { from:1, to:3, items:[[2,1],[3,1]] },
];

for (const m of months) {
  for (let i = 0; i < transferTpls.length; i++) {
    const tpl = transferTpls[i];
    const day = daysInMonth[i];
    const dateStr = `2026-${m.month}-${String(day).padStart(2,'0')}`;
    const num = nextNumber('stock_transfers', 'TF', m.year);

    insTransfer.run(num, dateStr, tpl.from, tpl.to, `Transfer ${m.prefix} #${i+1}`, m.periodId, userId);
    const trId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    for (const it of tpl.items) {
      const [barangId, qty] = it;
      insTransferItem.run(trId, barangId, qty, qty);

      // Get avg cost for cost tracking
      const bal = db.prepare('SELECT * FROM stock_balance WHERE ingredient_id=? AND warehouse_id=?').get(barangId, tpl.from);
      const unitCost = bal ? Number(bal.avg_cost) : barang[barangId].hpp;
      const totalCost = unitCost * qty;

      // OUT from source
      insTransferMovement.run(barangId, tpl.from, 'out', qty, trId, `Transfer OUT ${num}`, dateStr, unitCost, totalCost, m.periodId);
      // IN to destination
      insTransferMovement.run(barangId, tpl.to, 'in', qty, trId, `Transfer IN ${num}`, dateStr, unitCost, totalCost, m.periodId);

      // Update source balance
      const srcBal = db.prepare('SELECT * FROM stock_balance WHERE ingredient_id=? AND warehouse_id=?').get(barangId, tpl.from);
      if (srcBal) {
        const newQty = Number(srcBal.quantity) - qty;
        const removedCost = unitCost * qty;
        const newTotalCost = Number(srcBal.total_cost) - removedCost;
        db.prepare('UPDATE stock_balance SET quantity=?, total_cost=?, updated_at=datetime(\'now\') WHERE ingredient_id=? AND warehouse_id=?')
          .run(newQty, newTotalCost, barangId, tpl.from);
      }

      // Update destination balance
      const dstBal = db.prepare('SELECT * FROM stock_balance WHERE ingredient_id=? AND warehouse_id=?').get(barangId, tpl.to);
      if (dstBal) {
        const newQty = Number(dstBal.quantity) + qty;
        const newTotalCost = Number(dstBal.total_cost) + totalCost;
        const avgCost = newQty > 0 ? newTotalCost / newQty : 0;
        db.prepare('UPDATE stock_balance SET quantity=?, avg_cost=?, total_cost=?, updated_at=datetime(\'now\') WHERE ingredient_id=? AND warehouse_id=?')
          .run(newQty, avgCost, newTotalCost, barangId, tpl.to);
      } else {
        db.prepare('INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, avg_cost, total_cost, unit, created_at, updated_at) VALUES (?,?,?,?,?,\'pcs\',datetime(\'now\'),datetime(\'now\'))')
          .run(barangId, tpl.to, qty, unitCost, totalCost);
      }
    }

    console.log(`  ${m.prefix}: ${num} (from=G${tpl.from} to=G${tpl.to}, ${tpl.items.length} items)`);
  }
}

// ============================================================
// STOCK USAGE (Pemakaian Barang)
// ============================================================
console.log('\n--- Stock Usage ---');
const insUsage = db.prepare(`INSERT INTO stock_usage
  (number, tdate, warehouse_id, notes, void, status, period_id, user_create, created_at, updated_at)
  VALUES (?,?,?,?,0,'approved',?,?,datetime('now'),datetime('now'))`);

const insUsageItem = db.prepare(`INSERT INTO stock_usage_items
  (usage_id, barang_id, qty, unit_id, unit_ratio, qty_total, cogs_unit, cogs_total, created_at, updated_at)
  VALUES (?,?,?,null,1,?,?,?,datetime('now'),datetime('now'))`);

const insUsageMovement = db.prepare(`INSERT INTO stock_movements
  (ingredient_id, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, notes, created_at, transaction_date, unit_cost, total_cost, period_id, updated_at)
  VALUES (?,?,'out',?,'pcs','usage',?,?,datetime('now'),?,?,?,?,datetime('now'))`);

const usageTpls = [
  { items: [[1,1],[3,1]], wh:1 },
  { items: [[2,1],[4,1]], wh:1 },
  { items: [[5,1]], wh:1 },
  { items: [[1,1],[3,2],[4,1]], wh:1 },
];

for (const m of months) {
  for (let i = 0; i < usageTpls.length; i++) {
    const tpl = usageTpls[i];
    const day = daysInMonth[i];
    const dateStr = `2026-${m.month}-${String(day).padStart(2,'0')}`;
    const num = nextNumber('stock_usage', 'SU', m.year);

    insUsage.run(num, dateStr, tpl.wh, `Pemakaian ${m.prefix} #${i+1}`, m.periodId, userId);
    const usId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    for (const it of tpl.items) {
      const [barangId, qty] = it;

      const bal = db.prepare('SELECT * FROM stock_balance WHERE ingredient_id=? AND warehouse_id=?').get(barangId, tpl.wh);
      const cogsUnit = bal ? Number(bal.avg_cost) : barang[barangId].hpp;
      const cogsTotal = cogsUnit * qty;

      insUsageItem.run(usId, barangId, qty, qty, cogsUnit, cogsTotal);
      insUsageMovement.run(barangId, tpl.wh, qty, usId, `Usage ${num}`, dateStr, cogsUnit, cogsTotal, m.periodId);

      if (bal) {
        const newQty = Number(bal.quantity) - qty;
        const removedCost = cogsUnit * qty;
        const newCost = Number(bal.total_cost) - removedCost;
        db.prepare('UPDATE stock_balance SET quantity=?, total_cost=?, updated_at=datetime(\'now\') WHERE ingredient_id=? AND warehouse_id=?')
          .run(newQty, newCost, barangId, tpl.wh);
      }
    }

    console.log(`  ${m.prefix}: ${num} (wh=${tpl.wh}, ${tpl.items.length} items)`);
  }
}

// ============================================================
// AP PAYMENTS (Pembayaran Hutang)
// ============================================================
console.log('\n--- AP Payments ---');
const insAP = db.prepare(`INSERT INTO ap_payments
  (payment_number, payment_date, supplier_id, period_id, status, void, subtotal, total, notes, user_create, created_at, updated_at)
  VALUES (?,?,?,?,'active',0,?,?,?,?,datetime('now'),datetime('now'))`);

const insAPItem = db.prepare(`INSERT INTO ap_payment_items
  (payment_id, purchase_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
  VALUES (?,?,?,?,?,'AP Payment','purchase',?)`);

const insAPMethod = db.prepare(`INSERT INTO ap_payment_methods
  (payment_id, account_id, amount, notes)
  VALUES (?,?,?,?)`);

// Get purchases with outstanding balances
const unpaidPurchases = db.prepare("SELECT id, purchase_number, total, paid_amount FROM purchases WHERE void=0 AND total > paid_amount ORDER BY id").all();
console.log(`  Found ${unpaidPurchases.length} unpaid purchases`);

for (let pi = 0; pi < unpaidPurchases.length; pi++) {
  const p = unpaidPurchases[pi];
  // Determine which month based on purchase date
  const purch = db.prepare("SELECT purchase_date FROM purchases WHERE id=?").get(p.id);
  const pm = purch.purchase_date.substring(5,7);
  const periodId = findPeriodId(purch.purchase_date);
  const year = purch.purchase_date.substring(0,4);
  if (!periodId) continue;

  const num = nextNumber('ap_payments', 'AP', year);
  const payAmount = Number(p.total) - Number(p.paid_amount || 0);
  if (payAmount <= 0) continue;

  const dayStr = purch.purchase_date.substring(8,10);
  const payDate = `2026-${pm}-${dayStr}`;

  insAP.run(num, payDate, 2, periodId, payAmount, payAmount, `Pembayaran ${p.purchase_number}`, userId);
  const apId = db.prepare('SELECT last_insert_rowid() as id').get().id;

  insAPItem.run(apId, p.id, p.purchase_number, payAmount, payAmount, p.id);
  insAPMethod.run(apId, BANK_BCA, payAmount, 'Transfer BCA');

  // Update purchase payment status
  const newPaid = Number(p.paid_amount || 0) + payAmount;
  const newStatus = newPaid >= Number(p.total) ? 'Lunas' : 'Sebagian';
  db.prepare('UPDATE purchases SET paid_amount=?, payment_status=? WHERE id=?').run(newPaid, newStatus, p.id);

  console.log(`  ${num}: Pay ${p.purchase_number} Rp${payAmount.toLocaleString()}`);
}

// ============================================================
// AR PAYMENTS (Pembayaran Piutang)
// ============================================================
console.log('\n--- AR Payments ---');
const insAR = db.prepare(`INSERT INTO ar_payments
  (payment_number, payment_date, customer_id, customer_name, period_id, status, void, subtotal, total, notes, user_create, created_at, updated_at)
  VALUES (?,?,?,?,?,'active',0,?,?,?,?,datetime('now'),datetime('now'))`);

const insARItem = db.prepare(`INSERT INTO ar_payment_items
  (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
  VALUES (?,?,?,?,?,'AR Payment','transaction',?)`);

const insARMethod = db.prepare(`INSERT INTO ar_payment_methods
  (payment_id, account_id, account_code, account_name, amount, notes)
  VALUES (?,?,?,?,?,?)`);

// Get unpaid piutang transactions
const unpaidSales = db.prepare("SELECT id, transaction_number, total, payment_amount FROM transactions WHERE payment_method='piutang' AND status='completed' AND COALESCE(void,0)=0 ORDER BY id").all();
console.log(`  Found ${unpaidSales.length} unpaid invoices`);

for (let si = 0; si < unpaidSales.length; si++) {
  const s = unpaidSales[si];
  const tx = db.prepare("SELECT tgl_nota, customer_id, customer_name FROM transactions WHERE id=?").get(s.id);
  if (!tx) continue;
  const pm = tx.tgl_nota.substring(5,7);
  const periodId = findPeriodId(tx.tgl_nota);
  const year = tx.tgl_nota.substring(0,4);
  if (!periodId) continue;

  const num = nextNumber('ar_payments', 'AR', year);
  const remaining = Number(s.total) - Number(s.payment_amount || 0);
  if (remaining <= 0) continue;

  const payDate = tx.tgl_nota;

  insAR.run(num, payDate, tx.customer_id, tx.customer_name, periodId, remaining, remaining, `Pembayaran ${s.transaction_number}`, userId);
  const arId = db.prepare('SELECT last_insert_rowid() as id').get().id;

  insARItem.run(arId, s.id, s.transaction_number, remaining, remaining, s.id);

  const methodName = si % 2 === 0 ? 'Kas Besar' : 'Bank BCA';
  const accId = si % 2 === 0 ? KAS_BESAR : BANK_BCA;
  insARMethod.run(arId, accId, null, null, remaining, `Setoran via ${methodName}`);

  db.prepare('UPDATE transactions SET payment_amount=payment_amount+? WHERE id=?').run(remaining, s.id);

  console.log(`  ${num}: Collect ${s.transaction_number} Rp${remaining.toLocaleString()}`);
}

// ============================================================
// CASH MUTATIONS
// ============================================================
console.log('\n--- Cash Mutations ---');
const insMutation = db.prepare(`INSERT INTO cash_mutations
  (mutation_number, mutation_date, cash_account_id, cash_account_code, mutation_type, notes, total_amount, status, user_create, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,'active',?,datetime('now'),datetime('now'))`);

const insMutationDetail = db.prepare(`INSERT INTO cash_mutation_details
  (cash_mutation_id, line_no, account_id, account_code, notes, amount, created_at, updated_at)
  VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))`);

const mutationTpls = [
  { type:'MASUK', cashAcc:KAS_BESAR, cashCode:'111-001-01', items:[[PENJUALAN,'410-001-01','Setoran penjualan',5000000]] },
  { type:'KELUAR', cashAcc:KAS_KECIL, cashCode:'111-001-02', items:[[29,'610-001-01','Pembayaran gaji',3000000]] },
  { type:'MASUK', cashAcc:BANK_BCA, cashCode:'111-002-01', items:[[PENJUALAN,'410-001-01','Setoran penjualan',7500000]] },
  { type:'KELUAR', cashAcc:KAS_BESAR, cashCode:'111-001-01', items:[[30,'610-002-01','Pembayaran sewa',2000000]] },
];

for (const m of months) {
  for (let i = 0; i < mutationTpls.length; i++) {
    const tpl = mutationTpls[i];
    const day = daysInMonth[i];
    const dateStr = `2026-${m.month}-${String(day).padStart(2,'0')}`;
    const num = nextNumber('cash_mutations', 'MT', m.year);
    const totalAmount = tpl.items.reduce((s, it) => s + it[3], 0);

    insMutation.run(num, dateStr, tpl.cashAcc, tpl.cashCode, tpl.type,
      `${tpl.type === 'MASUK' ? 'Penerimaan' : 'Pengeluaran'} kas ${m.prefix} #${i+1}`,
      totalAmount, userId);

    const mtId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    for (let li = 0; li < tpl.items.length; li++) {
      const it = tpl.items[li];
      insMutationDetail.run(mtId, li + 1, it[0], it[1], it[2], it[3]);
    }

    console.log(`  ${m.prefix}: ${num} (${tpl.type}, Rp${totalAmount.toLocaleString()})`);
  }
}

// ============================================================
// MEMORIAL JOURNALS
// ============================================================
console.log('\n--- Memorial Journals ---');
const insJournal = db.prepare(`INSERT INTO memorial_journals
  (journal_number, journal_date, notes, total_debit, total_credit, status, user_create, created_at, updated_at)
  VALUES (?,?,?,?,?,'active',?,datetime('now'),datetime('now'))`);

const insJournalDetail = db.prepare(`INSERT INTO memorial_journal_details
  (memorial_journal_id, line_no, account_id, account_code, notes, debit, credit, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,datetime('now'),datetime('now'))`);

// Saldo awal (hanya 1x, untuk Mei 2026)
const saldoAwal = {
  notes:'Saldo awal',
  lines:[
    [4,'111-001-01','Saldo awal Kas Besar',25000000,0],
    [38,'111-001-02','Saldo awal Kas Kecil',5000000,0],
    [5,'111-002-01','Saldo awal Bank BCA',75000000,0],
    [7,'120-001-01','Saldo awal Piutang Dagang',15000000,0],
    [9,'130-001-01','Saldo awal Persediaan Barang Dagang',50000000,0],
    [12,'151-001-01','Saldo awal Peralatan',30000000,0],
    [45,'210-001-01','Saldo awal Hutang Usaha',0,10000000],
    [19,'310-001-01','Saldo awal Modal Disetor',0,190000000],
  ]};
const saNum = 'JM/2026/000001';
const saTotalDebit = saldoAwal.lines.reduce((s,l)=>s+l[3],0);
const saTotalCredit = saldoAwal.lines.reduce((s,l)=>s+l[4],0);
insJournal.run(saNum, '2026-05-01', saldoAwal.notes, saTotalDebit, saTotalCredit, userId);
const saId = db.prepare('SELECT last_insert_rowid() as id').get().id;
for (let li=0; li<saldoAwal.lines.length; li++) {
  const l=saldoAwal.lines[li];
  insJournalDetail.run(saId, li+1, l[0], l[1], l[2], l[3], l[4]);
}
// Fix sequence to continue from 2
updSeqStmt.run('memorial_journals', 1);
console.log(`  ${saNum} (Saldo awal, Rp${saTotalDebit.toLocaleString()})`);

const journalTpls = [
  { notes:'Beban penyusutan peralatan', lines:[
    [12,'151-001-01','Beban penyusutan',500000,0],
    [13,'159-001-01','Akumulasi penyusutan',0,500000],
  ]},
  { notes:'Beban listrik & air', lines:[
    [31,'610-003-01','Beban listrik & air',350000,0],
    [4,'111-001-01','Pembayaran listrik',0,350000],
  ]},
  { notes:'Penyesuaian persediaan akhir bulan', lines:[
    [9,'130-001-01','Penyesuaian persediaan',2500000,0],
    [26,'510-001-01','HPP penyesuaian',0,2500000],
  ]},
];

for (const m of months) {
  for (let i = 0; i < journalTpls.length; i++) {
    const tpl = journalTpls[i];
    const day = 28;
    const dateStr = `2026-${m.month}-${String(day).padStart(2,'0')}`;
    const num = nextNumber('memorial_journals', 'JM', m.year);

    const totalDebit = tpl.lines.reduce((s, l) => s + l[3], 0);
    const totalCredit = tpl.lines.reduce((s, l) => s + l[4], 0);

    insJournal.run(num, dateStr, `[${m.prefix}] ${tpl.notes}`, totalDebit, totalCredit, userId);
    const jId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    for (let li = 0; li < tpl.lines.length; li++) {
      const l = tpl.lines[li];
      insJournalDetail.run(jId, li + 1, l[0], l[1], l[2], l[3], l[4]);
    }

    console.log(`  ${m.prefix}: ${num} (${tpl.notes}, Rp${totalDebit.toLocaleString()})`);
  }
}

console.log('\n=== SEEDING SELESAI ===');
db.close();
