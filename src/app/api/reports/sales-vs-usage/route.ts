import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'sales_vs_usage', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat laporan Penjualan vs Pemakaian' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const start = (searchParams.get('start') || '').slice(0,10)
    const end = (searchParams.get('end') || '').slice(0,10)
    const debug = (searchParams.get('debug') || '0') === '1'

    // Get transaction headers with items and barang names
    const headerDateCol = 't.transaction_date'

    const queryParams: any[] = []
    let queryWhere = ''
    if (start) {
      queryWhere += ` AND t.transaction_date >= $${queryParams.length + 1}`
      queryParams.push(start)
    }
    if (end) {
      queryWhere += ` AND t.transaction_date <= $${queryParams.length + 1}`
      queryParams.push(end)
    }

    const txRows = await rawAll<any>(`
      SELECT 
        t.id as transaction_id,
        t.transaction_number,
        ${headerDateCol} as tdate,
        ti.id as item_id,
        ti.barang_id,
        ti.barang_code,
        ti.barang_name,
        ti.quantity as item_qty
      FROM transactions t
      JOIN transaction_items ti ON ti.transaction_id = t.id
      WHERE COALESCE(t.void, 0) = 0
        ${queryWhere}
      ORDER BY t.id ASC, ti.id ASC
    `, queryParams)

    if (txRows.length === 0) {
      return NextResponse.json({ rows: [], info: { start, end, count: 0 } })
    }

    // Batch load all needed data upfront
    const barangIds = [...new Set(txRows.map(r => Number(r.barang_id)))]
    const ingredientIds: number[] = []

    // Load HPP for all barang
    const hppMap = new Map<number, number>()
    if (barangIds.length > 0) {
      const hppRows = await rawAll<any>(
        `SELECT id, COALESCE(hpp,0) as hpp FROM master_barang WHERE id = ANY($1::int[])`,
        [barangIds]
      )
      for (const r of hppRows) hppMap.set(Number(r.id), Number(r.hpp))
    }

    // Load base units for all barang
    const unitMap = new Map<number, string>()
    if (barangIds.length > 0) {
      const unitRows = await rawAll<any>(
        `SELECT DISTINCT ON (barang_id) barang_id, name FROM barang_units WHERE barang_id = ANY($1::int[]) ORDER BY barang_id, ratio ASC, id ASC`,
        [barangIds]
      )
      for (const r of unitRows) unitMap.set(Number(r.barang_id), r.name)
    }

    // Load recipes for all barang
    const recipeMap = new Map<number, Array<{ ingredient_id: number; qty: number; unit_ratio: number }>>()
    if (barangIds.length > 0) {
      const recipeRows = await rawAll<any>(
        `SELECT barang_jadi as barang_id, ingredient_id, COALESCE(qty,0) as qty, COALESCE(unit_ratio,1) as unit_ratio FROM barang_recipes WHERE barang_jadi = ANY($1::int[]) ORDER BY id ASC`,
        [barangIds]
      )
      for (const r of recipeRows) {
        const list = recipeMap.get(Number(r.barang_id)) || []
        list.push({ ingredient_id: Number(r.ingredient_id), qty: Number(r.qty), unit_ratio: Number(r.unit_ratio) })
        recipeMap.set(Number(r.barang_id), list)
        ingredientIds.push(Number(r.ingredient_id))
      }
    }

    // Load ingredient names
    const ingNameMap = new Map<number, string>()
    if (ingredientIds.length > 0) {
      const ingRows = await rawAll<any>(
        `SELECT id, name FROM master_barang WHERE id = ANY($1::int[])`,
        [[...new Set(ingredientIds)]]
      )
      for (const r of ingRows) ingNameMap.set(Number(r.id), r.name)
    }

    // Load ingredient base units
    if (ingredientIds.length > 0) {
      const ingUnitRows = await rawAll<any>(
        `SELECT DISTINCT ON (barang_id) barang_id, name FROM barang_units WHERE barang_id = ANY($1::int[]) ORDER BY barang_id, ratio ASC, id ASC`,
        [[...new Set(ingredientIds)]]
      )
      for (const r of ingUnitRows) {
        if (!unitMap.has(Number(r.barang_id))) unitMap.set(Number(r.barang_id), r.name)
      }
    }

    // Load HPP for ingredients
    if (ingredientIds.length > 0) {
      const ingHppRows = await rawAll<any>(
        `SELECT id, COALESCE(hpp,0) as hpp FROM master_barang WHERE id = ANY($1::int[])`,
        [[...new Set(ingredientIds)]]
      )
      for (const r of ingHppRows) {
        if (!hppMap.has(Number(r.id))) hppMap.set(Number(r.id), Number(r.hpp))
      }
    }

    const rows: any[] = []

    for (const r of txRows) {
      const hppBarangJadi = hppMap.get(Number(r.barang_id)) || 0
      const barangBaseUnit = unitMap.get(Number(r.barang_id)) || 'unit'
      const recs = recipeMap.get(Number(r.barang_id)) || []

      if (recs.length === 0) {
        rows.push({
          transaction_number: r.transaction_number,
          tdate: r.tdate,
          barang: r.barang_name,
          barang_id: r.barang_id,
          qty: Number(r.item_qty || 0),
          hpp_barang_jadi: hppBarangJadi,
          bahan_baku: null,
          bahan_qty: null,
          bahan_unit: null,
          hpp_bahan_baku: 0
        })
        continue
      }

      for (const rec of recs) {
        const ingredientQtyBase = rec.qty * rec.unit_ratio * Number(r.item_qty || 0)
        const ingName = ingNameMap.get(rec.ingredient_id) || `#${rec.ingredient_id}`
        const ingBaseUnit = unitMap.get(rec.ingredient_id) || '-'
        const ingHpp = hppMap.get(rec.ingredient_id) || 0
        const hppBahanTotal = ingHpp * ingredientQtyBase

        rows.push({
          transaction_number: r.transaction_number,
          tdate: r.tdate,
          barang: r.barang_name,
          barang_id: r.barang_id,
          qty: Number(r.item_qty || 0),
          hpp_barang_jadi: hppBarangJadi,
          bahan_baku: ingName,
          bahan_qty: ingredientQtyBase,
          bahan_unit: ingBaseUnit,
          hpp_bahan_baku: hppBahanTotal
        })
      }
    }

    if (debug) {
      return NextResponse.json({ rowsCount: rows.length, start, end, sample: rows.slice(0,5) })
    }
    return NextResponse.json({ rows })
  } catch (e: any) {
    console.error('[reports/sales-vs-usage] error', e)
    return NextResponse.json({ error: e?.message || 'Failed to build report' }, { status: 500 })
  }
}
