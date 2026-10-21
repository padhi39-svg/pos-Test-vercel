import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET() {
  try {
    const db = getDb()
    
    console.log('\n=== TEST PRODUCT API ===')
    
    // Get Air Mineral 600 Ml
    const barang = await rawGet(`
      SELECT id, code, name, hpp, jenis
      FROM master_barang
      WHERE code = 'BK0022'
    `) as any
    
    if (!barang) {
      return NextResponse.json({ error: 'Product not found' })
    }
    
    console.log('Barang:', barang)
    
    // Get units
    const units = await rawAll(`
      SELECT id, name, ratio 
      FROM barang_units 
      WHERE barang_id = ?
    `, [barang.id]) as any[]
    
    console.log('Units:', units)
    
    // Get prices (with date filter)
    const prices = await rawAll(`
      SELECT unit_id, price, effective_date 
      FROM barang_prices 
      WHERE barang_id = ? 
        AND (effective_date::text <= CURRENT_DATE)
      ORDER BY effective_date DESC
    `, [barang.id]) as any[]
    
    console.log('Prices:', prices)
    
    // Build response like /api/barang does
    const result = {
      id: barang.id,
      code: barang.code,
      name: barang.name,
      hpp: barang.hpp,
      jenis: barang.jenis,
      units: units.map((u: any) => ({
        id: u.id,
        name: u.name,
        ratio: u.ratio
      })),
      prices: prices.map((p: any) => ({
        unit_id: p.unit_id,
        price: p.price,
        effectiveDate: p.effective_date
      }))
    }
    
    console.log('Result:', JSON.stringify(result, null, 2))
    
    return NextResponse.json({
      success: true,
      data: result,
      debug: {
        units_count: units.length,
        prices_count: prices.length,
        prices_have_unit_id: prices.every((p: any) => p.unit_id != null)
      }
    })
  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json({ 
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
