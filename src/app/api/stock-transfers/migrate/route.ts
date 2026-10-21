import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawRun } from '@/db/raw'
import { getDb } from '@/db'

async function ensureTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_transfers (
      id SERIAL PRIMARY KEY,
      number TEXT UNIQUE,
      tdate TEXT,
      from_warehouse_id INTEGER,
      to_warehouse_id INTEGER,
      notes TEXT,
      void INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_transfer_items (
      id SERIAL PRIMARY KEY,
      transfer_id INTEGER,
      barang_id INTEGER,
      qty REAL DEFAULT 0,
      unit_id INTEGER,
      unit_ratio REAL DEFAULT 1,
      qty_total REAL DEFAULT 0,
      FOREIGN KEY(transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE
    );
  `)
}

async function migrateColumns() {
  const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_transfer_items'")
  const has = (n: string) => cols.some(c => String(c.name).toLowerCase() === n)
  if (!has('unit_id')) await rawRun('ALTER TABLE stock_transfer_items ADD COLUMN unit_id INTEGER')
  if (!has('unit_ratio')) await rawRun('ALTER TABLE stock_transfer_items ADD COLUMN unit_ratio REAL DEFAULT 1')
  if (!has('qty_total')) await rawRun('ALTER TABLE stock_transfer_items ADD COLUMN qty_total REAL DEFAULT 0')
}

export async function GET(_req: NextRequest) {
  try {
    await ensureTables()
    await migrateColumns()
    const info = await rawRun(`UPDATE stock_transfer_items SET qty_total = COALESCE(qty,0) * COALESCE(unit_ratio,1)`)
    return NextResponse.json({ ok: true, updated: info.rowCount })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Migration failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
