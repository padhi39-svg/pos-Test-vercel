import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const db = getDb()

    const barangRows = await rawAll(`
      SELECT 
        b.id, b.code, b.name, b.aktif, b.tampil_menu,
        k.name AS kategori_name,
        s.name AS spesifikasi_name
      FROM master_barang b
      LEFT JOIN master_kategori k ON b.kategori_id = k.id
      LEFT JOIN master_spesifikasi s ON b.spesifikasi_id = s.id
      WHERE b.isdelete = 0
      ORDER BY b.name ASC
    `) as any[]

    // Build worksheet data rows as objects
    const rowsForXlsx: any[] = []
    for (const b of barangRows) {
      const units = await rawAll('SELECT name, ratio FROM barang_units WHERE barang_id = ? ORDER BY ratio ASC', [b.id]) as { name: string; ratio: number }[]
      const prices = await rawAll(`
        SELECT unit_id, price, effective_date 
        FROM barang_prices 
        WHERE barang_id = ? 
        ORDER BY effective_date DESC
      `, [b.id]) as { unit_id: number|null; price: number; effective_date: string }[]

      const u1 = units[0] || { name: '', ratio: '' as any }
      const u2 = units[1] || { name: '', ratio: '' as any }
      const u3 = units[2] || { name: '', ratio: '' as any }

      let hargaJual = 0
      if (prices && prices.length > 0) {
        hargaJual = Number(prices[0].price) || 0
      }

      rowsForXlsx.push({
        'Kode': b.code || '',
        'Nama Barang': b.name || '',
        'Spesifikasi': b.spesifikasi_name || '',
        'Kategori': b.kategori_name || '',
        'Harga Jual': hargaJual,
        'Satuan1': u1.name || '', 'Rasio1': u1.ratio ?? '',
        'Satuan2': u2.name || '', 'Rasio2': u2.ratio ?? '',
        'Satuan3': u3.name || '', 'Rasio3': u3.ratio ?? '',
        'Aktif': b.aktif ? 1 : 0,
        'Tampil Menu': b.tampil_menu ? 1 : 0,
      })
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rowsForXlsx, { header: [
      'Kode','Nama Barang','Spesifikasi','Kategori','Harga Jual',
      'Satuan1','Rasio1','Satuan2','Rasio2','Satuan3','Rasio3','Aktif','Tampil Menu'
    ] })
    XLSX.utils.book_append_sheet(wb, ws, 'Barang')
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    return new NextResponse(xlsxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="barang-export.xlsx"'
      }
    })
  } catch (error: any) {
    console.error('Error exporting barang:', error)
    return NextResponse.json({ error: 'Failed to export barang', details: error.message }, { status: 500 })
  }
}
