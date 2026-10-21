import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

async function ensureTable() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS master_season_discount (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      jenis_customer_id INTEGER NOT NULL REFERENCES master_jenis_customer(id),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      isdelete INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await rawRun(`
    CREATE TABLE IF NOT EXISTS master_season_discount_items (
      id SERIAL PRIMARY KEY,
      season_discount_id INTEGER NOT NULL REFERENCES master_season_discount(id) ON DELETE CASCADE,
      barang_id INTEGER REFERENCES master_barang(id),
      discount_type TEXT NOT NULL DEFAULT 'disc1',
      discount_value DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function generateCode(): Promise<string> {
  const last = await rawGet<any>("SELECT code FROM master_season_discount WHERE code LIKE 'SDS/%' ORDER BY id DESC LIMIT 1")
  let n = 0
  if (last?.code) {
    const m = /SDS\/(\d{6})$/.exec(last.code)
    if (m) n = parseInt(m[1], 10)
  }
  const next = (n + 1).toString().padStart(6, '0')
  return `SDS/${next}`
}

export async function GET() {
  try {
    await ensureTable()
    const rows = await rawAll<any>(
      `SELECT s.*, jc.name as jenis_customer_name
       FROM master_season_discount s
       LEFT JOIN master_jenis_customer jc ON jc.id = s.jenis_customer_id
       WHERE COALESCE(s.isdelete, 0) = 0
       ORDER BY s.id DESC`
    )

    const items = await rawAll<any>(
      `SELECT i.*, b.name as barang_name, b.code as barang_code
       FROM master_season_discount_items i
       LEFT JOIN master_barang b ON b.id = i.barang_id`
    )

    const itemMap: Record<number, any[]> = {}
    for (const it of items) {
      if (!itemMap[it.season_discount_id]) itemMap[it.season_discount_id] = []
      itemMap[it.season_discount_id].push(it)
    }

    for (const row of rows) {
      row.items = itemMap[row.id] || []
    }

    return NextResponse.json(rows)
  } catch (e: any) {
    console.error('GET /api/season-discount error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const body = await req.json()
    const name = (body.name || '').toString().trim()
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
    if (!body.jenis_customer_id) return NextResponse.json({ error: 'Jenis customer wajib diisi' }, { status: 400 })
    if (!body.start_date) return NextResponse.json({ error: 'Tanggal mulai wajib diisi' }, { status: 400 })
    if (!body.end_date) return NextResponse.json({ error: 'Tanggal akhir wajib diisi' }, { status: 400 })

    const code = await generateCode()
    const db = getDb()
    const pool = (db as any).$client

    const r = await pool.query(
      `INSERT INTO master_season_discount (code, name, jenis_customer_id, start_date, end_date, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
      [code, name, Number(body.jenis_customer_id), body.start_date, body.end_date, body.is_active === false || body.is_active === 0 ? 0 : 1]
    )
    const seasonId = r.rows[0].id

    if (Array.isArray(body.items)) {
      for (const item of body.items) {
        await pool.query(
          `INSERT INTO master_season_discount_items (season_discount_id, barang_id, discount_type, discount_value)
           VALUES ($1, $2, $3, $4)`,
          [seasonId, item.barang_id ? Number(item.barang_id) : null, item.discount_type || 'disc1', Number(item.discount_value) || 0]
        )
      }
    }

    return NextResponse.json({ id: seasonId, code, name, message: 'Season discount created' })
  } catch (e: any) {
    console.error('POST /api/season-discount error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to create' }, { status: 500 })
  }
}
