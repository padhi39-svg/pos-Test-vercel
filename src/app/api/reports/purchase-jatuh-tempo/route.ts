import { NextRequest, NextResponse } from 'next/server'
import { getPurchaseJatuhTempo } from '@/lib/repositories'

export async function GET(_request: NextRequest) {
  try {
    const rows = await getPurchaseJatuhTempo()
    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error('Error fetching purchase jatuh tempo:', error)
    return NextResponse.json({ error: 'Failed to fetch report', details: error.message }, { status: 500 })
  }
}
