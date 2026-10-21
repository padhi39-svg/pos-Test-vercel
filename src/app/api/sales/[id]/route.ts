import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const row = await rawGet<any>(
      'SELECT * FROM master_sales WHERE id = $1 AND COALESCE(isdelete, 0) = 0',
      [id]
    )

    if (!row) {
      return NextResponse.json({ error: 'Sales not found' }, { status: 404 })
    }

    return NextResponse.json(row)
  } catch (e: any) {
    console.error('GET /api/sales/[id] error:', e)
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await req.json()

    let name = (body.name || '').toString().trim()
    if (!name) {
      return NextResponse.json({ error: 'Nama sales wajib diisi' }, { status: 400 })
    }

    const userId = body.user_id ? Number(body.user_id) : null
    const phone = (body.phone || '').toString().trim()
    const email = (body.email || '').toString().trim()
    const ktp = (body.ktp || '').toString().trim()
    const aktif = body.aktif === 0 || body.aktif === false ? 0 : 1

    const result = await rawRun(
      `UPDATE master_sales
       SET name = $1, user_id = $2, phone = $3, email = $4, ktp = $5, aktif = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND COALESCE(isdelete, 0) = 0`,
      [name, userId, phone, email, ktp, aktif, id]
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Sales not found' }, { status: 404 })
    }

    const updated = await rawGet<any>('SELECT * FROM master_sales WHERE id = $1', [id])
    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('PUT /api/sales/[id] error:', e)
    return NextResponse.json({ error: 'Failed to update sales' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)

    const result = await rawRun(
      `UPDATE master_sales
       SET isdelete = 1, aktif = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND COALESCE(isdelete, 0) = 0`,
      [id]
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Sales not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Sales deleted successfully' })
  } catch (e: any) {
    console.error('DELETE /api/sales/[id] error:', e)
    return NextResponse.json({ error: 'Failed to delete sales' }, { status: 500 })
  }
}
