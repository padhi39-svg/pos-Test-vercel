import { rawAll } from '@/db/raw'

function hasColDetect(cols: { column_name: string }[], name: string) {
  return cols.some(c => String(c.column_name).toLowerCase() === name.toLowerCase())
}

export async function getPurchaseRecap(from?: string, to?: string, type?: string) {
  const cols = await rawAll<any>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'purchases'`)
  const hasCol = (name: string) => hasColDetect(cols, name)
  const col = (name: string) => (hasCol(name) ? name : undefined)

  const colCreatedAt = col('created_at') || 'CURRENT_TIMESTAMP'
  const colPurchaseDate = col('purchase_date')
  const colVoid = col('void') || 'void'
  const colIsReturn = col('is_return') || 'is_return'
  const colSubtotal = col('subtotal')
  const colDiscPct = col('discount_percent')
  const colDiscAmt = col('discount_amount')
  const colPpnAmt = col('ppn_amount')
  const colTotal = col('total')
  const colSupplierId = col('supplier_id') || 'supplier_id'

  const dateExpr = `DATE(COALESCE(${colPurchaseDate ? `p.${colPurchaseDate}` : 'NULL'}, p.${colCreatedAt}::text))`

  let query = `
    SELECT p.id, p.purchase_number AS transaction_number, ${dateExpr} AS transaction_date,
      COALESCE(s.name, '-') AS supplier_name,
      CASE WHEN COALESCE(${colIsReturn ? `p.${colIsReturn}` : '0'}, 0) = 1 THEN 'Retur Pembelian' ELSE 'Pembelian' END AS purchase_type,
      COALESCE(${colSubtotal ? `p.${colSubtotal}` : '0'}, 0) AS subtotal,
      COALESCE(${colDiscPct ? `p.${colDiscPct}` : '0'}, 0) AS discount_percent,
      COALESCE(${colDiscAmt ? `p.${colDiscAmt}` : '0'}, 0) AS discount_amount,
      COALESCE(${colPpnAmt ? `p.${colPpnAmt}` : '0'}, 0) AS ppn_amount,
      COALESCE(${colTotal ? `p.${colTotal}` : '0'}, 0) AS total
    FROM purchases p
    LEFT JOIN master_supplier s ON ${colSupplierId.startsWith('p.') ? colSupplierId : `p.${colSupplierId}`} = s.id
    WHERE COALESCE(${colVoid.startsWith('p.') ? colVoid : `p.${colVoid}`}, 0) = 0
  `
  const params: any[] = []
  if (from) { query += ` AND ${dateExpr} >= ?`; params.push(from) }
  if (to) { query += ` AND ${dateExpr} <= ?`; params.push(to) }
  if (type) { query += ` AND COALESCE(${colIsReturn.startsWith('p.') ? colIsReturn : `p.${colIsReturn}`}, 0) = ?`; params.push(Number(type) ? 1 : 0) }
  query += ` ORDER BY COALESCE(${colPurchaseDate ? `p.${colPurchaseDate}` : 'NULL'}, p.${colCreatedAt}::text) DESC, p.purchase_number DESC`
  return rawAll<any>(query, params)
}

export async function getPurchaseDetail(from?: string, to?: string, purchaseNumber?: string, type?: string, barangId?: string) {
  const pCols = await rawAll<any>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'purchases'`)
  const hasP = (name: string) => hasColDetect(pCols, name)
  const pCol = (name: string) => (hasP(name) ? name : undefined)

  const piCols = await rawAll<any>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_items'`)
  const hasPI = (name: string) => hasColDetect(piCols, name)
  const piCol = (name: string) => (hasPI(name) ? name : undefined)

  const colCreatedAt = pCol('created_at') || 'CURRENT_TIMESTAMP'
  const colPurchaseDate = pCol('purchase_date')
  const colVoid = pCol('void') || 'void'
  const colIsReturn = pCol('is_return') || 'is_return'
  const colSupplierId = pCol('supplier_id') || 'supplier_id'

  const colQty = piCol('quantity')
  const colUnit = piCol('unit_name')
  const colUnitPrice = piCol('unit_price')
  const colItemDiscPct = piCol('discount_percent')
  const colItemDiscAmt = piCol('discount_amount')
  const colTotalPrice = piCol('total_price')

  const dateExpr = `DATE(COALESCE(${colPurchaseDate ? `p.${colPurchaseDate}` : 'NULL'}, p.${colCreatedAt}::text))`

  let query = `
    SELECT p.id as purchase_id, p.purchase_number as purchase_number, ${dateExpr} as purchase_date,
      COALESCE(s.name, '-') as supplier_name,
      CASE WHEN COALESCE(${colIsReturn ? `p.${colIsReturn}` : '0'}, 0) = 1 THEN 'Retur Pembelian' ELSE 'Pembelian' END as purchase_type,
      COALESCE(mb.name, '-') as item_name,
      COALESCE(${colQty ? `pi.${colQty}` : '0'}, 0) as quantity,
      COALESCE(${colUnit ? `pi.${colUnit}` : "''"}, '') as unit,
      COALESCE(${colUnitPrice ? `pi.${colUnitPrice}` : '0'}, 0) as unit_price,
      COALESCE(${colItemDiscPct ? `pi.${colItemDiscPct}` : '0'}, 0) as discount_percent,
      COALESCE(${colItemDiscAmt ? `pi.${colItemDiscAmt}` : '0'}, 0) as discount_total,
      COALESCE(${colTotalPrice ? `pi.${colTotalPrice}` : '0'}, 0) as subtotal
    FROM purchases p
    JOIN purchase_items pi ON p.id = pi.purchase_id
    LEFT JOIN master_supplier s ON ${colSupplierId.startsWith('p.') ? colSupplierId : `p.${colSupplierId}`} = s.id
    LEFT JOIN master_barang mb ON mb.id = pi.barang_id
    WHERE COALESCE(${colVoid.startsWith('p.') ? colVoid : `p.${colVoid}`}, 0) = 0
  `
  const params: any[] = []
  if (from) { query += ` AND ${dateExpr} >= ?`; params.push(from) }
  if (to) { query += ` AND ${dateExpr} <= ?`; params.push(to) }
  if (purchaseNumber) { query += ` AND p.purchase_number LIKE ?`; params.push(`%${purchaseNumber}%`) }
  if (type !== null && type !== '') { query += ` AND COALESCE(${colIsReturn.startsWith('p.') ? colIsReturn : `p.${colIsReturn}`}, 0) = ?`; params.push(Number(type) ? 1 : 0) }
  if (barangId) { query += ` AND pi.barang_id = ?`; params.push(barangId) }
  query += ` ORDER BY COALESCE(${colPurchaseDate ? `p.${colPurchaseDate}` : 'NULL'}, p.${colCreatedAt}::text) DESC, p.purchase_number DESC, pi.id ASC`
  return rawAll<any>(query, params)
}
