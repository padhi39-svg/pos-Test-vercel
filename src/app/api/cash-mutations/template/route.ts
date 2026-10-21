import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const accounts = await rawAll(`
      SELECT id, code, name, is_cash, is_bank_account, normal_balance
      FROM accounts
      WHERE is_active = 1 AND posting_allowed = 1
      ORDER BY code ASC
    `) as { id: number; code: string; name: string; is_cash: number; is_bank_account: number; normal_balance: string }[]

    const sheet1Data = [
      ['Tanggal', 'No Mutasi', 'Kode Kas/Bank', 'Jenis', 'Kode Akun', 'Keterangan', 'Jumlah'],
      ['15/01/2026', '', '1101', 'MASUK', '411-001', 'Penjualan tunai', 500000],
      ['15/01/2026', '', '1102', 'KELUAR', '511-001', 'Beli bahan baku', 250000],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data)
    ws1['!cols'] = [
      { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 10 },
      { wch: 16 }, { wch: 30 }, { wch: 14 },
    ]

    const kasBankAccounts = accounts.filter(a => a.is_cash || a.is_bank_account)
    const contraAccounts = accounts.filter(a => !a.is_cash && !a.is_bank_account)

    const sheet2Header = ['Kode Akun', 'Nama Akun', 'Tipe']
    const sheet2Rows = [sheet2Header]
    for (const a of kasBankAccounts) {
      sheet2Rows.push([a.code, a.name, 'Kas/Bank'])
    }
    for (const a of contraAccounts) {
      sheet2Rows.push([a.code, a.name, a.normal_balance === 'D' ? 'Debit' : 'Kredit'])
    }
    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows)

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Template Mutasi')
    XLSX.utils.book_append_sheet(wb, ws2, 'Referensi Akun')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Template-Mutasi-Kas-Bank.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('GET /api/cash-mutations/template error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to generate template' }, { status: 500 })
  }
}
