import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { formatName } from '@/lib/textUtils'

let schemaEnsured = false
async function ensureSalesTable() {
  if (schemaEnsured) return
  schemaEnsured = true
  await rawRun(`
    CREATE TABLE IF NOT EXISTS master_sales (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT,
      user_id INTEGER,
      phone TEXT,
      email TEXT,
      ktp TEXT,
      aktif INTEGER DEFAULT 1,
      isdelete INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)

  try {
    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'master_sales'"
    )
    const names = cols.map(c => c.column_name.toLowerCase())
    const mig: string[] = []
    if (!names.includes('code')) mig.push('ALTER TABLE master_sales ADD COLUMN code TEXT')
    if (!names.includes('name')) mig.push('ALTER TABLE master_sales ADD COLUMN name TEXT')
    if (!names.includes('user_id')) mig.push('ALTER TABLE master_sales ADD COLUMN user_id INTEGER')
    if (!names.includes('phone')) mig.push('ALTER TABLE master_sales ADD COLUMN phone TEXT')
    if (!names.includes('email')) mig.push('ALTER TABLE master_sales ADD COLUMN email TEXT')
    if (!names.includes('ktp')) mig.push('ALTER TABLE master_sales ADD COLUMN ktp TEXT')
    if (!names.includes('aktif')) mig.push('ALTER TABLE master_sales ADD COLUMN aktif INTEGER DEFAULT 1')
    if (!names.includes('isdelete')) mig.push('ALTER TABLE master_sales ADD COLUMN isdelete INTEGER DEFAULT 0')
    if (!names.includes('created_at')) mig.push('ALTER TABLE master_sales ADD COLUMN created_at TIMESTAMP')
    if (!names.includes('updated_at')) mig.push('ALTER TABLE master_sales ADD COLUMN updated_at TIMESTAMP')
    for (const sql of mig) { try { await rawRun(sql) } catch {} }
  } catch (e) {
    console.warn('ensureSalesTable migration warning (master_sales):', e)
  }
}

async function generateSalesCode(): Promise<string> {
  const last = await rawGet<any>("SELECT code FROM master_sales WHERE code LIKE 'SLS/%' ORDER BY id DESC LIMIT 1")
  let n = 0
  if (last?.code) {
    const m = /SLS\/(\d{6})$/.exec(last.code)
    if (m) n = parseInt(m[1], 10)
  }
  const next = (n + 1).toString().padStart(6, '0')
  return `SLS/${next}`
}

export async function GET(req: NextRequest) {
  try {
    await ensureSalesTable()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('limit') || searchParams.get('page_size')) || 20))
    const sortBy = searchParams.get('sort_by') || 'code'
    const sortDir = (searchParams.get('sort_dir') || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'

    const allowedSort = ['code', 'name', 'user_id', 'phone', 'email', 'ktp']
    const orderCol = allowedSort.includes(sortBy) ? sortBy : 'code'
    const offset = (page - 1) * pageSize

    const whereClause = `WHERE COALESCE(isdelete, 0) = 0 AND ($1 = '' OR LOWER(code) LIKE '%'||$2||'%' OR LOWER(name) LIKE '%'||$3||'%')`

    const totalResult = await rawGet<{ value: number }>(
      `SELECT COUNT(*) as value FROM master_sales ${whereClause}`,
      [q, q, q]
    )
    const total = Number(totalResult?.value || 0)

    const rows = await rawAll<any>(
      `SELECT * FROM master_sales ${whereClause} ORDER BY ${orderCol} ${sortDir} LIMIT $4 OFFSET $5`,
      [q, q, q, pageSize, offset]
    )

    return NextResponse.json({ rows, total, page, pageSize })
  } catch (e: any) {
    console.error('GET /api/sales error:', e)
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSalesTable()
    const body = await req.json()

    let name = (body.name || '').toString().trim()
    if (!name) {
      return NextResponse.json({ error: 'Nama sales wajib diisi' }, { status: 400 })
    }
    name = formatName(name)

    const userId = body.user_id ? Number(body.user_id) : null
    const phone = (body.phone || '').toString().trim()
    const email = (body.email || '').toString().trim()
    const ktp = (body.ktp || '').toString().trim()
    const aktif = body.aktif === 0 || body.aktif === false ? 0 : 1

    const code = await generateSalesCode()

    const db = getDb()
    const pool = (db as any).$client
    const r = await pool.query(
      `INSERT INTO master_sales (code, name, user_id, phone, email, ktp, aktif, isdelete, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
      [code, name, userId, phone, email, ktp, aktif]
    )
    const id = r.rows[0].id

    const created = await rawGet<any>('SELECT * FROM master_sales WHERE id = $1', [id])
    return NextResponse.json(created)
  } catch (e: any) {
    console.error('POST /api/sales error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to create sales' }, { status: 500 })
  }
}
