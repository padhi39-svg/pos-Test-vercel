import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year')) || new Date().getFullYear()
    const month = Number(searchParams.get('month')) || (new Date().getMonth() + 1)

    const rows = await rawAll(`SELECT barang_id, hpp, avg_cost FROM barang_monthly_hpp WHERE year = ? AND month = ?`, [year, month]) as any[]

    return NextResponse.json(rows)
  } catch (e: any) {
    console.error('GET /api/barang-hpp error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to load HPP' }, { status: 500 })
  }
}
