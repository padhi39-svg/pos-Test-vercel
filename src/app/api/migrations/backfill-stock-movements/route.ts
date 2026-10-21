import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'

export async function POST() {
  try {
    const items = await rawAll<any>(
      `SELECT 
        ti.transaction_id,
        ti.barang_id,
        ti.barang_code,
        ti.quantity
      FROM transaction_items ti
      ORDER BY ti.transaction_id`
    )

    let processed = 0
    let skipped = 0
    let inserted = 0

    for (const item of items) {
      processed++

      const existing = await rawGet<any>(
        'SELECT COUNT(*) as count FROM stock_movements WHERE reference_type = $1 AND reference_id = $2',
        ['sale', item.transaction_id]
      )
      if (existing && existing.count > 0) {
        skipped++
        continue
      }

      const recipes = await rawAll<any>(
        'SELECT ingredient_id, quantity, unit FROM barang_recipes WHERE barang_id = $1',
        [item.barang_id]
      )

      if (recipes.length === 0) continue

      const qtySold = Number(item.quantity) || 1
      for (const r of recipes) {
        const perUnit = Number(r.quantity) || 0
        const used = perUnit * qtySold
        if (used > 0) {
          await rawRun(
            `INSERT INTO stock_movements (
              ingredient_id, movement_type, quantity, unit, reference_type, reference_id, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [r.ingredient_id, 'out', used, r.unit || 'unit', 'sale', item.transaction_id,
             `Backfill: ${item.barang_code} x${qtySold}`]
          )
          inserted++
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      skipped,
      inserted,
      message: `Backfill completed: ${inserted} movements inserted from ${processed} transaction items (${skipped} skipped)`
    })
  } catch (error: any) {
    console.error('Backfill error:', error)
    return NextResponse.json(
      { error: 'Backfill failed', details: error.message },
      { status: 500 }
    )
  }
}
