import { NextRequest, NextResponse } from 'next/server'
import { getPaymentRecapAp } from '@/lib/repositories/payment-reports'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rows = await getPaymentRecapAp(
      searchParams.get('from') || undefined,
      searchParams.get('to') || undefined,
      searchParams.get('supplier') || undefined,
      searchParams.get('status') || undefined
    )
    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error('Error in payment-recap-report:', error)
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 })
  }
}
