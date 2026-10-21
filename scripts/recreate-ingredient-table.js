const Database = require('better-sqlite3');
const db = new Database('./data/resto-system.db');

console.log('Recreating master_ingredient table...');

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS master_ingredient (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      kategori_id INTEGER,
      spesifikasi_id INTEGER,
      merk_id INTEGER,
      unit TEXT DEFAULT 'Kg',
      hpp DECIMAL(15,2) DEFAULT 0,
      stock_minimum DECIMAL(10,2) DEFAULT 0,
      stock_current DECIMAL(10,2) DEFAULT 0,
      isdelete BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('✅ Table master_ingredient created successfully');
  console.log('Note: This is a placeholder table for backward compatibility');
  console.log('The system now uses master_barang (jenis=2) for ingredients');
  
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  db.close();
}
