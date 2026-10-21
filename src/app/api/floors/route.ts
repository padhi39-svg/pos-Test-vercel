import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getDb } from '@/db'
import { rawRun, rawGet, rawAll } from '@/db/raw'
import { floors as floorTable } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req, 'lantai', 'view') && !hasPermission(req, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat lantai' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const sortBy = searchParams.get('sort_by') || 'name'
    const sortDir = (searchParams.get('sort_dir') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 20))

    const allowedSort: Record<string, string> = { code: 'code', name: 'name', levelNo: 'level_no', isActive: 'is_active' }
    const orderCol = allowedSort[sortBy] || 'name'

    const wheres: string[] = ['COALESCE(isdelete,0) = 0']
    const params: any[] = []
    if (q) {
      wheres.push('(LOWER(code) LIKE ? OR LOWER(name) LIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }
    const active = searchParams.get('active')
    if (active === '1') {
      wheres.push('is_active = 1')
    }

    const whereClause = `WHERE ${wheres.join(' AND ')}`
    const offset = (page - 1) * pageSize

    const countResult = await rawGet<any>(
      `SELECT COUNT(*) as total FROM floors ${whereClause}`,
      params.length > 0 ? params : undefined
    )
    const total = Number(countResult?.total || 0)

    const rows = await rawAll<any>(
      `SELECT * FROM floors ${whereClause} ORDER BY ${orderCol} ${sortDir} LIMIT ? OFFSET ?`,
      params.length > 0 ? [...params, pageSize, offset] : [pageSize, offset]
    )

    const result = rows.map((r: any) => ({
      id: Number(r.id),
      code: r.code,
      name: r.name,
      levelNo: r.level_no != null ? Number(r.level_no) : null,
      isActive: Number(r.is_active),
      isdelete: Number(r.isdelete),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))

    return NextResponse.json({ rows: result, total, page, pageSize })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengambil data lantai' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req, 'lantai', 'create') && !hasPermission(req, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat lantai' }, { status: 403 })
    }
    const body = await req.json().catch(()=>({})) as any
    let { code, name, level_no, is_active } = body
    code = String(code || '').trim().toUpperCase()
    name = String(name || '').trim()
    const levelNo = level_no != null ? Number(level_no) : null
    const isActive = is_active === 0 || is_active === false ? 0 : 1

    if (!code) return NextResponse.json({ error: 'Kode wajib diisi' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })

    const db = getDb()
    const dup = await db.select({ id: floorTable.id }).from(floorTable)
      .where(and(eq(floorTable.code, code), eq(floorTable.isdelete, 0)))
      .limit(1)
      .then(r => r[0] ?? null)
    if (dup) return NextResponse.json({ error: 'Kode sudah digunakan' }, { status: 400 })

    const userId = getUserId(req)
    const result = await db.execute(sql`
      INSERT INTO floors (code, name, level_no, is_active, user_create, created_at, updated_at)
      VALUES (${code}, ${name}, ${levelNo}, ${isActive}, ${userId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `)
    const created = result.rows[0]

    return NextResponse.json(created)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan lantai' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!hasPermission(req, 'lantai', 'edit') && !hasPermission(req, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah lantai' }, { status: 403 })
    }
    const body = await req.json().catch(()=>({})) as any
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    let { code, name, level_no, is_active } = body
    code = code != null ? String(code).trim().toUpperCase() : undefined
    name = name != null ? String(name).trim() : undefined
    const levelNo = level_no != null ? Number(level_no) : undefined
    const isActive = is_active != null ? (is_active === 0 || is_active === false ? 0 : 1) : undefined

    const exists = await rawGet<any>('SELECT * FROM floors WHERE id=? AND COALESCE(isdelete,0)=0', [id])
    if (!exists) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

    if (code) {
      const dup = await rawGet<any>('SELECT id FROM floors WHERE code=? AND id<>? AND COALESCE(isdelete,0)=0 LIMIT 1', [code, id])
      if (dup) return NextResponse.json({ error: 'Kode sudah digunakan' }, { status: 400 })
    }

    const setClauses: string[] = []
    const params: any[] = []
    if (code !== undefined) { setClauses.push('code=?'); params.push(code) }
    if (name !== undefined) { setClauses.push('name=?'); params.push(name) }
    if (levelNo !== undefined) { setClauses.push('level_no=?'); params.push(levelNo) }
    if (isActive !== undefined) { setClauses.push('is_active=?'); params.push(isActive) }

    if (setClauses.length === 0) return NextResponse.json(exists)

    const userId = getUserId(req)
    setClauses.push('user_edit=?')
    params.push(userId)
    params.push(id)
    await rawRun(`UPDATE floors SET ${setClauses.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`, params)
    const updated = await rawGet<any>('SELECT * FROM floors WHERE id=?', [id])
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengubah lantai' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!hasPermission(req, 'lantai', 'delete') && !hasPermission(req, 'transaksi', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus lantai' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const id = Number(searchParams.get('id'))
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const exists = await rawGet<any>('SELECT id FROM floors WHERE id=? AND COALESCE(isdelete,0)=0', [id])
    if (!exists) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

    const userId = getUserId(req)
    await rawRun('UPDATE floors SET isdelete=1, updated_at=CURRENT_TIMESTAMP, user_edit=? WHERE id=?', [userId, id])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal menghapus lantai' }, { status: 500 })
  }
}
