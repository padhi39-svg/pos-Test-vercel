const Database = require('better-sqlite3');
const path = require('path');

const dbPath = 'C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db';
const db = new Database(dbPath);

console.log('=== SEBELUM CLEANUP ===');

// Cek semua stock_movements terkait usage
console.log('\nStock movements usage:');
const before = db.prepare(`
  SELECT sm.id, sm.reference_type, sm.reference_id, sm.ingredient_id, 
         sm.movement_type, sm.quantity, sm.warehouse_id
  FROM stock_movements sm
  WHERE sm.reference_type IN ('usage','stock_usage')
  ORDER BY sm.reference_type, sm.id
`).all();
console.table(before);

// Cek stock_balance sebelum
console.log('\nStock balance sebelum:');
const balBefore = db.prepare('SELECT * FROM stock_balance ORDER BY ingredient_id, warehouse_id').all();
console.table(balBefore);

console.log('\nMemulai cleanup...\n');

// ============================================================
// CLEANUP
// ============================================================

// Untuk setiap stock_usage yang memiliki movement 'usage' (draft) DAN 'stock_usage' (approve),
// hapus movement 'usage'-nya lalu kembalikan stock_balance

const affectedDocs = db.prepare(`
  SELECT * FROM (
    SELECT su.id, su.status, su.void,
      (SELECT COUNT(*) FROM stock_movements WHERE reference_type='usage' AND reference_id=su.id) as draft_mv,
      (SELECT COUNT(*) FROM stock_movements WHERE reference_type='stock_usage' AND reference_id=su.id) as approve_mv
    FROM stock_usage su
  ) sub
  WHERE draft_mv > 0 AND approve_mv > 0
`).all();

console.log(`Found ${affectedDocs.length} doc(s) with duplicate movements\n`);

const cleanup = db.transaction(() => {
  for (const doc of affectedDocs) {
    // Ambil semua movement 'usage' (draft) untuk dokumen ini
    const draftMovements = db.prepare(`
      SELECT id, ingredient_id, warehouse_id, quantity, movement_type
      FROM stock_movements 
      WHERE reference_type='usage' AND reference_id=?
    `).all(doc.id);

    for (const mv of draftMovements) {
      const qty = mv.movement_type === 'in' ? Number(mv.quantity) : -Number(mv.quantity);
      
      // Kembalikan stock_balance
      const bal = db.prepare('SELECT * FROM stock_balance WHERE ingredient_id=? AND warehouse_id=?').get(mv.ingredient_id, mv.warehouse_id);
      
      if (bal) {
        const newQty = Number(bal.quantity) - qty; // karena qty negatif (-), minus jadi plus
        db.prepare('UPDATE stock_balance SET quantity=?, updated_at=datetime(\'now\') WHERE ingredient_id=? AND warehouse_id=?')
          .run(newQty, mv.ingredient_id, mv.warehouse_id);
        console.log(`  Restored stock_balance: ingredient=${mv.ingredient_id}, warehouse=${mv.warehouse_id}: ${Number(bal.quantity)} -> ${newQty}`);
      }
    }

    // Hapus movement 'usage' (draft) — yang duplikat
    const info = db.prepare("DELETE FROM stock_movements WHERE reference_type='usage' AND reference_id=?").run(doc.id);
    console.log(`  Deleted ${info.changes} 'usage' movement(s) for stock_usage id=${doc.id}`);
  }
});

cleanup();
console.log('\nCleanup selesai!');

// ============================================================
// SESUDAH CLEANUP
// ============================================================
console.log('\n=== SESUDAH CLEANUP ===');

console.log('\nStock movements usage:');
const after = db.prepare(`
  SELECT id, reference_type, reference_id, ingredient_id, movement_type, quantity, warehouse_id
  FROM stock_movements
  WHERE reference_type IN ('usage','stock_usage')
  ORDER BY reference_type, id
`).all();
console.table(after);

console.log('\nStock balance sesudah:');
const balAfter = db.prepare('SELECT * FROM stock_balance ORDER BY ingredient_id, warehouse_id').all();
console.table(balAfter);

console.log('\nTotal stock_movements:', db.prepare('SELECT COUNT(*) as cnt FROM stock_movements').get().cnt);
console.log('Total stock_balance:', db.prepare('SELECT COUNT(*) as cnt FROM stock_balance').get().cnt);

db.close();
