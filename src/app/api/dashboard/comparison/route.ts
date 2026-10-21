import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet } from '@/db/raw'
import { getLabaRugi } from '@/lib/repositories/accounting'

export async function GET(_req: NextRequest) {
  try {
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth() + 1
    const d = today.getDate()

    // Yesterday
    const yest = new Date(today)
    yest.setDate(yest.getDate() - 1)
    const yestStr = yest.toISOString().slice(0, 10)

    // Last month (same day-of-month, capped at month end)
    const lm = m === 1 ? 12 : m - 1
    const ly = m === 1 ? y - 1 : y
    const lastDayLM = new Date(ly, lm, 0).getDate()
    const ld = Math.min(d, lastDayLM)
    const lmStart = `${ly}-${String(lm).padStart(2, '0')}-01`
    const lmEnd = `${ly}-${String(lm).padStart(2, '0')}-${String(ld).padStart(2, '0')}`
    const lmFullEnd = `${ly}-${String(lm).padStart(2, '0')}-${String(lastDayLM).padStart(2, '0')}`

    // Transaction columns
    const cols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'transactions'`)
    const totalCol = cols.some(c => String(c.name).toLowerCase() === 'total') ? 'total' : undefined
    const dateExpr = `DATE(COALESCE(t.transaction_date, t.tgl_nota, t.created_at))`
    const totalExpr = totalCol ? `COALESCE(t.${totalCol},0)` : `0`

    const yesterdayRow = await rawGet(`
      SELECT COUNT(*) as orders, SUM(${totalExpr}) as revenue
      FROM transactions t
      WHERE COALESCE(t.void,0)=0 AND ${dateExpr} = ?
    `, [yestStr])

    const lastMonthRow = await rawGet(`
      SELECT COUNT(*) as orders, SUM(${totalExpr}) as revenue
      FROM transactions t
      WHERE COALESCE(t.void,0)=0 AND ${dateExpr} >= ? AND ${dateExpr} <= ?
    `, [lmStart, lmEnd])

    const yesterdayOrders = Number(yesterdayRow?.orders || 0)
    const yesterdayRevenue = Number(yesterdayRow?.revenue || 0)
    const lastMonthOrders = Number(lastMonthRow?.orders || 0)
    const lastMonthRevenue = Number(lastMonthRow?.revenue || 0)
    const lastMonthAvgOrderValue = lastMonthOrders > 0 ? Math.round(lastMonthRevenue / lastMonthOrders) : 0

    // Last month total hutang
    let lastMonthHutang = 0
    try {
      const tables = (await rawAll("SELECT table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema=CURRENT_SCHEMA")).map(r=>String(r.table_name).toLowerCase())
      if (tables.includes('purchases')) {
        const pcols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name='purchases'`)
        const has = (n:string) => pcols.some(c => String(c.name).toLowerCase()===n)
        const pDate = has('purchase_date') ? 'purchase_date' : (has('tgl_beli') ? 'tgl_beli' : 'created_at')
        const pTotal = has('total') ? 'total' : (has('grand_total') ? 'grand_total' : 'total')
        const pReturn = has('is_return') ? 'is_return' : null
        const pStatus = has('status') ? 'status' : null
        const hasApPayments = tables.includes('ap_payments') && tables.includes('ap_payment_items')
        const paidExpr = hasApPayments
          ? `COALESCE((SELECT SUM(COALESCE(i.pay_amount,0)) FROM ap_payment_items i JOIN ap_payments ap ON ap.id=i.payment_id WHERE i.purchase_id=p.id AND COALESCE(ap.status,'posted')<>'void'),0)`
          : `0`
        const row = await rawGet(`
          SELECT COALESCE(SUM(GREATEST(0, COALESCE(p.${pTotal},0)-(${paidExpr}))),0) AS outstanding
          FROM purchases p
          WHERE DATE(p.${pDate}) >= ? AND DATE(p.${pDate}) <= ?
          ${pReturn ? `AND COALESCE(p.${pReturn},0)=0` : ''}
          ${pStatus ? `AND COALESCE(p.${pStatus},'posted')<>'void'` : ''}
        `, [`${ly}-${String(lm).padStart(2, '0')}-01`, lmFullEnd])
        lastMonthHutang = Number(row?.outstanding || 0)
      }
    } catch {}

    // Last month laba rugi (previous period from periodId=2)
    let lastMonthLabaRugi = 0
    try {
      const curPeriod = await rawGet<any>('SELECT id, start_date, end_date FROM master_periode WHERE id=2 AND isdelete=0')
      if (curPeriod) {
        const prevPeriod = await rawGet<any>(`SELECT id, start_date, end_date FROM master_periode WHERE end_date<? AND isdelete=0 ORDER BY end_date DESC LIMIT 1`, [curPeriod.start_date])
        if (prevPeriod) {
          const prevLR = await getLabaRugi(prevPeriod.start_date, prevPeriod.end_date)
          lastMonthLabaRugi = Number(prevLR?.laba_bersih || 0)
        }
      }
    } catch {}

    return NextResponse.json({
      yesterdayOrders, yesterdayRevenue,
      lastMonthOrders, lastMonthRevenue, lastMonthAvgOrderValue,
      lastMonthHutang, lastMonthLabaRugi
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
