import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getSalesDetail } from '@/lib/repositories/sales'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'sales_detail', 'view') && !hasPermission(request as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const rows = await getSalesDetail(
      searchParams.get('from') || undefined,
      searchParams.get('to') || undefined,
      searchParams.get('transaction_number') || undefined
    )
    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error('Error fetching sales detail report:', error)
    return NextResponse.json({ error: 'Failed to fetch report', details: error.message }, { status: 500 })
  }
}
