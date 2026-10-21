import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST(_req: NextRequest) {
  try {
    const db = getDb()
    const pool = (db as any).$client

    try {
      const cols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'barang_recipes'"
      )
      const names = new Set(cols.map(c => c.column_name))
      if (!names.has('unit_id')) {
        await rawRun('ALTER TABLE barang_recipes ADD COLUMN unit_id INTEGER')
      }
    } catch {}

    const res1 = await rawRun(
      `UPDATE barang_recipes
       SET unit_id = (
         SELECT bu.id FROM barang_units bu
         WHERE bu.barang_id = barang_recipes.ingredient_id
           AND LOWER(bu.name) = LOWER(COALESCE(barang_recipes.unit, ''))
         LIMIT 1
       )
       WHERE COALESCE(unit_id, 0) = 0`
    )

    const res2 = await rawRun(
      `UPDATE barang_recipes
       SET unit_id = (
         SELECT bu.id FROM barang_units bu
         WHERE bu.barang_id = barang_recipes.ingredient_id
         ORDER BY bu.ratio ASC LIMIT 1
       )
       WHERE COALESCE(unit_id, 0) = 0`
    )

    const remaining = (await rawGet<any>("SELECT COUNT(*) as c FROM barang_recipes WHERE COALESCE(unit_id, 0) = 0"))?.c || 0

    return NextResponse.json({ ok: true, matchedByName: res1.rowCount || 0, filledByMinRatio: res2.rowCount || 0, remaining })
  } catch (e: any) {
    console.error('Backfill unit_id error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to backfill unit_id' }, { status: 500 })
  }
}
