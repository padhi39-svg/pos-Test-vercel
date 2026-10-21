import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'

const ENFORCE_ASSIGNEES = false

async function ensureTables() {
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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try{
    const opnameId = Number(params.id)
    if (!Number.isFinite(opnameId) || opnameId<=0) {
      return NextResponse.json({ error: 'Dokumen tidak valid' }, { status: 400 })
    }
    await ensureTables()
    await addAuditColumns()

    let rows: any[] = []
    try {
      rows = await rawAll<any[]>(`
      WITH latest AS (
        SELECT MAX(id) AS max_id
        FROM stock_opname_counts
        WHERE opname_id = ?
        GROUP BY barang_id
      )
      SELECT c.barang_id,
             c.qty,
             c.unit_id,
             c.unit_ratio,
             bu.unit_name AS unit_name,
             COALESCE(bu.unit_name, bu.unit) AS unit_label,
             b.code AS code,
             b.name AS name
      FROM latest l
      JOIN stock_opname_counts c ON c.id = l.max_id
      LEFT JOIN barang_units bu ON bu.id = c.unit_id
      LEFT JOIN master_barang b ON b.id = c.barang_id
      ORDER BY c.barang_id
    `, [opnameId])
    } catch {
      rows = await rawAll<any[]>(`
        SELECT c1.barang_id, c1.qty, c1.unit_id, c1.unit_ratio,
               NULL as unit_name, NULL as unit_label,
               mb.code AS code, mb.name AS name
        FROM stock_opname_counts c1
        LEFT JOIN master_barang mb ON mb.id = c1.barang_id
        WHERE c1.opname_id = ?
          AND c1.id = (
            SELECT MAX(c2.id)
            FROM stock_opname_counts c2
            WHERE c2.opname_id = c1.opname_id AND c2.barang_id = c1.barang_id
          )
        ORDER BY c1.barang_id
      `, [opnameId])
    }

    return NextResponse.json({ rows })
  }catch(e:any){
    return NextResponse.json({ error: e?.message || 'Gagal memuat counts' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const opnameId = Number(params.id)
    await ensureTables()
    await addAuditColumns()
    const userId = getUserId(req)

    const body = await req.json().catch(()=>({}))
    const barang_id = Number(body?.barang_id)
    const qty = Number(body?.qty)
    let unit_id = body?.unit_id != null ? Number(body.unit_id) : null
    let unit_ratio = body?.unit_ratio != null ? Number(body.unit_ratio) : null
    const method = body?.method ? String(body.method) : null
    const notes = body?.notes ? String(body.notes) : null

    if (!opnameId) return NextResponse.json({ error: 'Dokumen tidak valid' }, { status: 400 })

    if (ENFORCE_ASSIGNEES) try {
      const hdr = await rawGet<any>('SELECT assignees FROM stock_opname WHERE id=?', [opnameId])
      let raw: any = hdr?.assignees ?? '[]'
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw) } catch { }
      }
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw) } catch { }
      }
      const toId = (v:any)=> {
        if (v == null) return null
        if (typeof v === 'number') return v
        if (typeof v === 'string') return Number(v)
        if (typeof v === 'object' && 'id' in v) return Number((v as any).id)
        return null
      }
      const idsNumRaw = Array.isArray(raw) ? raw.map(toId) : []
      const idsNum = idsNumRaw.filter((x: number | null): x is number => typeof x === 'number' && !Number.isNaN(x))
      const idsStr = idsNum.map((n)=> String(n))
      let isManager = (req.headers.get('x-role') || '').toLowerCase() === 'manager'
      if (!isManager && userId != null) {
        try {
          const row = await rawGet<any>('SELECT role FROM users WHERE id=?', [Number(userId)])
          if (String(row?.role||'').toLowerCase()==='manager') isManager = true
        } catch {}
        if (!isManager) {
          try {
            const row2 = await rawGet<any>('SELECT role FROM user WHERE id=?', [Number(userId)])
            if (String(row2?.role||'').toLowerCase()==='manager') isManager = true
          } catch {}
        }
      }
      if (!isManager && userId != null && idsNum.length > 0) {
        const ok = idsNum.includes(Number(userId)) || idsStr.includes(String(userId))
        if (!ok) {
          return NextResponse.json({ error: 'Tidak berwenang', reason: 'not-assigned' }, { status: 403 })
        }
      }
    } catch { }
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
    const db = getDb()
    const pool = (db as any).$client

    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_opname_counts' AND table_schema = 'public'"
    )
    const hasUserCreate = cols.some(c=> String(c.column_name).toLowerCase()==='user_create')

    let info: any
    if (hasUserCreate) {
      info = await pool.query(
        `INSERT INTO stock_opname_counts(session_id, opname_id, barang_id, qty, unit_id, unit_ratio, qty_base, method, notes, user_create) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [null, opnameId, barang_id, qty, unit_id, unit_ratio, qty_base, method, notes, userId || null]
      )
    } else {
      info = await pool.query(
        `INSERT INTO stock_opname_counts(session_id, opname_id, barang_id, qty, unit_id, unit_ratio, qty_base, method, notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [null, opnameId, barang_id, qty, unit_id, unit_ratio, qty_base, method, notes]
      )
    }

    return NextResponse.json({ ok: true, id: info.rows[0].id, qty_base })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan hitung' }, { status: 500 })
  }
}
