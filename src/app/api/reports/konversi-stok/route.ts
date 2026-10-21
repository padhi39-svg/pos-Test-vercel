import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getKonversiStok, getKonversiStokMeta } from '@/lib/repositories/stock-reports'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'konversi_stok', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')

    if (mode === 'meta') {
      const meta = await getKonversiStokMeta()
      return NextResponse.json(meta)
    }

    const rows = await getKonversiStok(
      searchParams.get('tanggalAwal') || undefined,
      searchParams.get('tanggalAkhir') || undefined,
      Number(searchParams.get('barangId') || 0) || null,
      Number(searchParams.get('gudangId') || 0) || null,
      searchParams.get('status') || undefined
    )
    return NextResponse.json({ rows })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
