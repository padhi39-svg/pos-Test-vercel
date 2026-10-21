import { NextRequest, NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'
import { getLabaRugi } from '@/lib/repositories/accounting'

const rupiah = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_laba_rugi', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const periodId = url.searchParams.get('periodId')

    let startDate = ''
    let endDate = ''
    let periodLabel = ''

    if (periodId) {
      const period = await rawGet<any>('SELECT id, name, start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0', [Number(periodId)])
      if (period) {
        startDate = period.start_date
        endDate = period.end_date
        periodLabel = `${period.name} (${period.start_date} s.d ${period.end_date})`
      }
    }

    const data = await getLabaRugi(startDate, endDate)

    const XLSX = (await import('xlsx')).default
    const wb = XLSX.utils.book_new()

    const rows: any[][] = []
    rows.push(['LAPORAN LABA RUGI', '', ''])
    rows.push([`Periode: ${periodLabel}`, '', ''])
    rows.push([])

    const sections: { title: string; items: { code: string; name: string; balance: number }[]; total: number }[] = [
      { title: 'PENDAPATAN', items: data.pendapatan.akun, total: data.pendapatan.total },
      { title: 'HARGA POKOK PENJUALAN', items: data.harga_pokok_penjualan.akun, total: data.harga_pokok_penjualan.total },
    ]

    for (const sec of sections) {
      rows.push([sec.title.toUpperCase(), '', ''])
      rows.push(['KODE', 'AKUN', 'JUMLAH (Rp)'])
      for (const item of sec.items) {
        if (item.balance !== 0) {
          rows.push([item.code, item.name, rupiah(item.balance)])
        }
      }
      rows.push(['', 'Total ' + sec.title.toLowerCase(), rupiah(sec.total)])
      rows.push([])
    }

    rows.push(['LABA KOTOR', '', rupiah(data.laba_kotor)])
    rows.push([])

    const bebanSections: { title: string; items: { code: string; name: string; balance: number }[]; total: number }[] = [
      { title: 'BEBAN OPERASIONAL', items: data.beban.akun, total: data.beban.total },
      { title: 'BEBAN LAIN-LAIN', items: data.beban_lain.akun, total: data.beban_lain.total },
    ]

    for (const sec of bebanSections) {
      rows.push([sec.title.toUpperCase(), '', ''])
      rows.push(['KODE', 'AKUN', 'JUMLAH (Rp)'])
      for (const item of sec.items) {
        if (item.balance !== 0) {
          rows.push([item.code, item.name, rupiah(item.balance)])
        }
      }
      rows.push(['', 'Total ' + sec.title.toLowerCase(), rupiah(sec.total)])
      rows.push([])
    }

    rows.push(['LABA (RUGI) BERSIH', '', rupiah(data.laba_bersih)])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 50 }, { wch: 24 }]
    XLSX.utils.book_append_sheet(wb, ws, 'LabaRugi')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="LabaRugi-${endDate || 'report'}.xlsx"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
