import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getReservationRecap } from '@/lib/repositories'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'reservasi_booking', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined
    const status = searchParams.get('status') || undefined

    const rows = await getReservationRecap(from, to, status)

    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error('Error fetching reservation report:', error)
    return NextResponse.json({ error: 'Failed to fetch report', details: error.message }, { status: 500 })
  }
}
