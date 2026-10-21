import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

async function ensureTable() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS master_jenis_customer (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      isdelete INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function generateCode(): Promise<string> {
  const last = await rawGet<any>("SELECT code FROM master_jenis_customer WHERE code LIKE 'JNS/%' ORDER BY id DESC LIMIT 1")
  let n = 0
  if (last?.code) {
    const m = /JNS\/(\d{6})$/.exec(last.code)
    if (m) n = parseInt(m[1], 10)
  }
  const next = (n + 1).toString().padStart(6, '0')
  return `JNS/${next}`
}

export async function GET() {
  try {
    await ensureTable()
    const rows = await rawAll<any>(
      'SELECT * FROM master_jenis_customer WHERE COALESCE(isdelete, 0) = 0 ORDER BY id DESC'
    )
    return NextResponse.json(rows)
  } catch (e: any) {
    console.error('GET /api/jenis-customer error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const body = await req.json()
    const name = (body.name || '').toString().trim()
    if (!name) {
      return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
    }

    const code = await generateCode()
    const db = getDb()
    const pool = (db as any).$client
    const r = await pool.query(
      'INSERT INTO master_jenis_customer (code, name, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
      [code, name]
    )
    const id = r.rows[0].id

    return NextResponse.json({ id, code, name, message: 'Jenis customer created' })
  } catch (e: any) {
    console.error('POST /api/jenis-customer error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to create' }, { status: 500 })
  }
}
