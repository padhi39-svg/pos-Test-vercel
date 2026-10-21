import { NextRequest, NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'
import {
  getPiutangCustomers,
  getSalesPerTransaction,
  getPaymentsBySaleIds,
  getOpeningBalances,
  getPiutangReguler,
  getPiutangBeforeDate,
} from '@/lib/repositories'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_kartu_piutang', 'view') && !hasPermission(req as any, 'keu_buku_besar', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const startDate = url.searchParams.get('startDate') || ''
    const endDate = url.searchParams.get('endDate') || ''
    const customerId = url.searchParams.get('customerId') || ''
    const mode = url.searchParams.get('mode') || 'reguler'

    if (!customerId) {
      const list = await getPiutangCustomers()
      return NextResponse.json({ customers: list })
    }

    const cust = await rawGet<any>('SELECT id, name FROM master_customer WHERE id = $1', [customerId])
    const customerName = cust?.name || ''

    if (mode === 'per-transaksi') {
      const sales = await getSalesPerTransaction({ startDate, endDate, customerId })

      const saleIds = sales.map((s: any) => s.id)
      const paymentsMap: Record<number, any[]> = {}
      if (saleIds.length > 0) {
        const payments = await getPaymentsBySaleIds(saleIds)
        for (const pm of payments) {
          if (!paymentsMap[pm.sale_id]) paymentsMap[pm.sale_id] = []
          paymentsMap[pm.sale_id].push(pm)
        }
      }

      const groups: any[] = sales.map((s: any) => {
        const rows: any[] = [{
          tdate: s.tdate,
          source_number: s.transaction_number,
          description: 'penjualan',
          debit: 0,
          kredit: Number(s.total || 0),
        }]
        const pms = paymentsMap[s.id] || []
        for (const pm of pms) {
          rows.push({
            tdate: pm.tdate,
            source_number: pm.payment_number,
            description: 'terima piutang',
            debit: Number(pm.amount || 0),
            kredit: 0,
          })
        }
        return { sale_number: s.transaction_number, sale_date: s.tdate, rows }
      })

      const openingBalances = await getOpeningBalances({ startDate, endDate, customerId })
      for (const ob of openingBalances) {
        groups.push({
          sale_number: ob.kode_nota,
          sale_date: ob.tdate,
          rows: [{
            tdate: ob.tdate,
            source_number: ob.kode_nota,
            description: 'saldo awal piutang',
            debit: 0,
            kredit: Number(ob.nominal || 0),
          }],
          is_opening: true,
        })
      }

      groups.sort((a: any, b: any) => a.sale_date.localeCompare(b.sale_date) || a.sale_number.localeCompare(b.sale_number))

      return NextResponse.json({ mode: 'per-transaksi', customer_id: customerId, customer_name: customerName, groups })
    }

    const beforeStart = (() => {
      const d = new Date(startDate)
      d.setDate(d.getDate() - 1)
      return d.toISOString().slice(0, 10)
    })()

    const before = await getPiutangBeforeDate(beforeStart, customerId)
    const openingBalance = Math.round((before.sales - before.payments + before.openings) * 100) / 100

    const { sales, payments, openings } = await getPiutangReguler(startDate, endDate, customerId)

    const combined: any[] = [...sales, ...payments, ...openings]
    combined.sort((a: any, b: any) => a.tdate.localeCompare(b.tdate) || a.source_number.localeCompare(b.source_number))

    const rows: any[] = [{
      tdate: startDate,
      source_number: '',
      description: 'Saldo Awal',
      debit: 0,
      kredit: 0,
      balance: openingBalance,
    }]
    let balance = openingBalance
    for (const r of combined) {
      const debit = Number(r.debit || 0)
      const kredit = Number(r.kredit || 0)
      balance += kredit - debit
      rows.push({
        tdate: r.tdate,
        source_number: r.source_number,
        description: r.description,
        debit,
        kredit,
        balance: Math.round(balance * 100) / 100,
      })
    }

    return NextResponse.json({ mode: 'reguler', customer_id: customerId, customer_name: customerName, rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
