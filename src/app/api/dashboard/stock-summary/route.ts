import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(_req: NextRequest) {
  try {
    const tables = (await rawAll("SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema = CURRENT_SCHEMA")).map(r=>String(r.table_name).toLowerCase())
    const hasSB = tables.includes('stock_balance')
    const hasMB = tables.includes('master_barang')
    if (!hasSB) return NextResponse.json({ totalValue: 0, top: [] })

    const row = await rawGet(`SELECT COALESCE(SUM(COALESCE(total_cost,0)),0) as v FROM stock_balance`)
    const totalValue = Number(row?.v || 0)

    let top: any[] = []
    if (hasMB) {
      top = await rawAll(`
        SELECT mb.id, mb.code, mb.name, COALESCE(sb.total_cost,0) AS total_cost
        FROM stock_balance sb
        LEFT JOIN master_barang mb ON mb.id = sb.ingredient_id
        ORDER BY COALESCE(sb.total_cost,0) DESC
        LIMIT 5
      `)
    }

    return NextResponse.json({ totalValue, top })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Failed to get stock summary' }, { status: 500 })
  }
}
