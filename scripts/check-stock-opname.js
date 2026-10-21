const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');

console.log('=== STOCK OPNAME CHECK ===');

// Cek stock opname yang sudah dipost
const posted = db.prepare("SELECT id, status, void FROM stock_opname WHERE status='posted' OR void=1").all();
console.log('Stock opname posted/void:', posted.length);
console.table(posted);

// Cek stock_movements dari stock_opname
const soMv = db.prepare("SELECT reference_type, COUNT(*) as cnt FROM stock_movements WHERE reference_type='stock_opname' GROUP BY reference_type").all();
console.log('Stock opname movements:', soMv);

// Tampilkan detail
const soMvDetail = db.prepare(`
  SELECT sm.id, sm.reference_type, sm.reference_id, sm.ingredient_id,
         sm.movement_type, sm.quantity, sm.warehouse_id, so.status, so.void
  FROM stock_movements sm
  JOIN stock_opname so ON so.id = sm.reference_id
  WHERE sm.reference_type = 'stock_opname'
  ORDER BY sm.id
`).all();
console.log('Detail:');
console.table(soMvDetail);

console.log('\n=== VOIDED STOCK OPNAME CHECK ===');
const voidedSo = db.prepare("SELECT id, status, void FROM stock_opname WHERE void=1").all();
console.log('Voided stock opname:', voidedSo.length);
console.table(voidedSo);

// Cek movements untuk dokumen void
for (const v of voidedSo) {
  const mv = db.prepare("SELECT * FROM stock_movements WHERE reference_type='stock_opname' AND reference_id=?").all(v.id);
  if (mv.length > 0) {
    console.log(`  Stock opname id=${v.id} has ${mv.length} movements (should be 0 if voided!)`);
    console.table(mv);
  }
}

db.close();
