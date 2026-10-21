import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'
import { getAllowedJenisForRequest } from '@/lib/userJenis'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'ingredient', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses ingredient' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const allowedJenis = getAllowedJenisForRequest(req)

    const wheres: string[] = [
      'COALESCE(b.isdelete,0) = 0',
    ]
    const params: any[] = []
    if (q) {
      wheres.push('(LOWER(b.name) LIKE ? OR LOWER(b.code) LIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }
    if (Array.isArray(allowedJenis) && allowedJenis.length > 0) {
      const placeholders = allowedJenis.map(() => '?').join(',')
      wheres.push(`CAST(b.jenis AS INTEGER) IN (${placeholders})`)
      params.push(...allowedJenis)
    }

    const barangQuery = `
      SELECT 
        b.id, b.code, b.name, b.hpp, b.jenis, b.aktif, b.tampil_menu, b.photo_url, b.isdelete, b.created_at, b.updated_at,
        b.kategori_id, k.name as kategori_name,
        b.spesifikasi_id, s.name as spesifikasi_name,
        b.merk_id, m.name as merk_name
      FROM master_barang b
      LEFT JOIN master_kategori k ON b.kategori_id = k.id
      LEFT JOIN master_spesifikasi s ON b.spesifikasi_id = s.id
      LEFT JOIN master_merk m ON b.merk_id = m.id
      ${wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''}
      ORDER BY b.name ASC
    `
    const barang = await rawAll(barangQuery, params.length > 0 ? params : undefined) as any[]

    const result = await Promise.all(barang.map(async item => {
      const units = await rawAll('SELECT id, name, ratio FROM barang_units WHERE barang_id = ? ORDER BY ratio ASC', [item.id]) as any[]
      const baseUnitId = units[0]?.id || null
      const allPrices = await rawAll(`
        SELECT unit_id, price, effective_date 
        FROM barang_prices 
        WHERE barang_id = ? 
          AND effective_date <= CURRENT_TIMESTAMP
        ORDER BY effective_date DESC, id DESC
      `, [item.id]) as any[]
      const latestBase = baseUnitId ? allPrices.find(p => Number(p.unit_id) === Number(baseUnitId)) : null
      const other = allPrices.filter(p => !latestBase || p !== latestBase)
      const prices = latestBase ? [latestBase, ...other] : other

      return {
        id: item.id,
        code: item.code,
        name: item.name,
        photoUrl: item.photo_url || null,
        kategoriId: item.kategori_id,
        kategoriName: item.kategori_name,
        spesifikasiId: item.spesifikasi_id,
        spesifikasiName: item.spesifikasi_name,
        merkId: item.merk_id,
        merkName: item.merk_name,
        hpp: item.hpp,
        jenis: item.jenis,
        aktif: Boolean(item.aktif),
        tampilMenu: Boolean(item.tampil_menu),
        units: units.map(u => ({ id: u.id, name: u.name, ratio: u.ratio })),
        prices: prices.map(p => ({ unit_id: p.unit_id, price: p.price, effectiveDate: p.effective_date })),
        isdelete: Boolean(item.isdelete),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }
    }))

    return NextResponse.json(result)
  } catch (e:any) {
    console.error('Error fetching lookup barang for ingredient:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch' }, { status: 500 })
  }
}
