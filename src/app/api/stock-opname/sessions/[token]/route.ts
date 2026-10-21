import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'

async function ensureTables(){
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname_sessions(
      id SERIAL PRIMARY KEY,
      opname_id INTEGER,
      token TEXT,
      assignee TEXT,
      status TEXT DEFAULT 'open'
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname(
      id SERIAL PRIMARY KEY,
      number TEXT,
      tdate TEXT,
      warehouse_id INTEGER,
      status TEXT,
      notes TEXT
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname_items(
      id SERIAL PRIMARY KEY,
      opname_id INTEGER,
      barang_id INTEGER
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS master_barang(
      id SERIAL PRIMARY KEY,
      code TEXT,
      name TEXT
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname_counts (
      id SERIAL PRIMARY KEY,
      session_id INTEGER,
      opname_id INTEGER,
      barang_id INTEGER,
      qty REAL,
      unit_id INTEGER,
      unit_ratio REAL,
      qty_base REAL,
      method TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_create INTEGER
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS barang_units (
      id SERIAL PRIMARY KEY,
      barang_id INTEGER,
      unit_name TEXT,
      unit_ratio REAL
    );
  `)
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }){
  try {
    const token = String(params.token)
    await ensureTables()

    const sess = await rawGet<any>('SELECT id, opname_id, assignee, status FROM stock_opname_sessions WHERE token=?', [token])
    if (!sess) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })

    const header = await rawGet<any>('SELECT id, number, tdate, warehouse_id, status FROM stock_opname WHERE id=?', [sess.opname_id])
    const items = await rawAll<any[]>(`
      SELECT i.barang_id as id, mb.code, mb.name
      FROM stock_opname_items i
      LEFT JOIN master_barang mb ON mb.id = i.barang_id
      WHERE i.opname_id=?
      ORDER BY mb.code, mb.name
    `, [sess.opname_id])
    const counts = await rawAll<any[]>(`
      SELECT c.id, c.barang_id, mb.code, mb.name, c.qty, c.unit_id, c.unit_ratio,
             COALESCE(bu.unit_name, '') as unit_name
      FROM stock_opname_counts c
      LEFT JOIN master_barang mb ON mb.id = c.barang_id
      LEFT JOIN barang_units bu ON bu.id = c.unit_id
      WHERE c.session_id = ?
      ORDER BY c.id
    `, [sess.id])

    return NextResponse.json({ session: sess, header, items, counts })
  } catch(e:any){
    return NextResponse.json({ error: e?.message || 'Gagal memuat sesi' }, { status: 500 })
  }
}
