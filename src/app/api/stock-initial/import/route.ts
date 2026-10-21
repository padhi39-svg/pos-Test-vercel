import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import * as XLSX from 'xlsx'
import { getPeriodByDate } from '@/lib/period'
import { hasPermission } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'stock_initial', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses import saldo awal stok' }, { status: 403 })
    }
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet) as any[]

    if (data.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 })
    }

    const db = getDb()
    const pool = (db as any).$client
    const errors: string[] = []
    const success: string[] = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2 // Excel row (header = 1, data starts at 2)

      try {
        const kodeBarang = String(row['Kode Barang'] || '').trim()
        const kodeGudang = String(row['Kode Gudang'] || '').trim()
        const stok = parseFloat(String(row['Stok'] || '0'))
        const satuan = String(row['Satuan'] || '').trim()
        
        // Parse tanggal - handle Excel date formats
        let tanggal = new Date().toISOString().split('T')[0]
        if (row['Tanggal (YYYY-MM-DD)']) {
          const rawDate = row['Tanggal (YYYY-MM-DD)']
          if (typeof rawDate === 'number') {
            // Excel date serial number (days since 1900-01-01)
            const excelEpoch = Date.UTC(1900, 0, 1)
            const date = new Date(excelEpoch + (rawDate - 2) * 86400000)
            tanggal = date.toISOString().split('T')[0]
          } else if (typeof rawDate === 'string') {
            // Try to parse string date
            const parsed = new Date(rawDate)
            if (!isNaN(parsed.getTime())) {
              tanggal = parsed.toISOString().split('T')[0]
            } else {
              tanggal = String(rawDate).trim()
            }
          }
        }

        // Validation
        if (!kodeBarang) {
          errors.push(`Baris ${rowNum}: Kode Barang kosong`)
          continue
        }
        if (!kodeGudang) {
          errors.push(`Baris ${rowNum}: Kode Gudang kosong`)
          continue
        }
        if (isNaN(stok) || stok < 0) {
          errors.push(`Baris ${rowNum}: Stok tidak valid`)
          continue
        }
        if (!satuan) {
          errors.push(`Baris ${rowNum}: Satuan kosong`)
          continue
        }

        // Validate period - try to get by date, fallback to active period
        let period = await getPeriodByDate(tanggal)
        if (!period) {
          // If no period for this date, use the active (open) period
          const activePeriod = await rawGet(`
            SELECT id, name, is_closed 
            FROM master_periode 
            WHERE isdelete = 0 AND is_closed = 0 
            ORDER BY start_date DESC 
            LIMIT 1
          `) as any
          
          if (!activePeriod) {
            errors.push(`Baris ${rowNum}: Tidak ada periode aktif untuk tanggal ${tanggal}`)
            continue
          }
          period = { id: activePeriod.id, name: activePeriod.name, is_closed: 0 }
        }
        
        if (Number(period.is_closed) === 1) {
          errors.push(`Baris ${rowNum}: Periode '${period.name}' sudah ditutup`)
          continue
        }

        // Get barang by code (all types: menu, retail, ingredient)
        const barang = await rawGet(`
          SELECT id, code, name, hpp, jenis FROM master_barang 
          WHERE code = ? AND isdelete = 0
        `, [kodeBarang.toUpperCase()]) as any

        if (!barang) {
          errors.push(`Baris ${rowNum}: Barang dengan kode ${kodeBarang} tidak ditemukan di database`)
          continue
        }
        
        if (!barang.id || barang.id <= 0) {
          errors.push(`Baris ${rowNum}: Barang ${kodeBarang} memiliki ID tidak valid (${barang.id})`)
          continue
        }

        // Get gudang by code
        const gudang = await rawGet(`
          SELECT id, is_active FROM master_gudang 
          WHERE code = ? AND isdelete = 0
        `, [kodeGudang.toUpperCase()]) as any

        if (!gudang) {
          errors.push(`Baris ${rowNum}: Gudang dengan kode ${kodeGudang} tidak ditemukan atau sudah dihapus`)
          continue
        }

        if (gudang.is_active === 0) {
          errors.push(`Baris ${rowNum}: Gudang ${kodeGudang} tidak aktif`)
          continue
        }

        // Get unit and convert to base
        const unit = await rawGet(`
          SELECT name, ratio FROM barang_units 
          WHERE barang_id = ? AND name = ?
        `, [barang.id, satuan]) as any

        if (!unit) {
          errors.push(`Baris ${rowNum}: Satuan ${satuan} tidak ditemukan untuk barang ${kodeBarang}`)
          continue
        }

        // Get base unit
        const baseUnit = await rawGet(`
          SELECT name FROM barang_units 
          WHERE barang_id = ? AND ratio = 1
        `, [barang.id]) as any

        if (!baseUnit) {
          errors.push(`Baris ${rowNum}: Base unit tidak ditemukan untuk barang ${kodeBarang}`)
          continue
        }

        // Convert to base unit
        const quantityInBaseUnit = stok * unit.ratio

        // Check if stock balance already exists
        const existing = await rawGet(`
          SELECT id FROM stock_balance 
          WHERE ingredient_id = ? AND warehouse_id = ?
        `, [barang.id, gudang.id]) as any

        let stockBalanceId: number

        // HPP dari master_barang
        const isHppEligible = barang && (Number(barang.jenis) === 1 || Number(barang.jenis) === 2 || Number(barang.jenis) === 3)
        const hppStandar = isHppEligible ? (Number(barang.hpp) || 0) : 0
        const newTotalCost = isHppEligible ? (quantityInBaseUnit * hppStandar) : 0

        try {
          if (existing) {
            // Update existing (termasuk avg_cost, total_cost)
            await rawRun(`
              UPDATE stock_balance 
              SET quantity = ?, unit = ?, avg_cost = ?, total_cost = ?, updated_at = CURRENT_TIMESTAMP
              WHERE ingredient_id = ? AND warehouse_id = ?
            `, [quantityInBaseUnit, baseUnit.name, hppStandar, newTotalCost, barang.id, gudang.id])
            
            stockBalanceId = existing.id
          } else {
            // Insert new
            const r = await pool.query(`
              INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, unit, avg_cost, total_cost)
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
            `, [barang.id, gudang.id, quantityInBaseUnit, baseUnit.name, hppStandar, newTotalCost])
            
            stockBalanceId = r.rows[0].id
          }
        } catch (balanceErr: any) {
          errors.push(`Baris ${rowNum}: Gagal menyimpan stock_balance - ${balanceErr.message}`)
          continue
        }

        // Record in stock_movements with period_id and warehouse_id
        try {
          // Verify all foreign keys exist
          const periodCheck = await rawGet('SELECT id, name FROM master_periode WHERE id = ?', [period.id]) as any
          const warehouseCheck = await rawGet('SELECT id, code FROM master_gudang WHERE id = ?', [gudang.id]) as any
          const barangCheck = await rawGet('SELECT id, code, name FROM master_barang WHERE id = ?', [barang.id]) as any
          
          if (!periodCheck) {
            errors.push(`Baris ${rowNum}: Periode ID ${period.id} tidak ditemukan di master_periode`)
            continue
          }
          if (!warehouseCheck) {
            errors.push(`Baris ${rowNum}: Gudang ID ${gudang.id} (${kodeGudang}) tidak ditemukan di master_gudang`)
            continue
          }
          if (!barangCheck) {
            errors.push(`Baris ${rowNum}: Barang ID ${barang.id} (${kodeBarang}) tidak ditemukan di master_barang`)
            continue
          }
          
          // Hapus pergerakan saldo awal sebelumnya untuk kombinasi barang+gudang agar tidak dobel ketika re-import
          await rawRun(`
            DELETE FROM stock_movements 
            WHERE reference_type = 'initial_stock' 
              AND ingredient_id = ? 
              AND warehouse_id = ?
          `, [barang.id, gudang.id])

          // Try to insert with detailed error catching
          await rawRun(`
            INSERT INTO stock_movements (
              ingredient_id, warehouse_id, movement_type, quantity, unit, 
              reference_type, reference_id, period_id, transaction_date, notes,
              unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            barang.id,
            gudang.id,
            'in',
            quantityInBaseUnit,
            baseUnit.name,
            'initial_stock',
            stockBalanceId,
            period.id,
            tanggal,
            `Saldo awal (import): ${stok} ${satuan}`,
            isHppEligible ? hppStandar : null,
            isHppEligible ? newTotalCost : null,
            quantityInBaseUnit,
            isHppEligible ? newTotalCost : 0,
            isHppEligible ? hppStandar : null
          ])
        } catch (movementErr: any) {
          // Detailed error with all IDs for debugging
          const errMsg = `Baris ${rowNum}: Gagal menyimpan stock_movements - ${movementErr.message}\n` +
            `  Barang: ${kodeBarang} (ID=${barang.id})\n` +
            `  Gudang: ${kodeGudang} (ID=${gudang.id})\n` +
            `  Periode: ${period.name} (ID=${period.id})\n` +
            `  Stock Balance ID: ${stockBalanceId}`
          errors.push(errMsg)
          continue
        }

        success.push(`Baris ${rowNum}: ${kodeBarang} - ${kodeGudang} berhasil (Periode: ${period.name})`)

      } catch (err: any) {
        errors.push(`Baris ${rowNum}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      total: data.length,
      imported: success.length,
      failed: errors.length,
      errors,
      successMessages: success
    })

  } catch (error: any) {
    console.error('Error importing stock initial:', error)
    return NextResponse.json({ 
      error: 'Gagal import data', 
      details: error.message 
    }, { status: 500 })
  }
}
