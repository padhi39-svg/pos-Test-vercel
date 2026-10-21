import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ingredientId = searchParams.get('ingredient_id')

    if (ingredientId) {
      const movements = await rawAll<any>(
        `SELECT 
          sm.*,
          b.code as barang_code,
          b.name as barang_name
        FROM stock_movements sm
        JOIN master_barang b ON sm.ingredient_id = b.id
        WHERE sm.ingredient_id = $1
        ORDER BY sm.id DESC
        LIMIT 50`,
        [parseInt(ingredientId)]
      )

      return NextResponse.json({
        ingredient_id: ingredientId,
        count: movements.length,
        movements
      })
    } else {
      const movements = await rawAll<any>(
        `SELECT 
          sm.*,
          b.code as barang_code,
          b.name as barang_name
        FROM stock_movements sm
        JOIN master_barang b ON sm.ingredient_id = b.id
        ORDER BY sm.id DESC
        LIMIT 50`
      )

      return NextResponse.json({
        count: movements.length,
        movements
      })
    }
  } catch (error: any) {
    console.error('Error fetching stock movements:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
