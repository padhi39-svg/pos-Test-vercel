import { NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sql = `
      SELECT DISTINCT k.id, k.name
      FROM master_kategori k
      INNER JOIN master_barang b ON b.kategori_id = k.id
      WHERE COALESCE(k.isdelete, 0) = 0
        AND COALESCE(b.isdelete, 0) = 0
        AND COALESCE(b.aktif, 1) = 1
        AND COALESCE(b.tampil_menu, 1) = 1
      ORDER BY k.name ASC
    `
    const rows = (await rawAll(sql)) as any[]
    const categories = rows.map((r) => ({ id: Number(r.id), name: r.name }))
    return NextResponse.json(categories)
  } catch (e: any) {
    console.error('Error fetching self-order categories:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch categories' }, { status: 500 })
  }
}
