import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

// GET /api/stock-initial/template
// Generate an Excel template for Stock Initial with 2 sheets:
//  - Sheet1: Template Saldo Awal (headers only)
//  - Sheet2: Referensi Barang (Kode, Nama, Satuan1..3) to help users pick units
export async function GET(_req: NextRequest) {
  try {
    const db = getDb()

    // Query all active, non-deleted items and their units
    const items = await rawAll(`
      SELECT b.id, b.code, b.name
      FROM master_barang b
      WHERE b.isdelete = 0
      ORDER BY b.name ASC
    `) as { id: number; code: string; name: string }[]

    // Build Sheet1 (template)
    const sheet1Data = [
      ['Kode Barang', 'Kode Gudang', 'Stok', 'Satuan', 'Tanggal (YYYY-MM-DD)'],
    ]

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data)

    // Build Sheet2 (reference)
    const sheet2Rows: any[][] = [['Kode Barang', 'Nama Barang', 'Satuan 1', 'Satuan 2', 'Satuan 3']]

    for (const it of items) {
      const units = await rawAll(`
        SELECT name, ratio
        FROM barang_units
        WHERE barang_id = ?
        ORDER BY ratio ASC
      `, [it.id]) as { name: string; ratio: number }[]
      // Up to 3 units in ascending ratio order
      const u1 = units[0]?.name || ''
      const u2 = units[1]?.name || ''
      const u3 = units[2]?.name || ''
      sheet2Rows.push([it.code, it.name, u1, u2, u3])
    }

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows)

    // Create workbook
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Template Saldo Awal')
    XLSX.utils.book_append_sheet(wb, ws2, 'Referensi Barang')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Template-Saldo-Awal.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('GET /api/stock-initial/template error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to generate template' }, { status: 500 })
  }
}
