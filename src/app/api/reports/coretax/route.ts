import { NextRequest, NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'
import { getCoretax, getPeriod } from '@/lib/repositories/accounting'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_laba_rugi', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    let startDate = url.searchParams.get('startDate') || ''
    let endDate = url.searchParams.get('endDate') || ''
    const periodId = url.searchParams.get('periodId')

    if (periodId) {
      const period = await getPeriod(Number(periodId))
      if (period) { startDate = period.start_date; endDate = period.end_date }
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'periodId or startDate/endDate required' }, { status: 400 })
    }

    const result = await getCoretax(startDate, endDate)

    const periodInfo = periodId
      ? await rawGet<any>("SELECT name FROM master_periode WHERE id = $1 AND isdelete = 0", [Number(periodId)])
      : null
    result.periodName = periodInfo?.name || `${startDate} s.d ${endDate}`

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
