import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getPurchaseRecap } from '@/lib/repositories/purchase-reports'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'purchase_recap', 'view') && !hasPermission(request as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const rows = await getPurchaseRecap(
      searchParams.get('from') || undefined,
      searchParams.get('to') || undefined,
      searchParams.get('type') || undefined
    )
    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error('Error fetching purchase recap report:', error)
    return NextResponse.json({ error: 'Failed to fetch report', details: error.message }, { status: 500 })
  }
}
