import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_kartu_hutang', 'view') && !hasPermission(req as any, 'keu_buku_besar', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const pool = (getDb() as any).$client
    const url = new URL(req.url)
    const startDate = url.searchParams.get('startDate') || ''
    const endDate = url.searchParams.get('endDate') || ''
    const supplierId = url.searchParams.get('supplierId') || ''
    const mode = url.searchParams.get('mode') || 'reguler'

    const sup = await rawGet<any>('SELECT id, name FROM master_supplier WHERE id = $1', [supplierId])
    const supplierName = sup?.name || ''

    const XLSX = await import('xlsx').then(m => m.default || m)
    const wb = XLSX.utils.book_new()

    if (mode === 'per-transaksi') {
      const purchases = await rawAll<any>(`
        SELECT p.id, p.purchase_date as tdate, p.purchase_number, p.total,
               COALESCE((SELECT name FROM master_supplier WHERE id = p.supplier_id), '') as supplier_name
        FROM purchases p
        WHERE p.purchase_date >= $1 AND p.purchase_date <= $2
          AND p.supplier_id = $3
          AND (p.is_return IS NULL OR p.is_return = 0)
          AND COALESCE(p.void, 0) = 0
        ORDER BY p.purchase_date, p.id
      `, [startDate, endDate, supplierId])

      const returns = await rawAll<any>(`
        SELECT p.purchase_date as tdate, p.purchase_number,
               ABS(p.total) as total
        FROM purchases p
        WHERE p.purchase_date >= $1 AND p.purchase_date <= $2
          AND p.supplier_id = $3
          AND p.is_return = 1
          AND COALESCE(p.void, 0) = 0
        ORDER BY p.purchase_date, p.id
      `, [startDate, endDate, supplierId])

      const purchaseIds = purchases.map(p => p.id)
      const paymentsMap: Record<number, any[]> = {}
      if (purchaseIds.length > 0) {
        const payments = await rawAll<any>(`
          SELECT ppi.purchase_id, p.payment_date as tdate, p.payment_number, SUM(ppi.pay_amount) as amount
          FROM ap_payments p
          JOIN ap_payment_items ppi ON ppi.payment_id = p.id
          WHERE ppi.purchase_id = ANY($1::int[])
            AND p.status = 'active'
          GROUP BY ppi.purchase_id, p.id
          ORDER BY p.payment_date, p.id
        `, [purchaseIds])
        for (const pm of payments) {
          if (!paymentsMap[pm.purchase_id]) paymentsMap[pm.purchase_id] = []
          paymentsMap[pm.purchase_id].push(pm)
        }
      }

      const openingBalances = await rawAll<any>(`
        SELECT id, tanggal as tdate, kode_nota, nominal
        FROM ap_opening_balances
        WHERE tanggal >= $1 AND tanggal <= $2
          AND supplier_id = $3
          AND (status IS NULL OR status != 'void')
          AND nominal > 0
        ORDER BY tanggal, id
      `, [startDate, endDate, supplierId])

      interface ExpoRow { tdate: string; kode: string; desc: string; debit: number | ''; kredit: number | '' }
      const allRows: ExpoRow[] = []
      for (const p of purchases) {
        allRows.push({ tdate: p.tdate, kode: p.purchase_number, desc: 'pembelian', debit: Number(p.total || 0), kredit: '' })
        const pms = paymentsMap[p.id] || []
        for (const pm of pms) {
          allRows.push({ tdate: pm.tdate, kode: pm.payment_number, desc: 'bayar hutang', debit: '', kredit: Number(pm.amount || 0) })
        }
      }
      for (const r of returns) {
        allRows.push({ tdate: r.tdate, kode: r.purchase_number, desc: 'retur pembelian', debit: '', kredit: Number(r.total || 0) })
      }
      for (const ob of openingBalances) {
        allRows.push({ tdate: ob.tdate, kode: ob.kode_nota, desc: 'saldo awal hutang', debit: Number(ob.nominal || 0), kredit: '' })
      }
      allRows.sort((a, b) => a.tdate.localeCompare(b.tdate) || a.kode.localeCompare(b.kode))

      const rows: any[][] = [
        ['KARTU HUTANG PER TRANSAKSI'],
        [`Supplier: ${supplierName}`],
        [`Periode: ${startDate} s/d ${endDate}`],
        [],
        ['Tanggal', 'Kode Nota', 'Keterangan', 'Debit', 'Kredit'],
      ]

      for (const r of allRows) {
        rows.push([r.tdate, r.kode, r.desc, r.debit, r.kredit])
      }

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Kartu Hutang Per Transaksi')
    } else {
      const purchases = await rawAll<any>(`
        SELECT p.purchase_date as tdate, p.purchase_number as source_number,
               'pembelian' as description, p.total as debit, 0 as kredit
        FROM purchases p
        WHERE p.purchase_date >= $1 AND p.purchase_date <= $2
          AND p.supplier_id = $3
          AND (p.is_return IS NULL OR p.is_return = 0)
          AND COALESCE(p.void, 0) = 0
          AND p.total > 0
      `, [startDate, endDate, supplierId])

      const returns = await rawAll<any>(`
        SELECT p.purchase_date as tdate, p.purchase_number as source_number,
               'retur pembelian' as description, 0 as debit, ABS(p.total) as kredit
        FROM purchases p
        WHERE p.purchase_date >= $1 AND p.purchase_date <= $2
          AND p.supplier_id = $3
          AND p.is_return = 1
          AND COALESCE(p.void, 0) = 0
          AND ABS(p.total) > 0
      `, [startDate, endDate, supplierId])

      const payments = await rawAll<any>(`
        SELECT p.payment_date as tdate, p.payment_number as source_number,
               'bayar hutang' as description, 0 as debit, SUM(ppi.pay_amount) as kredit
        FROM ap_payments p
        JOIN ap_payment_items ppi ON ppi.payment_id = p.id
        WHERE p.payment_date >= $1 AND p.payment_date <= $2
          AND p.supplier_id = $3
          AND p.status = 'active'
        GROUP BY p.id
      `, [startDate, endDate, supplierId])

      const openings = await rawAll<any>(`
        SELECT tanggal as tdate, kode_nota as source_number,
               'saldo awal hutang' as description, nominal as debit, 0 as kredit
        FROM ap_opening_balances
        WHERE tanggal >= $1 AND tanggal <= $2
          AND supplier_id = $3
          AND (status IS NULL OR status != 'void')
          AND nominal > 0
      `, [startDate, endDate, supplierId])

      const beforeStart = (() => { const d = new Date(startDate); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) })()
      const beforePurchases = (await rawGet<any>(`SELECT COALESCE(SUM(p.total),0) as total FROM purchases p WHERE p.purchase_date <= $1 AND p.purchase_date>='2000-01-01' AND p.supplier_id=$2 AND (p.is_return IS NULL OR p.is_return=0) AND COALESCE(p.void,0)=0`, [beforeStart, supplierId]))?.total||0
      const beforePayments = (await rawGet<any>(`SELECT COALESCE(SUM(ppi.pay_amount),0) as total FROM ap_payments p JOIN ap_payment_items ppi ON ppi.payment_id=p.id WHERE p.payment_date<=$1 AND p.payment_date>='2000-01-01' AND p.supplier_id=$2 AND p.status='active'`, [beforeStart, supplierId]))?.total||0
      const beforeReturns = (await rawGet<any>(`SELECT COALESCE(SUM(ABS(p.total)),0) as total FROM purchases p WHERE p.purchase_date<=$1 AND p.purchase_date>='2000-01-01' AND p.supplier_id=$2 AND p.is_return=1 AND COALESCE(p.void,0)=0`, [beforeStart, supplierId]))?.total||0
      const beforeOpenings = (await rawGet<any>(`SELECT COALESCE(SUM(nominal),0) as total FROM ap_opening_balances WHERE tanggal <= $1 AND tanggal>='2000-01-01' AND supplier_id=$2 AND (status IS NULL OR status != 'void')`, [beforeStart, supplierId]))?.total||0
      const openingBalance = Math.round((Number(beforePurchases)-Number(beforeReturns)-Number(beforePayments)+Number(beforeOpenings))*100)/100

      const combined: any[] = [...purchases, ...returns, ...payments, ...openings]
      combined.sort((a, b) => a.tdate.localeCompare(b.tdate) || a.source_number.localeCompare(b.source_number))

      const rows: any[][] = [
        ['KARTU HUTANG'],
        [`Supplier: ${supplierName}`],
        [`Periode: ${startDate} s/d ${endDate}`],
        [],
        ['Tanggal', 'Kode Nota', 'Keterangan', 'Debit', 'Kredit', 'Saldo'],
      ]

      rows.push([startDate, '', 'Saldo Awal', '', '', openingBalance])
      let balance = openingBalance
      for (const r of combined) {
        const debit = Number(r.debit || 0)
        const kredit = Number(r.kredit || 0)
        balance += debit - kredit
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
      XLSX.utils.book_append_sheet(wb, ws, 'Kartu Hutang')
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const ts = new Date().toISOString().slice(0, 10)
    const fn = mode === 'per-transaksi' ? `kartu-hutang-per-transaksi-${ts}` : `kartu-hutang-${ts}`
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
