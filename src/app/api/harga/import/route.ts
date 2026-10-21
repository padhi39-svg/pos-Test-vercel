import { NextRequest, NextResponse } from 'next/server'
import { rawGet, rawRun } from '@/db/raw'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }
    
    for (const row of data.rows) {
      try {
        const barang = await rawGet(`
          SELECT id FROM master_barang 
          WHERE code = ? AND isdelete = 0
        `, [row.kodeBarang]) as any
        
        if (!barang) {
          results.failed++
          results.errors.push(`Baris ${row.rowNumber}: Kode barang "${row.kodeBarang}" tidak ditemukan`)
          continue
        }
        
        const unit = await rawGet(`
          SELECT id FROM barang_units 
          WHERE barang_id = ? AND name = ?
        `, [barang.id, row.satuan]) as any
        
        if (!unit) {
          results.failed++
          results.errors.push(`Baris ${row.rowNumber}: Satuan "${row.satuan}" tidak valid untuk barang "${row.kodeBarang}"`)
          continue
        }
        
        await rawRun(`
          INSERT INTO barang_prices (barang_id, price, effective_date)
          VALUES (?, ?, ?)
        `, [barang.id, row.harga, row.tanggalEfektif])
        
        results.success++
      } catch (error) {
        results.failed++
        results.errors.push(`Baris ${row.rowNumber}: ${error}`)
      }
    }
    
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error importing harga:', error)
    return NextResponse.json({ error: 'Failed to import' }, { status: 500 })
  }
}
