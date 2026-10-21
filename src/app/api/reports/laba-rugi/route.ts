import { NextRequest, NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'
import { getLabaRugi, getPeriod } from '@/lib/repositories/accounting'

async function computeSection(startDate: string, endDate: string) {
  return getLabaRugi(startDate, endDate)
}

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_laba_rugi', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    let startDate = url.searchParams.get('startDate') || ''
    let endDate = url.searchParams.get('endDate') || ''
    let periodId = url.searchParams.get('periodId')
    const compare = url.searchParams.get('compare') === 'true'

    if (periodId) {
      const period = await getPeriod(Number(periodId))
      if (period) { startDate = period.start_date; endDate = period.end_date }
    }

    const current = await computeSection(startDate, endDate)

    let previous: any = null
    let prevPeriodName = ''
    if (compare && periodId) {
      const curPeriod = await rawGet<any>('SELECT id, name, start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0', [Number(periodId)])
      if (curPeriod) {
        const prevPeriod = await rawGet<any>(`SELECT id, name, start_date, end_date FROM master_periode WHERE end_date < $1 AND isdelete = 0 ORDER BY end_date DESC LIMIT 1`, [curPeriod.start_date])
        if (prevPeriod) {
          previous = await computeSection(prevPeriod.start_date, prevPeriod.end_date)
          prevPeriodName = prevPeriod.name
        }
      }
    }

    return NextResponse.json({ ...current, previous, prevPeriodName })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
