import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const parents = await rawAll(`
      SELECT code, name, level FROM accounts WHERE is_header = 1 ORDER BY code
    `) as { code: string; name: string; level: number }[]

    const sheet1Data = [
      ['Kode', 'Nama', 'Parent Code', 'Normal Balance', 'Tipe', 'Golongan', 'Kas', 'Bank'],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data)
    ws1['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 6 }, { wch: 6 }]

    const sheet2Data = [
      ['Kode', 'Nama', 'Parent Code', 'Normal Balance', 'Tipe', 'Golongan', 'Kas', 'Bank'],
      ['110-000-00', 'KAS & BANK', '', 'D', 'header', '', '', ''],
      ['110-001-00', 'Kas', '110-000-00', 'D', 'header', '', '', ''],
      ['110-001-01', 'Kas Kecil', '110-001-00', 'D', 'detail', 'aset_lancar_kas', 'Ya', ''],
      ['110-001-02', 'Kas Besar', '110-001-00', 'D', 'detail', 'aset_lancar_kas', 'Ya', ''],
      ['110-002-00', 'Bank', '110-000-00', 'D', 'header', '', '', ''],
      ['110-002-01', 'Bank BCA', '110-002-00', 'D', 'detail', 'aset_lancar_kas', '', 'Ya'],
      ['110-002-02', 'Bank Mandiri', '110-002-00', 'D', 'detail', 'aset_lancar_kas', '', 'Ya'],
      ['210-000-00', 'KEWAJIBAN LANCAR', '', 'C', 'header', '', '', ''],
      ['210-001-00', 'Hutang Usaha', '210-000-00', 'C', 'header', '', '', ''],
      ['210-001-01', 'Hutang Dagang', '210-001-00', 'C', 'detail', 'kewajiban_lancar', '', ''],
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data)
    ws2['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 6 }, { wch: 6 }]

    const sheet3Data = [
      ['Kode', 'Nama', 'Level'],
      ...parents.map(p => [p.code, p.name, p.level]),
    ]
    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data)
    ws3['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 6 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Template')
    XLSX.utils.book_append_sheet(wb, ws2, 'Contoh')
    XLSX.utils.book_append_sheet(wb, ws3, 'Referensi Parent')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Template-COA.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('GET /api/accounts/template error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to generate template' }, { status: 500 })
  }
}
