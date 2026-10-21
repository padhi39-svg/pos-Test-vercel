import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getHutangJatuhTempo } from '@/lib/repositories/ap-reports'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_kartu_hutang', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const result = await getHutangJatuhTempo(
      url.searchParams.get('startDate') || undefined,
      url.searchParams.get('endDate') || undefined,
      url.searchParams.get('supplierId') || undefined
    )
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error hutang jatuh tempo:', error)
    return NextResponse.json({ error: 'Gagal memuat laporan', details: error.message }, { status: 500 })
  }
}
