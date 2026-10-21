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

    const masterHeaders = ['TransactionCode', 'Tanggal', 'Supplier Code', 'Subtotal', 'Discount %', 'Discount Amount', 'PPN %', 'Total', 'Notes', 'Warehouse']
    const detailHeaders = ['TransactionCode', 'Kode Barang', 'Quantity', 'Unit', 'Harga Satuan', 'Disc%', 'Disc1%', 'Disc2%', 'Disc3%', 'DiscRp', 'Total']

    const masterRows = [
      masterHeaders,
      ['TRX001', '2026-06-01', 'SUPP000', 1000000, 5, 0, 11, 1028138, 'Pembelian barang A+B', 1],
      ['TRX002', '2026-06-02', 'SUPP001', 2000000, 10, 0, 11, 1780718, '', 1],
    ]

    // TRX001: BRG-001 qty=50 price=10000 Disc%=5 → net=475000; BRG-002 qty=20 price=25000 → net=500000
    // TRX002: BRG-003 qty=100 price=15000 Disc%=10 Disc1%=5 → net=1282500; BRG-001 qty=10 price=50000 → net=500000
    const detailRows = [
      detailHeaders,
      ['TRX001', 'BRG-001', 50, 'pcs', 10000, 5, 0, 0, 0, 0, 475000],
      ['TRX001', 'BRG-002', 20, 'pcs', 25000, 0, 0, 0, 0, 0, 500000],
      ['TRX002', 'BRG-003', 100, 'pcs', 15000, 10, 5, 0, 0, 0, 1282500],
      ['TRX002', 'BRG-001', 10, 'pcs', 50000, 0, 0, 0, 0, 0, 500000],
    ]

    const wsMaster = XLSX.utils.aoa_to_sheet(masterRows)
    wsMaster['!cols'] = [
      { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
      { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 12 },
      { wch: 30 }, { wch: 12 },
    ]

    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows)
    wsDetail['!cols'] = [
      { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
      { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 12 }, { wch: 14 },
    ]

    const supplierHeader = ['Code', 'Name']
    const supplierRows = [supplierHeader, ...suppliers.map(s => [s.code, s.name])]
    const wsSupp = XLSX.utils.aoa_to_sheet(supplierRows)
    wsSupp['!cols'] = [{ wch: 14 }, { wch: 30 }]

    const barangHeader = ['Kode Barang', 'Nama Barang']
    const barangRows = [barangHeader, ...barangList.map(b => [b.code, b.name])]
    const wsBrg = XLSX.utils.aoa_to_sheet(barangRows)
    wsBrg['!cols'] = [{ wch: 16 }, { wch: 30 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsMaster, 'MASTER')
    XLSX.utils.book_append_sheet(wb, wsDetail, 'DETAIL')
    XLSX.utils.book_append_sheet(wb, wsSupp, 'Referensi Supplier')
    XLSX.utils.book_append_sheet(wb, wsBrg, 'Referensi Barang')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Template-Pembelian-2Sheet.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('GET /api/purchases/template-excel error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to generate template' }, { status: 500 })
  }
}
