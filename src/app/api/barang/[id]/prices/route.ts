import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const pool = (db as any).$client
    const barangId = parseInt(params.id)
    
    // Get barang info
    const barang = await rawGet(`
      SELECT id, code, name
      FROM master_barang 
      WHERE id = ? AND isdelete = 0
    `, [barangId]) as any
    
    if (!barang) {
      return NextResponse.json({ error: 'Barang not found' }, { status: 404 })
    }
    
    // Get all units with latest prices
    let units: any[] = []
    try {
      units = await rawAll(`
        SELECT 
          u.id as unit_id,
          u.name as unit_name,
          u.ratio as ratio_to_smallest,
          CASE WHEN u.ratio = 1 THEN 1 ELSE 0 END as is_smallest,
          p.price,
          p.effective_date
        FROM barang_units u
        LEFT JOIN (
          SELECT 
            unit_id,
            price,
            effective_date,
            ROW_NUMBER() OVER (PARTITION BY unit_id ORDER BY effective_date DESC) as rn
          FROM barang_prices
          WHERE barang_id = ?
            AND (effective_date::text <= CURRENT_DATE)
        ) p ON u.id = p.unit_id AND p.rn = 1
        WHERE u.barang_id = ?
        ORDER BY u.ratio ASC
      `, [barangId, barangId]) as any[]
    } catch (err) {
      console.error('Error fetching units:', err)
      units = []
    }
    
    // Map units with prices
    let unitsWithPrices = units.map(u => ({
      unitId: u.unit_id,
      unitName: u.unit_name,
      ratio: u.ratio_to_smallest,
      isSmallest: Boolean(u.is_smallest),
      price: u.price || 0,
      effectiveDate: u.effective_date
    }))
    
    // Fallback: if no units, use barang's hpp as default
    if (unitsWithPrices.length === 0) {
      const barangWithPrice = await rawGet(`
        SELECT hpp FROM master_barang WHERE id = ?
      `, [barangId]) as any
      
      unitsWithPrices = [{
        unitId: 0,
        unitName: 'PCS',
        ratio: 1,
        isSmallest: true,
        price: barangWithPrice?.hpp || 0,
        effectiveDate: null
      }]
    }

    const smallestUnitName = unitsWithPrices[0]?.unitName || 'PCS'
    
    return NextResponse.json({
      barang: {
        id: barang.id,
        code: barang.code,
        name: barang.name,
        stockCurrent: 0,
        smallestUnit: smallestUnitName
      },
      units: unitsWithPrices
    })
  } catch (error) {
    console.error('Error fetching barang prices:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch barang prices' 
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const pool = (db as any).$client
    const barangId = parseInt(params.id)
    const body = await request.json()
    let { unitId, unitName, price, effectiveDate } = body || {}

    if (!barangId || isNaN(barangId)) {
      return NextResponse.json({ error: 'Invalid barang id' }, { status: 400 })
    }

    const nPrice = Number(price)
    if (!isFinite(nPrice) || nPrice < 0) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }

    const eff = (String(effectiveDate || '') || new Date().toISOString().slice(0, 10)).slice(0, 10)

    // Resolve target unit
    let unitRow: any = null
    if (unitId) {
      unitRow = await rawGet('SELECT id, name, ratio FROM barang_units WHERE id = ? AND barang_id = ?', [unitId, barangId])
    }
    if (!unitRow && unitName) {
      unitRow = await rawGet('SELECT id, name, ratio FROM barang_units WHERE barang_id = ? AND LOWER(name) = LOWER(?)', [barangId, String(unitName)])
    }
    if (!unitRow) {
      unitRow = await rawGet('SELECT id, name, ratio FROM barang_units WHERE barang_id = ? ORDER BY ratio ASC LIMIT 1', [barangId])
    }
    if (!unitRow) {
      return NextResponse.json({ error: 'Unit not found for barang' }, { status: 404 })
    }

    // Base unit (ratio=1)
    const baseUnit = await rawGet('SELECT id, name, ratio FROM barang_units WHERE barang_id = ? ORDER BY ratio ASC LIMIT 1', [barangId]) as any
    if (!baseUnit) {
      return NextResponse.json({ error: 'Base unit not found' }, { status: 404 })
    }

    await pool.query('BEGIN')
    try {
      // Insert price for provided unit
      await rawRun('INSERT INTO barang_prices (barang_id, unit_id, price, effective_date) VALUES (?, ?, ?, ?)',
        [barangId, unitRow.id, Math.round(nPrice * 100) / 100, eff])

      // Sync base unit price
      const ratio = Number(unitRow.ratio) || 1
      const basePrice = ratio > 0 ? nPrice / ratio : nPrice
      await rawRun('INSERT INTO barang_prices (barang_id, unit_id, price, effective_date) VALUES (?, ?, ?, ?)',
        [barangId, baseUnit.id, Math.round(basePrice * 100) / 100, eff])

      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({
      success: true,
      barangId,
      unit: { id: unitRow.id, name: unitRow.name, ratio: unitRow.ratio },
      baseUnit: { id: baseUnit.id, name: baseUnit.name, ratio: baseUnit.ratio },
      effectiveDate: eff,
      price: Math.round(nPrice * 100) / 100
    })
  } catch (error: any) {
    console.error('Error creating barang price:', error)
    return NextResponse.json({ error: 'Failed to create price', details: error.message }, { status: 500 })
  }
}
