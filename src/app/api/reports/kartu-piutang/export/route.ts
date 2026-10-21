import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_kartu_piutang', 'view') && !hasPermission(req as any, 'keu_buku_besar', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const pool = (getDb() as any).$client
    const url = new URL(req.url)
    const startDate = url.searchParams.get('startDate') || ''
    const endDate = url.searchParams.get('endDate') || ''
    const customerId = url.searchParams.get('customerId') || ''
    const mode = url.searchParams.get('mode') || 'reguler'

    const cust = await rawGet<any>('SELECT id, name FROM master_customer WHERE id = $1', [customerId])
    const customerName = cust?.name || ''

    const XLSX = await import('xlsx').then(m => m.default || m)
    const wb = XLSX.utils.book_new()

    if (mode === 'per-transaksi') {
      const sales = await rawAll<any>(`
        SELECT t.id, t.transaction_date as tdate, t.transaction_number, t.total,
               COALESCE(t.customer_name, (SELECT name FROM master_customer WHERE id = t.customer_id), '') as customer_name
        FROM transactions t
        WHERE t.transaction_date >= $1 AND t.transaction_date <= $2
          AND t.customer_id = $3
          AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
          AND COALESCE(t.is_return, 0) = 0
        ORDER BY t.transaction_date, t.id
      `, [startDate, endDate, customerId])

      const saleIds = sales.map(s => s.id)
      const paymentsMap: Record<number, any[]> = {}
      if (saleIds.length > 0) {
        const payments = await rawAll<any>(`
          SELECT pai.sale_id, p.payment_date as tdate, p.payment_number, SUM(pai.pay_amount) as amount
          FROM ar_payments p
          JOIN ar_payment_items pai ON pai.payment_id = p.id
          WHERE pai.sale_id = ANY($1::int[])
            AND p.status = 'active'
          GROUP BY pai.sale_id, p.id
          ORDER BY p.payment_date, p.id
        `, [saleIds])
        for (const pm of payments) {
          if (!paymentsMap[pm.sale_id]) paymentsMap[pm.sale_id] = []
          paymentsMap[pm.sale_id].push(pm)
        }
      }

      const openingBalances = await rawAll<any>(`
        SELECT id, tanggal as tdate, kode_nota, nominal
        FROM ar_opening_balances
        WHERE tanggal >= $1 AND tanggal <= $2
          AND customer_id = $3
          AND (status IS NULL OR status != 'void')
          AND nominal > 0
        ORDER BY tanggal, id
      `, [startDate, endDate, customerId])

      interface ExpoRow { tdate: string; kode: string; desc: string; debit: number | ''; kredit: number | '' }
      const allRows: ExpoRow[] = []
      for (const s of sales) {
        allRows.push({ tdate: s.tdate, kode: s.transaction_number, desc: 'penjualan', debit: '', kredit: Number(s.total || 0) })
        const pms = paymentsMap[s.id] || []
        for (const pm of pms) {
          allRows.push({ tdate: pm.tdate, kode: pm.payment_number, desc: 'terima piutang', debit: Number(pm.amount || 0), kredit: '' })
        }
      }
      for (const ob of openingBalances) {
        allRows.push({ tdate: ob.tdate, kode: ob.kode_nota, desc: 'saldo awal piutang', debit: '', kredit: Number(ob.nominal || 0) })
      }
      allRows.sort((a, b) => a.tdate.localeCompare(b.tdate) || a.kode.localeCompare(b.kode))

      const rows: any[][] = [
        ['KARTU PIUTANG PER TRANSAKSI'],
        [`Customer: ${customerName}`],
        [`Periode: ${startDate} s/d ${endDate}`],
        [],
        ['Tanggal', 'Kode Nota', 'Keterangan', 'Debit', 'Kredit'],
      ]

      for (const r of allRows) {
        rows.push([r.tdate, r.kode, r.desc, r.debit, r.kredit])
      }

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Kartu Piutang Per Transaksi')
    } else {
      const sales = await rawAll<any>(`
        SELECT t.transaction_date as tdate, t.transaction_number as source_number,
               'penjualan' as description, 0 as debit, t.total as kredit
        FROM transactions t
        WHERE t.transaction_date >= $1 AND t.transaction_date <= $2
          AND t.customer_id = $3
          AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
          AND COALESCE(t.is_return, 0) = 0
          AND t.total > 0
      `, [startDate, endDate, customerId])

      const returns = await rawAll<any>(`
        SELECT t.transaction_date as tdate, t.transaction_number as source_number,
               'retur penjualan' as description, ABS(t.total) as debit, 0 as kredit
        FROM transactions t
        WHERE t.transaction_date >= $1 AND t.transaction_date <= $2
          AND t.customer_id = $3
          AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
          AND COALESCE(t.is_return, 0) = 1
          AND ABS(t.total) > 0
      `, [startDate, endDate, customerId])

      const payments = await rawAll<any>(`
        SELECT p.payment_date as tdate, p.payment_number as source_number,
               'terima piutang' as description, SUM(pai.pay_amount) as debit, 0 as kredit
        FROM ar_payments p
        JOIN ar_payment_items pai ON pai.payment_id = p.id
        WHERE p.payment_date >= $1 AND p.payment_date <= $2
          AND p.customer_id = $3
          AND p.status = 'active'
        GROUP BY p.id
      `, [startDate, endDate, customerId])

      const openings = await rawAll<any>(`
        SELECT tanggal as tdate, kode_nota as source_number,
               'saldo awal piutang' as description, 0 as debit, nominal as kredit
        FROM ar_opening_balances
        WHERE tanggal >= $1 AND tanggal <= $2
          AND customer_id = $3
          AND (status IS NULL OR status != 'void')
          AND nominal > 0
      `, [startDate, endDate, customerId])

      const beforeStart = (() => { const d = new Date(startDate); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) })()
      const beforeSales = (await rawGet<any>(`SELECT COALESCE(SUM(t.total),0) as total FROM transactions t WHERE t.transaction_date<=$1 AND t.transaction_date>='2000-01-01' AND t.customer_id=$2 AND COALESCE(t.status,'') NOT IN ('void','cancelled') AND COALESCE(t.is_return,0)=0`, [beforeStart, customerId]))?.total||0
      const beforeReturns = (await rawGet<any>(`SELECT COALESCE(SUM(ABS(t.total)),0) as total FROM transactions t WHERE t.transaction_date<=$1 AND t.transaction_date>='2000-01-01' AND t.customer_id=$2 AND COALESCE(t.status,'') NOT IN ('void','cancelled') AND COALESCE(t.is_return,0)=1`, [beforeStart, customerId]))?.total||0
      const beforePayments = (await rawGet<any>(`SELECT COALESCE(SUM(pai.pay_amount),0) as total FROM ar_payments p JOIN ar_payment_items pai ON pai.payment_id=p.id WHERE p.payment_date<=$1 AND p.payment_date>='2000-01-01' AND p.customer_id=$2 AND p.status='active'`, [beforeStart, customerId]))?.total||0
      const beforeOpenings = (await rawGet<any>(`SELECT COALESCE(SUM(nominal),0) as total FROM ar_opening_balances WHERE tanggal <= $1 AND tanggal>='2000-01-01' AND customer_id=$2 AND (status IS NULL OR status != 'void')`, [beforeStart, customerId]))?.total||0
      const openingBalance = Math.round((Number(beforeSales)-Number(beforeReturns)-Number(beforePayments)+Number(beforeOpenings))*100)/100

      const combined: any[] = [...sales, ...returns, ...payments, ...openings]
      combined.sort((a, b) => a.tdate.localeCompare(b.tdate) || a.source_number.localeCompare(b.source_number))

      const rows: any[][] = [
        ['KARTU PIUTANG'],
        [`Customer: ${customerName}`],
        [`Periode: ${startDate} s/d ${endDate}`],
        [],
        ['Tanggal', 'Kode Nota', 'Keterangan', 'Debit', 'Kredit', 'Saldo'],
      ]

      rows.push([startDate, '', 'Saldo Awal', '', '', openingBalance])
      let balance = openingBalance
      for (const r of combined) {
        const debit = Number(r.debit || 0)
        const kredit = Number(r.kredit || 0)
        balance += kredit - debit
        rows.push([r.tdate, r.source_number, r.description,
          debit > 0 ? debit : '',
          kredit > 0 ? kredit : '',
          Math.round(balance * 100) / 100,
        ])
      }
      rows.push([])
      rows.push(['', '', 'Saldo Akhir', '', '', Math.round(balance * 100) / 100])

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Kartu Piutang')
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const ts = new Date().toISOString().slice(0, 10)
    const fn = mode === 'per-transaksi' ? `kartu-piutang-per-transaksi-${ts}` : `kartu-piutang-${ts}`
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${fn}.xlsx`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
