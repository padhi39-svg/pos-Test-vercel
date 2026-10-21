import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

// POST /api/stock-simple - Simple stock reconciliation that works
export async function POST() {
  try {
    const pool = (getDb() as any).$client
    
    console.log('🔧 Starting simple stock reconciliation...')
    
    // Create simple stock table
    await rawRun(`
      DROP TABLE IF EXISTS stock_balance;
      CREATE TABLE stock_balance (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER,
        warehouse_id INTEGER DEFAULT 1,
        quantity REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ingredient_id, warehouse_id)
      );
    `)
    
    // Get purchases and add to stock
    const purchases = await rawAll<any>(`
      SELECT pi.barang_id, SUM(pi.quantity) as total_qty
      FROM purchases p
      JOIN purchase_items pi ON p.id = pi.purchase_id
      WHERE p.status = 'active'
      GROUP BY pi.barang_id
    `)
    
    console.log(`Processing ${purchases.length} purchase groups`)
    
    // Add purchase stock
    for (const purchase of purchases) {
      await rawRun(`
        INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, updated_at)
        VALUES ($1, 1, $2, NOW())
        ON CONFLICT (ingredient_id, warehouse_id) DO UPDATE SET quantity = $2, updated_at = NOW()
      `, [purchase.barang_id, purchase.total_qty])
    }
    
    // Get sales and subtract from stock
    const sales = await rawAll<any>(`
      SELECT ti.barang_id, SUM(ti.quantity) as total_qty
      FROM transactions t
      JOIN transaction_items ti ON t.id = ti.transaction_id
      WHERE t.status = 'completed'
      GROUP BY ti.barang_id
    `)
    
    console.log(`Processing ${sales.length} sale groups`)
    
    // Subtract sale stock
    for (const sale of sales) {
      const existing = await rawGet<any>(`
        SELECT quantity FROM stock_balance 
        WHERE ingredient_id = $1 AND warehouse_id = 1
      `, [sale.barang_id])
      
      const currentQty = existing?.quantity || 0
      const newQty = currentQty - sale.total_qty
      
      await rawRun(`
        INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, updated_at)
        VALUES ($1, 1, $2, NOW())
        ON CONFLICT (ingredient_id, warehouse_id) DO UPDATE SET quantity = $2, updated_at = NOW()
      `, [sale.barang_id, newQty])
    }
    
    // Get final results
    const finalStock = await rawAll<any>(`
      SELECT 
        b.code, b.name, b.jenis,
        COALESCE(sb.quantity, 0) as current_stock
      FROM master_barang b
      LEFT JOIN stock_balance sb ON b.id = sb.ingredient_id AND sb.warehouse_id = 1
      WHERE b.isdelete = 0 AND COALESCE(sb.quantity, 0) != 0
      ORDER BY ABS(COALESCE(sb.quantity, 0)) DESC
      LIMIT 10
    `)
    
    console.log('✅ Simple stock reconciliation completed!')
    
    return NextResponse.json({
      success: true,
      message: 'Stock berhasil diperbaiki dengan metode sederhana',
      summary: {
        purchaseGroups: purchases.length,
        saleGroups: sales.length,
        itemsWithStock: finalStock.length
      },
      stockSample: finalStock
    })
    
  } catch (error: any) {
    console.error('❌ Simple stock fix failed:', error)
    return NextResponse.json({ 
      error: 'Simple stock fix failed', 
      details: error.message 
    }, { status: 500 })
  }
}

// GET /api/stock-simple - Check current stock status
export async function GET() {
  try {
    const rows = await rawAll<any>(`
      SELECT 
        b.code, b.name, b.jenis,
        COALESCE(sb.quantity, 0) as current_stock
      FROM master_barang b
      LEFT JOIN stock_balance sb ON b.id = sb.ingredient_id AND sb.warehouse_id = 1
      WHERE b.isdelete = 0
      ORDER BY b.name
      LIMIT 20
    `)
    
    return NextResponse.json({
      success: true,
      totalItems: rows.length,
      stockItems: rows
    })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
