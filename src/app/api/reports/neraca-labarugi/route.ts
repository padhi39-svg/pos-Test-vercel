import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getNeracaLabaRugi } from '@/lib/repositories/accounting'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_neraca_labarugi', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const periodId = url.searchParams.get('periodId')
    if (!periodId) {
      return NextResponse.json({ error: 'periodId required' }, { status: 400 })
    }
    const result = await getNeracaLabaRugi(Number(periodId))
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
