import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!hasPermission(request as any, 'harga', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat harga' }, { status: 403 })
    }
    const barangId = parseInt(params.id)
    
    const barang = await rawGet(`
      SELECT 
        b.id, b.code, b.name,
        k.name as kategori_name
      FROM master_barang b
      LEFT JOIN master_kategori k ON b.kategori_id = k.id
      WHERE b.id = ? AND COALESCE(b.isdelete, 0) = 0
    `, [barangId]) as any
    
    if (!barang) {
      return NextResponse.json({ error: 'Barang not found' }, { status: 404 })
    }
    
    const units = await rawAll(`
      SELECT id, name, ratio
      FROM barang_units
      WHERE barang_id = ?
      ORDER BY ratio ASC
    `, [barangId]) as any[]
    
    const basePrice = await rawGet(`
      SELECT price, effective_date
      FROM barang_prices
      WHERE barang_id = ?
      ORDER BY effective_date DESC
      LIMIT 1
    `, [barangId]) as any
    
    const basePriceValue = basePrice?.price || 0
    
    const prices = units.map(u => ({
      unitId: u.id,
      unitName: u.name,
      ratio: u.ratio,
      price: basePriceValue * u.ratio,
      isManual: false,
      effectiveDate: basePrice?.effective_date || null
    }))
    
    return NextResponse.json({
      barang: {
        id: barang.id,
        code: barang.code,
        name: barang.name,
        kategoriName: barang.kategori_name || '-'
      },
      prices
    })
  } catch (error) {
    console.error('Error fetching harga detail:', error)
    return NextResponse.json({ error: 'Failed to fetch harga detail' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!hasPermission(request as any, 'harga', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah harga' }, { status: 403 })
    }
    const db = getDb(); const pool = (db as any).$client
    const barangId = parseInt(params.id)
    const data = await request.json()
    
    const barang = await rawGet('SELECT id FROM master_barang WHERE id = ? AND isdelete = 0', [barangId])
    if (!barang) {
      return NextResponse.json({ error: 'Barang not found' }, { status: 404 })
    }
    
    const userId = getUserId(request)
    
    if (data.prices && data.prices.length > 0) {
      for (const priceData of data.prices) {
        await pool.query(`
          INSERT INTO barang_prices (barang_id, unit_id, price, effective_date, user_create)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
        `, [barangId, priceData.unitId, priceData.price, userId])
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating harga:', error)
    return NextResponse.json({ error: 'Failed to update harga' }, { status: 500 })
  }
}
