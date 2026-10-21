import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { addAuditColumns } from '@/lib/audit'

async function ensureSOTables(){
  const db = getDb(); const pool = (db as any).$client
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "SO" (
      id SERIAL PRIMARY KEY,
      number TEXT,
      tdate TEXT,
      warehouse_id INTEGER,
      notes TEXT,
      approved INTEGER DEFAULT 0,
      period_id INTEGER,
      void INTEGER DEFAULT 0,
      dso_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_create INTEGER,
      user_edit INTEGER
    );
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "SODetail" (
      id SERIAL PRIMARY KEY,
      so_id INTEGER NOT NULL,
      barang_id INTEGER NOT NULL,
      system_qty REAL DEFAULT 0,
      count_qty REAL,
      variance_qty REAL,
      unit_id_default INTEGER,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(so_id) REFERENCES "SO"(id) ON DELETE CASCADE
    );
  `)
  try{ await rawRun(`CREATE INDEX IF NOT EXISTS idx_so_number ON "SO"(number)`)}catch{}
  try{ await rawRun(`CREATE INDEX IF NOT EXISTS idx_so_period_wh ON "SO"(period_id, warehouse_id)`)}catch{}
  try{ await rawRun(`CREATE INDEX IF NOT EXISTS idx_so_date ON "SO"(tdate)`)}catch{}
  try{ await rawRun(`CREATE INDEX IF NOT EXISTS idx_so_approved ON "SO"(approved)`)}catch{}
  try{ await rawRun(`CREATE INDEX IF NOT EXISTS idx_sodetail_so_id ON "SODetail"(so_id)`)}catch{}
  try{ await rawRun(`CREATE INDEX IF NOT EXISTS idx_sodetail_barang_id ON "SODetail"(barang_id)`)}catch{}
}

export async function GET(req: NextRequest){
  try{
    await ensureSOTables()
    addAuditColumns(getDb())

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q')||'').toLowerCase()
    const wh = searchParams.get('warehouse_id') || ''
    const approved = searchParams.get('approved') || ''

    let rows = await rawAll(`
      SELECT id, number, tdate, warehouse_id, notes, approved, void
      FROM "SO"
      ORDER BY id DESC
      LIMIT 1000
    `) as any[]

    if (q) rows = rows.filter(r => `${r.number||''} ${r.notes||''}`.toLowerCase().includes(q))
    if (wh) rows = rows.filter(r => Number(r.warehouse_id) === Number(wh))
    if (approved === '0' || approved === '1') rows = rows.filter(r => Number(r.approved) === Number(approved))

    return NextResponse.json({ rows })
  }catch(e:any){
    return NextResponse.json({ error: e?.message || 'Gagal memuat daftar SO' }, { status: 500 })
  }
}
