import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET() {
  try {
    const db = getDb()
    
    // Test 1: Check barang data
    console.log('\n=== TEST 1: Check Barang ===')
    const barang = await rawGet(`
      SELECT id, code, name, hpp, jenis
      FROM master_barang
      WHERE code = 'BK0022'
      LIMIT 1
    `) as any
    
    console.log('Barang:', barang)
    
    if (!barang) {
      return NextResponse.json({ 
        error: 'Barang BK0022 not found',
        step: 'barang_check'
      })
    }
    
    // Test 2: Check units
    console.log('\n=== TEST 2: Check Units ===')
    const units = await rawAll(`
      SELECT id, name, ratio
      FROM barang_units
      WHERE barang_id = ?
    `, [barang.id]) as any[]
    
    console.log('Units:', units)
    
    // Test 3: Check prices
    console.log('\n=== TEST 3: Check Prices ===')
    const prices = await rawAll(`
      SELECT id, unit_id, price, effective_date
      FROM barang_prices
      WHERE barang_id = ?
      ORDER BY effective_date DESC
    `, [barang.id]) as any[]
    
    console.log('Prices:', prices)
    
    // Test 4: Check joined data
    console.log('\n=== TEST 4: Check Joined Data ===')
    const joined = await rawAll(`
      SELECT 
        u.id as unit_id,
        u.name as unit_name,
        u.ratio,
        p.price,
        p.effective_date
      FROM barang_units u
      LEFT JOIN barang_prices p ON u.id = p.unit_id
      WHERE u.barang_id = ?
      ORDER BY u.ratio ASC
    `, [barang.id]) as any[]
    
    console.log('Joined:', joined)
    
    return NextResponse.json({
      success: true,
      barang: barang,
      units: units,
      prices: prices,
      joined: joined,
      summary: {
        barang_found: !!barang,
        units_count: units.length,
        prices_count: prices.length,
        joined_count: joined.length
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
