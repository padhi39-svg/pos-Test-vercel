import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getSalesRecap } from '@/lib/repositories/sales'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'sales_recap', 'view') && !hasPermission(request as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const rows = await getSalesRecap(
      searchParams.get('from') || undefined,
      searchParams.get('to') || undefined,
      searchParams.get('type') || undefined
    )
    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error('Error fetching sales recap report:', error)
    return NextResponse.json({ error: 'Failed to fetch report', details: error.message }, { status: 500 })
  }
}
