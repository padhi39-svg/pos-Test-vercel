import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const row = await rawGet<any>(
      `SELECT s.*, jc.name as jenis_customer_name
       FROM master_season_discount s
       LEFT JOIN master_jenis_customer jc ON jc.id = s.jenis_customer_id
       WHERE s.id = $1 AND COALESCE(s.isdelete, 0) = 0`,
      [id]
    )
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const items = await rawAll<any>(
      `SELECT i.*, b.name as barang_name, b.code as barang_code
       FROM master_season_discount_items i
       LEFT JOIN master_barang b ON b.id = i.barang_id
       WHERE i.season_discount_id = $1`,
      [id]
    )
    row.items = items

    return NextResponse.json(row)
  } catch (e: any) {
    console.error('GET /api/season-discount/[id] error:', e)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await req.json()
    const name = (body.name || '').toString().trim()
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })

    const db = getDb()
    const pool = (db as any).$client

    const result = await pool.query(
      `UPDATE master_season_discount
       SET name = $1, jenis_customer_id = $2, start_date = $3, end_date = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND COALESCE(isdelete, 0) = 0`,
      [name, Number(body.jenis_customer_id), body.start_date, body.end_date, body.is_active === false || body.is_active === 0 ? 0 : 1, id]
    )

    if (result.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Replace items: delete existing, insert new
    await pool.query('DELETE FROM master_season_discount_items WHERE season_discount_id = $1', [id])

    if (Array.isArray(body.items)) {
      for (const item of body.items) {
        await pool.query(
          `INSERT INTO master_season_discount_items (season_discount_id, barang_id, discount_type, discount_value)
           VALUES ($1, $2, $3, $4)`,
          [id, item.barang_id ? Number(item.barang_id) : null, item.discount_type || 'disc1', Number(item.discount_value) || 0]
        )
      }
    }

    return NextResponse.json({ message: 'Updated' })
  } catch (e: any) {
    console.error('PUT /api/season-discount/[id] error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const result = await rawRun(
      'UPDATE master_season_discount SET isdelete = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND COALESCE(isdelete, 0) = 0',
      [id]
    )
    if (result.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (e: any) {
    console.error('DELETE /api/season-discount/[id] error:', e)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
