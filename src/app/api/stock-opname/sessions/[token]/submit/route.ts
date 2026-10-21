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
    CREATE TABLE IF NOT EXISTS stock_opname (
      id SERIAL PRIMARY KEY,
      status TEXT
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

    const db = getDb()
    const pool = (db as any).$client
    await pool.query('BEGIN')
    try {
      const cols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_opname_sessions' AND table_schema = 'public'"
      )
      const hasUserEdit = cols.some(c=> String(c.column_name).toLowerCase()==='user_edit')
      if (hasUserEdit) {
        await rawRun("UPDATE stock_opname_sessions SET status='closed', updated_at=CURRENT_TIMESTAMP, user_edit=? WHERE id=?", [userId || null, sess.id])
      } else {
        await rawRun("UPDATE stock_opname_sessions SET status='closed', updated_at=CURRENT_TIMESTAMP WHERE id=?", [sess.id])
      }

      const open = await rawGet<any>("SELECT COUNT(*) as n FROM stock_opname_sessions WHERE opname_id=? AND status='open'", [sess.opname_id])
      if (Number(open?.n || 0) === 0) {
        await rawRun("UPDATE stock_opname SET status='submitted', updated_at=CURRENT_TIMESTAMP WHERE id=?", [sess.opname_id])
      }
      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal submit sesi' }, { status: 500 })
  }
}
