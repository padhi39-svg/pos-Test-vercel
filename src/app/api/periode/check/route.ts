import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getPeriodByDate } from '@/lib/period'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'periode', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const date = String(url.searchParams.get('date') || '').slice(0, 10)
    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    }

    const period = await getPeriodByDate(date)
    if (!period) {
      return NextResponse.json({ exists: false, code: 'PERIOD_NOT_FOUND' }, { status: 200 })
    }

    return NextResponse.json({ exists: true, period })
  } catch (e: any) {
    console.error('GET /api/periode/check error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to check period' }, { status: 500 })
  }
}
