import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req, 'reservasi_booking', 'create') && !hasPermission(req, 'reservasi_booking', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat menu pre-order' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()

    const wheres: string[] = [
      'COALESCE(b.isdelete,0) = 0',
      'COALESCE(b.aktif,1) = 1',
      'COALESCE(b.tampil_menu,1) = 1',
    ]
    const params: any[] = []
    let paramIdx = 1
    if (q) {
      wheres.push(`(LOWER(b.name) LIKE $${paramIdx} OR LOWER(b.code) LIKE $${paramIdx + 1})`)
      params.push(`%${q}%`, `%${q}%`)
      paramIdx += 2
    }

    const sql = `
      SELECT 
        b.id, b.code, b.name, b.hpp, b.jenis, b.aktif, b.tampil_menu, b.photo_url,
        b.kategori_id, k.name as kategori_name
      FROM master_barang b
      LEFT JOIN master_kategori k ON b.kategori_id = k.id
      ${wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''}
      ORDER BY b.name ASC
      LIMIT 200
    `

    const rows = await rawAll<any>(sql, params.length > 0 ? params : undefined)

    const result = rows.map((item: any) => {
      const units = rawAll<any>('SELECT id, name, ratio FROM barang_units WHERE barang_id = $1 ORDER BY ratio ASC', [item.id])
      const allPrices = rawAll<any>(
        `SELECT unit_id, price, effective_date 
         FROM barang_prices 
         WHERE barang_id = $1 
           AND effective_date::timestamp <= NOW()
         ORDER BY effective_date DESC`,
        [item.id]
      )
      return { item, unitsP: units, pricesP: allPrices }
    })

    const resolved = await Promise.all(result.map(async (r) => {
      const units = await r.unitsP
      const baseUnitId = units[0]?.id || null
      const allPrices = await r.pricesP
      const latestBase = baseUnitId ? allPrices.find((p: any) => Number(p.unit_id) === Number(baseUnitId)) : null
      const other = allPrices.filter((p: any) => !latestBase || p !== latestBase)
      const prices = latestBase ? [latestBase, ...other] : other

      return {
        id: r.item.id,
        code: r.item.code,
        name: r.item.name,
        photoUrl: r.item.photo_url || null,
        kategoriId: r.item.kategori_id,
        kategoriName: r.item.kategori_name,
        hpp: r.item.hpp,
        jenis: r.item.jenis,
        aktif: Boolean(r.item.aktif),
        tampilMenu: Boolean(r.item.tampil_menu),
        units: units.map((u: any) => ({ id: u.id, name: u.name, ratio: u.ratio })),
        prices: prices.map((p: any) => ({ unit_id: p.unit_id, price: p.price, effectiveDate: p.effective_date })),
      }
    }))

    return NextResponse.json(resolved)
  } catch (e:any) {
    console.error('Error fetching preorder menus:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch preorder menus' }, { status: 500 })
  }
}
