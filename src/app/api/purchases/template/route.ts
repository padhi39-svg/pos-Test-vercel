import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const db = getDb()

    const suppliers = await rawAll(
      `SELECT id, code, name FROM master_supplier WHERE isdelete = 0 ORDER BY name ASC`
    ) as { id: number; code: string; name: string }[]

    const barangList = await rawAll(
      `SELECT id, code, name FROM master_barang WHERE isdelete = 0 ORDER BY code ASC`
    ) as { id: number; code: string; name: string }[]

    const sheet1Data = [
      ['Tanggal', 'No Pembelian', 'Nama Supplier', 'No Invoice', 'Kode Barang', 'Qty', 'Satuan', 'Harga Satuan'],
      ['2026-01-15', '', 'PT Supplier ABC', 'INV-001', 'BRG-001', 10, 'pcs', 50000],
      ['2026-01-15', '', 'PT Supplier ABC', 'INV-001', 'BRG-002', 5, 'box', 75000],
      ['2026-01-16', '', 'CV Supplier XYZ', '', 'BRG-003', 20, 'pcs', 25000],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data)
    ws1['!cols'] = [
      { wch: 14 }, { wch: 20 }, { wch: 22 },
      { wch: 16 }, { wch: 16 }, { wch: 10 },
      { wch: 10 }, { wch: 14 },
    ]

    const supplierHeader = ['Nama Supplier']
    const supplierRows = [supplierHeader, ...suppliers.map(s => [s.name])]
    const ws2 = XLSX.utils.aoa_to_sheet(supplierRows)

    const barangHeader = ['Kode Barang', 'Nama Barang']
    const barangRows = [barangHeader, ...barangList.map(b => [b.code, b.name])]
    const ws3 = XLSX.utils.aoa_to_sheet(barangRows)

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Template Pembelian')
    XLSX.utils.book_append_sheet(wb, ws2, 'Referensi Supplier')
    XLSX.utils.book_append_sheet(wb, ws3, 'Referensi Barang')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Template-Pembelian.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('GET /api/purchases/template error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to generate template' }, { status: 500 })
  }
}
