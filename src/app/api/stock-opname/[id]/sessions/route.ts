import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'

async function ensureTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname (
      id SERIAL PRIMARY KEY,
      number TEXT,
      tdate TEXT,
      warehouse_id INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_create INTEGER,
      user_edit INTEGER
    );
  `)
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
}

function randomToken(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)]
  return out
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const opnameId = Number(params.id)
    const body = await req.json().catch(()=>({}))
    const assignee = String(body?.assignee || '').slice(0,64) || null

    await ensureTables()
    await addAuditColumns()
    const userId = getUserId(req)

    const hdr = await rawGet<any>('SELECT id, status FROM stock_opname WHERE id=?', [opnameId])
    if (!hdr) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })

    const exist = await rawGet<any>("SELECT token FROM stock_opname_sessions WHERE opname_id=? AND status='open' ORDER BY id DESC LIMIT 1", [opnameId])
    if (exist?.token) {
      if (assignee) {
        await rawRun('UPDATE stock_opname_sessions SET assignee=?, updated_at=CURRENT_TIMESTAMP WHERE opname_id=? AND token=?', [assignee, opnameId, exist.token])
      }
      if (String(hdr.status) === 'draft') {
        try {
          const cols = await rawAll<{ column_name: string }>(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_opname' AND table_schema = 'public'"
          )
          const hasUpdatedAt = cols.some(c=> String(c.column_name).toLowerCase()==='updated_at')
          if (hasUpdatedAt) await rawRun("UPDATE stock_opname SET status='counting', updated_at=CURRENT_TIMESTAMP WHERE id=?", [opnameId])
          else await rawRun("UPDATE stock_opname SET status='counting' WHERE id=?", [opnameId])
        } catch {
          await rawRun("UPDATE stock_opname SET status='counting' WHERE id=?", [opnameId])
        }
      }
      return NextResponse.json({ token: exist.token, url: `/m/opname/${exist.token}` })
    }

    const token = randomToken(10)
    const db = getDb()
    const pool = (db as any).$client
    await pool.query('BEGIN')
    try {
      const cols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_opname_sessions' AND table_schema = 'public'"
      )
      const hasUserCreate = cols.some(c=> String(c.column_name).toLowerCase()==='user_create')
      if (hasUserCreate) {
        await pool.query(
          'INSERT INTO stock_opname_sessions(opname_id, token, assignee, status, user_create) VALUES($1,$2,$3,$4,$5)',
          [opnameId, token, assignee, 'open', userId || null]
        )
      } else {
        await pool.query(
          'INSERT INTO stock_opname_sessions(opname_id, token, assignee, status) VALUES($1,$2,$3,$4)',
          [opnameId, token, assignee, 'open']
        )
      }
      if (String(hdr.status) === 'draft') {
        await rawRun("UPDATE stock_opname SET status='counting', updated_at=CURRENT_TIMESTAMP WHERE id=?", [opnameId])
      }
      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ token, url: `/m/opname/${token}` })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal membuat session' }, { status: 500 })
  }
}
