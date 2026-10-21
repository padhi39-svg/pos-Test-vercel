import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST(request: NextRequest) {
  try {
    const { barangId, unitName, quantity } = await request.json()
    const db = getDb()
    
    // Get barang stock
    const barang = await rawGet<any>(`
      SELECT stock_current, smallest_unit
      FROM master_barang 
      WHERE id = ? AND isdelete = 0
    `, [barangId])
    
    if (!barang) {
      return NextResponse.json({ 
        error: 'Barang not found' 
      }, { status: 404 })
    }
    
    // Get unit ratio
    const unit = await rawGet<any>(`
      SELECT ratio_to_smallest
      FROM barang_units
      WHERE barang_id = ? AND unit_name = ?
    `, [barangId, unitName])
    
    if (!unit) {
      return NextResponse.json({ 
        error: 'Unit not found' 
      }, { status: 404 })
    }
    
    // Calculate required stock in smallest unit
    const currentStock = Number(barang.stock_current) || 0
    const requiredStock = Number(quantity) * Number(unit.ratio_to_smallest)
    const available = currentStock >= requiredStock
    const shortage = Math.max(0, requiredStock - currentStock)
    
    return NextResponse.json({
      available,
      currentStock,
      requiredStock,
      shortage,
      smallestUnit: barang.smallest_unit,
      warning: !available ? `Stok tidak cukup! Tersedia: ${currentStock} ${barang.smallest_unit}, Dibutuhkan: ${requiredStock} ${barang.smallest_unit}` : null
    })
  } catch (error) {
    console.error('Error validating stock:', error)
    return NextResponse.json({ 
      error: 'Failed to validate stock' 
    }, { status: 500 })
  }
}
