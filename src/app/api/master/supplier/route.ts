import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').toLowerCase()

    const db = getDb(); const pool = (db as any).$client
    await pool.query(`
      CREATE TABLE IF NOT EXISTS master_supplier (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        npwp TEXT,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        term INTEGER DEFAULT 0,
        isdelete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    const rows = await rawAll(`
      SELECT id, code, name FROM master_supplier
      WHERE COALESCE(isdelete,0) = 0
        ${q ? 'AND (LOWER(code) LIKE ? OR LOWER(name) LIKE ?)' : ''}
      ORDER BY name ASC
    `, q ? [`%${q}%`, `%${q}%`] : undefined)

    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to list suppliers', details: e?.message }, { status: 500 })
  }
}
