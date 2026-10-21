const Database = require('better-sqlite3');
const db = new Database('./data/resto-system.db');

console.log('Inserting stock movements for Gurame Bakar transaction...');

// 1. Find Gurame Bakar transaction
const tx = db.prepare(`
  SELECT t.id, ti.barang_id, ti.quantity 
  FROM transactions t
  JOIN transaction_items ti ON t.id = ti.transaction_id
  WHERE ti.barang_code = 'MK058'
  LIMIT 1
`).get();

if (!tx) {
  console.log('ERROR: Transaction MK058 not found');
  db.close();
  process.exit(1);
}

console.log('Found transaction:', tx);

// 2. Get recipe for MK058
const recipes = db.prepare(`
  SELECT ingredient_id, quantity, unit
  FROM barang_recipes
  WHERE barang_id = ?
`).all(tx.barang_id);

console.log('Found recipes:', recipes);

if (recipes.length === 0) {
  console.log('ERROR: No recipes found for barang_id', tx.barang_id);
  db.close();
  process.exit(1);
}

// 3. Insert movements
const insert = db.prepare(`
  INSERT INTO stock_movements (
    ingredient_id, movement_type, quantity, unit, reference_type, reference_id, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const r of recipes) {
  const used = r.quantity * tx.quantity;
  insert.run(
    r.ingredient_id,
    'out',
    used,
    r.unit,
    'sale',
    tx.id,
    `Manual insert: MK058 x${tx.quantity}`
  );
  console.log(`Inserted: ingredient_id=${r.ingredient_id}, qty=${used} ${r.unit}`);
}

// 4. Verify
const verify = db.prepare(`
  SELECT 
    sm.*,
    ib.code,
    ib.name
  FROM stock_movements sm
  LEFT JOIN master_barang ib ON sm.ingredient_id = ib.id
  WHERE sm.reference_id = ?
`).all(tx.id);

console.log('\nVerification - Inserted movements:');
verify.forEach(v => {
  console.log(`  ${v.code} - ${v.name}: ${v.quantity} ${v.unit}`);
});

db.close();
console.log('\nDONE!');
