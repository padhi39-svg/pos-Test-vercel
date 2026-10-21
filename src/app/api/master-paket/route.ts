import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req, 'master_paket', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const sortBy = searchParams.get('sort_by') || 'kode'
    const sortDir = (searchParams.get('sort_dir') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 20))

    const allowedSort: Record<string, string> = { kode: 'p.kode', nama: 'p.nama', hargaJual: 'p.harga_jual', createdAt: 'p.created_at' }
    const orderCol = allowedSort[sortBy] || 'p.kode'

    const wheres: string[] = ['COALESCE(p.isdelete,0) = 0']
    const params: any[] = []
    if (q) {
      wheres.push('(LOWER(p.nama) LIKE ? OR LOWER(p.kode) LIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }

    const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''
    const offset = (page - 1) * pageSize

    const countResult = await rawGet<any>(
      `SELECT COUNT(*) as total FROM master_paket p ${whereClause}`,
      params.length > 0 ? params : undefined
    )
    const total = Number(countResult?.total || 0)

    const rows = await rawAll<any>(
      `SELECT p.*,
        (SELECT COUNT(*) FROM master_paket_detail pd WHERE pd.paket_id = p.id) as item_count
       FROM master_paket p
       ${whereClause}
       ORDER BY ${orderCol} ${sortDir}
       LIMIT ? OFFSET ?`,
      params.length > 0 ? [...params, pageSize, offset] : [pageSize, offset]
    )

    const result = rows.map((r: any) => ({
      id: r.id,
      kode: r.kode,
      nama: r.nama,
      hargaJual: r.harga_jual,
      aktif: Boolean(r.aktif),
      itemCount: r.item_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))

    return NextResponse.json({ rows: result, total, page, pageSize })
  } catch (error) {
    console.error('Error fetching paket:', error)
    return NextResponse.json({ error: 'Failed to fetch paket' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request, 'master_paket', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const data = await request.json()
    const db = getDb()
    const pool = (db as any).$client
    const userId = getUserId(request)

    const kode = (data.kode || '').trim().toUpperCase()
    const nama = (data.nama || '').trim()
    const hargaJual = Number(data.hargaJual) || 0
    const aktif = data.aktif !== false
    const items = Array.isArray(data.items) ? data.items : []

    if (!nama) {
      return NextResponse.json({ error: 'Nama paket harus diisi' }, { status: 400 })
    }

    let finalKode = kode
    if (!finalKode) {
      const count = await rawGet<any>('SELECT COUNT(*) as c FROM master_paket')
      const nextId = (count?.c || 0) + 1
      finalKode = `PKT-${String(nextId).padStart(3, '0')}`
    }

    await pool.query('BEGIN')
    try {
      const result = await pool.query(
        `INSERT INTO master_paket (kode, nama, harga_jual, aktif, user_create)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [finalKode, nama, hargaJual, aktif ? 1 : 0, userId]
      )
      const paketId = Number(result.rows[0].id)

      if (items.length > 0) {
        for (const it of items) {
          await pool.query('INSERT INTO master_paket_detail (paket_id, barang_id, quantity) VALUES ($1, $2, $3)',
            [paketId, it.barangId, Number(it.quantity) || 1])
        }
      }

      await pool.query('COMMIT')
      return NextResponse.json({ id: paketId, kode: finalKode, message: 'Paket created successfully' })
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (error) {
    console.error('Error creating paket:', error)
    return NextResponse.json({ error: (error as any)?.message || 'Failed to create paket' }, { status: 500 })
  }
}
