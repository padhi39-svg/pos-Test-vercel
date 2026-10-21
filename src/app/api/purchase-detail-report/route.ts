import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getPurchaseDetail } from '@/lib/repositories/purchase-reports'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'purchase_detail', 'view') && !hasPermission(request as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const rows = await getPurchaseDetail(
      searchParams.get('from') || undefined,
      searchParams.get('to') || undefined,
      searchParams.get('purchase_number') || undefined,
      searchParams.get('type') || undefined,
      searchParams.get('barang_id') || undefined
    )
    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error('Error fetching purchase detail report:', error)
    return NextResponse.json({ error: 'Failed to fetch report', details: error.message }, { status: 500 })
  }
}
