import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getKartuHutang } from '@/lib/repositories/ap-reports'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_kartu_hutang', 'view') && !hasPermission(req as any, 'keu_buku_besar', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const result = await getKartuHutang(
      url.searchParams.get('startDate') || undefined,
      url.searchParams.get('endDate') || undefined,
      url.searchParams.get('supplierId') || undefined,
      url.searchParams.get('mode') || 'reguler'
    )
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
