import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const canEdit = hasPermission(request as any, 'sales_gross_profit', 'edit') || hasPermission(request as any, 'sales_recap', 'edit')
    if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { year, month, barangId } = body
    if (!year || !month) return NextResponse.json({ error: 'year and month required' }, { status: 400 })

    const db = getDb()
    const pool = (db as any).$client
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`

    let barangRows: any[]
    if (barangId) {
      barangRows = await rawAll<any>('SELECT id, name, hpp FROM master_barang WHERE id = $1 AND COALESCE(isdelete,0)=0', [barangId])
    } else {
      barangRows = await rawAll<any>('SELECT id, name, hpp FROM master_barang WHERE COALESCE(isdelete,0)=0')
    }

    let count = 0
    await pool.query('BEGIN')
    try {
      for (const brg of barangRows) {
        const waHpp = await computeWeightedAvgHpp(brg.id, monthStart, monthEnd)
        if (waHpp !== null) {
          await pool.query(
            `INSERT INTO barang_monthly_hpp (barang_id, tahun, bulan, year, month, hpp, avg_cost)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (barang_id, year, month) DO UPDATE SET
               tahun = excluded.tahun, bulan = excluded.bulan,
               hpp = excluded.hpp, avg_cost = excluded.avg_cost,
               calculated_at = CURRENT_TIMESTAMP`,
            [brg.id, year, month, year, month, waHpp, waHpp]
          )
          count++
          continue
        }

        const recipeHpp = await computeRecipeHpp(brg.id, monthEnd)
        if (recipeHpp !== null) {
          await pool.query(
            `INSERT INTO barang_monthly_hpp (barang_id, tahun, bulan, year, month, hpp, avg_cost)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (barang_id, year, month) DO UPDATE SET
               tahun = excluded.tahun, bulan = excluded.bulan,
               hpp = excluded.hpp, avg_cost = excluded.avg_cost,
               calculated_at = CURRENT_TIMESTAMP`,
            [brg.id, year, month, year, month, recipeHpp, recipeHpp]
          )
          count++
          continue
        }

        await pool.query(
          `INSERT INTO barang_monthly_hpp (barang_id, tahun, bulan, year, month, hpp, avg_cost)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (barang_id, year, month) DO UPDATE SET
             tahun = excluded.tahun, bulan = excluded.bulan,
             hpp = excluded.hpp, avg_cost = excluded.avg_cost,
             calculated_at = CURRENT_TIMESTAMP`,
          [brg.id, year, month, year, month, brg.hpp || 0, brg.hpp || 0]
        )
        count++
      }
      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ success: true, count, year, month })
  } catch (e: any) {
    console.error('Error recalc-barang-hpp:', e)
    return NextResponse.json({ error: 'Failed', details: e?.message }, { status: 500 })
  }
}

async function computeRecipeHpp(barangId: number, endDate: string): Promise<number | null> {
  const recipes = await rawAll<any>('SELECT ingredient_id, quantity FROM barang_recipes WHERE barang_id = $1', [barangId])
  if (!recipes || recipes.length === 0) return null

  let total = 0
  for (const r of recipes) {
    const row = await rawGet<any>(
      `SELECT balance_avg_cost FROM stock_movements
       WHERE ingredient_id = $1 AND DATE(COALESCE(transaction_date::text, created_at::text)) <= DATE($2)
       ORDER BY COALESCE(transaction_date::text, created_at::text) DESC, id DESC
       LIMIT 1`,
      [r.ingredient_id, endDate]
    )
    const cost = row?.balance_avg_cost ?? null
    const fallback = await rawGet<any>('SELECT COALESCE(hpp,0) AS hpp FROM master_barang WHERE id = $1', [r.ingredient_id])
    const unitCost = cost ?? fallback?.hpp ?? 0
    total += unitCost * (r.quantity || 0)
  }
  return total
}

async function computeWeightedAvgHpp(barangId: number, monthStart: string, monthEnd: string): Promise<number | null> {
  const hasMov = await rawGet<any>('SELECT 1 FROM stock_movements WHERE ingredient_id = $1 LIMIT 1', [barangId])
  if (!hasMov) return null

  const opening = await rawGet<any>(
    `SELECT balance_qty, balance_cost FROM stock_movements
     WHERE ingredient_id = $1 AND DATE(COALESCE(transaction_date::text, created_at::text)) < DATE($2)
     ORDER BY COALESCE(transaction_date::text, created_at::text) DESC, id DESC
     LIMIT 1`,
    [barangId, monthStart]
  )
  const openingQty = opening ? Number(opening.balance_qty) || 0 : 0
  const openingCost = opening ? Number(opening.balance_cost) || 0 : 0

  const inAgg = await rawGet<any>(
    `SELECT COALESCE(SUM(ABS(quantity)), 0) AS total_qty,
            COALESCE(SUM(COALESCE(total_cost, 0)), 0) AS total_cost
     FROM stock_movements
     WHERE ingredient_id = $1
       AND DATE(COALESCE(transaction_date::text, created_at::text)) BETWEEN DATE($2) AND DATE($3)
       AND ((LOWER(movement_type) IN ('in','manufaktur_in') AND quantity > 0) OR (LOWER(movement_type) = 'adjustment' AND quantity > 0) OR (LOWER(movement_type) = 'out' AND quantity < 0))`,
    [barangId, monthStart, monthEnd]
  )
  const inQty = Number(inAgg?.total_qty) || 0
  const inCost = Number(inAgg?.total_cost) || 0

  const totalQtyAvail = openingQty + inQty
  const totalCostAvail = openingCost + inCost

  if (totalQtyAvail <= 0) return 0
  return totalCostAvail / totalQtyAvail
}
