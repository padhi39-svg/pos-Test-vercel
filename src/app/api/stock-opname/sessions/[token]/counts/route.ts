import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'

async function ensureTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname_sessions (
      id SERIAL PRIMARY KEY,
      opname_id INTEGER,
      token TEXT,
      assignee TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_create INTEGER,
      user_edit INTEGER
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

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = String(params.token)
    await ensureTables()
    await addAuditColumns()
    const userId = getUserId(req)

    const sess = await rawGet<any>('SELECT id, opname_id, status FROM stock_opname_sessions WHERE token=?', [token])
    if (!sess) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
    if (String(sess.status) !== 'open') return NextResponse.json({ error: 'Sesi sudah ditutup' }, { status: 400 })

    const body = await req.json().catch(()=>({}))
    const barang_id = Number(body?.barang_id)
    const qty = Number(body?.qty)
    let unit_id = body?.unit_id != null ? Number(body.unit_id) : null
    let unit_ratio = body?.unit_ratio != null ? Number(body.unit_ratio) : null
    const method = body?.method ? String(body.method) : null
    const notes = body?.notes ? String(body.notes) : null

    if (!barang_id || !qty || qty <= 0) return NextResponse.json({ error: 'Data input tidak valid' }, { status: 400 })

    if (!unit_ratio) {
      if (unit_id) {
        const u = await rawGet<any>('SELECT unit_ratio FROM barang_units WHERE id=? AND barang_id=?', [unit_id, barang_id])
        unit_ratio = Number(u?.unit_ratio || 1)
      } else {
        const u = await rawGet<any>('SELECT unit_ratio FROM barang_units WHERE barang_id=? ORDER BY CASE WHEN COALESCE(unit_ratio,1)=1 THEN 0 ELSE 1 END, id LIMIT 1', [barang_id])
        unit_ratio = Number(u?.unit_ratio || 1)
      }
    }

    const qty_base = qty * (Number(unit_ratio) || 1)

    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_opname_counts' AND table_schema = 'public'"
    )
    const hasUserCreate = cols.some(c=> String(c.column_name).toLowerCase()==='user_create')

    const db = getDb()
    const pool = (db as any).$client
    let info: any
    if (hasUserCreate) {
      info = await pool.query(
        'INSERT INTO stock_opname_counts(session_id, opname_id, barang_id, qty, unit_id, unit_ratio, qty_base, method, notes, user_create) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
        [sess.id, sess.opname_id, barang_id, qty, unit_id, unit_ratio, qty_base, method, notes, userId || null]
      )
    } else {
      info = await pool.query(
        'INSERT INTO stock_opname_counts(session_id, opname_id, barang_id, qty, unit_id, unit_ratio, qty_base, method, notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        [sess.id, sess.opname_id, barang_id, qty, unit_id, unit_ratio, qty_base, method, notes]
      )
    }

    return NextResponse.json({ ok: true, id: info.rows[0].id, qty_base })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan hitung' }, { status: 500 })
  }
}
