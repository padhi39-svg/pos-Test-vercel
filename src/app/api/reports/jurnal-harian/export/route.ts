import { NextRequest, NextResponse } from 'next/server'
import { getJournalEntries } from '@/lib/journalHelpers'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_jurnal_harian', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const startDate = url.searchParams.get('startDate') || ''
    const endDate = url.searchParams.get('endDate') || ''

    const entries = await getJournalEntries(startDate, endDate)
    if (!entries.length) {
      return NextResponse.json({ error: 'No data' }, { status: 400 })
    }

    const XLSX = await import('xlsx').then(m => m.default || m)
    const wb = XLSX.utils.book_new()

    const rows: any[][] = [
      ['JURNAL HARIAN'],
      [`Periode: ${startDate} s/d ${endDate}`],
      [],
      ['Tanggal', 'Kode Nota', 'Kode Akun', 'Perkiraan', 'Debit', 'Kredit'],
    ]

    let grandDebit = 0
    let grandCredit = 0
    let lastDoc = ''

    for (const e of entries) {
      const debit = Number(e.debit || 0)
      const credit = Number(e.credit || 0)
      grandDebit += debit
      grandCredit += credit

      const showDoc = e.source_number !== lastDoc
      lastDoc = e.source_number

      rows.push([
        showDoc ? e.entry_date : '',
        showDoc ? e.source_number : '',
        e.account_code,
        e.account_name,
        debit > 0 ? debit : '',
        credit > 0 ? credit : '',
      ])
    }

    rows.push([])
    rows.push(['', '', '', 'GRAND TOTAL', grandDebit, grandCredit])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Jurnal Harian')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const ts = new Date().toISOString().slice(0, 10)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=jurnal-harian-${ts}.xlsx`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
