import { rawAll } from '@/db/raw'

export async function getPoRecap(from?: string, to?: string, status?: string) {
  let query = `
    SELECT po.id, po.po_number AS transaction_number, DATE(po.order_date) AS transaction_date,
      po.expected_date, COALESCE(s.name, po.supplier_name, '-') AS supplier_name,
      po.po_status, COALESCE(po.subtotal, 0) AS subtotal,
      COALESCE(po.discount_percent, 0) AS discount_percent,
      COALESCE(po.discount_amount, 0) AS discount_amount,
      COALESCE(po.ppn_amount, 0) AS ppn_amount, COALESCE(po.total, 0) AS total
    FROM purchase_orders po
    LEFT JOIN master_supplier s ON po.supplier_id = s.id
    WHERE COALESCE(po.void, 0) = 0
  `
  const params: any[] = []
  const dateExpr = `DATE(po.order_date)`
  if (from) { query += ` AND ${dateExpr} >= ?`; params.push(from) }
  if (to) { query += ` AND ${dateExpr} <= ?`; params.push(to) }
  if (status) { query += ` AND po.po_status = ?`; params.push(status) }
  query += ` ORDER BY po.order_date DESC, po.po_number DESC`
  return rawAll<any>(query, params)
}

export async function getPoDetail(from?: string, to?: string, poNumber?: string, barangId?: string) {
  let query = `
    SELECT po.id as po_id, po.po_number as po_number, DATE(po.order_date) as po_date,
      po.expected_date, po.po_status, COALESCE(s.name, po.supplier_name, '-') as supplier_name,
      COALESCE(mb.name, pi.barang_name, '-') as item_name,
      COALESCE(pi.quantity, 0) as quantity, COALESCE(pi.unit_name, '') as unit,
      COALESCE(pi.unit_price, 0) as unit_price,
      COALESCE(pi.discount_percent, 0) as discount_percent,
      COALESCE(pi.discount_amount, 0) as discount_total,
      COALESCE(pi.total_price, 0) as subtotal, COALESCE(pi.received_qty, 0) as received_qty
    FROM purchase_orders po
    JOIN purchase_order_items pi ON po.id = pi.po_id
    LEFT JOIN master_supplier s ON po.supplier_id = s.id
    LEFT JOIN master_barang mb ON mb.id = pi.barang_id
    WHERE COALESCE(po.void, 0) = 0
  `
  const params: any[] = []
  const dateExpr = `DATE(po.order_date)`
  if (from) { query += ` AND ${dateExpr} >= ?`; params.push(from) }
  if (to) { query += ` AND ${dateExpr} <= ?`; params.push(to) }
  if (poNumber) { query += ` AND po.po_number LIKE ?`; params.push(`%${poNumber}%`) }
  if (barangId) { query += ` AND pi.barang_id = ?`; params.push(barangId) }
  query += ` ORDER BY po.order_date DESC, po.po_number DESC, pi.id ASC`
  return rawAll<any>(query, params)
}

export async function getPoRealization(from?: string, to?: string, poNumber?: string) {
  let query = `
    SELECT po.id as po_id, po.po_number as po_number, DATE(po.order_date) as po_date,
      po.expected_date, po.po_status, COALESCE(s.name, po.supplier_name, '-') as supplier_name,
      COALESCE(mb.name, pi.barang_name, '-') as item_name,
      COALESCE(pi.quantity, 0) as quantity, COALESCE(pi.unit_name, '') as unit,
      COALESCE(pi.received_qty, 0) as received_qty,
      (COALESCE(pi.quantity, 0) - COALESCE(pi.received_qty, 0)) as outstanding_qty
    FROM purchase_orders po
    JOIN purchase_order_items pi ON po.id = pi.po_id
    LEFT JOIN master_supplier s ON po.supplier_id = s.id
    LEFT JOIN master_barang mb ON mb.id = pi.barang_id
    WHERE COALESCE(po.void, 0) = 0 AND COALESCE(pi.received_qty, 0) > 0
  `
  const params: any[] = []
  const dateExpr = `DATE(po.order_date)`
  if (from) { query += ` AND ${dateExpr} >= ?`; params.push(from) }
  if (to) { query += ` AND ${dateExpr} <= ?`; params.push(to) }
  if (poNumber) { query += ` AND po.po_number LIKE ?`; params.push(`%${poNumber}%`) }
  query += ` ORDER BY po.order_date DESC, po.po_number DESC, pi.id ASC`
  return rawAll<any>(query, params)
}

export async function getPoOutstanding(from?: string, to?: string, poNumber?: string) {
  let query = `
    SELECT po.id as po_id, po.po_number as po_number, DATE(po.order_date) as po_date,
      po.expected_date, po.po_status, COALESCE(s.name, po.supplier_name, '-') as supplier_name,
      COALESCE(mb.name, pi.barang_name, '-') as item_name,
      COALESCE(pi.quantity, 0) as quantity, COALESCE(pi.unit_name, '') as unit,
      COALESCE(pi.received_qty, 0) as received_qty,
      (COALESCE(pi.quantity, 0) - COALESCE(pi.received_qty, 0)) as outstanding_qty
    FROM purchase_orders po
    JOIN purchase_order_items pi ON po.id = pi.po_id
    LEFT JOIN master_supplier s ON po.supplier_id = s.id
    LEFT JOIN master_barang mb ON mb.id = pi.barang_id
    WHERE COALESCE(po.void, 0) = 0 AND (COALESCE(pi.quantity, 0) - COALESCE(pi.received_qty, 0)) > 0
  `
  const params: any[] = []
  const dateExpr = `DATE(po.order_date)`
  if (from) { query += ` AND ${dateExpr} >= ?`; params.push(from) }
  if (to) { query += ` AND ${dateExpr} <= ?`; params.push(to) }
  if (poNumber) { query += ` AND po.po_number LIKE ?`; params.push(`%${poNumber}%`) }
  query += ` ORDER BY po.order_date DESC, po.po_number DESC, pi.id ASC`
  return rawAll<any>(query, params)
}
