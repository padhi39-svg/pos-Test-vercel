// Script to reset all transactions and stock data
// Run this with: node scripts/reset-stock-transactions.js

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', '..', 'data', 'resto-system.db');
const db = new Database(dbPath);

console.log('🔄 Starting reset process...');
console.log('Database:', dbPath);

try {
  // Get counts before deletion
  const beforeCounts = {
    transactions: db.prepare('SELECT COUNT(*) as count FROM transactions').get().count,
    transaction_items: db.prepare('SELECT COUNT(*) as count FROM transaction_items').get().count,
    transaction_payments: db.prepare('SELECT COUNT(*) as count FROM transaction_payments').get().count,
    stock_movements: db.prepare('SELECT COUNT(*) as count FROM stock_movements').get().count,
    stock_balance: db.prepare('SELECT COUNT(*) as count FROM stock_balance').get().count,
    resto_temp_orders: db.prepare('SELECT COUNT(*) as count FROM resto_temp_orders').get().count,
    resto_temp_order_items: db.prepare('SELECT COUNT(*) as count FROM resto_temp_order_items').get().count,
  };

  console.log('\n📊 Before deletion:');
  console.log('  - Transactions:', beforeCounts.transactions);
  console.log('  - Transaction Items:', beforeCounts.transaction_items);
  console.log('  - Transaction Payments:', beforeCounts.transaction_payments);
  console.log('  - Stock Movements:', beforeCounts.stock_movements);
  console.log('  - Stock Balance:', beforeCounts.stock_balance);
  console.log('  - Resto Temp Orders:', beforeCounts.resto_temp_orders);
  console.log('  - Resto Temp Items:', beforeCounts.resto_temp_order_items);

  // Delete in correct order (respect foreign keys)
  console.log('\n🗑️  Deleting data...');
  
  // Resto temp first (items then orders)
  try { db.prepare('DELETE FROM resto_temp_order_items').run(); console.log('  ✅ Resto temp items deleted'); } catch {}
  try { db.prepare('DELETE FROM resto_temp_orders').run(); console.log('  ✅ Resto temp orders deleted'); } catch {}

  // Payments before items/transactions
  try { db.prepare('DELETE FROM transaction_payments').run(); console.log('  ✅ Transaction payments deleted'); } catch {}

  db.prepare('DELETE FROM transaction_items').run();
  console.log('  ✅ Transaction items deleted');
  
  db.prepare('DELETE FROM transactions').run();
  console.log('  ✅ Transactions deleted');
  
  db.prepare('DELETE FROM stock_movements').run();
  console.log('  ✅ Stock movements deleted');
  
  db.prepare('DELETE FROM stock_balance').run();
  console.log('  ✅ Stock balance deleted');

  // Get counts after deletion
  const afterCounts = {
    transactions: db.prepare('SELECT COUNT(*) as count FROM transactions').get().count,
    transaction_items: db.prepare('SELECT COUNT(*) as count FROM transaction_items').get().count,
    transaction_payments: db.prepare('SELECT COUNT(*) as count FROM transaction_payments').get().count,
    stock_movements: db.prepare('SELECT COUNT(*) as count FROM stock_movements').get().count,
    stock_balance: db.prepare('SELECT COUNT(*) as count FROM stock_balance').get().count,
    resto_temp_orders: db.prepare('SELECT COUNT(*) as count FROM resto_temp_orders').get().count,
    resto_temp_order_items: db.prepare('SELECT COUNT(*) as count FROM resto_temp_order_items').get().count,
  };

  console.log('\n📊 After deletion:');
  console.log('  - Transactions:', afterCounts.transactions);
  console.log('  - Transaction Items:', afterCounts.transaction_items);
  console.log('  - Transaction Payments:', afterCounts.transaction_payments);
  console.log('  - Stock Movements:', afterCounts.stock_movements);
  console.log('  - Stock Balance:', afterCounts.stock_balance);
  console.log('  - Resto Temp Orders:', afterCounts.resto_temp_orders);
  console.log('  - Resto Temp Items:', afterCounts.resto_temp_order_items);

  // Reset sequences
  try {
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('transactions','transaction_items','transaction_payments','stock_movements','stock_balance','resto_temp_orders','resto_temp_order_items')").run();
    console.log('  🔁 Sequences reset');
  } catch {}

  console.log('\n✅ Reset completed successfully!');
  console.log('\n📝 Next steps:');
  console.log('  1. Import saldo awal: http://localhost:3000/barang/stock-initial');
  console.log('  2. Test POS Retail: http://localhost:3000/pos/retail');
  console.log('  3. Check stock card: http://localhost:3000/stock');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
