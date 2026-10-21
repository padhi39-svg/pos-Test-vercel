import { Pool } from 'pg'

function toPool(dbOrPool: any): Pool {
  return dbOrPool?.$client || dbOrPool
}

export async function checkStockAvailability(
  dbOrPool: any,
  ingredientId: number,
  warehouseId: number,
  requiredQuantity: number
): Promise<{ available: boolean; currentStock: number; shortage: number }> {
  try {
    const pool = toPool(dbOrPool)
    const result = await pool.query(
      `SELECT quantity FROM stock_balance
       WHERE ingredient_id = $1 AND warehouse_id = $2`,
      [ingredientId, warehouseId]
    )
    const row = result.rows[0] as { quantity: number } | undefined
    const currentStock = row ? Number(row.quantity) : 0
    const shortage = Math.max(0, requiredQuantity - currentStock)
    return { available: currentStock >= requiredQuantity, currentStock, shortage }
  } catch {
    return { available: false, currentStock: 0, shortage: requiredQuantity }
  }
}

export async function getTotalStock(dbOrPool: any, ingredientId: number): Promise<number> {
  try {
    const pool = toPool(dbOrPool)
    const result = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) as total FROM stock_balance
       WHERE ingredient_id = $1`,
      [ingredientId]
    )
    return Number(result.rows[0]?.total || 0)
  } catch {
    return 0
  }
}

export async function requireStockAvailable(
  dbOrPool: any,
  barangId: number,
  warehouseId: number,
  requiredQuantity: number,
  itemLabel: string,
  allowNegative: boolean
): Promise<void> {
  if (allowNegative) return
  const check = await checkStockAvailability(dbOrPool, barangId, warehouseId, requiredQuantity)
  if (!check.available) {
    throw new Error(
      `Stok tidak mencukupi: ${itemLabel} — tersedia ${check.currentStock}, dibutuhkan ${Math.round(requiredQuantity)}`
    )
  }
}

export async function getStockAllowNegative(dbOrPool?: any): Promise<boolean> {
  try {
    const pool = toPool(dbOrPool)
    const result = await pool.query(
      `SELECT setting_value FROM settings WHERE setting_key = 'stock_allow_negative' LIMIT 1`
    )
    return result.rows[0]?.setting_value === '1'
  } catch {
    return false
  }
}

export async function getStockByWarehouse(
  dbOrPool: any,
  ingredientId: number,
  warehouseId: number
): Promise<number> {
  try {
    const pool = toPool(dbOrPool)
    const result = await pool.query(
      `SELECT quantity FROM stock_balance
       WHERE ingredient_id = $1 AND warehouse_id = $2`,
      [ingredientId, warehouseId]
    )
    return result.rows[0] ? Number(result.rows[0].quantity) : 0
  } catch {
    return 0
  }
}
