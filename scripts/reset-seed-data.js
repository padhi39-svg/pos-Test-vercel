/**
 * Hapus semua data seed untuk memulai dari awal.
 * Hanya membersihkan data transaksional, bukan data master.
 */
const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');

const tablesToReset = [
  'transactions', 'transaction_items', 'transaction_payments',
  'purchases', 'purchase_items',
  'stock_transfers', 'stock_transfer_items',
  'stock_usage', 'stock_usage_items',
  'ar_payments', 'ar_payment_items', 'ar_payment_methods', 'ar_payment_extras',
  'ap_payments', 'ap_payment_items', 'ap_payment_methods', 'ap_payment_extras',
  'cash_mutations', 'cash_mutation_details',
  'memorial_journals', 'memorial_journal_details',
  'gl_journal', 'gl_journal_lines',
  'stock_movements',
  'stock_balance',
];

// Keep: master_periode (keep months), master_barang, master_customer, master_supplier,
// master_gudang, master_banks, accounts, account_mappings, barang_units, barang_prices,
// stock_balance, stock_movements (we'll recalc these after)
// BUT we need to recalc stock from purchases after reset

const reset = db.transaction(() => {
  for (const t of tablesToReset) {
    db.prepare(`DELETE FROM ${t}`).run();
    db.prepare(`DELETE FROM sqlite_sequence WHERE name=?`).run(t);
  }
  console.log('All seed data cleared');
});

reset();
db.close();
