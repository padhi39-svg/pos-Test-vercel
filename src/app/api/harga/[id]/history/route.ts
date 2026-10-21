import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const barangId = parseInt(params.id)
    
    // Get price history with unit details (sorted by datetime DESC, ratio ASC)
    const history = await rawAll(`
      SELECT 
        p.price,
        p.effective_date,
        u.name as unit_name,
        u.ratio
      FROM barang_prices p
      JOIN barang_units u ON p.unit_id = u.id
      WHERE p.barang_id = ?
      ORDER BY p.effective_date DESC, u.ratio ASC
      LIMIT 100
    `, [barangId]) as any[]
    
    return NextResponse.json(history.map((h: any) => ({
      price: h.price,
      effectiveDate: h.effective_date,
      unitName: h.unit_name,
      ratio: h.ratio
    })))
  } catch (error) {
    console.error('Error fetching price history:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
