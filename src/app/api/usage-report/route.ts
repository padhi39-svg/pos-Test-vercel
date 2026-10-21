import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'
import { getUsageReport, getUsageDetail } from '@/lib/repositories'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'usage_report', 'view') && !hasPermission(request as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat laporan pemakaian' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined
    const ingredientId = searchParams.get('ingredientId') || undefined
    const productId = searchParams.get('productId') || undefined

    const summaryRaw = await getUsageReport(from, to, ingredientId)

    const summary = await Promise.all(summaryRaw.map(async (item: any) => {
      const units = await rawAll<any>(`
        SELECT name, ratio 
        FROM barang_units 
        WHERE barang_id = $1 
        ORDER BY ratio ASC
      `, [item.ingredient_id])

      const conversions = units.map((u: any) => ({
        unit_name: u.name,
        quantity: item.total_used / u.ratio
      }))

      return { ...item, unit_conversions: conversions }
    }))

    const details = productId ? await getUsageDetail(from, to, productId) : null

    return NextResponse.json({
      period: { from, to },
      summary,
      details
    })
  } catch (error: any) {
    console.error('Error fetching usage report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage report', details: error.message },
      { status: 500 }
    )
  }
}
