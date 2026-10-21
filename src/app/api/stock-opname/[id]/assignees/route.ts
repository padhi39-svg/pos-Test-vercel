import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'

async function ensureTables(){
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
      user_edit INTEGER,
      assignees TEXT
    );
  `)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }){
  try {
    const opnameId = Number(params.id)
    await ensureTables()
    await addAuditColumns()

    const body = await req.json().catch(()=>({}))
    let assignees = body?.assignees
    if (!Array.isArray(assignees)) return NextResponse.json({ error: 'assignees harus array user_id' }, { status: 400 })
    assignees = Array.from(new Set(assignees.map((x:any)=>Number(x)).filter((n:number)=>Number.isFinite(n) && n>0)))

    const hdr = await rawGet<any>('SELECT id FROM stock_opname WHERE id=?', [opnameId])
    if (!hdr) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })

    const json = JSON.stringify(assignees)
    try {
      const cols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_opname' AND table_schema = 'public'"
      )
      const has = (n:string)=> cols.some(c=> String(c.column_name).toLowerCase()===n)
      if (!has('updated_at')) { try { await rawRun('ALTER TABLE stock_opname ADD COLUMN updated_at TIMESTAMP') } catch {} }
      if (!has('user_edit')) { try { await rawRun('ALTER TABLE stock_opname ADD COLUMN user_edit INTEGER') } catch {} }
    } catch {}

    try {
      const cols2 = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_opname' AND table_schema = 'public'"
      )
      const has2 = (n:string)=> cols2.some(c=> String(c.column_name).toLowerCase()===n)
      const hasUpdatedAt2 = has2('updated_at')
      const hasUserEdit2 = has2('user_edit')
      const uid = getUserId(req)
      if (hasUserEdit2 && hasUpdatedAt2) {
        await rawRun('UPDATE stock_opname SET assignees=?, user_edit=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [json, uid || null, opnameId])
      } else if (hasUserEdit2) {
        await rawRun('UPDATE stock_opname SET assignees=?, user_edit=? WHERE id=?', [json, uid || null, opnameId])
      } else if (hasUpdatedAt2) {
        await rawRun('UPDATE stock_opname SET assignees=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [json, opnameId])
      } else {
        await rawRun('UPDATE stock_opname SET assignees=? WHERE id=?', [json, opnameId])
      }
    } catch {
      await rawRun('UPDATE stock_opname SET assignees=? WHERE id=?', [json, opnameId])
    }

    return NextResponse.json({ ok: true, assignees })
  } catch(e:any){
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan assignees' }, { status: 500 })
  }
}
