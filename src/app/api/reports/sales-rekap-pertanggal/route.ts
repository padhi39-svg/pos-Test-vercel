import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getSalesRekapPertanggal } from '@/lib/repositories/sales'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'sales_recap', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const rows = await getSalesRekapPertanggal(
      searchParams.get('from') || undefined,
      searchParams.get('to') || undefined,
      searchParams.get('type') || undefined
    )
    return NextResponse.json({ rows })
  } catch (e: any) {
    console.error('Error sales-rekap-pertanggal:', e)
    return NextResponse.json({ error: 'Failed to fetch report', details: e.message }, { status: 500 })
  }
}
