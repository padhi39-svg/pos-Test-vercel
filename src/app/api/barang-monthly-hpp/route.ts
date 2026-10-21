import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const canView = hasPermission(request as any, 'sales_gross_profit', 'view') || hasPermission(request as any, 'sales_recap', 'view') || hasPermission(request as any, 'transaksi', 'view')
    if (!canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const url = new URL(request.url)
    const year = url.searchParams.get('year')
    const month = url.searchParams.get('month')
    const barangId = url.searchParams.get('barangId')

    if (!year || !month) return NextResponse.json({ error: 'year and month required' }, { status: 400 })

    let sql = `
      SELECT bm.*, b.name AS barang_name, b.hpp AS default_hpp
      FROM barang_monthly_hpp bm
      JOIN master_barang b ON b.id = bm.barang_id
      WHERE bm.year = ? AND bm.month = ?
    `
    const params: any[] = [Number(year), Number(month)]
    if (barangId) {
      sql += ` AND bm.barang_id = ?`
      params.push(Number(barangId))
    }
    sql += ` ORDER BY b.name ASC`

    const rows = await rawAll(sql, params) as any[]

    return NextResponse.json({ rows, year, month })
  } catch (e: any) {
    console.error('Error barang-monthly-hpp GET:', e)
    return NextResponse.json({ error: 'Failed', details: e?.message }, { status: 500 })
  }
}
