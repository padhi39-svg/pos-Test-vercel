import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request, 'master_paket', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const id = parseInt(params.id)

    const paket = await rawGet<any>('SELECT * FROM master_paket WHERE id = $1 AND COALESCE(isdelete,0) = 0', [id])
    if (!paket) {
      return NextResponse.json({ error: 'Paket not found' }, { status: 404 })
    }

    const detail = await rawAll<any>(
      `SELECT pd.id, pd.barang_id, pd.quantity,
        b.code as barang_code, b.name as barang_name, b.hpp
       FROM master_paket_detail pd
       JOIN master_barang b ON b.id = pd.barang_id
       WHERE pd.paket_id = $1`,
      [id]
    )

    const result = {
      id: paket.id,
      kode: paket.kode,
      nama: paket.nama,
      hargaJual: paket.harga_jual,
      aktif: Boolean(paket.aktif),
      items: detail.map((d: any) => ({
        id: d.id,
        barangId: d.barang_id,
        barangCode: d.barang_code,
        barangName: d.barang_name,
        hpp: d.hpp,
        quantity: d.quantity,
      })),
      createdAt: paket.created_at,
      updatedAt: paket.updated_at,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching paket:', error)
    return NextResponse.json({ error: 'Failed to fetch paket' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request, 'master_paket', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const data = await request.json()
    const db = getDb()
    const pool = (db as any).$client
    const id = parseInt(params.id)
    const userId = getUserId(request)

    const nama = (data.nama || '').trim()
    if (!nama) {
      return NextResponse.json({ error: 'Nama paket harus diisi' }, { status: 400 })
    }

    const existing = await rawGet<any>('SELECT id FROM master_paket WHERE id = $1 AND COALESCE(isdelete,0) = 0', [id])
    if (!existing) {
      return NextResponse.json({ error: 'Paket not found' }, { status: 404 })
    }

    const hargaJual = Number(data.hargaJual) || 0
    const aktif = data.aktif !== false
    const items = Array.isArray(data.items) ? data.items : []

    await pool.query('BEGIN')
    try {
      await pool.query(
        'UPDATE master_paket SET nama = $1, harga_jual = $2, aktif = $3, updated_at = CURRENT_TIMESTAMP, user_edit = $4 WHERE id = $5',
        [nama, hargaJual, aktif ? 1 : 0, userId, id]
      )

      await pool.query('DELETE FROM master_paket_detail WHERE paket_id = $1', [id])

      if (items.length > 0) {
        for (const it of items) {
          await pool.query('INSERT INTO master_paket_detail (paket_id, barang_id, quantity) VALUES ($1, $2, $3)',
            [id, it.barangId, Number(it.quantity) || 1])
        }
      }

      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ message: 'Paket updated successfully' })
  } catch (error) {
    console.error('Error updating paket:', error)
    return NextResponse.json({ error: (error as any)?.message || 'Failed to update paket' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request, 'master_paket', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const id = parseInt(params.id)
    const userId = getUserId(request)

    const result = await rawRun(
      'UPDATE master_paket SET isdelete = 1, updated_at = CURRENT_TIMESTAMP, user_edit = $1 WHERE id = $2 AND COALESCE(isdelete,0) = 0',
      [userId, id]
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Paket not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Paket deleted successfully' })
  } catch (error) {
    console.error('Error deleting paket:', error)
    return NextResponse.json({ error: 'Failed to delete paket' }, { status: 500 })
  }
}
