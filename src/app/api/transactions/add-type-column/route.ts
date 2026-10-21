import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

/**
 * POST /api/transactions/add-type-column
 * Add transaction_type column to transactions table
 * 1 = POS Resto, 2 = POS Retail
 */
export async function POST() {
  try {
    const db = getDb()

    // Try to add column (will fail if already exists)
    try {
      await rawRun('ALTER TABLE transactions ADD COLUMN transaction_type INTEGER DEFAULT 1')
      console.log('✅ Column transaction_type added')
    } catch (e: any) {
      if (e.message.includes('duplicate') || e.message.includes('already exists')) {
        console.log('⚠️ Column already exists')
      } else {
        throw e
      }
    }

    // Set default value for existing records
    await rawRun('UPDATE transactions SET transaction_type = 1 WHERE transaction_type IS NULL')

    return NextResponse.json({ 
      success: true, 
      message: 'Column transaction_type added successfully. 1=POS Resto, 2=POS Retail' 
    })
  } catch (error: any) {
    console.error('Error adding column:', error)
    return NextResponse.json(
      { error: 'Failed to add column', details: error.message },
      { status: 500 }
    )
  }
}
