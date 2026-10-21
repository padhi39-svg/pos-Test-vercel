import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'harga', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const jenis = searchParams.get('jenis') || ''
    const status = searchParams.get('status') || ''
    const sortBy = searchParams.get('sort_by') || 'name'
    const sortDirRaw = searchParams.get('sort_dir') || 'asc'
    const sortDir = sortDirRaw === 'desc' ? 'DESC' : 'ASC'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))
    const offset = (page - 1) * limit

    const conditions: string[] = ['b.isdelete = 0']
    const params: any[] = []

    if (q) {
      conditions.push('(b.name ILIKE ? OR b.code ILIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }
    if (jenis) {
      conditions.push('b.jenis = ?')
      params.push(Number(jenis))
    }

    const baseSelect = `
      SELECT b.id, b.code, b.name, b.jenis,
        COALESCE(k.name, '-') as kategori_name,
        COUNT(DISTINCT u.id) as total_units,
        (SELECT COUNT(*) FROM barang_prices WHERE barang_id = b.id) as prices_set
      FROM master_barang b
      LEFT JOIN master_kategori k ON b.kategori_id = k.id
      LEFT JOIN barang_units u ON b.id = u.barang_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY b.id, b.code, b.name, b.jenis, k.name
    `

    const statusHasFilter = status === 'with-price' || status === 'without-price'

    let havingClause = ''
    let havingParams: any[] = []
    if (statusHasFilter) {
      havingClause = `HAVING ((? != 'with-price' OR prices_set > 0) AND (? != 'without-price' OR prices_set = 0))`
      havingParams = [status, status]
    }

    const sortMap: Record<string, string> = {
      name: 'b.name',
      code: 'b.code',
    }
    const orderCol = sortMap[sortBy] || 'b.name'

    const [countResult, rows] = await Promise.all([
      rawAll(`SELECT COUNT(*)::int as total FROM (${baseSelect} ${havingClause}) sub`, [...params, ...havingParams]),
      rawAll(`${baseSelect} ${havingClause} ORDER BY ${orderCol} ${sortDir} LIMIT ? OFFSET ?`, [...params, ...havingParams, limit, offset]),
    ])

    const total = Number((countResult as any[])[0]?.total || 0)

    const mapped = (rows as any[]).map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      jenis: r.jenis,
      kategoriName: r.kategori_name,
      totalUnits: r.total_units || 0,
      pricesSet: r.prices_set || 0,
    }))

    return NextResponse.json({ rows: mapped, total, page, pageSize: limit })
  } catch (error) {
    console.error('Error fetching harga:', error)
    return NextResponse.json({ error: 'Failed to fetch harga' }, { status: 500 })
  }
}
