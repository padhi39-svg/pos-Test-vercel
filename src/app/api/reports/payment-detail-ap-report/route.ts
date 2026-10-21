import { NextRequest, NextResponse } from 'next/server'
import { getPaymentDetailApReport } from '@/lib/repositories/payment-reports'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rows = await getPaymentDetailApReport(
      searchParams.get('from') || undefined,
      searchParams.get('to') || undefined,
      searchParams.get('payment_number') || undefined,
      searchParams.get('customer') || undefined,
      searchParams.get('status') || 'active'
    )
    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error('Error in payment-detail-ap-report:', error)
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 })
  }
}
