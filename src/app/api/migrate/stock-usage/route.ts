import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import fs from 'fs'
import path from 'path'

function readSchema(): string {
  // Resolve schema file path
  const schemaPath = path.join(process.cwd(), 'web', 'src', 'db', 'schema', 'stock_usage.sql')
  if (fs.existsSync(schemaPath)) {
    return fs.readFileSync(schemaPath, 'utf-8')
  }
  // Fallback SQL if file is not found
  return `
  CREATE TABLE IF NOT EXISTS stock_usage (
    id SERIAL PRIMARY KEY,
    number TEXT,
    tdate TEXT,
    warehouse_id INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    void INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS stock_usage_items (
    id SERIAL PRIMARY KEY,
    usage_id INTEGER,
    barang_id INTEGER,
    qty REAL,
    unit_id INTEGER,
    unit_ratio REAL,
    qty_total REAL,
    FOREIGN KEY(usage_id) REFERENCES stock_usage(id) ON DELETE CASCADE
  );
  `
}

export async function GET(_req: NextRequest) {
  try {
    const db = getDb()
    const sql = readSchema()
    await rawRun(sql)
    return NextResponse.json({ ok: true, migrated: ['stock_usage', 'stock_usage_items'] })
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Migration failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
