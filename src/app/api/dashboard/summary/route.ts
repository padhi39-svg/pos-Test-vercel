import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(_req: NextRequest) {
  try {
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)

    // Total Menu (aktif & not deleted)
    const totalMenu = (await rawGet(`SELECT COUNT(*) AS c FROM master_barang WHERE isdelete = 0 AND aktif = 1`))?.c || 0

    // Customers
    const customerCount = (await rawGet(`SELECT COUNT(*) AS c FROM master_customer WHERE isdelete = 0`))?.c || 0

    // Today sales count and revenue
    const dateCol = `COALESCE(transaction_date, tgl_nota, created_at::date)`
    const whereToday = `${dateCol} = ?::date`

    const todaySalesRow = await rawGet(`
      SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS sum_total
      FROM transactions
      WHERE ${whereToday}
    `, [today])

    const todaySalesCount = todaySalesRow?.cnt || 0
    const todayRevenue = todaySalesRow?.sum_total || 0

    // Recent transactions (last 5, exclude void)
    const tdateExpr = `COALESCE(t.transaction_date, t.tgl_nota, t.created_at::date)`
    const orderBy = `${tdateExpr} DESC, t.created_at DESC`
    const recent = await rawAll(`
      SELECT t.id, t.transaction_number, ${tdateExpr} AS tdate,
             t.total, c.name AS customer_name
      FROM transactions t
      LEFT JOIN master_customer c ON t.customer_id = c.id
      WHERE COALESCE(t.void, 0) = 0
      ORDER BY ${orderBy}
      LIMIT 5
    `)

    // Attach item count per transaction
    const recentWithItems = await Promise.all(recent.map(async (r: any) => {
      const itemRow = await rawGet(`SELECT COUNT(*) AS c FROM transaction_items WHERE transaction_id = ?`, [r.id])
      return { ...r, item_count: itemRow?.c || 0 }
    }))

    return NextResponse.json({
      totalMenu,
      customerCount,
      todaySalesCount,
      todayRevenue,
      recentTransactions: recentWithItems,
      date: today,
    })
  } catch (error: any) {
    console.error('[Dashboard] summary error:', error)
    return NextResponse.json({ error: 'Failed to compute dashboard summary', details: error.message }, { status: 500 })
  }
}
