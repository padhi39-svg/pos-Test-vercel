import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet } from '@/db/raw'
import { getJournalEntries } from '@/lib/journalHelpers'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_buku_besar', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const accountCode = url.searchParams.get('accountCode') || ''
    const startParam = url.searchParams.get('startDate') || ''
    const endParam = url.searchParams.get('endDate') || ''
    const startDate = startParam && !isNaN(new Date(startParam).getTime()) ? startParam : '2000-01-01'
    const endDate = endParam && !isNaN(new Date(endParam).getTime()) ? endParam : new Date().toISOString().slice(0, 10)

    const XLSX = await import('xlsx').then(m => m.default || m)
    const wb = XLSX.utils.book_new()

    const beforeStart = (() => {
      const d = new Date(startDate)
      d.setDate(d.getDate() - 1)
      return d.toISOString().slice(0, 10)
    })()

    const allBefore = await getJournalEntries('2000-01-01', beforeStart)
    const entries = await getJournalEntries(startDate, endDate)

    function pushExcelRows(rows: any[][], e: any, balBefore: number, normalBalance: string, isSaldoAwal: boolean): number {
      const newBalance = isSaldoAwal ? balBefore : (balBefore + (normalBalance === 'D' ? e.debit - e.credit : e.credit - e.debit))
      rows.push([
        isSaldoAwal ? startDate : e.entry_date,
        e.source_number || '',
        isSaldoAwal ? 'Saldo Awal' : (e.description || ''),
        (!isSaldoAwal && e.debit) ? e.debit : '',
        (!isSaldoAwal && e.credit) ? e.credit : '',
        Math.round(newBalance * 100) / 100,
      ])
      return newBalance
    }

    if (!accountCode) {
      const accounts = await rawAll<any[]>('SELECT code, name, normal_balance FROM accounts WHERE posting_allowed = 1 ORDER BY code')
      let grandDebit = 0, grandCredit = 0, grandSaldo = 0

      for (const acct of accounts) {
        const normalBalance = acct.normal_balance || 'D'
        let runningBalance = 0
        for (const e of allBefore) {
          if (e.account_code === acct.code) {
            runningBalance += normalBalance === 'D' ? e.debit - e.credit : e.credit - e.debit
          }
        }
        const filtered = entries.filter(e => e.account_code === acct.code)
        if (!filtered.length && runningBalance === 0) continue

        const rows: any[][] = [
          ['Akun: ' + acct.code + ' - ' + acct.name],
          ['Periode: ' + startDate + ' s/d ' + endDate],
          [],
          ['Tanggal', 'Kode Nota', 'Keterangan', 'Debit', 'Kredit', 'Saldo'],
        ]

        runningBalance = pushExcelRows(rows, {
          account_code: acct.code,
          account_name: acct.name,
          entry_date: startDate,
          source_number: '',
          description: 'Saldo Awal',
          debit: 0,
          credit: 0,
        }, runningBalance, normalBalance, true)

        for (const e of filtered) {
          runningBalance = pushExcelRows(rows, e, runningBalance, normalBalance, false)
        }
        rows.push([])
        rows.push(['', '', '', 'Saldo Akhir', '', '', Math.round(runningBalance * 100) / 100])
        rows.push([])

        grandDebit += filtered.reduce((s, r) => s + r.debit, 0)
        grandCredit += filtered.reduce((s, r) => s + r.credit, 0)
        grandSaldo += runningBalance

        const ws = XLSX.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
        const safeName = (acct.code || 'akun').replace(/[\/\\*\[\]?:]/g, '_').slice(0, 31)
        XLSX.utils.book_append_sheet(wb, ws, safeName)
      }

      const gtRows: any[][] = [['Grand Total'], [], ['Total Debit', grandDebit], ['Total Kredit', grandCredit], ['Total Saldo', grandSaldo]]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gtRows), 'Grand Total')
    } else {
      const acct = await rawGet<any>('SELECT code, name, normal_balance FROM accounts WHERE code = ?', [accountCode])
      const normalBalance = acct?.normal_balance || 'D'

      let runningBalance = 0
      for (const e of allBefore) {
        if (e.account_code === accountCode) {
          runningBalance += normalBalance === 'D' ? e.debit - e.credit : e.credit - e.debit
        }
      }

      const filtered = entries.filter(e => e.account_code === accountCode)

      const rows: any[][] = [
        ['Akun: ' + accountCode + ' - ' + (acct?.name || '')],
        ['Periode: ' + startDate + ' s/d ' + endDate],
        [],
        ['Tanggal', 'Kode Nota', 'Keterangan', 'Debit', 'Kredit', 'Saldo'],
      ]

      runningBalance = pushExcelRows(rows, {
        account_code: accountCode,
        account_name: acct?.name || '',
        entry_date: startDate,
        source_number: '',
        description: 'Saldo Awal',
        debit: 0,
        credit: 0,
      }, runningBalance, normalBalance, true)

      for (const e of filtered) {
        runningBalance = pushExcelRows(rows, e, runningBalance, normalBalance, false)
      }
      rows.push([])
      rows.push(['', '', '', 'Saldo Akhir', '', '', Math.round(runningBalance * 100) / 100])

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
      const safeName = (accountCode || 'buku-besar').replace(/[\/\\*\[\]?:]/g, '_').slice(0, 31)
      XLSX.utils.book_append_sheet(wb, ws, safeName)
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const ts = new Date().toISOString().slice(0, 10)
    const fn = accountCode ? `buku-besar-${accountCode}-${ts}` : `buku-besar-all-${ts}`
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${fn}.xlsx`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
