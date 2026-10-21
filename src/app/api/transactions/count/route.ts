import { NextRequest, NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')

    if (!year) {
      return NextResponse.json({ error: 'Year parameter required' }, { status: 400 })
    }

    const result = await rawGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM transactions WHERE EXTRACT(YEAR FROM created_at) = $1",
      [year]
    )

    return NextResponse.json({ count: result?.count || 0 })
  } catch (error: any) {
    console.error('Error counting transactions:', error)
    return NextResponse.json(
      { error: 'Failed to count transactions', details: error.message },
      { status: 500 }
    )
  }
}
