import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawRun } from '@/db/raw'

async function ensureTables(){
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname (
      id SERIAL PRIMARY KEY,
      number TEXT,
      tdate TEXT,
      warehouse_id INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'draft'
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname_items (
      id SERIAL PRIMARY KEY,
      opname_id INTEGER,
      barang_id INTEGER
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname_sessions (
      id SERIAL PRIMARY KEY,
      opname_id INTEGER,
      token TEXT,
      assignee TEXT,
      status TEXT DEFAULT 'open'
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
      notes TEXT
    );
  `)
}

async function doClear(){
  await ensureTables()
  try { await rawRun('SET CONSTRAINTS ALL DEFERRED') } catch {}

  const rows = await rawAll<any[]>("SELECT id, COALESCE(LOWER(status),'') as s FROM stock_opname")
  const drafts = rows.filter(r => r.s === 'draft' || r.s === 'counting')
  const ids = drafts.map(d=>d.id)

  const res = { opname: 0, items: 0, sessions: 0, counts: 0 }
  const db = getDb()
  const pool = (db as any).$client
  await pool.query('BEGIN')
  try {
    if (ids.length === 0) { await pool.query('COMMIT'); return { ok: true, deleted: res, ids } }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
    const cntResult = await pool.query(`DELETE FROM stock_opname_counts WHERE opname_id IN (${placeholders})`, ids)
    res.counts = cntResult.rowCount ?? 0
    const sesResult = await pool.query(`DELETE FROM stock_opname_sessions WHERE opname_id IN (${placeholders})`, ids)
    res.sessions = sesResult.rowCount ?? 0
    const itResult = await pool.query(`DELETE FROM stock_opname_items WHERE opname_id IN (${placeholders})`, ids)
    res.items = itResult.rowCount ?? 0
    const opResult = await pool.query(`DELETE FROM stock_opname WHERE id IN (${placeholders})`, ids)
    res.opname = opResult.rowCount ?? 0
    await pool.query('COMMIT')
    return { ok: true, deleted: res, ids }
  } catch (e) {
    await pool.query('ROLLBACK')
    throw e
  }
}

export async function POST(_req: NextRequest){
  try {
    const out = await doClear()
    return NextResponse.json(out)
  } catch(e:any){
    return NextResponse.json({ error: e?.message || 'Gagal menghapus draft opname' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest){
  try {
    const out = await doClear()
    return NextResponse.json(out)
  } catch(e:any){
    return NextResponse.json({ error: e?.message || 'Gagal menghapus draft opname' }, { status: 500 })
  }
}
