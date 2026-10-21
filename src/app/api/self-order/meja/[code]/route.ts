import { NextRequest, NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    if (!code) {
      return NextResponse.json({ error: 'Kode meja wajib diisi' }, { status: 400 })
    }

    const row = (await rawGet(
      `SELECT m.id, m.code, m.name
       FROM master_meja m
       WHERE UPPER(m.code) = UPPER($1) AND COALESCE(m.isdelete,0) = 0 AND COALESCE(m.is_active,1) = 1`,
      [code],
    )) as any

    if (!row) {
      return NextResponse.json({ error: 'Meja tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ id: Number(row.id), code: row.code, name: row.name })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengambil data meja' }, { status: 500 })
  }
}
