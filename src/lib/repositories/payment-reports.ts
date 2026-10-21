import { rawAll, rawGet } from '@/db/raw'

function hasColDetect(cols: { column_name: string }[], name: string) {
  return cols.some(c => String(c.column_name).toLowerCase() === name.toLowerCase())
}

export async function getPaymentRecapAp(from?: string, to?: string, supplier?: string, status?: string) {
  let query = `
    SELECT p.id, p.payment_number, p.payment_date, p.total, p.status, p.notes, s.name AS supplier_name
    FROM ap_payments p LEFT JOIN master_supplier s ON s.id = p.supplier_id WHERE 1=1
  `
  const params: any[] = []
  if (from) { query += ` AND p.payment_date >= ?`; params.push(from) }
  if (to) { query += ` AND p.payment_date <= ?`; params.push(to) }
  if (supplier) { query += ` AND s.name LIKE ?`; params.push(`%${supplier}%`) }
  if (status) { query += ` AND p.status = ?`; params.push(status) }
  query += ` ORDER BY p.payment_date DESC, p.payment_number DESC`
  return rawAll<any>(query, params)
}

export async function getPaymentRecapAr(from?: string, to?: string, customer?: string, status?: string) {
  let query = `
    SELECT p.id, p.payment_number, p.payment_date, p.total, p.status, p.notes, c.name AS customer_name
    FROM ar_payments p LEFT JOIN master_customer c ON c.id = p.customer_id WHERE 1=1
  `
  const params: any[] = []
  if (from) { query += ` AND p.payment_date >= ?`; params.push(from) }
  if (to) { query += ` AND p.payment_date <= ?`; params.push(to) }
  if (customer) { query += ` AND c.name LIKE ?`; params.push(`%${customer}%`) }
  if (status) { query += ` AND p.status = ?`; params.push(status) }
  query += ` ORDER BY p.payment_date DESC, p.payment_number DESC`
  return rawAll<any>(query, params)
}

function processPaymentRows(rows: any[]) {
  const paymentMap = new Map<number, any>()
  const processedRows: any[] = []
  for (const row of rows) {
    const pid = row.payment_id
    if (!paymentMap.has(pid)) {
      paymentMap.set(pid, {
        payment_id: pid, payment_number: row.payment_number, payment_date: row.payment_date,
        customer_name: row.customer_name || row.supplier_name || '',
        status: row.status, notes: row.notes, payment_amount: row.payment_amount ?? 0,
      })
    }
    if (row.sale_id || row.purchase_id) {
      processedRows.push({
        ...paymentMap.get(pid),
        sale_number: row.transaction_number || (row.sale_id ? `TXN/${String(row.sale_id).padStart(6, '0')}` : null),
        purchase_number: row.purchase_id ? `PO/${String(row.purchase_id).padStart(6, '0')}` : null,
        invoice_number: row.invoice_number, due_amount: row.due_amount ?? 0,
        pay_amount: row.pay_amount ?? 0, account_name: null, method_amount: 0,
        item_notes: row.item_remarks,
      })
    }
    if (row.account_id && row.method_amount) {
      processedRows.push({
        ...paymentMap.get(pid), sale_number: null, purchase_number: null, invoice_number: null,
        due_amount: 0, pay_amount: 0, account_name: row.account_name,
        method_amount: row.method_amount ?? 0, item_notes: row.notes,
      })
    }
  }
  if (processedRows.length === 0) {
    paymentMap.forEach(payment => {
      processedRows.push({
        ...payment, sale_number: null, purchase_number: null, invoice_number: null,
        due_amount: 0, pay_amount: 0, account_name: null,
        method_amount: payment.payment_amount, item_notes: null,
      })
    })
  }
  return processedRows
}

export async function getPaymentDetailAp(from?: string, to?: string, paymentNumber?: string, customer?: string, status?: string) {
  let query = `
    SELECT p.id AS payment_id, p.payment_number, p.payment_date, p.notes, p.status, p.total AS payment_amount,
      COALESCE(p.customer_name, c.name, 'Umum') AS customer_name,
      pi.sale_id, t.transaction_number AS transaction_number, pi.invoice_number, pi.due_amount, pi.pay_amount, pi.remarks AS item_remarks,
      pm.account_id, COALESCE(pm.account_name, a.name) AS account_name, pm.amount AS method_amount
    FROM ar_payments p
    LEFT JOIN master_customer c ON p.customer_id = c.id
    LEFT JOIN ar_payment_items pi ON pi.payment_id = p.id
    LEFT JOIN transactions t ON pi.sale_id = t.id
    LEFT JOIN ar_payment_methods pm ON pm.payment_id = p.id
    LEFT JOIN accounts a ON a.id = pm.account_id
    WHERE 1=1
  `
  const params: any[] = []
  if (status) { query += ` AND p.status = ?`; params.push(status) }
  if (from) { query += ` AND p.payment_date >= ?`; params.push(from) }
  if (to) { query += ` AND p.payment_date <= ?`; params.push(to) }
  if (paymentNumber) { query += ` AND p.payment_number LIKE ?`; params.push(`%${paymentNumber}%`) }
  if (customer) { query += ` AND COALESCE(p.customer_name, c.name) LIKE ?`; params.push(`%${customer}%`) }
  query += ` ORDER BY p.payment_date DESC, p.payment_number DESC, pi.id, pm.id`
  const rows = await rawAll<any>(query, params)
  return processPaymentRows(rows)
}

export async function getPaymentDetailAr(from?: string, to?: string, paymentNumber?: string, customer?: string, status?: string) {
  let query = `
    SELECT p.id AS payment_id, p.payment_number, p.payment_date, p.notes, p.status, p.total AS payment_amount,
      s.name AS customer_name, pi.purchase_id, pi.invoice_number, pi.due_amount, pi.pay_amount, pi.remarks AS item_remarks,
      pm.account_id, a.name AS account_name, pm.amount AS method_amount
    FROM ar_payments p
    LEFT JOIN master_supplier s ON s.id = p.supplier_id
    LEFT JOIN ar_payment_items pi ON pi.payment_id = p.id
    LEFT JOIN ar_payment_methods pm ON pm.payment_id = p.id
    LEFT JOIN accounts a ON a.id = pm.account_id
    WHERE 1=1
  `
  const params: any[] = []
  if (status) { query += ` AND p.status = ?`; params.push(status) }
  if (from) { query += ` AND p.payment_date >= ?`; params.push(from) }
  if (to) { query += ` AND p.payment_date <= ?`; params.push(to) }
  if (paymentNumber) { query += ` AND p.payment_number LIKE ?`; params.push(`%${paymentNumber}%`) }
  if (customer) { query += ` AND s.name LIKE ?`; params.push(`%${customer}%`) }
  query += ` ORDER BY p.payment_date DESC, p.payment_number DESC, pi.id, pm.id`
  const rows = await rawAll<any>(query, params)
  return processPaymentRows(rows)
}

export async function getPaymentDetailApReport(from?: string, to?: string, paymentNumber?: string, customer?: string, status?: string) {
  let query = `
    SELECT p.id AS payment_id, p.payment_number, p.payment_date, p.notes, p.status, p.total AS payment_amount,
      COALESCE(p.customer_name, c.name, 'Umum') AS customer_name,
      pi.sale_id, t.transaction_number AS transaction_number, pi.invoice_number, pi.due_amount, pi.pay_amount, pi.remarks AS item_remarks,
      pm.account_id, COALESCE(pm.account_name, a.name) AS account_name, pm.amount AS method_amount
    FROM ar_payments p
    LEFT JOIN master_customer c ON p.customer_id = c.id
    LEFT JOIN ar_payment_items pi ON pi.payment_id = p.id
    LEFT JOIN transactions t ON pi.sale_id = t.id
    LEFT JOIN ar_payment_methods pm ON pm.payment_id = p.id
    LEFT JOIN accounts a ON a.id = pm.account_id
    WHERE 1=1
  `
  const params: any[] = []
  if (status) { query += ` AND p.status = ?`; params.push(status) }
  if (from) { query += ` AND p.payment_date >= ?`; params.push(from) }
  if (to) { query += ` AND p.payment_date <= ?`; params.push(to) }
  if (paymentNumber) { query += ` AND p.payment_number LIKE ?`; params.push(`%${paymentNumber}%`) }
  if (customer) { query += ` AND COALESCE(p.customer_name, c.name) LIKE ?`; params.push(`%${customer}%`) }
  query += ` ORDER BY p.payment_date DESC, p.payment_number DESC, pi.id, pm.id`
  const rows = await rawAll<any>(query, params)
  return processPaymentRows(rows)
}

export async function getPaymentDetailApOld(from?: string, to?: string, paymentNumber?: string, supplier?: string) {
  let query = `
    SELECT p.id AS payment_id, p.payment_number, p.payment_date, p.status, p.notes AS payment_notes,
      s.name AS supplier_name,
      pi.purchase_id, pi.invoice_number, pi.due_amount, pi.pay_amount, pi.remarks AS item_remarks,
      pm.account_id, a.name AS account_name, pm.amount AS method_amount
    FROM ap_payments p
    LEFT JOIN master_supplier s ON s.id = p.supplier_id
    LEFT JOIN ap_payment_items pi ON pi.payment_id = p.id
    LEFT JOIN ap_payment_methods pm ON pm.payment_id = p.id
    LEFT JOIN accounts a ON a.id = pm.account_id
    WHERE 1=1 AND p.status = 'active'
  `
  const params: any[] = []
  if (from) { query += ` AND p.payment_date >= ?`; params.push(from) }
  if (to) { query += ` AND p.payment_date <= ?`; params.push(to) }
  if (paymentNumber) { query += ` AND p.payment_number LIKE ?`; params.push(`%${paymentNumber}%`) }
  if (supplier) { query += ` AND s.name LIKE ?`; params.push(`%${supplier}%`) }
  query += ` ORDER BY p.payment_date DESC, p.payment_number DESC, pi.id, pm.id`
  const rows = await rawAll<any>(query, params)
  return processPaymentRows(rows)
}
