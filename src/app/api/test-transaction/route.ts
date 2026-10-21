import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const pool = (db as any).$client
    
    // Simple test insert
    const r = await pool.query(`
      INSERT INTO transactions (
        transaction_number, customer_id, subtotal, total, payment_method, payment_amount, status,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `, ['TEST/2025/00001', 1, 10000, 11000, 'cash', 11000, 'completed'])
    
    return NextResponse.json({ 
      success: true, 
      transactionId: r.rows[0].id,
      message: 'Test transaction created successfully' 
    })
  } catch (error: any) {
    console.error('Test transaction error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
