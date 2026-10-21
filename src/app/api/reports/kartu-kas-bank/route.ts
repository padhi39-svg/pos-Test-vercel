import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getKartuKasBank } from '@/lib/repositories/cashbank'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_kartu_kas_bank', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const result = await getKartuKasBank(
      url.searchParams.get('accountId') || undefined,
      url.searchParams.get('startDate') || undefined,
      url.searchParams.get('endDate') || undefined
    )
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
