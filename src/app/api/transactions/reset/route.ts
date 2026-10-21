import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

/**
 * POST /api/transactions/reset
 * Delete all transactions and reset auto-increment ID sequence
 */
export async function POST() {
  try {
    const db = getDb()
    const pool = (db as any).$client

    // Delete all transaction items first (foreign key)
    await rawRun('DELETE FROM transaction_items')
    
    // Delete all stock movements related to sales
    await rawRun("DELETE FROM stock_movements WHERE reference_type = 'sale'")
    
    // Delete all transactions
    await rawRun('DELETE FROM transactions')
    
    // Reset auto-increment sequence for transactions table
    await pool.query("ALTER SEQUENCE transactions_id_seq RESTART WITH 1")
    await pool.query("ALTER SEQUENCE transaction_items_id_seq RESTART WITH 1")
    
    return NextResponse.json({ 
      success: true, 
      message: 'All transactions deleted and ID sequence reset to 1' 
    })
  } catch (error: any) {
    console.error('Error resetting transactions:', error)
    return NextResponse.json(
      { error: 'Failed to reset transactions', details: error.message },
      { status: 500 }
    )
  }
}
