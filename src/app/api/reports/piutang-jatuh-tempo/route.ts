import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getPiutangJatuhTempo } from '@/lib/repositories/ar-reports'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_kartu_piutang', 'view') && !hasPermission(req as any, 'keu_buku_besar', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const result = await getPiutangJatuhTempo(
      url.searchParams.get('startDate') || undefined,
      url.searchParams.get('endDate') || undefined,
      url.searchParams.get('customerId') || undefined
    )
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error piutang jatuh tempo:', error)
    return NextResponse.json({ error: 'Gagal memuat laporan', details: error.message }, { status: 500 })
  }
}
