import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST() {
  try {
    const db = getDb()
    const pool = (db as any).$client

    const ingredients = await rawAll<any>('SELECT id, code, name, satuan FROM master_ingredient WHERE isdelete = 0')

    const results = []

    for (const ing of ingredients) {
      let baseUnit = 'unit'
      const satuan = (ing.satuan || '').toLowerCase()

      if (satuan.includes('kg') || satuan.includes('gram') || satuan.includes('gr')) {
        baseUnit = 'gram'
      } else if (satuan.includes('liter') || satuan.includes('ml')) {
        baseUnit = 'ml'
      } else if (satuan.includes('pcs') || satuan.includes('buah') || satuan.includes('biji')) {
        baseUnit = 'pcs'
      }

      await rawRun('UPDATE master_ingredient SET base_unit = $1 WHERE id = $2', [baseUnit, ing.id])

      const existingUnits = await rawGet<any>('SELECT COUNT(*) as count FROM ingredient_units WHERE ingredient_id = $1', [ing.id])

      if (existingUnits?.count === 0) {
        if (baseUnit === 'gram') {
          await pool.query('INSERT INTO ingredient_units (ingredient_id, name, ratio) VALUES ($1, $2, $3)', [ing.id, 'gram', 1])
          await pool.query('INSERT INTO ingredient_units (ingredient_id, name, ratio) VALUES ($1, $2, $3)', [ing.id, 'kg', 1000])
          await pool.query('INSERT INTO ingredient_units (ingredient_id, name, ratio) VALUES ($1, $2, $3)', [ing.id, 'ons', 100])
        } else if (baseUnit === 'ml') {
          await pool.query('INSERT INTO ingredient_units (ingredient_id, name, ratio) VALUES ($1, $2, $3)', [ing.id, 'ml', 1])
          await pool.query('INSERT INTO ingredient_units (ingredient_id, name, ratio) VALUES ($1, $2, $3)', [ing.id, 'liter', 1000])
        } else if (baseUnit === 'pcs') {
          await pool.query('INSERT INTO ingredient_units (ingredient_id, name, ratio) VALUES ($1, $2, $3)', [ing.id, 'pcs', 1])
          await pool.query('INSERT INTO ingredient_units (ingredient_id, name, ratio) VALUES ($1, $2, $3)', [ing.id, 'lusin', 12])
          await pool.query('INSERT INTO ingredient_units (ingredient_id, name, ratio) VALUES ($1, $2, $3)', [ing.id, 'kodi', 20])
        } else {
          await pool.query('INSERT INTO ingredient_units (ingredient_id, name, ratio) VALUES ($1, $2, $3)', [ing.id, 'unit', 1])
        }
      }

      results.push({
        id: ing.id,
        code: ing.code,
        name: ing.name,
        base_unit: baseUnit,
        units_created: existingUnits?.count === 0
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Units setup completed',
      results
    })
  } catch (error: any) {
    console.error('Error setting up units:', error)
    return NextResponse.json(
      { error: 'Failed to setup units', details: error.message },
      { status: 500 }
    )
  }
}
