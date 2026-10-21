import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'gudang', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat gudang' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const sortBy = searchParams.get('sort_by') || 'code'
    const sortDir = (searchParams.get('sort_dir') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 20))

    const allowedSort: Record<string, string> = { code: 'code', name: 'name' }
    const orderCol = allowedSort[sortBy] || 'code'

    const wheres: string[] = ['isdelete = 0']
    const params: any[] = []
    if (q) {
      wheres.push('(LOWER(name) LIKE ? OR LOWER(code) LIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }

    const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''
    const offset = (page - 1) * pageSize

    const countResult = await rawGet<any>(
      `SELECT COUNT(*) as total FROM master_gudang ${whereClause}`,
      params.length > 0 ? params : undefined
    )
    const total = Number(countResult?.total || 0)

    const rows = await rawAll<any>(
      `SELECT * FROM master_gudang ${whereClause} ORDER BY ${orderCol} ${sortDir} LIMIT ? OFFSET ?`,
      params.length > 0 ? [...params, pageSize, offset] : [pageSize, offset]
    )

    return NextResponse.json({ rows, total, page, pageSize })
  } catch (error: any) {
    console.error('Error fetching gudang:', error)
    return NextResponse.json({ error: 'Failed to fetch gudang', details: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'gudang', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat gudang' }, { status: 403 })
    }
    const body = await request.json()
    const { code, name, is_active } = body

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    }

    const db = getDb(); const pool = (db as any).$client

    const existing = await rawGet('SELECT id FROM master_gudang WHERE code = ? AND isdelete = 0', [code.toUpperCase()])
    if (existing) {
      return NextResponse.json({ error: 'Kode gudang sudah digunakan' }, { status: 400 })
    }

    const userId = getUserId(request)
    const result = await pool.query(`
      INSERT INTO master_gudang (code, name, is_active, isdelete, created_at, updated_at, user_create)
      VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4)
      RETURNING id
    `, [code.toUpperCase(), name, is_active ?? 1, userId])

    return NextResponse.json({ 
      success: true, 
      id: result.rows[0].id,
      message: 'Gudang berhasil ditambahkan' 
    })
  } catch (error: any) {
    console.error('Error creating gudang:', error)
    return NextResponse.json({ error: 'Failed to create gudang', details: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'gudang', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah gudang' }, { status: 403 })
    }
    const body = await request.json()
    const { id, name, is_active } = body

    if (!id || !name) {
      return NextResponse.json({ error: 'ID and name are required' }, { status: 400 })
    }

    const userId = getUserId(request)
    const result = await rawRun(`
      UPDATE master_gudang 
      SET name = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP, user_edit = ?
      WHERE id = ? AND isdelete = 0
    `, [name, is_active ?? 1, userId, id])

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Gudang tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Gudang berhasil diupdate' 
    })
  } catch (error: any) {
    console.error('Error updating gudang:', error)
    return NextResponse.json({ error: 'Failed to update gudang', details: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'gudang', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus gudang' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const userId = getUserId(request)
    const result = await rawRun(`
      UPDATE master_gudang 
      SET isdelete = 1, updated_at = CURRENT_TIMESTAMP, user_edit = ?
      WHERE id = ?
    `, [userId, id])

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Gudang tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Gudang berhasil dihapus' 
    })
  } catch (error: any) {
    console.error('Error deleting gudang:', error)
    return NextResponse.json({ error: 'Failed to delete gudang', details: error.message }, { status: 500 })
  }
}
