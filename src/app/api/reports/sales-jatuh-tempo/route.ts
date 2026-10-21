import { NextRequest, NextResponse } from 'next/server'
import { getSalesJatuhTempo } from '@/lib/repositories/sales'

export async function GET(request: NextRequest) {
  try {
    const rows = await getSalesJatuhTempo()
    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error('Error fetching sales jatuh tempo:', error)
    return NextResponse.json({ error: 'Failed to fetch report', details: error.message }, { status: 500 })
  }
}
