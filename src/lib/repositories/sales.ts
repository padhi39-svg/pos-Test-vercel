import { rawAll, rawGet } from '@/db/raw'

function hasColDetect(cols: { column_name: string }[], name: string) {
  return cols.some(c => String(c.column_name).toLowerCase() === name.toLowerCase())
}

export async function getSalesRecap(from?: string, to?: string, type?: string) {
  const cols = await rawAll<any>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions'`)
  const hasCol = (name: string) => hasColDetect(cols, name)
  const col = (name: string) => (hasCol(name) ? name : undefined)

  const colCreatedAt = col('created_at') || 'CURRENT_TIMESTAMP'
  const colTglNota = col('tgl_nota')
  const colTxnType = col('transaction_type')
  const colSubtotal = col('subtotal')
  const colDiscPct = col('discount_percent')
  const colDiscAmt = col('discount_amount')
  const colPpnAmt = col('ppn_amount')
  const colTotal = col('total')
  const colCustomerId = col('customer_id') || 'customer_id'
  const colVoid = col('void') || 'void'

  const dateExpr = `DATE(COALESCE(${colTglNota ? `t.${colTglNota}::text` : 'NULL'}, t.${colCreatedAt}::text))`

  let query = `
    SELECT t.id, t.transaction_number,
      ${dateExpr} as transaction_date,
      COALESCE(c.name, 'Customer Umum') as customer_name,
      CASE WHEN COALESCE(${colTxnType ? `t.${colTxnType}` : '1'}, 1) = 1 THEN 'Pos Resto'
           WHEN COALESCE(${colTxnType ? `t.${colTxnType}` : '1'}, 1) = 2 THEN 'Pos Retail'
           WHEN COALESCE(${colTxnType ? `t.${colTxnType}` : '1'}, 1) = 3 THEN 'Invoice'
           ELSE 'Pos Resto' END as sales_type,
      COALESCE(${colSubtotal ? `t.${colSubtotal}` : '0'}, 0) as subtotal,
      COALESCE(${colDiscPct ? `t.${colDiscPct}` : '0'}, 0) as discount_percent,
      COALESCE(${colDiscAmt ? `t.${colDiscAmt}` : '0'}, 0) as discount_amount,
      COALESCE(${colPpnAmt ? `t.${colPpnAmt}` : '0'}, 0) as ppn_amount,
      COALESCE(${colTotal ? `t.${colTotal}` : '0'}, 0) as total
    FROM transactions t
    LEFT JOIN master_customer c ON ${colCustomerId.startsWith('t.') ? colCustomerId : `t.${colCustomerId}`} = c.id
    WHERE COALESCE(${colVoid.startsWith('t.') ? colVoid : `t.${colVoid}`}, 0) = 0
  `
  const params: any[] = []
  if (from) { query += ` AND ${dateExpr} >= ?`; params.push(from) }
  if (to) { query += ` AND ${dateExpr} <= ?`; params.push(to) }
  if (type) { query += ` AND COALESCE(${colTxnType ? `t.${colTxnType}` : '1'},1) = ?`; params.push(Number(type)) }
  query += ` ORDER BY COALESCE(${colTglNota ? `t.${colTglNota}::text` : 'NULL'}, t.${colCreatedAt}::text) DESC, t.transaction_number DESC`
  return rawAll<any>(query, params)
}

export async function getSalesDetail(from?: string, to?: string, transactionNumber?: string) {
  let query = `
    SELECT t.id as transaction_id, t.transaction_number,
      DATE(COALESCE(t.tgl_nota::text, t.created_at::text)) as transaction_date,
      COALESCE(c.name, 'Customer Umum') as customer_name,
      CASE WHEN COALESCE(t.transaction_type, 1) = 1 THEN 'Pos Resto'
           WHEN COALESCE(t.transaction_type, 1) = 2 THEN 'Pos Retail'
           WHEN COALESCE(t.transaction_type, 1) = 3 THEN 'Invoice'
           ELSE 'Pos Resto' END as sales_type,
      ti.barang_name as item_name, ti.quantity,
      COALESCE(ti.unit_name, 'PCS') as unit,
      COALESCE(ti.unit_price, 0) as unit_price,
      COALESCE(t.discount_percent, 0) as discount_percent,
      COALESCE(ti.discon_total, ti.discount_amount, 0) as discount_total,
      ROUND(COALESCE(ti.total_price, 0)::numeric - ROUND(COALESCE(ti.total_price, 0)::numeric / (1 + COALESCE(t.tax_rate_percent, t.ppn_percent, 11)::numeric / 100.0), 0), 0) as ppn_amount,
      COALESCE(ti.total_price, ti.unit_price * ti.quantity) as subtotal,
      COALESCE(k.name, '-') as kategori_name,
      COALESCE(s.name, '-') as spesifikasi_name
    FROM transactions t
    JOIN transaction_items ti ON t.id = ti.transaction_id
    LEFT JOIN master_barang b ON b.id = ti.barang_id
    LEFT JOIN master_kategori k ON k.id = b.kategori_id
    LEFT JOIN master_spesifikasi s ON s.id = b.spesifikasi_id
    LEFT JOIN master_customer c ON t.customer_id = c.id
    WHERE COALESCE(t.void, 0) = 0
  `
  const params: any[] = []
  const dateExpr = `DATE(COALESCE(t.tgl_nota::text, t.created_at::text))`
  if (from) { query += ` AND ${dateExpr} >= ?`; params.push(from) }
  if (to) { query += ` AND ${dateExpr} <= ?`; params.push(to) }
  if (transactionNumber) { query += ` AND t.transaction_number LIKE ?`; params.push(`%${transactionNumber}%`) }
  query += ` ORDER BY COALESCE(t.tgl_nota::text, t.created_at::text) DESC, t.transaction_number DESC, ti.id ASC`
  return rawAll<any>(query, params)
}

export async function getSalesRekapPertanggal(from?: string, to?: string, type?: string) {
  const tcols = await rawAll<any>("SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND table_schema = 'public'")
  const hasCol = (name: string) => hasColDetect(tcols, name)
  const col = (name: string, def?: string) => hasCol(name) ? `t.${name}` : (def || 'NULL')

  const colDateExpr = `DATE(COALESCE(${hasCol('tgl_nota') ? 't.tgl_nota::text' : 'NULL'}, ${col('created_at', 't.created_at::text')}::text))`
  const colSubtotal = `COALESCE(${col('subtotal', '0')},0)`
  const colPpn = `COALESCE(${col('ppn_amount', '0')},0)`
  const colTotal = `COALESCE(${col('total', '0')},0)`
  const colTxnType = `COALESCE(${hasCol('transaction_type') ? 't.transaction_type' : '1'},1)`
  const colVoid = `COALESCE(${hasCol('void') ? 't.void' : '0'},0)`

  const pcols = await rawAll<any>("SELECT column_name FROM information_schema.columns WHERE table_name = 'transaction_payments' AND table_schema = 'public'")
  const hasP = (name: string) => hasColDetect(pcols, name)
  const pcol = (name: string) => hasP(name) ? name : undefined
  const pMethod = pcol('method') || 'method'
  const pAmount = pcol('amount') || 'amount'
  const pChange = pcol('change_amount') || 'change_amount'

  let query = `
    WITH base AS (
      SELECT t.id AS transaction_id, ${colDateExpr} AS txn_date, ${colSubtotal} AS subtotal,
        ${colPpn} AS ppn_amount, ${colTotal} AS grand_total, ${colTxnType} AS txn_type
      FROM transactions t WHERE ${colVoid} = 0
    ),
    pays AS (
      SELECT tp.transaction_id,
        SUM(CASE WHEN LOWER(${pMethod}) IN ('cash') THEN (${pAmount} - COALESCE(${pChange},0)) ELSE 0 END) AS cash_paid,
        SUM(CASE WHEN LOWER(${pMethod}) IN ('debit card','credit card','transfer') THEN (${pAmount} - COALESCE(${pChange},0)) ELSE 0 END) AS card_paid,
        SUM((${pAmount} - COALESCE(${pChange},0))) AS total_paid
      FROM transaction_payments tp GROUP BY tp.transaction_id
    ),
    joined AS (
      SELECT b.txn_date, b.subtotal, b.ppn_amount, b.grand_total, b.txn_type,
        COALESCE(p.cash_paid,0) AS cash_paid, COALESCE(p.card_paid,0) AS card_paid, COALESCE(p.total_paid,0) AS total_paid
      FROM base b LEFT JOIN pays p ON p.transaction_id = b.transaction_id
    ),
    apportioned AS (
      SELECT txn_date, subtotal, grand_total, ppn_amount, txn_type,
        CASE WHEN total_paid > 0 THEN subtotal * (card_paid / total_paid) ELSE 0 END AS dpp_card,
        CASE WHEN total_paid > 0 THEN ppn_amount * (card_paid / total_paid) ELSE 0 END AS pb1_card,
        CASE WHEN total_paid > 0 THEN subtotal * (cash_paid / total_paid) ELSE 0 END AS dpp_cash,
        CASE WHEN total_paid > 0 THEN ppn_amount * (cash_paid / total_paid) ELSE 0 END AS pb1_cash,
        card_paid AS card_amount, cash_paid AS cash_amount
      FROM joined
    )
    SELECT txn_date AS tanggal, SUM(subtotal) AS total, SUM(ppn_amount) AS pb1,
      SUM(dpp_card) AS card_dpp, SUM(pb1_card) AS card_pb1, SUM(card_amount) AS card_total,
      SUM(dpp_cash) AS cash_dpp, SUM(pb1_cash) AS cash_pb1, SUM(cash_amount) AS cash_total
    FROM apportioned WHERE 1=1
  `
  const params: any[] = []
  if (from) { query += ` AND txn_date >= ?`; params.push(from) }
  if (to) { query += ` AND txn_date <= ?`; params.push(to) }
  if (type) { query += ` AND txn_type = ?`; params.push(Number(type)) }
  query += ` GROUP BY txn_date ORDER BY txn_date ASC`
  return rawAll<any>(query, params)
}

export async function getSalesJatuhTempo() {
  const cols = await rawAll<any>("SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND table_schema = 'public'")
  const hasCol = (name: string) => hasColDetect(cols, name)
  const hasDueDate = hasCol('due_date')
  const hasTglNota = hasCol('tgl_nota')
  const hasNmCust = hasCol('nm_cust') || hasCol('Nm_cust')
  const nmCustCol = hasCol('Nm_cust') ? 't.Nm_cust' : hasCol('nm_cust') ? 't.nm_cust' : null

  if (!hasDueDate) return []

  const query = `
    SELECT t.id, t.transaction_number as kode_nota,
      COALESCE(${nmCustCol ? nmCustCol : 'NULL'}, c.name, 'Umum') as customer,
      COALESCE(${hasTglNota ? 't.tgl_nota::text' : 'NULL'}, date(t.created_at)::text) as tanggal_nota,
      t.total, t.due_date as jatuh_tempo
    FROM transactions t
    LEFT JOIN master_customer c ON t.customer_id = c.id
    WHERE t.due_date IS NOT NULL AND t.due_date <= CURRENT_DATE AND COALESCE(t.void, 0) = 0
    ORDER BY t.due_date ASC, t.transaction_number ASC
  `
  return rawAll<any>(query)
}

export async function getSalesGrossProfit(from?: string, to?: string, barangId?: string, customerId?: string) {
  const dateExpr = "substr(COALESCE(t.tgl_nota::text, t.Tgl_Nota::text, t.transaction_date::text, t.created_at::text),1,10)"
  let sql = `
    WITH item_base AS (
      SELECT t.id AS transaction_id, ${dateExpr} AS txn_date, t.transaction_number AS kodenota,
        ti.id AS item_id, ti.barang_id, t.customer_id AS customer_id, ti.barang_name AS nama_barang,
        ti.quantity AS qty, ti.unit_price AS harga, ti.total_price AS subtotal,
        COALESCE(ti.cogs_unit, 0) AS hpp, COALESCE(ti.cogs_total, 0) AS total_hpp
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      WHERE COALESCE(t.status,'completed') <> 'void'
    )
    SELECT ib.kodenota, ib.barang_id, ib.nama_barang, ib.qty, ib.harga, ib.subtotal,
      ROUND(ib.hpp::numeric, 0) AS hpp,
      ROUND(ib.total_hpp::numeric, 0) AS total_hpp,
      ROUND(ib.subtotal::numeric - ib.total_hpp::numeric, 0) AS laba_rugi,
      COALESCE(c.name, 'Customer Umum') AS customer_name,
      COALESCE(c.code, '') AS customer_code, ib.customer_id
    FROM item_base ib
    LEFT JOIN master_customer c ON c.id = ib.customer_id
    WHERE 1=1
  `
  const params: any[] = []
  if (from) { sql += ` AND txn_date >= ?`; params.push(from) }
  if (to) { sql += ` AND txn_date <= ?`; params.push(to) }
  if (barangId) { sql += ` AND barang_id = ?`; params.push(Number(barangId)) }
  if (customerId) { sql += ` AND COALESCE(customer_id,0) = ?`; params.push(Number(customerId)) }
  sql += ` ORDER BY kodenota ASC, item_id ASC`
  return rawAll<any>(sql, params)
}

export async function getSalesVsUsageMeta() {
  const barang = await rawAll<any>(`SELECT id, name FROM master_barang WHERE COALESCE(isdelete,0)=0 ORDER BY name`)
  const customer = await rawAll<any>(`SELECT id, name FROM master_customer WHERE COALESCE(isdelete,0)=0 ORDER BY name`)
  return { barang, customer }
}
