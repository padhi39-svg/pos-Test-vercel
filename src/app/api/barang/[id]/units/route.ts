import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

/**
 * GET /api/barang/[id]/units
 * Get units for a specific barang with conversion ratios
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    
    // Get all units for this barang
    const units = await rawAll(`
      SELECT 
        id,
        barang_id,
        name as unit,
        ratio,
        CASE WHEN ratio = 1 THEN 1 ELSE 0 END as is_base
      FROM barang_units
      WHERE barang_id = ?
      ORDER BY ratio ASC
    `, [params.id])

    if (!units || units.length === 0) {
      return NextResponse.json({ error: 'Units not found for this barang' }, { status: 404 })
    }

    return NextResponse.json(units)
  } catch (error: any) {
    console.error('Error fetching barang units:', error)
    return NextResponse.json({ error: 'Failed to fetch units', details: error.message }, { status: 500 })
  }
}
