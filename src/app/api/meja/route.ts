import { NextRequest, NextResponse } from 'next/server'
import { getUserId, applyCreateAudit, applyUpdateAudit } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getDb } from '@/db'
import { rawAll, rawRun, rawGet } from '@/db/raw'

async function notifyMejaChanged() {
  try {
    const db = getDb()
    const pool = (db as any).$client
    await pool.query("SELECT pg_notify('meja_changed', '')")
  } catch {}
}

const INT_FIELDS = ['id', 'floor_id', 'capacity', 'is_active', 'is_mergeable', 'is_smoking', 'isdelete', 'user_create', 'user_edit']
function normalizeRow(r: any) {
  if (!r) return r
  const o: any = {}
  for (const k of Object.keys(r)) {
    o[k] = INT_FIELDS.includes(k) ? Number(r[k]) : r[k]
  }
  return o
}

async function ensureTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS floors (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      level_no INTEGER,
      is_active INTEGER DEFAULT 1,
      isdelete INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS master_meja (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      floor_id INTEGER,
      zone TEXT,
      capacity INTEGER DEFAULT 2,
      is_active INTEGER DEFAULT 1,
      is_mergeable INTEGER DEFAULT 1,
      is_smoking INTEGER DEFAULT 0,
      isdelete INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE SET NULL
    );
  `)

  const mmCols = await rawAll<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'master_meja'"
  )
  const hasCol = (n: string) => mmCols.some(c => c.column_name.toLowerCase() === n.toLowerCase())

  if (!hasCol('isdelete')) {
    try { await rawRun('ALTER TABLE master_meja ADD COLUMN isdelete INTEGER DEFAULT 0') } catch {}
  }
  if (!hasCol('pos_x')) { try { await rawRun('ALTER TABLE master_meja ADD COLUMN pos_x REAL DEFAULT 0') } catch {} }
  if (!hasCol('pos_y')) { try { await rawRun('ALTER TABLE master_meja ADD COLUMN pos_y REAL DEFAULT 0') } catch {} }
  if (!hasCol('width')) { try { await rawRun('ALTER TABLE master_meja ADD COLUMN width REAL DEFAULT 120') } catch {} }
  if (!hasCol('height')) { try { await rawRun('ALTER TABLE master_meja ADD COLUMN height REAL DEFAULT 100') } catch {} }
  if (!hasCol('shape')) { try { await rawRun("ALTER TABLE master_meja ADD COLUMN shape TEXT DEFAULT 'rectangle'") } catch {} }
  if (!hasCol('barcode_data')) { try { await rawRun('ALTER TABLE master_meja ADD COLUMN barcode_data TEXT') } catch {} }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables()
    const canMeja = hasPermission(req, 'meja', 'view')
    const canTransaksi = hasPermission(req, 'transaksi', 'view')
    const canPosResto = hasPermission(req, 'pos_resto', 'view')
    const canPosRestoTable = hasPermission(req, 'pos_resto_table', 'view')
    const canSalesList = hasPermission(req, 'sales_list', 'view')
    if (!canMeja && !canTransaksi && !canPosResto && !canPosRestoTable && !canSalesList) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat meja' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').toLowerCase()
    const floorId = Number(searchParams.get('floor_id')) || null
    const onlyActive = (searchParams.get('active') || '').toLowerCase() === '1'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 20))
    const offset = (page - 1) * limit

    const db = getDb()
    const pool = (db as any).$client
    let where = `WHERE COALESCE(m.isdelete,0)=0`
    const params: any[] = []
    if (onlyActive) { where += ` AND COALESCE(m.is_active,1)=1` }
    if (floorId) { where += ` AND m.floor_id = $${params.length + 1}`; params.push(floorId) }
    if (q) { where += ` AND LOWER(COALESCE(m.code,'') || ' ' || COALESCE(m.name,'') || ' ' || COALESCE(f.name,'') || ' ' || COALESCE(m.zone,'')) LIKE $${params.length + 1}`; params.push(`%${q}%`) }

    const countResult = await pool.query(`SELECT COUNT(*) as total FROM master_meja m LEFT JOIN floors f ON f.id = m.floor_id ${where}`, params)
    const total = Number(countResult.rows[0]?.total || 0)

    const sortBy = searchParams.get('sort_by') || 'code'
    const sortDir = (searchParams.get('sort_dir') || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    const SORT_COLUMNS: Record<string, string> = {
      code: 'm.code',
      name: 'm.name',
      floor_name: 'f.name',
      capacity: 'm.capacity',
      zone: 'm.zone',
      is_active: 'm.is_active',
    }
    const orderCol = SORT_COLUMNS[sortBy] || 'm.code'

    let sql = `SELECT m.*, f.name as floor_name, f.code as floor_code
               FROM master_meja m
               LEFT JOIN floors f ON f.id = m.floor_id
               ${where}
               ORDER BY ${orderCol} ${sortDir}, m.id
               LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    const result = await pool.query(sql, [...params, limit, offset])
    const rows = result.rows.map(normalizeRow)

    return NextResponse.json({ rows, total, page, limit })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengambil data meja' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req, 'meja', 'create') && !hasPermission(req, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat meja' }, { status: 403 })
    }
    const body = await req.json().catch(()=>({})) as any
    let { code, name, floor_id, zone, capacity, is_active, is_mergeable, is_smoking, notes } = body
    code = String(code || '').trim().toUpperCase()
    name = String(name || '').trim()
    const floorId = floor_id != null ? Number(floor_id) : null
    const cap = capacity != null ? Number(capacity) : 2
    const isActive = is_active === 0 || is_active === false ? 0 : 1
    const isMergeable = is_mergeable === 0 || is_mergeable === false ? 0 : 1
    const isSmoking = is_smoking === 1 || is_smoking === true ? 1 : 0
    notes = notes != null ? String(notes) : null

    if (!code) return NextResponse.json({ error: 'Kode wajib diisi' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })

    const db = getDb()
    const dupResult = await db.execute(sql`SELECT id FROM master_meja WHERE code = ${code} AND COALESCE(isdelete,0)=0 LIMIT 1`)
    const dup = dupResult.rows[0] as any
    if (dup) return NextResponse.json({ error: 'Kode sudah digunakan' }, { status: 400 })

    const insertResult = await db.execute(sql`
      INSERT INTO master_meja(code, name, floor_id, zone, capacity, is_active, is_mergeable, is_smoking, notes)
      VALUES(${code}, ${name}, ${floorId}, ${zone || null}, ${cap}, ${isActive}, ${isMergeable}, ${isSmoking}, ${notes})
      RETURNING id
    `)
    const newId = (insertResult.rows[0] as any).id

    const userId = getUserId(req)
    const createdResult = await db.execute(sql`
      SELECT m.*, f.name as floor_name, f.code as floor_code
      FROM master_meja m
      LEFT JOIN floors f ON f.id = m.floor_id
      WHERE m.id = ${newId}
    `)
    const created = normalizeRow(createdResult.rows[0] as any)
    try { await applyCreateAudit('master_meja', newId, userId) } catch {}
    await notifyMejaChanged()
    return NextResponse.json(created)
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan meja' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!hasPermission(req, 'meja', 'edit') && !hasPermission(req, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah meja' }, { status: 403 })
    }
    const body = await req.json().catch(()=>({})) as any
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    let { code, name, floor_id, zone, capacity, is_active, is_mergeable, is_smoking, notes } = body
    code = code != null ? String(code).trim().toUpperCase() : undefined
    name = name != null ? String(name).trim() : undefined
    const floorId = floor_id != null ? Number(floor_id) : undefined
    const cap = capacity != null ? Number(capacity) : undefined
    const isActive = is_active != null ? (is_active === 0 || is_active === false ? 0 : 1) : undefined
    const isMergeable = is_mergeable != null ? (is_mergeable === 0 || is_mergeable === false ? 0 : 1) : undefined
    const isSmoking = is_smoking != null ? (is_smoking === 1 || is_smoking === true ? 1 : 0) : undefined
    notes = notes !== undefined ? (notes != null ? String(notes) : null) : undefined

    await ensureTables()

    const exists = normalizeRow(await rawGet<any>('SELECT * FROM master_meja WHERE id=? AND COALESCE(isdelete,0)=0', [id]))
    if (!exists) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

    if (code) {
      const dup = await rawGet<any>('SELECT id FROM master_meja WHERE code=? AND id<>? AND COALESCE(isdelete,0)=0 LIMIT 1', [code, id])
      if (dup) return NextResponse.json({ error: 'Kode sudah digunakan' }, { status: 400 })
    }

    const setClauses: string[] = []
    const params: any[] = []
    if (code !== undefined) { setClauses.push('code=?'); params.push(code) }
    if (name !== undefined) { setClauses.push('name=?'); params.push(name) }
    if (floorId !== undefined) { setClauses.push('floor_id=?'); params.push(floorId) }
    if (zone !== undefined) { setClauses.push('zone=?'); params.push(zone) }
    if (cap !== undefined) { setClauses.push('capacity=?'); params.push(cap) }
    if (isActive !== undefined) { setClauses.push('is_active=?'); params.push(isActive) }
    if (isMergeable !== undefined) { setClauses.push('is_mergeable=?'); params.push(isMergeable) }
    if (isSmoking !== undefined) { setClauses.push('is_smoking=?'); params.push(isSmoking) }
    if (notes !== undefined) { setClauses.push('notes=?'); params.push(notes) }

    if (setClauses.length === 0) return NextResponse.json(exists)

    const userId = getUserId(req)
    params.push(id)
    await rawRun(`UPDATE master_meja SET ${setClauses.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`, params)
    try { await applyUpdateAudit('master_meja', id, userId) } catch {}
    const updated = normalizeRow(await rawGet<any>(`
      SELECT m.*, f.name as floor_name, f.code as floor_code
      FROM master_meja m
      LEFT JOIN floors f ON f.id = m.floor_id
      WHERE m.id=?
    `, [id]))
    await notifyMejaChanged()
    return NextResponse.json(updated)
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengubah meja' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!hasPermission(req, 'meja', 'delete') && !hasPermission(req, 'transaksi', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus meja' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const id = Number(searchParams.get('id'))
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    await ensureTables()

    const exists = await rawGet<any>('SELECT id FROM master_meja WHERE id=? AND COALESCE(isdelete,0)=0', [id])
    if (!exists) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

    const userId = getUserId(req)
    await rawRun('UPDATE master_meja SET isdelete=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [id])
    try { await applyUpdateAudit('master_meja', id, userId) } catch {}
    await notifyMejaChanged()
    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal menghapus meja' }, { status: 500 })
  }
}
