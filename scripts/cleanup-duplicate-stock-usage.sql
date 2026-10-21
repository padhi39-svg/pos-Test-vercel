-- ============================================================
-- Cleanup: Hapus duplicate stock_movements dari stock usage
-- 
-- Masalah: Sebelum fix, setiap stock usage membuat movement 2x:
--   1. Saat draft (reference_type='usage')
--   2. Saat approve (reference_type='stock_usage')
-- Akibatnya stok terpotong double, kartu stok kacau.
-- ============================================================

-- 1. Hapus movement 'usage' dari dokumen DRAFT (tidak pernah approve)
--    Karena draft seharusnya tidak memotong stok sama sekali.
DELETE FROM stock_movements
WHERE reference_type = 'usage'
  AND reference_id IN (
    SELECT id FROM stock_usage
    WHERE COALESCE(void, 0) = 0
      AND COALESCE(status, 'draft') = 'draft'
  );

-- 2. Hapus movement 'usage' dari dokumen yang sudah APPROVED
--    (sudah ada movement 'stock_usage' dari approve, jd 'usage' adalah duplikat draft)
DELETE FROM stock_movements
WHERE reference_type = 'usage'
  AND reference_id IN (
    SELECT id FROM stock_usage
    WHERE COALESCE(void, 0) = 0
      AND COALESCE(status, 'draft') = 'approved'
  );

-- 3. Hapus movement 'usage' dari dokumen VOID
--    (void hanya membersihkan movement 'stock_usage', 'usage' dari draft tertinggal)
DELETE FROM stock_movements
WHERE reference_type = 'usage'
  AND reference_id IN (
    SELECT id FROM stock_usage
    WHERE COALESCE(void, 0) = 1
  );

-- 4. Hapus movement 'stock_usage' dari dokumen DRAFT (seharusnya tidak ada, jaga-jaga)
DELETE FROM stock_movements
WHERE reference_type = 'stock_usage'
  AND reference_id IN (
    SELECT id FROM stock_usage
    WHERE COALESCE(void, 0) = 0
      AND COALESCE(status, 'draft') = 'draft'
  );

-- 5. Hapus movement 'stock_usage' dari dokumen VOID (seharusnya sudah dibersihkan void route)
DELETE FROM stock_movements
WHERE reference_type = 'stock_usage'
  AND reference_id IN (
    SELECT id FROM stock_usage
    WHERE COALESCE(void, 0) = 1
  );

-- ============================================================
-- Rekalkulasi stock_balance dari stock_movements
-- ============================================================

-- Hapus semua stock_balance yang ada (akan dihitung ulang)
DELETE FROM stock_balance;

-- Insert ulang stock_balance berdasarkan akumulasi stock_movements
INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, unit, created_at, updated_at)
SELECT
  ingredient_id,
  warehouse_id,
  SUM(CASE
    WHEN LOWER(COALESCE(movement_type,'')) = 'in' THEN quantity
    WHEN LOWER(COALESCE(movement_type,'')) = 'out' THEN -ABS(quantity)
    WHEN LOWER(COALESCE(movement_type,'')) = 'adjustment' THEN quantity
    ELSE 0
  END) as qty,
  'unit',
  MIN(created_at),
  MAX(created_at)
FROM stock_movements
GROUP BY ingredient_id, warehouse_id
HAVING qty > 0;

-- ============================================================
-- Catatan: Setelah ini jalankan "Hitung Ulang Neraca"
-- di menu Laporan > Neraca untuk periode yang bersangkutan.
-- Recalc HPP akan mengisi ulang avg_cost & total_cost.
-- ============================================================
