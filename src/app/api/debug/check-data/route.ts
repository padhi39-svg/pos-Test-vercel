import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const barangName = searchParams.get('barang') || 'gurame'

    const barangJadi = await rawAll<any>(
      `SELECT id, code, name, jenis 
       FROM master_barang 
       WHERE LOWER(name) LIKE $1 AND jenis = 1
       LIMIT 5`,
      [`%${barangName.toLowerCase()}%`]
    )

    const bahanBaku = await rawAll<any>(
      `SELECT id, code, name, jenis, hpp
       FROM master_barang 
       WHERE jenis = 2
       LIMIT 10`
    )

    let recipes: any[] = []
    if (barangJadi.length > 0) {
      const firstId = (barangJadi[0] as any).id
      recipes = await rawAll<any>(
        `SELECT 
          br.barang_id,
          br.ingredient_id,
          br.quantity,
          br.unit,
          b.name as barang_name,
          ib.name as ingredient_name,
          ib.jenis as ingredient_jenis
        FROM barang_recipes br
        LEFT JOIN master_barang b ON br.barang_id = b.id
        LEFT JOIN master_barang ib ON br.ingredient_id = ib.id
        WHERE br.barang_id = $1`,
        [firstId]
      )
    }

    const movements = await rawAll<any>(
      `SELECT 
        sm.id,
        sm.ingredient_id,
        sm.movement_type,
        sm.quantity,
        sm.unit,
        sm.reference_type,
        sm.reference_id,
        sm.notes,
        sm.created_at,
        ib.name as ingredient_name,
        ib.jenis as ingredient_jenis
      FROM stock_movements sm
      LEFT JOIN master_barang ib ON sm.ingredient_id = ib.id
      ORDER BY sm.created_at DESC
      LIMIT 20`
    )

    const transactions = await rawAll<any>(
      `SELECT 
        t.id,
        t.transaction_number,
        t.total,
        t.created_at,
        ti.barang_id,
        ti.barang_name,
        ti.quantity
      FROM transactions t
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      ORDER BY t.created_at DESC
      LIMIT 10`
    )

    return NextResponse.json({
      barang_jadi: barangJadi,
      bahan_baku: bahanBaku,
      recipes_for_first_barang: recipes,
      recent_stock_movements: movements,
      recent_transactions: transactions,
      note: 'Cek apakah barang_jadi ada, recipes tersimpan, dan movements tercatat saat transaksi'
    })
  } catch (error: any) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
