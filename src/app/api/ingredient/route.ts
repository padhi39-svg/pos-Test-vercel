import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { formatName, formatCode } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'ingredient', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat ingredient' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const sortBy = searchParams.get('sort_by') || 'name'
    const sortDir = (searchParams.get('sort_dir') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 20))

    const allowedSort: Record<string, string> = {
      code: 'i.code',
      name: 'i.name',
      unit: 'i.unit',
      hpp: 'i.hpp',
      createdAt: 'i.created_at',
    }
    const orderCol = allowedSort[sortBy] || 'i.name'

    const wheres: string[] = ['COALESCE(i.isdelete, 0) = 0']
    const params: any[] = []
    if (q) {
      wheres.push('(LOWER(i.name) LIKE ? OR LOWER(i.code) LIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }

    const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''
    const offset = (page - 1) * pageSize

    const countResult = await rawGet<any>(
      `SELECT COUNT(*) as total FROM master_ingredient i ${whereClause}`,
      params.length > 0 ? params : undefined
    )
    const total = Number(countResult?.total || 0)

    const rows = await rawAll<any>(
      `SELECT 
        i.id, i.code, i.name, i.unit, i.hpp, i.stock_minimum, i.stock_current,
        i.kategori_id, k.name as kategori_name,
        i.spesifikasi_id, s.name as spesifikasi_name,
        i.merk_id, m.name as merk_name,
        i.isdelete, i.created_at, i.updated_at
       FROM master_ingredient i
       LEFT JOIN master_kategori k ON i.kategori_id = k.id
       LEFT JOIN master_spesifikasi s ON i.spesifikasi_id = s.id
       LEFT JOIN master_merk m ON i.merk_id = m.id
       ${whereClause}
       ORDER BY ${orderCol} ${sortDir}
       LIMIT ? OFFSET ?`,
      params.length > 0 ? [...params, pageSize, offset] : [pageSize, offset]
    )

    return NextResponse.json({ rows, total, page, pageSize })
  } catch (error) {
    console.error('Error fetching ingredients:', error)
    return NextResponse.json({ error: 'Failed to fetch ingredients' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'ingredient', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat ingredient' }, { status: 403 })
    }
    const data = await request.json()
    const db = getDb(); const pool = (db as any).$client
    
    const code = formatCode(data.code) || ''
    const name = formatName(data.name) || ''
    const unit = data.unit || 'Kg'
    const hpp = parseFloat(data.hpp) || 0
    const stockMinimum = parseFloat(data.stockMinimum) || 0
    const stockCurrent = parseFloat(data.stockCurrent) || 0
    const kategoriId = data.kategoriId || null
    const spesifikasiId = data.spesifikasiId || null
    const merkId = data.merkId || null
    
    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    }
    
    const existing = await rawGet('SELECT id FROM master_ingredient WHERE code = ? AND COALESCE(isdelete, 0) = 0', [code])
    if (existing) {
      return NextResponse.json({ error: 'Code already exists' }, { status: 400 })
    }
    
    const userId = getUserId(request)
    const result = await pool.query(`
      INSERT INTO master_ingredient (code, name, kategori_id, spesifikasi_id, merk_id, unit, hpp, stock_minimum, stock_current, user_create, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `, [code, name, kategoriId, spesifikasiId, merkId, unit, hpp, stockMinimum, stockCurrent, userId])
    
    const newIngredient = await rawGet(`
      SELECT 
        i.id, i.code, i.name, i.unit, i.hpp, i.stock_minimum, i.stock_current,
        i.kategori_id, k.name as kategori_name,
        i.spesifikasi_id, s.name as spesifikasi_name,
        i.merk_id, m.name as merk_name,
        i.isdelete, i.created_at, i.updated_at
      FROM master_ingredient i
      LEFT JOIN master_kategori k ON i.kategori_id = k.id
      LEFT JOIN master_spesifikasi s ON i.spesifikasi_id = s.id
      LEFT JOIN master_merk m ON i.merk_id = m.id
      WHERE i.id = ?
    `, [result.rows[0].id])
    
    return NextResponse.json(newIngredient)
  } catch (error) {
    console.error('Error creating ingredient:', error)
    return NextResponse.json({ error: 'Failed to create ingredient' }, { status: 500 })
  }
}
