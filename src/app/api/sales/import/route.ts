import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { formatName } from '@/lib/textUtils'

async function ensureSalesTable() {
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
    if (!names.includes('code')) await rawRun('ALTER TABLE master_sales ADD COLUMN code TEXT')
    if (!names.includes('name')) await rawRun('ALTER TABLE master_sales ADD COLUMN name TEXT')
    if (!names.includes('user_id')) await rawRun('ALTER TABLE master_sales ADD COLUMN user_id INTEGER')
    if (!names.includes('phone')) await rawRun('ALTER TABLE master_sales ADD COLUMN phone TEXT')
    if (!names.includes('email')) await rawRun('ALTER TABLE master_sales ADD COLUMN email TEXT')
    if (!names.includes('ktp')) await rawRun('ALTER TABLE master_sales ADD COLUMN ktp TEXT')
    if (!names.includes('aktif')) await rawRun('ALTER TABLE master_sales ADD COLUMN aktif INTEGER DEFAULT 1')
    if (!names.includes('isdelete')) await rawRun('ALTER TABLE master_sales ADD COLUMN isdelete INTEGER DEFAULT 0')
    if (!names.includes('created_at')) await rawRun('ALTER TABLE master_sales ADD COLUMN created_at TIMESTAMP')
    if (!names.includes('updated_at')) await rawRun('ALTER TABLE master_sales ADD COLUMN updated_at TIMESTAMP')
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

export async function POST(req: NextRequest) {
  try {
    await ensureSalesTable()
    const body = await req.json()
    const data = Array.isArray(body.data) ? body.data : []

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'Data tidak valid atau kosong' }, { status: 400 })
    }

    const db = getDb()
    const pool = (db as any).$client
    const inserted: any[] = []
    const skipped: any[] = []

    for (const row of data) {
      const name = row['Nama'] || row['nama'] || row['name'] || ''
      const userId = row['User ID'] || row['user_id'] || row['UserId'] || null
      const phone = row['Phone'] || row['phone'] || row['Telp'] || row['telp'] || ''
      const email = row['Email'] || row['email'] || ''
      const ktp = row['KTP'] || row['ktp'] || ''

      const cleanName = formatName(String(name).trim())
      if (!cleanName) {
        skipped.push({ row, reason: 'Nama kosong atau tidak valid' })
        continue
      }

      const exists = await rawGet<any>(
        "SELECT id FROM master_sales WHERE LOWER(TRIM(name)) = LOWER($1) AND COALESCE(isdelete,0)=0",
        [cleanName]
      )
      if (exists) {
        skipped.push({ row, reason: 'Nama sales sudah ada' })
        continue
      }

      const code = await generateSalesCode()
      const r = await pool.query(
        `INSERT INTO master_sales (code, name, user_id, phone, email, ktp, aktif, isdelete, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
        [code, cleanName, userId ? Number(userId) : null, String(phone).trim(), String(email).trim(), String(ktp).trim()]
      )
      const created = await rawGet<any>('SELECT * FROM master_sales WHERE id = $1', [r.rows[0].id])
      inserted.push(created)
    }

    return NextResponse.json({
      message: `Import selesai. ${inserted.length} data berhasil, ${skipped.length} dilewati.`,
      inserted,
      skipped
    })
  } catch (e: any) {
    console.error('POST /api/sales/import error:', e)
    return NextResponse.json({ error: e?.message || 'Import gagal' }, { status: 500 })
  }
}
