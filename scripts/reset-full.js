const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');

// Disable foreign key checks
db.pragma('foreign_keys = OFF');

// Start transaction
db.exec('BEGIN TRANSACTION');

try {
  // === CLEAR ALL TRANSACTIONAL TABLES ===
  const transactionalTables = [
    // Sales
    'transactions', 'transaction_items', 'transaction_payments',
    'sales_order', 'sales_order_items',
    'SO', 'SODetail',
    'resto_temp_orders', 'resto_temp_order_items',
    'pos_table_locks', 'resto_table_locks',

    // Purchases
    'purchases', 'purchase_items',
    'purchase_orders', 'purchase_order_items',
    'purchase_requests', 'purchase_request_items',

    // Stock
    'stock_transfers', 'stock_transfer_items',
    'stock_usage', 'stock_usage_items',
    'stock_movements',
    'stock_balance', 'stock_balance_by_warehouse', 'stock_balance_monthly',
    'stock_opname', 'stock_opname_counts', 'stock_opname_items',
    'stock_opname_sessions', 'stock_period_snapshots',

    // Cash
    'cash_mutations', 'cash_mutation_details',
    'cashbank_transactions', 'cashbank_transaction_lines',
    'cash_opening_balances', 'cashier_closing',

    // AP
    'ap_payments', 'ap_payment_items', 'ap_payment_methods', 'ap_payment_extras',
    'ap_advances', 'ap_advance_lines',
    'ap_ledger', 'ap_opening_balances',

    // AR
    'ar_payments', 'ar_payment_items', 'ar_payment_methods', 'ar_payment_extras',
    'ar_advances', 'ar_advance_lines',
    'ar_ledger', 'ar_opening_balances',
    'ar_receipts', 'ar_receipt_items',

    // Memorial
    'memorial_journals', 'memorial_journal_details',

    // GL
    'gl_journal', 'gl_journal_lines',

    // Manufacturing
    'manufaktur', 'manufaktur_biaya', 'manufaktur_detail',

    // Other
    'report_snapshot_cache',
    'barang_monthly_hpp',

    // akun_saldo_bulanan (reset to 0)
    'akun_saldo_bulanan',
  ];

  for (const table of transactionalTables) {
    try {
      const result = db.prepare(`DELETE FROM "${table}"`).run();
      console.log(`  ✓ ${table}: ${result.changes} rows deleted`);
    } catch (e) {
      console.log(`  ✗ ${table}: ${e.message}`);
    }
  }

  // === CLEAR PERIODS ===
  try {
    const pResult = db.prepare('DELETE FROM master_periode').run();
    console.log(`\n  ✓ master_periode: ${pResult.changes} rows deleted`);
  } catch (e) {
    console.log(`\n  ✗ master_periode: ${e.message}`);
  }

  db.exec('COMMIT');
  console.log('\n✅ Reset transaksi & periode selesai!');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('\n❌ Gagal:', e.message);
}

db.pragma('foreign_keys = ON');
db.close();
