import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawRun } from '@/db/raw'
import { getDb } from '@/db'

async function ensureLockTable() {
  const db = getDb(); const pool = (db as any).$client
  await pool.query(`
    CREATE TABLE IF NOT EXISTS resto_table_locks (
      id SERIAL PRIMARY KEY,
      table_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      user_id INTEGER,
      user_name TEXT,
      locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP
    );
  `)
  try { await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_table_locks_table ON resto_table_locks(table_id)') } catch {}
}

export async function GET(req: NextRequest) {
  try {
    const db = getDb(); const pool = (db as any).$client
    await ensureLockTable()
    try {
      await rawRun(`DELETE FROM resto_table_locks WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP`)
    } catch {}
    const rows = await rawAll(`SELECT table_id, device_id, user_id, user_name, locked_at, updated_at, expires_at FROM resto_table_locks`)
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengambil daftar lock' }, { status: 500 })
  }
}
