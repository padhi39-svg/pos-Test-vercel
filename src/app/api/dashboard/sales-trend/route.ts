import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(req: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(req.url)
    const days = Math.max(1, Math.min(31, Number(searchParams.get('days') || 7)))
    const type = searchParams.get('type')

    const cols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'transactions'`)
    const has = (n: string) => cols.some(c => String(c.name).toLowerCase() === n)
    const totalCol = has('total') ? 'total' : undefined
    const dateExpr = `DATE(COALESCE(t.transaction_date, t.tgl_nota, t.created_at))`
    const totalExpr = totalCol ? `COALESCE(t.${totalCol},0)` : `0`

    let sql = `
      SELECT TO_CHAR(${dateExpr}, 'YYYY-MM-DD') as tdate, COUNT(*)::int as orders, SUM(${totalExpr})::numeric as revenue
      FROM transactions t
      WHERE COALESCE(t.void,0)=0 AND ${dateExpr} >= CURRENT_DATE - (?::int || ' days')::interval
    `
    const params: any[] = [days]
    if (type && has('transaction_type')) {
      sql += ` AND COALESCE(t.transaction_type,1) = ?`
      params.push(Number(type))
    }
    sql += ` GROUP BY ${dateExpr} ORDER BY ${dateExpr}`

    const rows = await rawAll(sql, params)

    return NextResponse.json({ rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to get trend' }, { status: 500 })
  }
}
