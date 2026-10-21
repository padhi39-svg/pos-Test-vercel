import { rawAll, rawGet } from '@/db/raw'

export async function getPiutangCustomers() {
  return rawAll<any>(`
    SELECT DISTINCT c.id, c.name FROM master_customer c
    WHERE c.id IN (
      SELECT customer_id FROM transactions WHERE customer_id IS NOT NULL
      UNION
      SELECT customer_id FROM ar_payments WHERE customer_id IS NOT NULL
    )
    ORDER BY c.name
  `)
}

export async function getSalesPerTransaction(filter: { startDate: string; endDate: string; customerId: string | number }) {
  const { startDate, endDate, customerId } = filter
  const sql = `
    SELECT t.id, LEFT(t.created_at::text, 10) as tdate, t.transaction_number, t.total,
           COALESCE(t.customer_name, (SELECT name FROM master_customer WHERE id = t.customer_id), '') as customer_name
    FROM transactions t
    WHERE LEFT(t.created_at::text, 10) >= $1 AND LEFT(t.created_at::text, 10) <= $2
      AND t.customer_id = $3
      AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
    ORDER BY LEFT(t.created_at::text, 10), t.id
  `
  return rawAll<any>(sql, [startDate, endDate, Number(customerId)])
}

export async function getPaymentsBySaleIds(saleIds: number[]) {
  if (saleIds.length === 0) return []
  const sql = `
    SELECT pai.sale_id, p.payment_date as tdate, p.payment_number, SUM(pai.pay_amount) as amount
    FROM ar_payments p
    JOIN ar_payment_items pai ON pai.payment_id = p.id
    WHERE pai.sale_id = ANY($1::int[])
      AND p.status = 'active'
    GROUP BY pai.sale_id, p.id
    ORDER BY p.payment_date, p.id
  `
  return rawAll<any>(sql, [saleIds])
}

export async function getOpeningBalances(filter: { startDate: string; endDate: string; customerId: string | number }) {
  const { startDate, endDate, customerId } = filter
  const sql = `
    SELECT id, tanggal as tdate, kode_nota, nominal
    FROM ar_opening_balances
    WHERE tanggal >= $1 AND tanggal <= $2
      AND customer_id = $3
      AND (status IS NULL OR status != 'void')
      AND nominal > 0
    ORDER BY tanggal, id
  `
  return rawAll<any>(sql, [startDate, endDate, Number(customerId)])
}

export async function getPiutangReguler(startDate: string, endDate: string, customerId: string | number) {
  const cid = Number(customerId)

  const sales = await rawAll<any>(`
    SELECT LEFT(t.created_at::text, 10) as tdate, t.transaction_number as source_number,
           'penjualan' as description, 0 as debit, t.total as kredit
    FROM transactions t
    WHERE LEFT(t.created_at::text, 10) >= $1 AND LEFT(t.created_at::text, 10) <= $2
      AND t.customer_id = $3
      AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
      AND t.total > 0
  `, [startDate, endDate, cid])

  const payments = await rawAll<any>(`
    SELECT p.payment_date as tdate, p.payment_number as source_number,
           'terima piutang' as description, SUM(pai.pay_amount) as debit, 0 as kredit
    FROM ar_payments p
    JOIN ar_payment_items pai ON pai.payment_id = p.id
    WHERE p.payment_date >= $1 AND p.payment_date <= $2
      AND p.customer_id = $3
      AND p.status = 'active'
    GROUP BY p.id
  `, [startDate, endDate, cid])

  const openings = await rawAll<any>(`
    SELECT tanggal as tdate, kode_nota as source_number,
           'saldo awal piutang' as description, 0 as debit, nominal as kredit
    FROM ar_opening_balances
    WHERE tanggal >= $1 AND tanggal <= $2
      AND customer_id = $3
      AND (status IS NULL OR status != 'void')
      AND nominal > 0
  `, [startDate, endDate, cid])

  return { sales, payments, openings }
}

export async function getPiutangBeforeDate(date: string, customerId: string | number) {
  const cid = Number(customerId)
  const beforeSales = await rawGet<any>(`
    SELECT COALESCE(SUM(t.total), 0) as total FROM transactions t
    WHERE LEFT(t.created_at::text, 10) <= $1 AND LEFT(t.created_at::text, 10) >= '2000-01-01'
      AND t.customer_id = $2
      AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
  `, [date, cid])

  const beforePayments = await rawGet<any>(`
    SELECT COALESCE(SUM(pai.pay_amount), 0) as total
    FROM ar_payments p JOIN ar_payment_items pai ON pai.payment_id = p.id
    WHERE p.payment_date <= $1 AND p.payment_date >= '2000-01-01'
      AND p.customer_id = $2 AND p.status = 'active'
  `, [date, cid])

  const beforeOpenings = await rawGet<any>(`
    SELECT COALESCE(SUM(nominal), 0) as total FROM ar_opening_balances
    WHERE tanggal <= $1 AND tanggal >= '2000-01-01'
      AND customer_id = $2 AND (status IS NULL OR status != 'void')
  `, [date, cid])

  return {
    sales: Number(beforeSales?.total || 0),
    payments: Number(beforePayments?.total || 0),
    openings: Number(beforeOpenings?.total || 0),
  }
}
