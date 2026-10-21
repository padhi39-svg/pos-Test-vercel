import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getPoRealization } from '@/lib/repositories/po-reports'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'po_realization', 'view') && !hasPermission(request as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const rows = await getPoRealization(
      searchParams.get('from') || undefined,
      searchParams.get('to') || undefined,
      searchParams.get('po_number') || undefined
    )
    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error('Error fetching PO realization report:', error)
    return NextResponse.json({ error: 'Failed to fetch report', details: error.message }, { status: 500 })
  }
}
