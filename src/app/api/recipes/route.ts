import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'

/**
 * GET /api/recipes
 * Get all recipes (barang_recipes grouped by barang_id)
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    // Ensure schema has unit_id for recipes
    try {
      const cols = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='barang_recipes'`) as any[]
      const names = new Set(cols.map((c: any) => c.name))
      if (!names.has('unit_id')) {
        await rawRun(`ALTER TABLE barang_recipes ADD COLUMN unit_id INTEGER`)
      }
    } catch {}
    const { searchParams } = new URL(request.url)
    const barangIdParam = searchParams.get('barangId')
    
    // Get all recipes with barang info
    let baseQuery = `
      SELECT 
        br.barang_id,
        b.code as barang_code,
        b.name as barang_name,
        br.ingredient_id,
        ib.code as ingredient_code,
        ib.name as ingredient_name,
        ib.hpp as ingredient_hpp,
        br.quantity,
        COALESCE(bu.name, br.unit) as unit,
        br.unit_id,
        br.notes,
        br.created_at
      FROM barang_recipes br
      LEFT JOIN master_barang b ON br.barang_id = b.id
      LEFT JOIN master_barang ib ON br.ingredient_id = ib.id
      LEFT JOIN barang_units bu ON bu.id = br.unit_id
    `
    const params: any[] = []
    if (barangIdParam) {
      baseQuery += ' WHERE br.barang_id = ?'
      params.push(parseInt(barangIdParam))
    }
    baseQuery += ' ORDER BY br.barang_id, br.ingredient_id'

    const recipes = await rawAll(baseQuery, params)
    
    return NextResponse.json(recipes)
  } catch (error) {
    console.error('Error fetching recipes:', error)
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 })
  }
}

/**
 * POST /api/recipes
 * Create or update recipe for a barang
 * Body: { barangJadiId, items: [{ bahanBakuId, quantity, unitName, notes }] }
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const db = getDb()
    const pool = (db as any).$client
    
    const barangJadiId = data.barangJadiId
    const items = data.items || []
    
    // Validate
    if (!barangJadiId) {
      return NextResponse.json({ error: 'barangJadiId is required' }, { status: 400 })
    }
    
    if (items.length === 0) {
      return NextResponse.json({ error: 'At least one ingredient is required' }, { status: 400 })
    }
    
    // Check if barang exists and is jenis=1 (Barang Jadi)
    const barang = await rawGet('SELECT id, jenis FROM master_barang WHERE id = ?', [barangJadiId]) as any
    if (!barang) {
      return NextResponse.json({ error: 'Barang not found' }, { status: 404 })
    }
    if (barang.jenis !== 1 && barang.jenis !== 3) {
      return NextResponse.json({ error: 'Only Barang Jadi (jenis=1) or Barang Setengah Jadi (jenis=3) can have recipes' }, { status: 400 })
    }
    
    // Ensure schema has unit_id
    try {
      const cols = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='barang_recipes'`) as any[]
      const names = new Set(cols.map((c: any) => c.name))
      if (!names.has('unit_id')) {
        await rawRun(`ALTER TABLE barang_recipes ADD COLUMN unit_id INTEGER`)
      }
    } catch {}

    // Prevent duplicate: if recipe already exists for this barang_jadi, block creation
    const existCount = (await rawGet('SELECT COUNT(*) as c FROM barang_recipes WHERE barang_id = ?', [barangJadiId]) as any).c
    if (existCount > 0) {
      return NextResponse.json({ error: 'Resep untuk barang jadi ini sudah ada. Gunakan edit untuk mengubah.' }, { status: 409 })
    }
    
    // Insert new recipes
    const userId = getUserId(request)
    
    await pool.query('BEGIN')
    try {
      for (const item of items) {
        const bahanBakuId = item.bahanBakuId
        const quantity = parseFloat(item.quantity) || 0
        let unitId = Number(item.unitId || 0)
        let unitName = item.unitName || ''
        const notes = item.notes || ''
        
        if (bahanBakuId && quantity > 0) {
          // Verify bahan baku exists and is jenis=2
          const bahanBaku = await rawGet('SELECT id, jenis FROM master_barang WHERE id = ?', [bahanBakuId]) as any
          if (!bahanBaku) {
            console.warn(`Bahan baku ID ${bahanBakuId} not found, skipping`)
            continue
          }
          if (bahanBaku.jenis !== 2 && bahanBaku.jenis !== 3) {
            console.warn(`Barang ID ${bahanBakuId} is not Bahan Baku (jenis=${bahanBaku.jenis}), skipping`)
            continue
          }
          // Resolve unit id/name if necessary
          if (!unitId || unitId <= 0) {
            if (unitName) {
              const row = await rawGet(`SELECT id, name FROM barang_units WHERE barang_id = ? AND LOWER(name) = LOWER(?)`, [bahanBakuId, unitName]) as any
              if (row) { unitId = Number(row.id); unitName = row.name }
            }
            // fallback to minimum ratio unit
            if (!unitId || unitId <= 0) {
              const row = await rawGet(`SELECT id, name FROM barang_units WHERE barang_id = ? ORDER BY ratio ASC LIMIT 1`, [bahanBakuId]) as any
              if (row) { unitId = Number(row.id); unitName = row.name }
            }
            if (!unitId || unitId <= 0) unitName = unitName || 'unit'
          }

          // Store bahanBakuId (from master_barang) in ingredient_id column
          try {
            await rawRun(`INSERT INTO barang_recipes (barang_id, ingredient_id, quantity, unit, unit_id, notes, user_create, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
              [barangJadiId, bahanBakuId, quantity, unitName, unitId || null, notes, userId])
          } catch (err: any) {
            console.error(`Error inserting recipe item:`, err.message)
            // Continue with other items even if one fails
          }
        }
      }
      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }
    
    // Get created recipes
    const createdRecipes = await rawAll(`
      SELECT 
        br.barang_id,
        br.ingredient_id,
        br.quantity,
        br.unit,
        br.notes,
        b.code as ingredient_code,
        b.name as ingredient_name
      FROM barang_recipes br
      LEFT JOIN master_barang b ON br.ingredient_id = b.id
      WHERE br.barang_id = ?
    `, [barangJadiId])
    
    return NextResponse.json({
      success: true,
      barangJadiId,
      recipes: createdRecipes
    })
  } catch (error: any) {
    console.error('Error creating recipe:', error)
    return NextResponse.json(
      { error: 'Failed to create recipe', details: error.message },
      { status: 500 }
    )
  }
}
