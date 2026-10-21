import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getNeraca } from '@/lib/repositories/accounting'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_neraca', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const result = await getNeraca(
      url.searchParams.get('asOf') || undefined,
      url.searchParams.get('periodId') || undefined
    )
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
