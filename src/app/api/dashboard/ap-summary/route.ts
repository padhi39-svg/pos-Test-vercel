import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

// AP (Hutang) monthly summary and total outstanding
export async function GET(req: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(req.url)
    const months = Math.max(1, Math.min(24, Number(searchParams.get('months') || 12)))

    // Detect schema
    const tables = (await rawAll("SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema = CURRENT_SCHEMA")).map(r=>String(r.table_name).toLowerCase())
    const hasPurchases = tables.includes('purchases')
    const hasApPayments = tables.includes('ap_payments') && tables.includes('ap_payment_items')
    if (!hasPurchases) return NextResponse.json({ rows: [], totalOutstanding: 0 })

    const pcols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'purchases'`)
    const has = (n:string)=> pcols.some(c=> String(c.name).toLowerCase()===n)
    const dateCol = has('purchase_date') ? 'purchase_date' : (has('tgl_beli') ? 'tgl_beli' : 'created_at')
    const totalCol = has('total') ? 'total' : (has('grand_total') ? 'grand_total' : 'total')
    const isReturnCol = has('is_return') ? 'is_return' : null
    const statusCol = has('status') ? 'status' : null

    // Total paid per purchase via ap_payment_items
    const paidExpr = hasApPayments
      ? `COALESCE((SELECT SUM(COALESCE(i.pay_amount,0))
                   FROM ap_payment_items i
                   JOIN ap_payments ap ON ap.id = i.payment_id
                   WHERE i.purchase_id = p.id AND COALESCE(ap.status,'posted') <> 'void'), 0)`
      : `0`

    // Build monthly rows for last N months
    const rows: Array<{ ym: string; outstanding: number }> = []
    for (let i = months - 1; i >= 0; i--) {
      const row = await rawGet(`
        SELECT TO_CHAR(CURRENT_DATE + INTERVAL '1 month' * $1, 'YYYY-MM') as ym,
               COALESCE(SUM(
                 GREATEST(0, COALESCE(p.${totalCol},0) - (${paidExpr}))
               ), 0) AS outstanding
        FROM purchases p
        WHERE DATE(p.${dateCol}) >= DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month' * $2)
          AND DATE(p.${dateCol}) < DATE(DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month' * $3) + INTERVAL '1 month')
          ${isReturnCol ? `AND COALESCE(p.${isReturnCol},0)=0` : ''}
          ${statusCol ? `AND COALESCE(p.${statusCol},'posted') <> 'void'` : ''}
      `, [-i, -i, -i])
      rows.push({ ym: String(row?.ym || ''), outstanding: Number(row?.outstanding || 0) })
    }

    // Total outstanding now (all time)
    const total = await rawGet(`
      SELECT COALESCE(SUM(GREATEST(0, COALESCE(p.${totalCol},0) - (${paidExpr}))), 0) AS outstanding
      FROM purchases p
      ${isReturnCol ? `WHERE COALESCE(p.${isReturnCol},0)=0` : ''}
      ${statusCol ? `${isReturnCol ? 'AND' : 'WHERE'} COALESCE(p.${statusCol},'posted') <> 'void'` : ''}
    `)

    return NextResponse.json({ rows, totalOutstanding: Number(total?.outstanding || 0) })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Failed to get AP summary' }, { status: 500 })
  }
}
