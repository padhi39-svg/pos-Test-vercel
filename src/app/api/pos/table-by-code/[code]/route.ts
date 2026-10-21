import { NextRequest, NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  try {
    const code = String(params.code || '').trim()
    if (!code) {
      return NextResponse.json({ error: 'Kode meja wajib diisi' }, { status: 400 })
    }

    const row = (await rawGet(
      `SELECT m.id, m.code, m.name, m.floor_id, m.capacity, f.name as floor_name, f.code as floor_code
       FROM master_meja m
       LEFT JOIN floors f ON f.id = m.floor_id
       WHERE UPPER(m.code) = UPPER(?) AND COALESCE(m.isdelete,0) = 0 AND COALESCE(m.is_active,1) = 1`,
      [code],
    )) as any

    if (!row) {
      return NextResponse.json({ error: 'Meja tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({
      id: Number(row.id),
      code: row.code,
      name: row.name,
      floorId: row.floor_id != null ? Number(row.floor_id) : null,
      floorName: row.floor_name || null,
      floorCode: row.floor_code || null,
      capacity: row.capacity != null ? Number(row.capacity) : null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengambil data meja' }, { status: 500 })
  }
}
