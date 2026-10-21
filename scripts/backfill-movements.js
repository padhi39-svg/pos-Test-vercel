const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'resto-system.db');
const db = new Database(dbPath);

console.log('Starting backfill...');

try {
  // Get all transaction items
  const items = db.prepare(`
    SELECT 
      ti.transaction_id,
      ti.barang_id,
      ti.barang_code,
      ti.quantity
    FROM transaction_items ti
    ORDER BY ti.transaction_id
  `).all();
  
  console.log(`Found ${items.length} transaction items`);
  
  const getRecipes = db.prepare('SELECT ingredient_id, quantity, unit FROM barang_recipes WHERE barang_id = ?');
  const checkExisting = db.prepare('SELECT COUNT(*) as count FROM stock_movements WHERE reference_type = ? AND reference_id = ?');
  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (
      ingredient_id, movement_type, quantity, unit, reference_type, reference_id, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  let processed = 0;
  let skipped = 0;
  let inserted = 0;
  
  for (const item of items) {
    processed++;
    
    // Check if already has movements
    const existing = checkExisting.get('sale', item.transaction_id);
    if (existing.count > 0) {
      skipped++;
      continue;
    }
    
    // Get recipes for this barang
    const recipes = getRecipes.all(item.barang_id);
    
    if (recipes.length === 0) {
      console.log(`  No recipe for barang_id ${item.barang_id} (${item.barang_code})`);
      continue;
    }
    
    console.log(`  Processing ${item.barang_code} (${recipes.length} ingredients)`);
    
    // Insert movements
    const qtySold = Number(item.quantity) || 1;
    for (const r of recipes) {
      const perUnit = Number(r.quantity) || 0;
      const used = perUnit * qtySold;
      if (used > 0) {
        insertMovement.run(
          r.ingredient_id,
          'out',
          used,
          r.unit || 'unit',
          'sale',
          item.transaction_id,
          `Backfill: ${item.barang_code} x${qtySold}`
        );
        inserted++;
        console.log(`    - Inserted: ingredient_id=${r.ingredient_id}, qty=${used} ${r.unit}`);
      }
    }
  }
  
  console.log('\n=== BACKFILL COMPLETED ===');
  console.log(`Processed: ${processed} transaction items`);
  console.log(`Skipped: ${skipped} (already have movements)`);
  console.log(`Inserted: ${inserted} stock movements`);
  
  // Show sample of inserted data
  const sample = db.prepare(`
    SELECT 
      sm.id,
      sm.ingredient_id,
      ib.code,
      ib.name,
      sm.quantity,
      sm.unit,
      sm.reference_id,
      sm.notes
    FROM stock_movements sm
    LEFT JOIN master_barang ib ON sm.ingredient_id = ib.id
    WHERE sm.reference_type = 'sale'
    ORDER BY sm.id DESC
    LIMIT 10
  `).all();
  
  console.log('\n=== SAMPLE DATA (last 10) ===');
  sample.forEach(s => {
    console.log(`${s.code} - ${s.name}: ${s.quantity} ${s.unit} (${s.notes})`);
  });
  
} catch (error) {
  console.error('ERROR:', error.message);
  process.exit(1);
} finally {
  db.close();
}
