import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const db = getDb()
    const pool = (db as any).$client

    console.log('🔧 Starting simple stock fix...')

    try {
      await rawRun(`
        CREATE TABLE IF NOT EXISTS stock_movements (
          id SERIAL PRIMARY KEY,
          ingredient_id INTEGER,
          warehouse_id INTEGER DEFAULT 1,
          movement_type TEXT,
          quantity REAL DEFAULT 0,
          reference_type TEXT,
          reference_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `)
      await rawRun(`
        CREATE TABLE IF NOT EXISTS stock_balance (
          id SERIAL PRIMARY KEY,
          ingredient_id INTEGER,
          warehouse_id INTEGER DEFAULT 1,
          quantity REAL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(ingredient_id, warehouse_id)
        );
      `)
    } catch (e) {
      console.log('Tables already exist, continuing...')
    }

    try {
      await rawRun('DELETE FROM stock_movements')
      await rawRun('DELETE FROM stock_balance')
    } catch (e) {
      console.log('Clearing stock data...')
    }

    const purchases = await rawAll<any>(
      `SELECT 
        p.id as purchase_id,
        pi.barang_id,
        pi.quantity
      FROM purchases p
      JOIN purchase_items pi ON p.id = pi.purchase_id
      WHERE p.status = 'active'
      ORDER BY p.id ASC`
    )

    console.log(`Found ${purchases.length} purchase items`)

    for (const purchase of purchases) {
      await pool.query(
        `INSERT INTO stock_movements (
          ingredient_id, warehouse_id, movement_type, quantity,
          reference_type, reference_id, created_at
        ) VALUES ($1, 1, 'IN', $2, 'purchase', $3, NOW())`,
        [purchase.barang_id, purchase.quantity, purchase.purchase_id]
      )

      const existing = await rawGet<any>(
        'SELECT quantity FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = 1',
        [purchase.barang_id]
      )

      if (existing) {
        await rawRun(
          'UPDATE stock_balance SET quantity = quantity + $1, updated_at = NOW() WHERE ingredient_id = $2 AND warehouse_id = 1',
          [purchase.quantity, purchase.barang_id]
        )
      } else {
        await rawRun(
          'INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, created_at, updated_at) VALUES ($1, 1, $2, NOW(), NOW())',
          [purchase.barang_id, purchase.quantity]
        )
      }
    }

    const sales = await rawAll<any>(
      `SELECT 
        t.id as transaction_id,
        ti.barang_id,
        ti.quantity
      FROM transactions t
      JOIN transaction_items ti ON t.id = ti.transaction_id
      WHERE t.status = 'completed'
      ORDER BY t.id ASC`
    )

    console.log(`Found ${sales.length} sale items`)

    for (const sale of sales) {
      await pool.query(
        `INSERT INTO stock_movements (
          ingredient_id, warehouse_id, movement_type, quantity,
          reference_type, reference_id, created_at
        ) VALUES ($1, 1, 'OUT', $2, 'sale', $3, NOW())`,
        [sale.barang_id, sale.quantity, sale.transaction_id]
      )

      const existing = await rawGet<any>(
        'SELECT quantity FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = 1',
        [sale.barang_id]
      )

      if (existing) {
        await rawRun(
          'UPDATE stock_balance SET quantity = quantity - $1, updated_at = NOW() WHERE ingredient_id = $2 AND warehouse_id = 1',
          [sale.quantity, sale.barang_id]
        )
      } else {
        await rawRun(
          'INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, created_at, updated_at) VALUES ($1, 1, $2, NOW(), NOW())',
          [sale.barang_id, -sale.quantity]
        )
      }
    }

    const finalStock = await rawAll<any>(
      `SELECT 
        b.code, b.name, b.jenis,
        COALESCE(sb.quantity, 0) as current_stock
      FROM master_barang b
      LEFT JOIN stock_balance sb ON b.id = sb.ingredient_id AND sb.warehouse_id = 1
      WHERE b.isdelete = 0 AND COALESCE(sb.quantity, 0) != 0
      ORDER BY ABS(COALESCE(sb.quantity, 0)) DESC
      LIMIT 20`
    )

    console.log('✅ Stock fix completed!')

    return NextResponse.json({
      success: true,
      message: 'Stock berhasil diperbaiki',
      summary: {
        purchaseItems: purchases.length,
        saleItems: sales.length,
        itemsWithStock: finalStock.length
      },
      stockSample: finalStock
    })

  } catch (error: any) {
    console.error('❌ Stock fix failed:', error)
    return NextResponse.json({ 
      error: 'Stock fix failed', 
      details: error.message 
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const purchaseCount = await rawGet<any>('SELECT COUNT(*) as count FROM purchases WHERE status = $1', ['active'])
    const saleCount = await rawGet<any>("SELECT COUNT(*) as count FROM transactions WHERE status = 'completed'")
    const movementCount = await rawGet<any>('SELECT COUNT(*) as count FROM stock_movements')
    const balanceCount = await rawGet<any>("SELECT COUNT(*) as count FROM stock_balance WHERE quantity != 0")

    return NextResponse.json({
      purchases: purchaseCount?.count || 0,
      sales: saleCount?.count || 0,
      movements: movementCount?.count || 0,
      balances: balanceCount?.count || 0,
      needsFix: (movementCount?.count || 0) === 0 && ((purchaseCount?.count || 0) > 0 || (saleCount?.count || 0) > 0)
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
