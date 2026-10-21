import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const kategoriId = searchParams.get('kategori_id')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))
    const offset = (page - 1) * limit

    const q = (searchParams.get('q') || '').trim().toLowerCase()

    const wheres: string[] = [
      'COALESCE(b.isdelete,0) = 0',
      'COALESCE(b.aktif,1) = 1',
      'COALESCE(b.tampil_menu,1) = 1',
    ]
    const params: any[] = []
    if (kategoriId) {
      wheres.push('b.kategori_id = $' + (params.length + 1))
      params.push(Number(kategoriId))
    }
    if (q) {
      wheres.push(`(LOWER(b.name) LIKE $${params.length + 1} OR LOWER(b.code) LIKE $${params.length + 2})`)
      params.push(`%${q}%`, `%${q}%`)
    }

    const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''

    const countSql = `SELECT COUNT(*) as total FROM master_barang b ${whereClause}`
    const countResult = (await rawAll(countSql, params.length > 0 ? params : undefined)) as any[]
    const total = Number(countResult[0]?.total || 0)

    const dataSql = `
      SELECT b.id, b.code, b.name, b.photo_url, b.kategori_id, k.name as kategori_name
      FROM master_barang b
      LEFT JOIN master_kategori k ON b.kategori_id = k.id
      ${whereClause}
      ORDER BY b.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `
    const rows = (await rawAll(dataSql, params.length > 0 ? params : undefined)) as any[]

    const result = await Promise.all(
      rows.map(async (item) => {
        const units = (await rawAll(
          'SELECT id, name, ratio FROM barang_units WHERE barang_id = $1 ORDER BY ratio ASC',
          [item.id],
        )) as any[]
        const baseUnitId = units[0]?.id || null

        const allPrices = (await rawAll(
          `SELECT unit_id, price, effective_date
           FROM barang_prices
           WHERE barang_id = $1
             AND effective_date <= CURRENT_DATE
           ORDER BY effective_date DESC, id DESC`,
          [item.id],
        )) as any[]

        const latestBase = baseUnitId ? allPrices.find((p) => Number(p.unit_id) === Number(baseUnitId)) : null
        const other = allPrices.filter((p) => !latestBase || p !== latestBase)
        const prices = latestBase ? [latestBase, ...other] : other
        const basePrice = prices[0] ? Number(prices[0].price) : 0

        return {
          id: Number(item.id),
          code: item.code,
          name: item.name,
          photoUrl: item.photo_url || null,
          kategoriId: item.kategori_id != null ? Number(item.kategori_id) : null,
          kategoriName: item.kategori_name,
          price: basePrice,
        }
      }),
    )

    return NextResponse.json({ items: result, total, page, pageSize: limit })
  } catch (e: any) {
    console.error('Error fetching self-order products:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch products' }, { status: 500 })
  }
}
