import { NextRequest, NextResponse } from 'next/server'
import { rawGet, rawRun } from '@/db/raw'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const row = await rawGet<any>('SELECT * FROM master_jenis_customer WHERE id = $1 AND COALESCE(isdelete, 0) = 0', [id])
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e: any) {
    console.error('GET /api/jenis-customer/[id] error:', e)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await req.json()
    const name = (body.name || '').toString().trim()
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })

    const result = await rawRun(
      'UPDATE master_jenis_customer SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND COALESCE(isdelete, 0) = 0',
      [name, id]
    )
    if (result.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ message: 'Updated' })
  } catch (e: any) {
    console.error('PUT /api/jenis-customer/[id] error:', e)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const result = await rawRun(
      'UPDATE master_jenis_customer SET isdelete = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND COALESCE(isdelete, 0) = 0',
      [id]
    )
    if (result.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (e: any) {
    console.error('DELETE /api/jenis-customer/[id] error:', e)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
