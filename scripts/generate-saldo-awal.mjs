import pg from 'pg';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web' });

function findExactQuantities(items, target) {
  const hpp = items.map(i => Number(i.hpp));
  const n = items.length;
  const totalHpp = hpp.reduce((s, v) => s + v, 0);
  
  // Proportional base (floor)
  const base = Math.floor(target / totalHpp);
  let qty = hpp.map(() => base);
  let current = qty.reduce((s, v, i) => s + v * hpp[i], 0);
  let remaining = target - current;
  
  if (remaining === 0) return { qty, exact: true, diff: 0 };
  
  // Find subset of items whose HPP sums to exactly remaining
  // Try all combinations of copies (0-5) for each item (n ≤ 5)
  function findSubset(hppValues, targetRemaining) {
    const m = hppValues.length;
    const maxCopy = 5;
    
    function tryCombos(idx, currentSum, counts) {
      if (idx === m) {
        return currentSum === targetRemaining ? [...counts] : null;
      }
      for (let c = 0; c <= maxCopy; c++) {
        const newSum = currentSum + c * hppValues[idx];
        if (newSum > targetRemaining) break;
        counts.push(c);
        const result = tryCombos(idx + 1, newSum, counts);
        if (result) return result;
        counts.pop();
      }
      return null;
    }
    
    const result = tryCombos(0, 0, []);
    if (result) return result;
    
    // Fallback: try wider range
    function tryCombosWide(idx, currentSum, counts) {
      if (idx === m) {
        return currentSum === targetRemaining ? [...counts] : null;
      }
      const maxC = Math.min(10, Math.floor((targetRemaining - currentSum) / hppValues[idx]));
      for (let c = 0; c <= maxC; c++) {
        counts.push(c);
        const r = tryCombosWide(idx + 1, currentSum + c * hppValues[idx], counts);
        if (r) return r;
        counts.pop();
      }
      return null;
    }
    
    return tryCombosWide(0, 0, []);
  }
  
  const subset = findSubset(hpp, remaining);
  if (subset) {
    for (let i = 0; i < n; i++) {
      qty[i] += subset[i];
    }
    current = qty.reduce((s, v, i) => s + v * hpp[i], 0);
    return { qty, exact: current === target, diff: target - current };
  }
  
  return { qty, exact: false, diff: remaining };
}

async function main() {
  // 1. Get all active barang
  const barang = await pool.query(
    `SELECT id, code, name, hpp, jenis FROM master_barang WHERE isdelete = 0 AND aktif = 1 ORDER BY code`
  );
  
  // 2. Get gudang utama
  const gudang = await pool.query(
    `SELECT id, code, name FROM master_gudang WHERE isdelete = 0 ORDER BY id LIMIT 1`
  );
  const gd = gudang.rows[0];
  
  // 3. Get units
  const units = await pool.query(
    `SELECT b.id as barang_id, bu.name as unit_name, bu.ratio
     FROM master_barang b
     JOIN barang_units bu ON bu.barang_id = b.id
     WHERE b.isdelete = 0 AND b.aktif = 1
     ORDER BY b.id, bu.ratio`
  );
  const unitMap = {};
  for (const u of units.rows) {
    if (!unitMap[u.barang_id]) unitMap[u.barang_id] = [];
    unitMap[u.barang_id].push(u);
  }

  // 4. Get memorial journal value for persediaan
  const mapping = await pool.query(
    `SELECT account_id FROM account_mappings WHERE map_group = 'barang' AND map_key = 'persediaan_barang'`
  );
  const accId = mapping.rows[0]?.account_id;
  let totalPersediaan = 0;
  if (accId) {
    const det = await pool.query(
      `SELECT SUM(debit) - SUM(credit) as total FROM memorial_journal_details WHERE account_id = $1`,
      [accId]
    );
    totalPersediaan = Number(det.rows[0]?.total || 0);
  }
  
  console.log('Total nilai persediaan dari jurnal: Rp', totalPersediaan.toLocaleString('id-ID'));
  console.log('');
  
  // 5. Calculate exact quantities
  const { qty: quantities, exact, diff } = findExactQuantities(barang.rows, totalPersediaan);
  
  const rows = [];
  let totalValue = 0;
  
  console.log('Barang yang akan dimasukkan:');
  console.log('===========================');
  for (let i = 0; i < barang.rows.length; i++) {
    const b = barang.rows[i];
    const q = quantities[i];
    const unitList = unitMap[b.id] || [];
    const baseUnit = unitList[0];
    const unitName = baseUnit?.unit_name || 'pcs';
    const value = q * Number(b.hpp || 0);
    totalValue += value;
    
    console.log(`${String(b.code).padEnd(10)} | ${String(b.name).padEnd(35)} | HPP: Rp ${Number(b.hpp).toLocaleString('id-ID').padStart(12)} | Qty: ${String(q).padStart(3)} ${String(unitName).padEnd(5)} | Nilai: Rp ${value.toLocaleString('id-ID').padStart(15)}`);
    
    rows.push({
      'Kode Barang': b.code,
      'Kode Gudang': gd?.code || 'GD001',
      'Stok': q,
      'Satuan': unitName,
      'Tanggal (YYYY-MM-DD)': '2026-05-01'
    });
  }
  console.log('');
  console.log(`${'='.repeat(110)}`);
  console.log(`Total nilai: Rp ${totalValue.toLocaleString('id-ID')}`);
  console.log(`Target dari jurnal: Rp ${totalPersediaan.toLocaleString('id-ID')}`);
  console.log(`Status: ${exact ? '✅ PAS (exact match)' : `⚠️  Selisih Rp ${diff.toLocaleString('id-ID')}`}`);
  console.log('');
  
  // 6. Generate Excel
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  
  ws['!cols'] = [
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 22 },
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Template Saldo Awal');
  
  // Sheet 2: Reference data
  const refRows = barang.rows.map((b, i) => {
    const u = unitMap[b.id] || [];
    const ref = { 'Kode Barang': b.code, 'Nama Barang': b.name, 'HPP': Number(b.hpp || 0), 'Qty': quantities[i] };
    u.forEach((unit, j) => { ref[`Satuan ${j+1}`] = `${unit.unit_name} (${unit.ratio})`; });
    return ref;
  });
  const ws2 = XLSX.utils.json_to_sheet(refRows);
  ws2['!cols'] = [
    { wch: 15 }, { wch: 35 }, { wch: 15 },
    { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Referensi Barang');
  
  const outPath = path.join(__dirname, '..', 'saldo-awal-stok-mei-2026.xlsx');
  XLSX.writeFile(wb, outPath);
  console.log(`✅ File: ${outPath}`);
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
