import { rawAll, rawGet } from '@/db/raw'

function hasColDetect(cols: { column_name: string }[], name: string) {
  return cols.some(c => String(c.column_name).toLowerCase() === name.toLowerCase())
}

export async function getPiutangJatuhTempo(startDate?: string, endDate?: string, customerId?: string) {
  const cols = await rawAll<any>(`SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transactions' AND table_schema = 'public'`)
  const hasCol = (name: string) => hasColDetect(cols, name)
  const hasDueDate = hasCol('due_date')
  const hasNmCust = hasCol('Nm_cust') || hasCol('nm_cust')
  const nmCustCol = hasCol('Nm_cust') ? 't.Nm_cust' : hasCol('nm_cust') ? 't.nm_cust' : null

  if (!hasDueDate) return { rows: [], customers: [] }

  let where = `t.due_date IS NOT NULL AND t.due_date != '' AND COALESCE(t.void, 0) = 0 AND COALESCE(t.status, '') NOT IN ('void', 'cancelled') AND COALESCE(t.is_return, 0) = 0`
  const params: any[] = []
  if (startDate) { where += ' AND t.transaction_date >= ?'; params.push(startDate) }
  if (endDate) { where += ' AND t.transaction_date <= ?'; params.push(endDate) }
  if (customerId) { where += ' AND t.customer_id = ?'; params.push(customerId) }

  const query = `
    SELECT t.id, t.transaction_number as kode_nota,
      COALESCE(${nmCustCol ? nmCustCol : 'NULL'}, c.name, 'Umum') as customer,
      t.transaction_date as tanggal_nota, t.due_date as jatuh_tempo, t.total,
      t.total - COALESCE((SELECT SUM(pi.pay_amount) FROM ar_payment_items pi JOIN ar_payments arp ON arp.id = pi.payment_id WHERE pi.sale_id = t.id AND arp.status = 'active' AND COALESCE(arp.void, 0) = 0), 0) as sisa
    FROM transactions t LEFT JOIN master_customer c ON t.customer_id = c.id
    WHERE ${where}
    ORDER BY t.due_date ASC, t.transaction_number ASC
  `
  const allRows = await rawAll<any>(query, params)
  const rows = allRows.filter((r: any) => {
    r.sisa = Math.round(Number(r.sisa || 0) * 100) / 100
    return r.sisa > 0
  })
  const customers = await rawAll<any>(`
    SELECT DISTINCT c.id, c.name FROM master_customer c
    WHERE c.id IN (SELECT customer_id FROM transactions WHERE due_date IS NOT NULL AND due_date != '' AND COALESCE(void,0)=0 AND COALESCE(status,'') NOT IN ('void','cancelled'))
    ORDER BY c.name
  `)
  return { rows, customers }
}

export async function getKartuUangMukaCustomer(startDate?: string, endDate?: string, customerId?: string) {
  if (!customerId) {
    const list = await rawAll<any>(`
      SELECT DISTINCT c.id, c.name FROM master_customer c
      WHERE c.id IN (SELECT customer_id FROM ar_advances WHERE status = 'active') ORDER BY c.name
    `)
    return { customers: list }
  }

  const cust = await rawGet<any>('SELECT id, name FROM master_customer WHERE id = ?', [customerId])
  const customerName = cust?.name || ''

  const advCols = await rawAll<any>(`SELECT column_name as name FROM information_schema.columns WHERE table_name = 'ar_advances' AND table_schema = 'public'`)
  const advHas = (name: string) => hasColDetect(advCols, name)
  const totalCol = advHas('total_amount') ? 'total_amount' : 'total'

  const beforeStart = (() => {
    const d = new Date(startDate!)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })()
  const beforeCreated = (await rawGet<any>(`SELECT COALESCE(SUM(${totalCol}), 0) as total FROM ar_advances WHERE tanggal <= ? AND tanggal >= '2000-01-01' AND customer_id = ? AND status = 'active'`, [beforeStart, customerId]))?.total || 0
  const beforeUsed = (await rawGet<any>(`SELECT COALESCE(SUM(pi.pay_amount), 0) as total FROM ar_payment_items pi JOIN ar_payments p ON p.id = pi.payment_id WHERE pi.source_type = 'ar_advance' AND p.payment_date <= ? AND p.payment_date >= '2000-01-01' AND p.customer_id = ? AND p.status = 'active'`, [beforeStart, customerId]))?.total || 0
  const openingBalance = Math.round((Number(beforeCreated) - Number(beforeUsed)) * 100) / 100

  const creations = await rawAll<any>(`SELECT tanggal as tdate, kode_nota as source_number, COALESCE(notes, 'uang muka customer') as description, 0 as debit, ${totalCol} as kredit FROM ar_advances WHERE tanggal >= ? AND tanggal <= ? AND customer_id = ? AND status = 'active' AND ${totalCol} > 0`, [startDate, endDate, customerId])
  const usage = await rawAll<any>(`SELECT p.payment_date as tdate, p.payment_number as source_number, 'pakai uang muka' as description, pi.pay_amount as debit, 0 as kredit FROM ar_payment_items pi JOIN ar_payments p ON p.id = pi.payment_id WHERE pi.source_type = 'ar_advance' AND p.payment_date >= ? AND p.payment_date <= ? AND p.customer_id = ? AND p.status = 'active' AND pi.pay_amount > 0`, [startDate, endDate, customerId])

  const combined: any[] = [...creations, ...usage]
  combined.sort((a, b) => a.tdate.localeCompare(b.tdate) || a.source_number.localeCompare(b.source_number))

  const rows: any[] = [{ tdate: startDate!, source_number: '', description: 'Saldo Awal', debit: 0, kredit: 0, balance: openingBalance }]
  let balance = openingBalance
  for (const r of combined) {
    const debit = Number(r.debit || 0)
    const kredit = Number(r.kredit || 0)
    balance += kredit - debit
    rows.push({ tdate: r.tdate, source_number: r.source_number, description: r.description, debit, kredit, balance: Math.round(balance * 100) / 100 })
  }
  return { customer_id: customerId, customer_name: customerName, rows }
}
