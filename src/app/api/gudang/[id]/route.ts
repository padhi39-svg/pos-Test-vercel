import { NextRequest, NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await rawGet(`
      SELECT * FROM master_gudang 
      WHERE id = ? AND isdelete = 0
    `, [params.id])

    if (!row) {
      return NextResponse.json({ error: 'Gudang tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(row)
  } catch (error: any) {
    console.error('Error fetching gudang:', error)
    return NextResponse.json({ error: 'Failed to fetch gudang', details: error.message }, { status: 500 })
  }
}
