const Database = require('better-sqlite3');
const db = new Database('./data/resto-system.db');

console.log('=== DIAGNOSTIC REPORT ===\n');

// 1. Check Gurame Bakar
console.log('1. Barang Jadi: MK058 - Gurame Bakar');
const barang = db.prepare("SELECT * FROM master_barang WHERE code = 'MK058'").get();
console.log(barang || 'NOT FOUND');

// 2. Check recipes
console.log('\n2. Recipes for Gurame Bakar:');
if (barang) {
  const recipes = db.prepare(`
    SELECT 
      br.*,
      ib.id as ib_id,
      ib.code as ib_code,
      ib.name as ib_name,
      ib.jenis as ib_jenis
    FROM barang_recipes br
    LEFT JOIN master_barang ib ON br.ingredient_id = ib.id
    WHERE br.barang_id = ?
  `).all(barang.id);
  
  recipes.forEach(r => {
    console.log(`  - ingredient_id: ${r.ingredient_id}`);
    console.log(`    Exists in master_barang: ${r.ib_id ? 'YES' : 'NO'}`);
    if (r.ib_id) {
      console.log(`    Code: ${r.ib_code}, Name: ${r.ib_name}, Jenis: ${r.ib_jenis}`);
    }
    console.log(`    Quantity: ${r.quantity} ${r.unit}`);
    console.log('');
  });
}

// 3. Check bahan baku (jenis=2)
console.log('3. Available Bahan Baku (jenis=2):');
const bahan = db.prepare("SELECT id, code, name FROM master_barang WHERE jenis = 2 LIMIT 10").all();
bahan.forEach(b => {
  console.log(`  ${b.id}: ${b.code} - ${b.name}`);
});

// 4. Check stock_movements table structure
console.log('\n4. Stock Movements FK:');
const fk = db.prepare("PRAGMA foreign_key_list(stock_movements)").all();
console.log(fk);

db.close();
