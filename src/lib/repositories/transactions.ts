import { rawAll, rawGet } from '@/db/raw'

export type TransactionFilter = {
  startDate?: string
  endDate?: string
  customerId?: string | number
}

export async function getTransactionsByDateRange(filter: TransactionFilter) {
  const { startDate, endDate, customerId } = filter
  const params: any[] = []
  let sql = `
    SELECT t.id, LEFT(t.created_at::text, 10) as tdate, t.transaction_number, t.total,
           COALESCE(t.customer_name, (SELECT name FROM master_customer WHERE id = t.customer_id), '') as customer_name
    FROM transactions t
    WHERE 1=1
  `
  if (startDate) { sql += ` AND LEFT(t.created_at::text, 10) >= $${params.length + 1}`; params.push(startDate) }
  if (endDate) { sql += ` AND LEFT(t.created_at::text, 10) <= $${params.length + 1}`; params.push(endDate) }
  if (customerId) { sql += ` AND t.customer_id = $${params.length + 1}`; params.push(Number(customerId)) }
  sql += ` AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
           ORDER BY LEFT(t.created_at::text, 10), t.id`
  return rawAll<any>(sql, params)
}

export async function getNonReturnTransactions(filter: TransactionFilter) {
  const { startDate, endDate, customerId } = filter
  const params: any[] = []
  let sql = `
    SELECT LEFT(t.created_at::text, 10) as tdate, t.transaction_number as source_number,
           'penjualan' as description, 0 as debit, t.total as kredit
    FROM transactions t
    WHERE 1=1
  `
  if (startDate) { sql += ` AND LEFT(t.created_at::text, 10) >= $${params.length + 1}`; params.push(startDate) }
  if (endDate) { sql += ` AND LEFT(t.created_at::text, 10) <= $${params.length + 1}`; params.push(endDate) }
  if (customerId) { sql += ` AND t.customer_id = $${params.length + 1}`; params.push(Number(customerId)) }
  sql += ` AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
           AND t.total > 0
           AND (t.total_discount IS NULL OR t.total_discount >= 0)
           ORDER BY LEFT(t.created_at::text, 10), t.id`
  return rawAll<any>(sql, params)
}

export async function getSalesByCustomer(customerId: string | number, startDate: string, endDate: string) {
  const params: any[] = [startDate, endDate, Number(customerId)]
  const sql = `
    SELECT t.id, LEFT(t.created_at::text, 10) as tdate, t.transaction_number, t.total,
           COALESCE(t.customer_name, (SELECT name FROM master_customer WHERE id = t.customer_id), '') as customer_name
    FROM transactions t
    WHERE LEFT(t.created_at::text, 10) >= $1 AND LEFT(t.created_at::text, 10) <= $2
      AND t.customer_id = $3
      AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
    ORDER BY LEFT(t.created_at::text, 10), t.id
  `
  return rawAll<any>(sql, params)
}

export async function getSalesTotalBefore(filter: { date: string; customerId: string | number }) {
  const { date, customerId } = filter
  const sql = `
    SELECT COALESCE(SUM(t.total), 0) as total FROM transactions t
    WHERE LEFT(t.created_at::text, 10) <= $1 AND LEFT(t.created_at::text, 10) >= '2000-01-01'
      AND t.customer_id = $2
      AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
  `
  const result = await rawGet<any>(sql, [date, Number(customerId)])
  return Number(result?.total || 0)
}

export async function getUsageReport(dateFrom?: string, dateTo?: string, ingredientId?: string) {
  const dateExpr = "LEFT(t.created_at::text, 10)"
  let sql = `
    SELECT 
      br.ingredient_id,
      ib.code as ingredient_code,
      ib.name as ingredient_name,
      br.unit as base_unit,
      ib.hpp as ingredient_hpp,
      SUM(br.quantity * ti.quantity) as total_used,
      (SUM(br.quantity * ti.quantity) * COALESCE(ib.hpp, 0)) as total_hpp_used
    FROM transactions t
    JOIN transaction_items ti ON t.id = ti.transaction_id
    JOIN barang_recipes br ON ti.barang_id = br.barang_id
    LEFT JOIN master_barang ib ON br.ingredient_id = ib.id
    WHERE COALESCE(t.status, '') NOT IN ('void', 'cancelled')
  `
  const params: any[] = []
  if (dateFrom) { sql += ` AND ${dateExpr} >= $${params.length + 1}`; params.push(dateFrom) }
  if (dateTo) { sql += ` AND ${dateExpr} <= $${params.length + 1}`; params.push(dateTo) }
  if (ingredientId) { sql += ` AND br.ingredient_id = $${params.length + 1}`; params.push(parseInt(ingredientId)) }
  sql += ' GROUP BY br.ingredient_id, ib.code, ib.name, br.unit, ib.hpp ORDER BY total_used DESC'
  return rawAll<any>(sql, params.length > 0 ? params : undefined)
}

export async function getUsageDetail(dateFrom?: string, dateTo?: string, productId?: string) {
  const dateExpr = "LEFT(t.created_at::text, 10)"
  let sql = `
    SELECT 
      t.id as transaction_id,
      t.transaction_number,
      t.created_at,
      ti.barang_id,
      ti.barang_code,
      ti.barang_name,
      ti.quantity as product_qty,
      br.ingredient_id,
      ib.name as ingredient_name,
      (br.quantity * ti.quantity) as ingredient_used,
      br.unit
    FROM transactions t
    JOIN transaction_items ti ON t.id = ti.transaction_id
    JOIN barang_recipes br ON ti.barang_id = br.barang_id
    LEFT JOIN master_barang ib ON br.ingredient_id = ib.id
    WHERE ti.barang_id = $1
      AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
  `
  const params: any[] = [parseInt(productId!)]
  if (dateFrom) { sql += ` AND ${dateExpr} >= $${params.length + 1}`; params.push(dateFrom) }
  if (dateTo) { sql += ` AND ${dateExpr} <= $${params.length + 1}`; params.push(dateTo) }
  sql += ' ORDER BY t.created_at DESC'
  return rawAll<any>(sql, params)
}

export async function getSalesIngredientReport(dateFrom?: string, dateTo?: string, transactionNumber?: string) {
  let sql = `
    SELECT 
      t.id as transaction_id,
      t.transaction_number,
      DATE(t.created_at) as transaction_date,
      ti.barang_id,
      ti.barang_code,
      ti.barang_name,
      ti.quantity as product_qty,
      br.ingredient_id,
      ib.code as ingredient_code,
      ib.name as ingredient_name,
      br.quantity as recipe_qty,
      br.unit as base_unit,
      COALESCE(ib.hpp, 0) as ingredient_hpp,
      (br.quantity * ti.quantity) as ingredient_used,
      (br.quantity * ti.quantity * COALESCE(ib.hpp, 0)) as total_hpp
    FROM transactions t
    JOIN transaction_items ti ON t.id = ti.transaction_id
    JOIN barang_recipes br ON ti.barang_id = br.barang_id
    LEFT JOIN master_barang ib ON br.ingredient_id = ib.id
    WHERE COALESCE(t.status, '') NOT IN ('void', 'cancelled')
  `
  const params: any[] = []
  if (dateFrom) { sql += ' AND DATE(t.created_at) >= ?'; params.push(dateFrom) }
  if (dateTo) { sql += ' AND DATE(t.created_at) <= ?'; params.push(dateTo) }
  if (transactionNumber) { sql += ' AND t.transaction_number = ?'; params.push(transactionNumber) }
  sql += ' ORDER BY t.transaction_number, ti.barang_name, ib.name'
  return rawAll<any>(sql, params)
}
