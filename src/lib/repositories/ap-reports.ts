import { rawAll, rawGet } from '@/db/raw'

function hasColDetect(cols: { column_name: string }[], name: string) {
  return cols.some(c => String(c.column_name).toLowerCase() === name.toLowerCase())
}

export async function getHutangJatuhTempo(startDate?: string, endDate?: string, supplierId?: string) {
  const cols = await rawAll<any>(`SELECT column_name as name FROM information_schema.columns WHERE table_name = 'purchases' AND table_schema = 'public'`)
  const hasCol = (name: string) => hasColDetect(cols, name)
  const dueDateCol = hasCol('due_date') ? 'due_date' : hasCol('expected_date') ? 'expected_date' : null

  if (!dueDateCol) return { rows: [], suppliers: [] }

  let where = `p.${dueDateCol} IS NOT NULL AND p.${dueDateCol} != '' AND COALESCE(p.void, 0) = 0 AND p.status = 'active'`
  const params: any[] = []
  if (startDate) { where += ' AND p.purchase_date >= ?'; params.push(startDate) }
  if (endDate) { where += ' AND p.purchase_date <= ?'; params.push(endDate) }
  if (supplierId) { where += ' AND p.supplier_id = ?'; params.push(supplierId) }

  const query = `
    SELECT p.id, p.purchase_number as kode_nota, COALESCE(s.name, 'Umum') as supplier,
      p.purchase_date as tanggal_nota, p.${dueDateCol} as jatuh_tempo, p.total,
      p.total - COALESCE((SELECT SUM(pi.pay_amount) FROM ap_payment_items pi JOIN ap_payments app ON app.id = pi.payment_id WHERE pi.purchase_id = p.id AND app.status = 'active' AND COALESCE(app.void, 0) = 0), 0) as sisa
    FROM purchases p LEFT JOIN master_supplier s ON p.supplier_id = s.id
    WHERE ${where}
    ORDER BY p.${dueDateCol} ASC, p.purchase_number ASC
  `
  const allRows = await rawAll<any>(query, params)
  const rows = allRows.filter((r: any) => {
    r.sisa = Math.round(Number(r.sisa || 0) * 100) / 100
    return r.sisa > 0
  })
  const suppliers = await rawAll<any>(`
    SELECT DISTINCT s.id, s.name FROM master_supplier s
    WHERE s.id IN (SELECT supplier_id FROM purchases WHERE ${dueDateCol} IS NOT NULL AND ${dueDateCol} != '' AND COALESCE(void,0)=0 AND status='active')
    ORDER BY s.name
  `)
  return { rows, suppliers }
}

export async function getKartuHutang(startDate?: string, endDate?: string, supplierId?: string, mode?: string) {
  if (!supplierId) {
    const list = await rawAll<any>(`
      SELECT DISTINCT s.id, s.name FROM master_supplier s
      WHERE s.id IN (SELECT supplier_id FROM purchases WHERE supplier_id IS NOT NULL UNION SELECT supplier_id FROM ap_payments WHERE supplier_id IS NOT NULL)
      ORDER BY s.name
    `)
    return { suppliers: list }
  }

  const sup = await rawGet<any>('SELECT id, name FROM master_supplier WHERE id = $1', [supplierId])
  const supplierName = sup?.name || ''

  if (mode === 'per-transaksi') {
    const purchases = await rawAll<any>(`
      SELECT p.id, p.purchase_date as tdate, p.purchase_number, p.total, COALESCE((SELECT name FROM master_supplier WHERE id = p.supplier_id), '') as supplier_name
      FROM purchases p WHERE p.purchase_date >= $1 AND p.purchase_date <= $2 AND p.supplier_id = $3
        AND (p.is_return IS NULL OR p.is_return = 0) AND COALESCE(p.void, 0) = 0
      ORDER BY p.purchase_date, p.id
    `, [startDate, endDate, supplierId])

    const returns = await rawAll<any>(`
      SELECT p.id, p.purchase_date as tdate, p.purchase_number, p.total
      FROM purchases p WHERE p.purchase_date >= $1 AND p.purchase_date <= $2 AND p.supplier_id = $3
        AND p.is_return = 1 AND COALESCE(p.void, 0) = 0
      ORDER BY p.purchase_date, p.id
    `, [startDate, endDate, supplierId])

    const purchaseIds = purchases.map(p => p.id)
    const paymentsMap: Record<number, any[]> = {}
    if (purchaseIds.length > 0) {
      const payments = await rawAll<any>(`
        SELECT ppi.purchase_id, p.payment_date as tdate, p.payment_number, SUM(ppi.pay_amount) as amount
        FROM ap_payments p JOIN ap_payment_items ppi ON ppi.payment_id = p.id
        WHERE ppi.purchase_id = ANY($1::int[]) AND p.status = 'active'
        GROUP BY ppi.purchase_id, p.id ORDER BY p.payment_date, p.id
      `, [purchaseIds])
      for (const pm of payments) {
        if (!paymentsMap[pm.purchase_id]) paymentsMap[pm.purchase_id] = []
        paymentsMap[pm.purchase_id].push(pm)
      }
    }
    const groups: any[] = purchases.map(p => {
      const rows: any[] = [{ tdate: p.tdate, source_number: p.purchase_number, description: 'pembelian', debit: Number(p.total || 0), kredit: 0 }]
      const pms = paymentsMap[p.id] || []
      for (const pm of pms) rows.push({ tdate: pm.tdate, source_number: pm.payment_number, description: 'bayar hutang', debit: 0, kredit: Number(pm.amount || 0) })
      return { purchase_number: p.purchase_number, purchase_date: p.tdate, rows }
    })
    for (const r of returns) {
      groups.push({ purchase_number: r.purchase_number, purchase_date: r.tdate, rows: [{ tdate: r.tdate, source_number: r.purchase_number, description: 'retur pembelian', debit: 0, kredit: Math.abs(Number(r.total || 0)) }], is_return: true })
    }
    const openingBalances = await rawAll<any>(`SELECT id, tanggal as tdate, kode_nota, nominal FROM ap_opening_balances WHERE tanggal >= $1 AND tanggal <= $2 AND supplier_id = $3 AND (status IS NULL OR status != 'void') AND nominal > 0 ORDER BY tanggal, id`, [startDate, endDate, supplierId])
    for (const ob of openingBalances) {
      groups.push({ purchase_number: ob.kode_nota, purchase_date: ob.tdate, rows: [{ tdate: ob.tdate, source_number: ob.kode_nota, description: 'saldo awal hutang', debit: Number(ob.nominal || 0), kredit: 0 }], is_opening: true })
    }
    groups.sort((a, b) => a.purchase_date.localeCompare(b.purchase_date) || a.purchase_number.localeCompare(b.purchase_number))
    return { mode: 'per-transaksi', supplier_id: supplierId, supplier_name: supplierName, groups }
  }

  const beforeStart = (() => { const d = new Date(startDate!); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
  const beforePurchases = (await rawGet<any>(`SELECT COALESCE(SUM(p.total), 0) as total FROM purchases p WHERE p.purchase_date <= $1 AND p.purchase_date >= '2000-01-01' AND p.supplier_id = $2 AND (p.is_return IS NULL OR p.is_return = 0) AND COALESCE(p.void, 0) = 0`, [beforeStart, supplierId]))?.total || 0
  const beforePayments = (await rawGet<any>(`SELECT COALESCE(SUM(ppi.pay_amount), 0) as total FROM ap_payments p JOIN ap_payment_items ppi ON ppi.payment_id = p.id WHERE p.payment_date <= $1 AND p.payment_date >= '2000-01-01' AND p.supplier_id = $2 AND p.status = 'active'`, [beforeStart, supplierId]))?.total || 0
  const beforeReturns = (await rawGet<any>(`SELECT COALESCE(SUM(ABS(p.total)), 0) as total FROM purchases p WHERE p.purchase_date <= $1 AND p.purchase_date >= '2000-01-01' AND p.supplier_id = $2 AND p.is_return = 1 AND COALESCE(p.void, 0) = 0`, [beforeStart, supplierId]))?.total || 0
  const beforeOpenings = (await rawGet<any>(`SELECT COALESCE(SUM(nominal), 0) as total FROM ap_opening_balances WHERE tanggal <= $1 AND tanggal >= '2000-01-01' AND supplier_id = $2 AND (status IS NULL OR status != 'void')`, [beforeStart, supplierId]))?.total || 0
  const openingBalance = Math.round((Number(beforePurchases) - Number(beforeReturns) - Number(beforePayments) + Number(beforeOpenings)) * 100) / 100

  const purchases = await rawAll<any>(`SELECT p.purchase_date as tdate, p.purchase_number as source_number, 'pembelian' as description, p.total as debit, 0 as kredit FROM purchases p WHERE p.purchase_date >= $1 AND p.purchase_date <= $2 AND p.supplier_id = $3 AND (p.is_return IS NULL OR p.is_return = 0) AND COALESCE(p.void, 0) = 0 AND p.total > 0`, [startDate, endDate, supplierId])
  const returns = await rawAll<any>(`SELECT p.purchase_date as tdate, p.purchase_number as source_number, 'retur pembelian' as description, 0 as debit, ABS(p.total) as kredit FROM purchases p WHERE p.purchase_date >= $1 AND p.purchase_date <= $2 AND p.supplier_id = $3 AND p.is_return = 1 AND COALESCE(p.void, 0) = 0 AND ABS(p.total) > 0`, [startDate, endDate, supplierId])
  const payments = await rawAll<any>(`SELECT p.payment_date as tdate, p.payment_number as source_number, 'bayar hutang' as description, 0 as debit, SUM(ppi.pay_amount) as kredit FROM ap_payments p JOIN ap_payment_items ppi ON ppi.payment_id = p.id WHERE p.payment_date >= $1 AND p.payment_date <= $2 AND p.supplier_id = $3 AND p.status = 'active' GROUP BY p.id`, [startDate, endDate, supplierId])
  const openings = await rawAll<any>(`SELECT tanggal as tdate, kode_nota as source_number, 'saldo awal hutang' as description, nominal as debit, 0 as kredit FROM ap_opening_balances WHERE tanggal >= $1 AND tanggal <= $2 AND supplier_id = $3 AND (status IS NULL OR status != 'void') AND nominal > 0`, [startDate, endDate, supplierId])

  const combined: any[] = [...purchases, ...returns, ...payments, ...openings]
  combined.sort((a, b) => a.tdate.localeCompare(b.tdate) || a.source_number.localeCompare(b.source_number))

  const rows: any[] = [{ tdate: startDate!, source_number: '', description: 'Saldo Awal', debit: 0, kredit: 0, balance: openingBalance }]
  let balance = openingBalance
  for (const r of combined) {
    const debit = Number(r.debit || 0)
    const kredit = Number(r.kredit || 0)
    balance += debit - kredit
    rows.push({ tdate: r.tdate, source_number: r.source_number, description: r.description, debit, kredit, balance: Math.round(balance * 100) / 100 })
  }
  return { mode: 'reguler', supplier_id: supplierId, supplier_name: supplierName, rows }
}

export async function getKartuUangMukaSupplier(startDate?: string, endDate?: string, supplierId?: string) {
  if (!supplierId) {
    const list = await rawAll<any>(`
      SELECT DISTINCT s.id, s.name FROM master_supplier s
      WHERE s.id IN (SELECT supplier_id FROM ap_advances WHERE status = 'active') ORDER BY s.name
    `)
    return { suppliers: list }
  }

  const sup = await rawGet<any>('SELECT id, name FROM master_supplier WHERE id = ?', [supplierId])
  const supplierName = sup?.name || ''

  const advCols = await rawAll<any>(`SELECT column_name as name FROM information_schema.columns WHERE table_name = 'ap_advances' AND table_schema = 'public'`)
  const advHas = (name: string) => hasColDetect(advCols, name)
  const totalCol = advHas('total_amount') ? 'total_amount' : 'total'

  const beforeStart = (() => { const d = new Date(startDate!); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
  const beforeCreated = (await rawGet<any>(`SELECT COALESCE(SUM(${totalCol}), 0) as total FROM ap_advances WHERE tanggal <= ? AND tanggal >= '2000-01-01' AND supplier_id = ? AND status = 'active'`, [beforeStart, supplierId]))?.total || 0
  const beforeUsed = (await rawGet<any>(`SELECT COALESCE(SUM(pi.pay_amount), 0) as total FROM ap_payment_items pi JOIN ap_payments p ON p.id = pi.payment_id WHERE pi.source_type = 'ap_advance' AND p.payment_date <= ? AND p.payment_date >= '2000-01-01' AND p.supplier_id = ? AND p.status = 'active'`, [beforeStart, supplierId]))?.total || 0
  const openingBalance = Math.round((Number(beforeCreated) - Number(beforeUsed)) * 100) / 100

  const creations = await rawAll<any>(`SELECT tanggal as tdate, kode_nota as source_number, COALESCE(notes, 'uang muka supplier') as description, ${totalCol} as debit, 0 as kredit FROM ap_advances WHERE tanggal >= ? AND tanggal <= ? AND supplier_id = ? AND status = 'active' AND ${totalCol} > 0`, [startDate, endDate, supplierId])
  const usage = await rawAll<any>(`SELECT p.payment_date as tdate, p.payment_number as source_number, 'pakai uang muka' as description, 0 as debit, pi.pay_amount as kredit FROM ap_payment_items pi JOIN ap_payments p ON p.id = pi.payment_id WHERE pi.source_type = 'ap_advance' AND p.payment_date >= ? AND p.payment_date <= ? AND p.supplier_id = ? AND p.status = 'active' AND pi.pay_amount > 0`, [startDate, endDate, supplierId])

  const combined: any[] = [...creations, ...usage]
  combined.sort((a, b) => a.tdate.localeCompare(b.tdate) || a.source_number.localeCompare(b.source_number))

  const rows: any[] = [{ tdate: startDate!, source_number: '', description: 'Saldo Awal', debit: 0, kredit: 0, balance: openingBalance }]
  let balance = openingBalance
  for (const r of combined) {
    const debit = Number(r.debit || 0)
    const kredit = Number(r.kredit || 0)
    balance += debit - kredit
    rows.push({ tdate: r.tdate, source_number: r.source_number, description: r.description, debit, kredit, balance: Math.round(balance * 100) / 100 })
  }
  return { supplier_id: supplierId, supplier_name: supplierName, rows }
}
