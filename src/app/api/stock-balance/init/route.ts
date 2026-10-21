import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

/**
 * POST /api/stock-balance/init
 * Create stock_balance table
 */
export async function POST() {
  try {
    const db = getDb()

    // Create stock_balance table
    await rawRun(`
      CREATE TABLE IF NOT EXISTS stock_balance (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER NOT NULL,
        warehouse_id INTEGER NOT NULL,
        quantity REAL NOT NULL DEFAULT 0,
        unit TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ingredient_id) REFERENCES master_barang(id),
        FOREIGN KEY (warehouse_id) REFERENCES master_gudang(id),
        UNIQUE(ingredient_id, warehouse_id)
      )
    `)

    console.log('✅ Table stock_balance created')

    return NextResponse.json({ 
      success: true, 
      message: 'Table stock_balance created successfully' 
    })
  } catch (error: any) {
    console.error('Error creating stock_balance table:', error)
    return NextResponse.json(
      { error: 'Failed to create table', details: error.message },
      { status: 500 }
    )
  }
}
