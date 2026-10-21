import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns } from '@/lib/audit'

async function ensureTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname_items (
      id SERIAL PRIMARY KEY,
      opname_id INTEGER,
      barang_id INTEGER,
      system_qty REAL DEFAULT 0,
      count_qty REAL,
      variance_qty REAL
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname_counts (
      id SERIAL PRIMARY KEY,
      session_id INTEGER,
      opname_id INTEGER,
      barang_id INTEGER,
      qty_base REAL
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname_sessions (
      id SERIAL PRIMARY KEY,
      opname_id INTEGER,
      status TEXT
    );
  `)
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const opnameId = Number(params.id)
    await ensureTables()
    await addAuditColumns()

    const hdr = await rawGet<any>('SELECT id, status FROM stock_opname WHERE id=?', [opnameId])
    if (!hdr) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })

    const db = getDb()
    const pool = (db as any).$client
    await pool.query('BEGIN')
    try {
      const totals = await rawAll<any[]>('SELECT barang_id, SUM(qty_base) as qty_base FROM stock_opname_counts WHERE opname_id=? GROUP BY barang_id', [opnameId])

      const map = new Map<number, number>()
      for (const t of totals) map.set(t.barang_id, Number(t.qty_base||0))

      const items = await rawAll<any[]>('SELECT id, barang_id, system_qty FROM stock_opname_items WHERE opname_id=?', [opnameId])
      let affected = 0
      for (const it of items) {
        const count = map.get(Number(it.barang_id)) || 0
        const variance = count - (Number(it.system_qty) || 0)
        await rawRun('UPDATE stock_opname_items SET count_qty=?, variance_qty=? WHERE id=?', [count, variance, it.id])
        affected++
      }
      const countsCnt = await rawGet<any>('SELECT COUNT(*) as n FROM stock_opname_counts WHERE opname_id=?', [opnameId])
      if (Number(countsCnt?.n||0) > 0 && String(hdr.status) !== 'approved' && String(hdr.status) !== 'posted') {
        await rawRun("UPDATE stock_opname SET status='submitted', updated_at=CURRENT_TIMESTAMP WHERE id=?", [opnameId])
      }

      await pool.query('COMMIT')
      return NextResponse.json({ ok: true, affected })
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal recalc' }, { status: 500 })
  }
}
