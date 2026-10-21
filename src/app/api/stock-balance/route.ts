import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

// GET /api/stock-balance
// Returns all items with their current stock balance aggregated from stock_balance table
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    // dukung kedua format penamaan param
    const warehouseId = searchParams.get('warehouseId') || searchParams.get('warehouse_id')
    const kategoriId = searchParams.get('kategoriId') || searchParams.get('kategori_id')
    const merkId = searchParams.get('merkId') || searchParams.get('merk_id')
    const includeZero = (searchParams.get('includeZero') || '0') === '1'
    const debug = (searchParams.get('debug') || '0') === '1'
    
    // Ambil daftar barang berdasarkan saldo di stock_balance per gudang
    // Catatan: jangan filter b.aktif agar barang dengan saldo namun tidak aktif tetap muncul
    let query = `
      WITH unit_min AS (
        SELECT barang_id, MIN(ratio) AS min_ratio
        FROM barang_units
        GROUP BY barang_id
      )
      SELECT 
        b.id,
        b.code,
        b.name,
        b.hpp,
        (
          SELECT CASE WHEN EXISTS (
            SELECT 1 FROM barang_recipes r WHERE r.ingredient_id = b.id LIMIT 1
          ) THEN 2 ELSE 1 END
        ) AS jenis,
        COALESCE(bu.name, 'unit') as base_unit,
        COALESCE(sb.quantity, 0) as current_stock,
        COALESCE(sb.avg_cost, b.hpp, 0) as avg_cost,
        g.code as warehouse_code,
        g.name as warehouse_name
      FROM master_barang b
      LEFT JOIN stock_balance sb ON sb.ingredient_id = b.id AND sb.warehouse_id = $1
      LEFT JOIN unit_min um ON um.barang_id = b.id
      LEFT JOIN barang_units bu ON bu.barang_id = b.id AND bu.ratio = um.min_ratio
      LEFT JOIN master_kategori k ON k.id = b.kategori_id
      LEFT JOIN master_merk mm ON mm.id = b.merk_id
      LEFT JOIN master_gudang g ON g.id = $2
      WHERE b.isdelete = 0
    `
    
    const params: any[] = []
    
    const wh = warehouseId ? Number(warehouseId) : 1
    // two bindings: one for LEFT JOIN sb, one for LEFT JOIN g
    params.push(wh, wh)

    // Filter kategori/merk jika disediakan
    if (kategoriId) {
      query += ` AND COALESCE(b.kategori_id, 0) = $${params.length + 1}`
      params.push(Number(kategoriId))
    }
    if (merkId) {
      query += ` AND COALESCE(b.merk_id, 0) = $${params.length + 1}`
      params.push(Number(merkId))
    }

    // Tampilkan zero stock hanya jika diminta
    if (!includeZero) {
      query += ` AND COALESCE(sb.quantity, 0) != 0`
    }
    
    query += ` ORDER BY b.code ASC`
    
    const rows = await rawAll<any>(query, params)

    // Format response with units array for compatibility
    const result = rows.map(row => ({
      id: row.id,
      code: row.code,
      name: row.name,
      jenis: row.jenis,
      current_stock: row.current_stock || 0,
      base_unit: row.base_unit || 'unit',
      hpp: row.hpp || 0,
      avg_cost: row.avg_cost || 0,
      warehouse_code: row.warehouse_code,
      warehouse_name: row.warehouse_name
    }))
    
    if (debug) {
      return NextResponse.json({ sql: query, params, rowsCount: result.length, sample: result.slice(0, 5) })
    }
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching stock balance:', error)
    return NextResponse.json({ error: 'Failed to fetch stock balance', details: error.message }, { status: 500 })
  }
}
