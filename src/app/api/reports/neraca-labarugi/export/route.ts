import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawGet } from '@/db/raw'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_neraca_labarugi', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const pool = (getDb() as any).$client
    const url = new URL(req.url)
    const periodId = url.searchParams.get('periodId')
    if (!periodId) {
      return NextResponse.json({ error: 'periodId required' }, { status: 400 })
    }

    const period = await rawGet<any>('SELECT start_date, end_date, name FROM master_periode WHERE id = $1 AND isdelete = 0', [Number(periodId)])
    if (!period) {
      return NextResponse.json({ error: 'Periode not found' }, { status: 404 })
    }

    const { default: XLSX } = await import('xlsx')

    const apiUrl = new URL(req.url)
    apiUrl.pathname = '/api/reports/neraca-labarugi'
    const res = await fetch(apiUrl.toString())
    const json = await res.json()
    const n = json.neraca
    const lr = json.laba_rugi

    const wb = XLSX.utils.book_new()

    const neracaRows: any[][] = []
    neracaRows.push(['NERACA'])
    neracaRows.push([`Periode: ${period.name} (${period.start_date} s.d ${period.end_date})`])
    neracaRows.push([])

    const addNeracaSection = (title: string, items: any[], total: number) => {
      neracaRows.push([title])
      const childrenOf = (parentId: number | null) => items.filter(a => a.parent_id === parentId)
      const roots = items.filter((a: any) => a.parent_id === null && a.level <= 1)
      const walk = (list: any[], depth: number) => {
        for (const a of list) {
          const kids = childrenOf(a.id)
          const isH = a.is_header === 1
          const indent = depth === 0 ? '' : '  '.repeat(depth)
          const label = a.code ? `${a.code} - ${a.name}` : a.name
          const showVal = !(isH && depth === 0)
          neracaRows.push([`${indent}${label}`, showVal ? a.balance : ''])
          if (kids.length > 0) walk(kids, depth + 1)
        }
      }
      walk(roots, 0)
      if (title === 'EKUITAS') {
        neracaRows.push(['  Laba Periode Berjalan', n.laba_periode_berjalan])
      }
      neracaRows.push(['Total ' + title.charAt(0).toUpperCase() + title.slice(1).toLowerCase(), total])
      neracaRows.push([])
    }

    addNeracaSection('ASET', n.aset.akun, n.aset.total)
    addNeracaSection('KEWAJIBAN', n.kewajiban.akun, n.kewajiban.total)
    addNeracaSection('EKUITAS', n.ekuitas.akun, n.ekuitas.total + n.laba_periode_berjalan)
    neracaRows.push(['Total Aset', n.total_aset])
    neracaRows.push(['Total Pasiva (Kewajiban + Ekuitas + Laba)', n.total_kewajiban_ekuitas + n.laba_periode_berjalan])
    neracaRows.push(['Selisih', n.selisih !== 0 ? n.selisih : 0])

    const wsNeraca = XLSX.utils.aoa_to_sheet(neracaRows)
    wsNeraca['!cols'] = [{ wch: 60 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsNeraca, 'NERACA')

    const lrRows: any[][] = []
    lrRows.push(['LABA RUGI'])
    lrRows.push([`Periode: ${period.name} (${period.start_date} s.d ${period.end_date})`])
    lrRows.push([])

    const addLrSection = (title: string, items: any[], total: number | null) => {
      lrRows.push([title])
      if (items.length === 0) {
        lrRows.push(['  (Tidak ada transaksi)'])
      } else {
        for (const a of items) {
          lrRows.push([`  ${a.code} - ${a.name}`, a.balance])
        }
      }
      if (total !== null) {
        lrRows.push(['Total ' + title.charAt(0).toUpperCase() + title.slice(1).toLowerCase(), total])
        lrRows.push([])
      }
    }

    addLrSection('PENDAPATAN', lr.pendapatan.akun, lr.pendapatan.total)
    addLrSection('HARGA POKOK PENJUALAN', lr.harga_pokok_penjualan.akun, lr.harga_pokok_penjualan.total)
    lrRows.push(['Laba Kotor', lr.laba_kotor])
    lrRows.push([])
    addLrSection('BEBAN', lr.beban.akun, lr.beban.total)
    addLrSection('BEBAN LAIN-LAIN', lr.beban_lain.akun, lr.beban_lain.total)
    lrRows.push(['Laba Bersih', lr.laba_bersih])

    const wsLr = XLSX.utils.aoa_to_sheet(lrRows)
    wsLr['!cols'] = [{ wch: 60 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsLr, 'LABA RUGI')

    const GOLONGAN_LIST = [
      { value: 'aset',                     label: 'ASET',                             kategori: 'ASET' },
      { value: 'aset_lancar_kas',        label: 'Aset Lancar - Kas & Bank',       kategori: 'ASET' },
      { value: 'aset_lancar_piutang',    label: 'Aset Lancar - Piutang',          kategori: 'ASET' },
      { value: 'aset_lancar_persediaan',  label: 'Aset Lancar - Persediaan',       kategori: 'ASET' },
      { value: 'aset_lancar_lainnya',     label: 'Aset Lancar - Lainnya',          kategori: 'ASET' },
      { value: 'aset_tidak_lancar',       label: 'Aset Tidak Lancar',              kategori: 'ASET' },
      { value: 'kewajiban',               label: 'KEWAJIBAN',                       kategori: 'KEWAJIBAN' },
      { value: 'kewajiban_lancar',        label: 'Kewajiban Lancar',               kategori: 'KEWAJIBAN' },
      { value: 'kewajiban_tidak_lancar',  label: 'Kewajiban Tidak Lancar',         kategori: 'KEWAJIBAN' },
      { value: 'ekuitas',                 label: 'Ekuitas',                        kategori: 'EKUITAS' },
      { value: 'pendapatan',              label: 'Pendapatan',                     kategori: 'LABA RUGI' },
      { value: 'hpp',                     label: 'HPP',                            kategori: 'LABA RUGI' },
      { value: 'beban',                   label: 'Beban',                          kategori: 'LABA RUGI' },
      { value: 'pendapatan_lain',        label: 'Pendapatan Lain-lain',           kategori: 'LABA RUGI' },
      { value: 'beban_lain',              label: 'Beban Lain-lain',               kategori: 'LABA RUGI' },
    ]
    const refRows: any[][] = [
      ['REFERENSI GOLONGAN'],
      [],
      ['GOLONGAN', 'KETERANGAN', 'KATEGORI LAPORAN'],
      ...GOLONGAN_LIST.map(g => [g.value, g.label, g.kategori]),
    ]
    const wsRef = XLSX.utils.aoa_to_sheet(refRows)
    wsRef['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsRef, 'Referensi Golongan')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=neraca-labarugi-${periodId}.xlsx`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
