import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { getUserId } from '@/lib/audit'

async function ensureTables() {
  await rawRun(`CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    purchase_number TEXT,
    po_id INTEGER,
    supplier_id INTEGER,
    warehouse_id INTEGER DEFAULT 1,
    purchase_date TEXT,
    invoice_number TEXT,
    subtotal REAL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    ppn_percent REAL DEFAULT 0,
    ppn_amount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    is_return INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)
  await rawRun(`CREATE TABLE IF NOT EXISTS purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_id INTEGER,
    po_item_id INTEGER,
    barang_id INTEGER,
    quantity REAL DEFAULT 0,
    unit_name TEXT,
    unit_ratio INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    total_price REAL DEFAULT 0
  )`)
  await rawRun(`CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    ingredient_id INTEGER,
    warehouse_id INTEGER DEFAULT 1,
    movement_type TEXT,
    quantity REAL DEFAULT 0,
    unit TEXT,
    reference_type TEXT,
    reference_id INTEGER,
    period_id INTEGER,
    transaction_date TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)
  await rawRun(`CREATE TABLE IF NOT EXISTS stock_balance (
    id SERIAL PRIMARY KEY,
    ingredient_id INTEGER,
    warehouse_id INTEGER DEFAULT 1,
    quantity REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  try {
    const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_movements'")
    const names = new Set(cols.map(c => c.name))
    if (!names.has('unit_cost')) await rawRun("ALTER TABLE stock_movements ADD COLUMN unit_cost REAL")
    if (!names.has('total_cost')) await rawRun("ALTER TABLE stock_movements ADD COLUMN total_cost REAL")
    if (!names.has('balance_qty')) await rawRun("ALTER TABLE stock_movements ADD COLUMN balance_qty REAL")
    if (!names.has('balance_cost')) await rawRun("ALTER TABLE stock_movements ADD COLUMN balance_cost REAL")
    if (!names.has('balance_avg_cost')) await rawRun("ALTER TABLE stock_movements ADD COLUMN balance_avg_cost REAL")
  } catch {}
  try {
    const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_balance'")
    const names = new Set(cols.map(c => c.name))
    if (!names.has('avg_cost')) await rawRun("ALTER TABLE stock_balance ADD COLUMN avg_cost REAL DEFAULT 0")
    if (!names.has('total_cost')) await rawRun("ALTER TABLE stock_balance ADD COLUMN total_cost REAL DEFAULT 0")
  } catch {}
}

function parseExcelDate(value: any): string | null {
  if (!value) return null
  if (typeof value === 'number') {
    const excelEpoch = Date.UTC(1899, 11, 30)
    const date = new Date(excelEpoch + value * 86400000)
    return date.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const cleaned = value.trim()
    const d = new Date(cleaned)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return cleaned
  }
  return null
}

async function nextPurchaseNumber(year: string): Promise<string> {
  const prefix = 'PB'
  const lastDoc = await rawGet<any>(
    `SELECT purchase_number FROM purchases 
     WHERE purchase_number LIKE $1 
     ORDER BY id DESC LIMIT 1`,
    [`${prefix}/${year}/%`]
  )
  let seq = 1
  if (lastDoc && lastDoc.purchase_number) {
    const parts = lastDoc.purchase_number.split('/')
    const lastSeq = parseInt(parts[2] || '0', 10)
    seq = isNaN(lastSeq) ? 1 : lastSeq + 1
  }
  return `${prefix}/${year}/${seq.toString().padStart(6, '0')}`
}

export async function POST(request: NextRequest) {
  try {
    const pool = (getDb() as any).$client
    await ensureTables()
    const body = await request.json()
    const rows = Array.isArray(body.data) ? body.data : []
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data untuk diimport' }, { status: 400 })
    }

    const userId = getUserId(request)
    const errors: string[] = []
    const successRows: string[] = []
    let imported = 0

    const groups: { key: string; items: any[] }[] = []
    let autoKeyCounter = 0
    for (const row of rows) {
      const purchaseKey = String(row['No Pembelian'] || '').trim() || `__auto_${++autoKeyCounter}`
      const existing = groups.find(g => g.key === purchaseKey)
      if (existing) {
        existing.items.push(row)
      } else {
        groups.push({ key: purchaseKey, items: [row] })
      }
    }

    for (const group of groups) {
      const items = group.items
      const firstRow = items[0]
      const rowNumBase = rows.indexOf(firstRow) + 2

      try {
        const tanggal = parseExcelDate(firstRow['Tanggal'] || firstRow['tanggal'] || firstRow['DATE'])
        if (!tanggal) {
          errors.push(`Baris ${rowNumBase}: Tanggal tidak valid`)
          continue
        }

        const period = await getPeriodByDate(tanggal)
        if (!period) {
          errors.push(`Baris ${rowNumBase}: Tidak ada periode aktif untuk tanggal ${tanggal}`)
          continue
        }
        if (Number(period.is_closed) === 1) {
          errors.push(`Baris ${rowNumBase}: Periode "${period.name}" sudah ditutup`)
          continue
        }

        const supplierName = String(firstRow['Nama Supplier'] || firstRow['nama_supplier'] || firstRow['SUPPLIER'] || '').trim()
        if (!supplierName) {
          errors.push(`Baris ${rowNumBase}: Nama Supplier kosong`)
          continue
        }
        const supplier = await rawGet<any>(
          `SELECT id, code, name FROM master_supplier WHERE LOWER(name) = LOWER($1) AND isdelete = 0 LIMIT 1`,
          [supplierName]
        )
        if (!supplier) {
          errors.push(`Baris ${rowNumBase}: Supplier "${supplierName}" tidak ditemukan di database`)
          continue
        }

        const invoiceNumber = String(firstRow['No Invoice'] || firstRow['no_invoice'] || firstRow['INVOICE'] || '').trim()
        const warehouseId = 1

        interface PurchaseItemInput {
          barangId: number
          quantity: number
          unitName: string | null
          unitRatio: number
          unitPrice: number
          totalPrice: number
          isHppEligible: boolean
        }
        const purchaseItems: PurchaseItemInput[] = []
        let itemError = false

        for (let i = 0; i < items.length; i++) {
          const row = items[i]
          const actualRowNum = rows.indexOf(row) + 2
          const barangCode = String(row['Kode Barang'] || row['kode_barang'] || row['BARANG'] || '').trim()

          if (!barangCode) {
            errors.push(`Baris ${actualRowNum}: Kode Barang kosong`)
            itemError = true
            continue
          }

          const barang = await rawGet<any>(
            `SELECT id, code, name, jenis FROM master_barang WHERE code = $1 AND isdelete = 0 LIMIT 1`,
            [barangCode]
          )
          if (!barang) {
            errors.push(`Baris ${actualRowNum}: Barang dengan kode "${barangCode}" tidak ditemukan`)
            itemError = true
            continue
          }

          const qty = parseFloat(String(row['Qty'] || row['qty'] || row['QUANTITY'] || '0').replace(/,/g, ''))
          if (!qty || qty <= 0) {
            errors.push(`Baris ${actualRowNum}: Qty tidak valid`)
            itemError = true
            continue
          }

          const unitPrice = parseFloat(String(row['Harga Satuan'] || row['harga_satuan'] || row['PRICE'] || '0').replace(/,/g, ''))
          if (!unitPrice || unitPrice <= 0) {
            errors.push(`Baris ${actualRowNum}: Harga Satuan tidak valid`)
            itemError = true
            continue
          }

          let unitName: string | null = null
          let unitRatio = 1
          const unitInput = String(row['Satuan'] || row['satuan'] || row['UNIT'] || '').trim()
          if (unitInput) {
            const barangUnit = await rawGet<any>(
              `SELECT name, ratio FROM barang_units WHERE barang_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
              [barang.id, unitInput]
            )
            if (barangUnit) {
              unitName = barangUnit.name
              unitRatio = Number(barangUnit.ratio) || 1
            } else {
              errors.push(`Baris ${actualRowNum}: Satuan "${unitInput}" tidak ditemukan untuk barang "${barangCode}"`)
              itemError = true
              continue
            }
          } else {
            const defaultUnit = await rawGet<any>(
              `SELECT name, ratio FROM barang_units WHERE barang_id = $1 ORDER BY ratio ASC LIMIT 1`,
              [barang.id]
            )
            if (defaultUnit) {
              unitName = defaultUnit.name
              unitRatio = Number(defaultUnit.ratio) || 1
            }
          }

          const totalPrice = Math.round(qty * unitPrice)
          const isHppEligible = barang && (Number(barang.jenis) === 1 || Number(barang.jenis) === 2 || Number(barang.jenis) === 3)
          purchaseItems.push({ barangId: barang.id, quantity: qty, unitName, unitRatio, unitPrice, totalPrice, isHppEligible })
        }

        if (itemError || purchaseItems.length === 0) {
          if (purchaseItems.length === 0 && !itemError) {
            errors.push(`Baris ${rowNumBase}: Tidak ada item yang valid`)
          }
          continue
        }

        const subtotal = purchaseItems.reduce((sum, it) => sum + it.totalPrice, 0)
        const total = subtotal

        const year = new Date(tanggal).getFullYear().toString()
        let purchaseNumber = String(firstRow['No Pembelian'] || '').trim()
        if (!purchaseNumber) {
          purchaseNumber = await nextPurchaseNumber(year)
        } else {
          const existingNum = await rawGet<any>('SELECT id FROM purchases WHERE purchase_number = $1', [purchaseNumber])
          if (existingNum) {
            errors.push(`Baris ${rowNumBase}: No Pembelian "${purchaseNumber}" sudah ada di database`)
            continue
          }
        }

        const createdAt = tanggal + ' 00:00:00'
        const hdrResult = await pool.query(`
          INSERT INTO purchases (
            purchase_number, supplier_id, warehouse_id, purchase_date, invoice_number,
            subtotal, discount_percent, discount_amount, ppn_percent, ppn_amount, total, is_return, user_create, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, 0, $7, 0, $8, $9)
          RETURNING id
        `, [purchaseNumber, supplier.id, warehouseId, tanggal, invoiceNumber, subtotal, total, userId, createdAt])
        const purchaseId = Number(hdrResult.rows[0].id)

        for (const it of purchaseItems) {
          await rawRun(`
            INSERT INTO purchase_items (
              purchase_id, barang_id, quantity, unit_name, unit_ratio, unit_price,
              discount_percent, discount_amount, total_price
            ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7)
          `, [purchaseId, it.barangId, it.quantity, it.unitName, it.unitRatio, it.unitPrice, it.totalPrice])

          const qtyBase = it.quantity * it.unitRatio
          try {
            const unitCostBase = qtyBase > 0 ? (it.totalPrice / qtyBase) : 0

            const currentBal = await rawGet<any>(`
              SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2
            `, [it.barangId, warehouseId])
            const prevQty = currentBal ? Number(currentBal.quantity) || 0 : 0
            const prevTotalCost = currentBal ? Number(currentBal.total_cost) || 0 : 0
            const deltaQty = qtyBase
            const deltaCost = it.isHppEligible ? it.totalPrice : 0
            let newQty = prevQty + deltaQty
            let newTotalCost = prevTotalCost + deltaCost
            const newAvg = (it.isHppEligible && newQty > 0) ? (newTotalCost / newQty) : (currentBal ? Number(currentBal.avg_cost) || 0 : 0)

            await rawRun(`
              INSERT INTO stock_movements (
                ingredient_id, warehouse_id, movement_type, quantity, unit,
                reference_type, reference_id, period_id, transaction_date, notes, created_at,
                unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            `, [
              it.barangId, warehouseId, 'in', Math.abs(qtyBase), it.unitName,
              'purchase', purchaseId, period.id, tanggal, 'import pembelian', tanggal,
              it.isHppEligible ? unitCostBase : null,
              it.isHppEligible ? Math.abs(it.totalPrice) : null,
              newQty,
              it.isHppEligible ? newTotalCost : (currentBal ? prevTotalCost : 0),
              it.isHppEligible ? newAvg : (currentBal ? Number(currentBal.avg_cost) || 0 : 0)
            ])

            if (currentBal) {
              await rawRun(`
                UPDATE stock_balance 
                SET quantity = quantity + $1, 
                    total_cost = COALESCE(total_cost,0) + $2,
                    avg_cost = CASE WHEN (quantity + $3) > 0 THEN (COALESCE(total_cost,0) + $4) / (quantity + $5) ELSE 0 END,
                    updated_at = $6
                WHERE ingredient_id = $7 AND warehouse_id = $8
              `, [deltaQty, deltaCost, deltaQty, deltaCost, deltaQty, createdAt, it.barangId, warehouseId])
            } else {
              await rawRun(`
                INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, total_cost, avg_cost, created_at, updated_at) 
                VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, [it.barangId, warehouseId, deltaQty, it.isHppEligible ? it.totalPrice : 0, it.isHppEligible ? unitCostBase : 0, createdAt, createdAt])
            }
          } catch (stockError) {
            console.error('Stock update error during import:', stockError)
          }
        }

        successRows.push(`Baris ${rowNumBase}: ${purchaseNumber} - ${tanggal} - ${supplier.name} - Rp ${total.toLocaleString()} (${purchaseItems.length} item)`)
        imported++
      } catch (err: any) {
        errors.push(`Baris ${rowNumBase}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      total: groups.length,
      failed: errors.length,
      errors,
      successMessages: successRows,
    })
  } catch (error: any) {
    console.error('Error importing purchases:', error)
    return NextResponse.json({ error: 'Gagal import data: ' + error.message }, { status: 500 })
  }
}
