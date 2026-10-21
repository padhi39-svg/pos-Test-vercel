import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(_req: NextRequest) {
  try {
    const db = getDb()

    // Dates for today and month
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const todayStr = `${yyyy}-${mm}-${dd}`
    const monthStart = `${yyyy}-${mm}-01`

    // Safe column access
    const cols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'transactions'`)
    const totalCol = cols.some(c => String(c.name).toLowerCase() === 'total') ? 'total' : undefined

    // Defaults if columns missing
    const dateExpr = `DATE(COALESCE(t.transaction_date, t.tgl_nota, t.created_at))`
    const totalExpr = totalCol ? `COALESCE(t.${totalCol},0)` : `0`

    const todayRow = await rawGet(`
      SELECT COUNT(*) as orders, SUM(${totalExpr}) as revenue
      FROM transactions t
      WHERE COALESCE(t.void,0)=0 AND ${dateExpr} = ?
    `, [todayStr])

    const monthRow = await rawGet(`
      SELECT COUNT(*) as orders, SUM(${totalExpr}) as revenue
      FROM transactions t
      WHERE COALESCE(t.void,0)=0 AND ${dateExpr} >= ? AND ${dateExpr} <= ?
    `, [monthStart, todayStr])

    // New customers this month
    let newCustomers = 0
    try {
      const ccols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'master_customer'`)
      const cHasCreatedAt = ccols.some(c => String(c.name).toLowerCase() === 'created_at')
      const custRow = await rawGet(`
        SELECT COUNT(*) as c FROM master_customer 
        WHERE COALESCE(isdelete,0)=0 ${cHasCreatedAt ? `AND DATE(created_at) >= ? AND DATE(created_at) <= ?` : ''}
      `, [monthStart, todayStr])
      newCustomers = Number(custRow?.c || 0)
    } catch {}

    // Total menu
    let totalMenu = 0
    try {
      const mcols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'master_barang'`)
      const hasIsActive = mcols.some(c => String(c.name).toLowerCase() === 'isactive')
      const row = await rawGet(`SELECT COUNT(*) as c FROM master_barang ${hasIsActive ? 'WHERE COALESCE(isactive,1)=1' : ''}`)
      totalMenu = Number(row?.c || 0)
    } catch {}

    const todayOrders = Number(todayRow?.orders || 0)
    const todayRevenue = Number(todayRow?.revenue || 0)
    const monthOrders = Number(monthRow?.orders || 0)
    const monthRevenue = Number(monthRow?.revenue || 0)
    const aov = monthOrders > 0 ? monthRevenue / monthOrders : 0

    return NextResponse.json({
      todayOrders, todayRevenue, monthOrders, monthRevenue, avgOrderValue: aov, newCustomers, totalMenu
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to get KPI' }, { status: 500 })
  }
}
