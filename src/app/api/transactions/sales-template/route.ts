import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET() {
  try {
    const db = getDb()

    const customers = await rawAll("SELECT code, name FROM master_customer WHERE isdelete = 0 ORDER BY name") as any[]
    const barang = await rawAll("SELECT code, name FROM master_barang WHERE isdelete = 0 ORDER BY name") as any[]

    const wb = XLSX.utils.book_new()

    const mainData = [
      ['No. Nota', 'Tanggal', 'Kode Customer', 'Tipe Penjualan', 'Kode Barang', 'Quantity', 'Metode Pembayaran'],
      ['', '2026-05-26', 'CUST001', '1', 'BRG001', 5, 'cash'],
      ['', '2026-05-26', '', '2', 'BRG002', 10, 'transfer'],
      ['', '2026-05-26', 'CUST001', '1', 'BRG001', 3, 'card'],
    ]
    const wsMain = XLSX.utils.aoa_to_sheet(mainData)
    wsMain['!cols'] = [
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 22 },
    ]
    XLSX.utils.book_append_sheet(wb, wsMain, 'Template Penjualan')

    const custData = [['Kode Customer', 'Nama Customer']]
    for (const c of customers) custData.push([c.code, c.name])
    const wsCust = XLSX.utils.aoa_to_sheet(custData)
    wsCust['!cols'] = [{ wch: 18 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, wsCust, 'Referensi Customer')

    const barangData = [['Kode Barang', 'Nama Barang']]
    for (const b of barang) barangData.push([b.code, b.name])
    const wsBarang = XLSX.utils.aoa_to_sheet(barangData)
    wsBarang['!cols'] = [{ wch: 18 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, wsBarang, 'Referensi Barang')

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="penjualan-import-template.xlsx"'
      }
    })
  } catch (error) {
    console.error('Error generating sales template:', error)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}
