import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_kartu_kas_bank', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const apiUrl = new URL(url.toString())
    apiUrl.pathname = '/api/reports/kartu-kas-bank'
    const res = await fetch(apiUrl.toString())
    const json = await res.json()
    if (!json.entries) return NextResponse.json({ error: 'No data' }, { status: 400 })

    const XLSX = await import('xlsx').then(m => m.default || m)
    const rows: any[][] = [
      ['KARTU ' + (json.account?.is_bank_account ? 'BANK' : 'KAS') + ' - ' + (json.account?.name || '')],
      [],
      ['Tanggal', 'Ref', 'Deskripsi', 'Debet (Masuk)', 'Kredit (Keluar)', 'Saldo'],
    ]
    for (const e of json.entries) {
      rows.push([
        e.tgl, e.ref, e.deskripsi,
        e.debet > 0 ? e.debet : '',
        e.kredit > 0 ? e.kredit : '',
        e.saldo,
      ])
    }
    rows.push([])
    rows.push(['Total', '', '', json.total_debet, json.total_kredit, json.saldo_akhir])

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Kartu Kas Bank')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const ts = new Date().toISOString().slice(0, 10)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=kartu-kas-bank-${ts}.xlsx`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
