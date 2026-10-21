import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const db = getDb()

    const accounts = await rawAll(`
      SELECT id, code, name, is_active
      FROM accounts
      WHERE is_active = 1 AND posting_allowed = 1
      ORDER BY code ASC
    `) as { id: number; code: string; name: string; is_active: number }[]

    const sheet1Data = [
      ['Tanggal', 'No Jurnal', 'Kode Akun', 'Debit', 'Kredit', 'Keterangan'],
      ['15/01/2026', '', '1101', 100000, 0, 'Setoran modal'],
      ['15/01/2026', '', '311-001', 0, 100000, 'Setoran modal'],
      ['15/01/2026', 'group-1', '1101', 50000, 0, 'Biaya listrik'],
      ['15/01/2026', 'group-1', '511-001', 0, 50000, 'Biaya listrik'],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data)
    ws1['!cols'] = [
      { wch: 14 }, { wch: 20 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 30 },
    ]

    const refHeader = ['Kode Akun', 'Nama Akun']
    const refRows = [refHeader, ...accounts.map(a => [a.code, a.name])]
    const ws2 = XLSX.utils.aoa_to_sheet(refRows)

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Template Jurnal')
    XLSX.utils.book_append_sheet(wb, ws2, 'Referensi Akun')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Template-Jurnal-Memorial.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('GET /api/memorial-journals/template error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to generate template' }, { status: 500 })
  }
}
