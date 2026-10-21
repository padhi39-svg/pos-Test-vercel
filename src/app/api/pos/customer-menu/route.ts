import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const pool = (getDb() as any).$client
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()

    const wheres: string[] = [
      'COALESCE(b.isdelete,0) = 0',
      'COALESCE(b.aktif,1) = 1',
      'COALESCE(b.tampil_menu,1) = 1',
    ]
    const params: any[] = []
    if (q) {
      wheres.push('(LOWER(b.name) LIKE ? OR LOWER(b.code) LIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }

    const sql = `
      SELECT
        b.id, b.code, b.name, b.jenis, b.aktif, b.tampil_menu, b.photo_url,
        b.kategori_id, k.name as kategori_name
      FROM master_barang b
      LEFT JOIN master_kategori k ON b.kategori_id = k.id
      ${wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''}
      ORDER BY b.name ASC
      LIMIT 500
    `

    const rows = (await rawAll(sql, params.length > 0 ? params : undefined)) as any[]

    const result = await Promise.all(
      rows.map(async (item) => {
        const units = (await rawAll('SELECT id, name, ratio FROM barang_units WHERE barang_id = ? ORDER BY ratio ASC', [item.id])) as any[]
        const baseUnitId = units[0]?.id || null

        const allPrices = (await rawAll(
          `SELECT unit_id, price, effective_date
           FROM barang_prices
           WHERE barang_id = ?
             AND effective_date <= CURRENT_DATE
           ORDER BY effective_date DESC, id DESC`,
          [item.id],
        )) as any[]

        const latestBase = baseUnitId ? allPrices.find((p) => Number(p.unit_id) === Number(baseUnitId)) : null
        const other = allPrices.filter((p) => !latestBase || p !== latestBase)
        const prices = latestBase ? [latestBase, ...other] : other

        return {
          id: Number(item.id),
          code: item.code,
          name: item.name,
          photoUrl: item.photo_url || null,
          kategoriId: item.kategori_id != null ? Number(item.kategori_id) : null,
          kategoriName: item.kategori_name,
          jenis: Number(item.jenis),
          aktif: Boolean(item.aktif),
          tampilMenu: Boolean(item.tampil_menu),
          units: units.map((u) => ({ id: Number(u.id), name: u.name, ratio: Number(u.ratio) })),
          prices: prices.map((p) => ({
            unit_id: p.unit_id != null ? Number(p.unit_id) : null,
            price: Number(p.price),
            effectiveDate: p.effective_date,
          })),
        }
      }),
    )

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Error fetching customer menu:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch menu' }, { status: 500 })
  }
}
