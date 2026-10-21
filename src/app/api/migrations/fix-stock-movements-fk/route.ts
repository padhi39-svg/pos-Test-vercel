import { NextResponse } from 'next/server'
import { rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST() {
  try {
    const db = getDb()
    const pool = (db as any).$client

    await pool.query('BEGIN')
    try {
      await rawRun(`
        CREATE TABLE IF NOT EXISTS stock_movements_new (
          id SERIAL PRIMARY KEY,
          ingredient_id INTEGER NOT NULL,
          movement_type TEXT NOT NULL,
          quantity DECIMAL(10,4) NOT NULL,
          unit TEXT NOT NULL,
          reference_type TEXT,
          reference_id INTEGER,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `)
      await rawRun('INSERT INTO stock_movements_new SELECT * FROM stock_movements')
      await rawRun('DROP TABLE stock_movements')
      await rawRun('ALTER TABLE stock_movements_new RENAME TO stock_movements')
      await pool.query('COMMIT')
    } catch (e:any) {
      await pool.query('ROLLBACK')
      throw e
    }
    return NextResponse.json({ success: true })
  } catch (error:any) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Migration failed', details: error.message }, { status: 500 })
  }
}
