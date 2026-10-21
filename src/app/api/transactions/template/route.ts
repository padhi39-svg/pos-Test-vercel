import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    // Check permission - user harus bisa create invoice
    if (!hasPermission(request as any, 'invoice', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat invoice' }, { status: 403 })
    }

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Sheet 1: MASTER
    const masterData = [
      ['Transaction Code', 'Tanggal Nota', 'Customer Code', 'Subtotal', 'Discount %', 'Discount Amount', 'PPN %', 'Total', 'Notes', 'Warehouse'],
      ['INV001', '2026-05-21', 'CUST000', 10000000, 10, 1000000, 11, 9990000, 'Invoice bulanan', 1],
      ['INV002', '2026-05-22', 'CUST001', 5000000, 5, 250000, 11, 5272500, 'Invoice kedua', 1]
    ]

    const wsMaster = XLSX.utils.aoa_to_sheet(masterData)
    
    // Set column widths for master sheet
    wsMaster['!cols'] = [
      { wch: 15 }, // Transaction Code
      { wch: 15 }, // Tanggal Nota
      { wch: 15 }, // Customer Code
      { wch: 12 }, // Subtotal
      { wch: 10 }, // Discount %
      { wch: 15 }, // Discount Amount
      { wch: 8 },  // PPN %
      { wch: 12 }, // Total
      { wch: 20 }, // Notes
      { wch: 10 }  // Warehouse
    ]

    // Sheet 2: DETAIL
    const detailData = [
      ['Transaction Code', 'Kode Barang', 'Quantity', 'Unit', 'Harga Satuan', 'Discount %', 'Discount Amount', 'Total'],
      ['INV001', 'KAV3USER', 5, 'pcs', 450000, 0, 0, 2250000],
      ['INV001', 'TAC61200', 10, 'pcs', 375000, 10, 375000, 3375000],
      ['INV002', 'TSG105', 2, 'pcs', 250000, 0, 0, 500000]
    ]

    const wsDetail = XLSX.utils.aoa_to_sheet(detailData)
    
    // Set column widths for detail sheet
    wsDetail['!cols'] = [
      { wch: 15 }, // Transaction Code
      { wch: 15 }, // Kode Barang
      { wch: 10 }, // Quantity
      { wch: 8 },  // Unit
      { wch: 15 }, // Harga Satuan
      { wch: 10 }, // Discount %
      { wch: 15 }, // Discount Amount
      { wch: 12 }  // Total
    ]

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(wb, wsMaster, 'MASTER')
    XLSX.utils.book_append_sheet(wb, wsDetail, 'DETAIL')

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return as file download
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="invoice-import-template.xlsx"'
      }
    })

  } catch (error) {
    console.error('Error generating template:', error)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}
