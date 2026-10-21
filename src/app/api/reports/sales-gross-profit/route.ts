import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'
import { getSalesGrossProfit, getSalesVsUsageMeta } from '@/lib/repositories/sales'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode')

    const canView = hasPermission(request as any, 'sales_gross_profit', 'view') || hasPermission(request as any, 'sales_recap', 'view')
    if (!canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (mode === 'meta') {
      const meta = await getSalesVsUsageMeta()
      return NextResponse.json(meta)
    }

    const from = url.searchParams.get('from') || ''
    const to = url.searchParams.get('to') || ''
    const barangId = url.searchParams.get('barangId')
    const customerId = url.searchParams.get('customerId')

    const rows = await getSalesGrossProfit(from || undefined, to || undefined, barangId || undefined, customerId || undefined)
    const totalSubtotal = rows.reduce((s, r) => s + (Number(r.subtotal) || 0), 0)
    const totalHpp = rows.reduce((s, r) => s + (Number(r.total_hpp) || 0), 0)
    const totalLabaRugi = totalSubtotal - totalHpp

    return NextResponse.json({ rows, totals: { subtotal: totalSubtotal, total_hpp: totalHpp, laba_rugi: totalLabaRugi } })
  } catch (e: any) {
    console.error('Error sales-gross-profit:', e)
    return NextResponse.json({ error: 'Failed to fetch report', details: e?.message }, { status: 500 })
  }
}
