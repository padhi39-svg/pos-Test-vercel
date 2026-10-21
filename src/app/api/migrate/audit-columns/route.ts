import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { addAuditColumns } from '@/lib/audit'

export async function POST() {
  try {
    const db = getDb()
    addAuditColumns(db)
    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal migrasi kolom audit' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const db = getDb()
    addAuditColumns(db)
    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal migrasi kolom audit' }, { status: 500 })
  }
}
