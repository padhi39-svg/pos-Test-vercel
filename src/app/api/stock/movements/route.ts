import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

/**
 * GET /api/stock/movements
 * Get all stock movements with details (using view)
 */
export async function GET() {
  try {
    const db = getDb()
    
    const movements = await rawAll(`
      SELECT * FROM v_stock_movements_detail
      ORDER BY transaction_date DESC, created_at DESC
    `)
    
    return NextResponse.json(movements)
  } catch (error: any) {
    console.error('Error fetching stock movements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock movements', details: error.message },
      { status: 500 }
    )
  }
}
