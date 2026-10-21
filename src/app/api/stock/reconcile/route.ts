import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

// POST /api/stock/reconcile
// Backfill stock movements from existing purchases and sales
export async function POST() {
  try {
    const db = getDb()
    
    console.log('🔄 Starting stock reconciliation...')
    
    // Start transaction
    const pool = (db as any).$client
    await pool.query('BEGIN')
    
    try {
      // 1. Clear existing stock movements and balances
      console.log('📝 Clearing existing stock data...')
      await rawRun('DELETE FROM stock_movements')
      await rawRun('DELETE FROM stock_balance')
      
      // 2. Backfill from purchases
      console.log('📦 Processing purchases...')
      const purchases = await rawAll<any>(`
        SELECT p.id, p.purchase_date, pi.barang_id, pi.quantity
        FROM purchases p
        JOIN purchase_items pi ON p.id = pi.purchase_id
        WHERE COALESCE(p.void, 0) = 0
        ORDER BY p.purchase_date ASC
      `)
      
      let purchaseCount = 0
      for (const purchase of purchases) {
        // Insert stock movement for purchase (IN)
        await rawRun(`
          INSERT INTO stock_movements (
            ingredient_id, warehouse_id, movement_type, quantity, 
            reference_type, reference_id, movement_date, created_at
          ) VALUES (?, 1, 'IN', ?, 'purchase', ?, ?, NOW())
        `, [
          purchase.barang_id,
          purchase.quantity,
          purchase.id,
          purchase.purchase_date
        ])
        
        // Update stock balance
        const existingBalance = await rawGet<any>(`
          SELECT quantity FROM stock_balance 
          WHERE ingredient_id = ? AND warehouse_id = 1
        `, [purchase.barang_id])
        
        if (existingBalance) {
          await rawRun(`
            UPDATE stock_balance 
            SET quantity = quantity + ?, updated_at = NOW()
            WHERE ingredient_id = ? AND warehouse_id = 1
          `, [purchase.quantity, purchase.barang_id])
        } else {
          await rawRun(`
            INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, created_at, updated_at)
            VALUES (?, 1, ?, NOW(), NOW())
          `, [purchase.barang_id, purchase.quantity])
        }
        
        purchaseCount++
      }
      
      // 3. Backfill from sales transactions
      console.log('🛒 Processing sales...')
      const sales = await rawAll<any>(`
        SELECT t.id, t.created_at, ti.barang_id, ti.quantity
        FROM transactions t
        JOIN transaction_items ti ON t.id = ti.transaction_id
        WHERE COALESCE(t.void, 0) = 0
        ORDER BY t.created_at ASC
      `)
      
      let salesCount = 0
      for (const sale of sales) {
        // Insert stock movement for sale (OUT)
        await rawRun(`
          INSERT INTO stock_movements (
            ingredient_id, warehouse_id, movement_type, quantity, 
            reference_type, reference_id, movement_date, created_at
          ) VALUES (?, 1, 'OUT', ?, 'sale', ?, ?, NOW())
        `, [
          sale.barang_id,
          sale.quantity,
          sale.id,
          sale.created_at
        ])
        
        // Update stock balance (subtract)
        const existingBalance = await rawGet<any>(`
          SELECT quantity FROM stock_balance 
          WHERE ingredient_id = ? AND warehouse_id = 1
        `, [sale.barang_id])
        
        if (existingBalance) {
          await rawRun(`
            UPDATE stock_balance 
            SET quantity = quantity - ?, updated_at = NOW()
            WHERE ingredient_id = ? AND warehouse_id = 1
          `, [sale.quantity, sale.barang_id])
        } else {
          // Create negative balance if item was sold before purchased
          await rawRun(`
            INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, created_at, updated_at)
            VALUES (?, 1, ?, NOW(), NOW())
          `, [sale.barang_id, -sale.quantity])
        }
        
        salesCount++
      }
      
      // 4. Get final stock summary
      const stockSummary = await rawAll<any>(`
        SELECT 
          b.code, b.name,
          COALESCE(sb.quantity, 0) as current_stock
        FROM master_barang b
        LEFT JOIN stock_balance sb ON b.id = sb.ingredient_id AND sb.warehouse_id = 1
        WHERE b.isdelete = 0
        ORDER BY b.name
      `)
      
      // Commit transaction
      await pool.query('COMMIT')
      
      console.log('✅ Stock reconciliation completed!')
      console.log(`📦 Processed ${purchaseCount} purchase items`)
      console.log(`🛒 Processed ${salesCount} sale items`)
      
      return NextResponse.json({
        success: true,
        message: 'Stock reconciliation completed successfully',
        summary: {
          purchaseItems: purchaseCount,
          saleItems: salesCount,
          totalItems: stockSummary.length
        },
        stockSummary: stockSummary.slice(0, 10)
      })
      
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK')
      throw error
    }
    
  } catch (error: any) {
    console.error('❌ Stock reconciliation failed:', error)
    return NextResponse.json({ 
      error: 'Stock reconciliation failed', 
      details: error.message 
    }, { status: 500 })
  }
}

// GET /api/stock/reconcile
// Get reconciliation status and summary
export async function GET() {
  try {
    const db = getDb()
    
    // Get counts
    const purchaseCount = await rawGet<{count: number}>('SELECT COUNT(*) as count FROM purchases WHERE COALESCE(void, 0) = 0')
    const saleCount = await rawGet<{count: number}>('SELECT COUNT(*) as count FROM transactions WHERE COALESCE(void, 0) = 0')
    const movementCount = await rawGet<{count: number}>('SELECT COUNT(*) as count FROM stock_movements')
    const balanceCount = await rawGet<{count: number}>('SELECT COUNT(*) as count FROM stock_balance WHERE quantity != 0')
    
    // Get sample stock balances
    const stockSample = await rawAll<any>(`
      SELECT 
        b.code, b.name, b.jenis,
        COALESCE(sb.quantity, 0) as current_stock
      FROM master_barang b
      LEFT JOIN stock_balance sb ON b.id = sb.ingredient_id AND sb.warehouse_id = 1
      WHERE b.isdelete = 0
      ORDER BY ABS(COALESCE(sb.quantity, 0)) DESC
      LIMIT 10
    `)
    
    return NextResponse.json({
      status: {
        totalPurchases: purchaseCount?.count ?? 0,
        totalSales: saleCount?.count ?? 0,
        totalMovements: movementCount?.count ?? 0,
        itemsWithStock: balanceCount?.count ?? 0
      },
      needsReconciliation: (movementCount?.count ?? 0) === 0 && ((purchaseCount?.count ?? 0) > 0 || (saleCount?.count ?? 0) > 0),
      stockSample
    })
    
  } catch (error: any) {
    console.error('Error getting reconciliation status:', error)
    return NextResponse.json({ 
      error: 'Failed to get reconciliation status', 
      details: error.message 
    }, { status: 500 })
  }
}
