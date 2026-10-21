import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST() {
  try {
    const db = getDb()
    const tables = await rawAll<{table_name:string}>(`SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema = CURRENT_SCHEMA`)
    let affected = [] as Array<{ table: string; updated_create: number; updated_edit: number }>
    for (const t of tables) {
      const name = String(t.table_name)
      const cols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?`, [name])
      const colNames = cols.map(c => String(c.name).toLowerCase())
      const hasCreate = colNames.includes('user_create')
      const hasEdit = colNames.includes('user_edit')
      if (!hasCreate && !hasEdit) continue
      let updCreate = 0
      let updEdit = 0
      if (hasCreate) {
        const res = await rawRun(`UPDATE ${name} SET user_create = COALESCE(user_create, 1) WHERE user_create IS NULL OR user_create = 0`)
        updCreate = res.rowCount || 0
      }
      if (hasEdit) {
        const res2 = await rawRun(`UPDATE ${name} SET user_edit = COALESCE(user_edit, 1) WHERE user_edit IS NULL OR user_edit = 0`)
        updEdit = res2.rowCount || 0
      }
      affected.push({ table: name, updated_create: updCreate, updated_edit: updEdit })
    }
    return NextResponse.json({ ok: true, affected })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal backfill user_create/user_edit' }, { status: 500 })
  }
}

export async function GET() { return POST() }
