import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { getUserId, addAuditColumns } from '@/lib/audit'
import { calculateTieredDiscount, roundRp } from '@/lib/discountUtils'
import { saveJournalEntriesForSource, generateEntriesForSingleSource } from '@/lib/journalHelpers'
import * as XLSX from 'xlsx'

let __pb_seq_cache: Record<string, { base: number; next: number }> = {}

function normalizeDate(val: any): string {
  if (!val) return new Date().toISOString().slice(0, 10)
  if (Object.prototype.toString.call(val) === '[object Date]') {
    const d = val as Date
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const num = Number(val)
  if (isFinite(num) && String(val).trim() !== '' && /^(\d+)(\.\d+)?$/.test(String(val))) {
    const ms = Math.round((num - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const [_, dd, mm, yyyy] = m
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

async function generatePurchaseNumber(date: string, isReturn?: number): Promise<string> {
  const year = new Date(date).getFullYear()
  const prefix = isReturn ? `RET/${year}` : `PB/${year}`
  if (!__pb_seq_cache[prefix]) {
    const last = await rawGet<any>(
      `SELECT purchase_number FROM purchases WHERE purchase_number LIKE $1 ORDER BY purchase_number DESC LIMIT 1`,
      [`${prefix}%`]
    )
    let lastNumber = 0
    if (last?.purchase_number) {
      const match = String(last.purchase_number).match(/\/(\d{6})$/)
      if (match) lastNumber = parseInt(match[1])
    }
    __pb_seq_cache[prefix] = { base: lastNumber, next: lastNumber + 1 }
  }
  const seq = __pb_seq_cache[prefix]
  const num = seq.next
  seq.next++
  return `${prefix}/${String(num).padStart(6, '0')}`
}

export async function POST(request: NextRequest) {
  __pb_seq_cache = {}
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    if (!file.name.match(/\.(xlsx|xls)$/))
      return NextResponse.json({ error: 'File harus berformat Excel (.xlsx atau .xls)' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    if (!workbook.SheetNames.includes('MASTER') || !workbook.SheetNames.includes('DETAIL'))
      return NextResponse.json({ error: 'File harus memiliki 2 sheet: MASTER dan DETAIL' }, { status: 400 })

    const masterSheet = workbook.Sheets['MASTER']
    const masterData = XLSX.utils.sheet_to_json(masterSheet, { header: 1 }) as any[][]
    if (masterData.length < 2)
      return NextResponse.json({ error: 'Sheet MASTER harus memiliki minimal 2 baris (header + data)' }, { status: 400 })

    const detailSheet = workbook.Sheets['DETAIL']
    const detailData = XLSX.utils.sheet_to_json(detailSheet, { header: 1 }) as any[][]
    if (detailData.length < 2)
      return NextResponse.json({ error: 'Sheet DETAIL harus memiliki minimal 2 baris (header + data)' }, { status: 400 })

    const pool = (getDb() as any).$client
    await addAuditColumns()
    const userId = getUserId(request)

    const detailHeaders = detailData[0]
    const txCodeIdx = detailHeaders.findIndex((h: any) =>
      String(h).toLowerCase().includes('transaction code') || String(h).toLowerCase().includes('transactioncode')
    )
    const detailMap = new Map<string, any[][]>()
    if (txCodeIdx >= 0) {
      for (let d = 1; d < detailData.length; d++) {
        const row = detailData[d]
        if (!row || row.length === 0) continue
        const key = row[txCodeIdx] != null ? String(row[txCodeIdx]).trim() : ''
        if (!key) continue
        if (!detailMap.has(key)) detailMap.set(key, [])
        detailMap.get(key)!.push(row)
      }
    }

    const results: any[] = []
    const headers = masterData[0]
    const masterTxIdx = headers.findIndex((h: any) =>
      String(h).toLowerCase().includes('transaction code') || String(h).toLowerCase().includes('transactioncode')
    )

    await rawRun(`CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      purchase_number TEXT, supplier_id INTEGER, warehouse_id INTEGER DEFAULT 1,
      purchase_date TEXT, invoice_number TEXT,
      subtotal REAL DEFAULT 0, discount_percent REAL DEFAULT 0, discount_amount REAL DEFAULT 0,
      total_discount REAL DEFAULT 0, ppn_percent REAL DEFAULT 0, ppn_amount REAL DEFAULT 0, total REAL DEFAULT 0,
      is_return INTEGER DEFAULT 0, status TEXT DEFAULT 'active',
      user_create INTEGER, created_at TIMESTAMP, notes TEXT
    )`)
    await rawRun(`CREATE TABLE IF NOT EXISTS purchase_items (
      id SERIAL PRIMARY KEY,
      purchase_id INTEGER, barang_id INTEGER, quantity REAL DEFAULT 0,
      unit_name TEXT, unit_ratio INTEGER DEFAULT 1, unit_price REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0, discount_amount REAL DEFAULT 0, total_price REAL DEFAULT 0,
      disc1_percent REAL DEFAULT 0, disc1_amount REAL DEFAULT 0,
      disc2_percent REAL DEFAULT 0, disc2_amount REAL DEFAULT 0,
      disc3_percent REAL DEFAULT 0, disc3_amount REAL DEFAULT 0,
      disc_nominal REAL DEFAULT 0,
      gross_amount REAL DEFAULT 0, net_amount REAL DEFAULT 0
    )`)

    for (let i = 1; i < masterData.length; i++) {
      const row = masterData[i]
      if (!row || row.length === 0) continue

      const getValue = (name: string) => {
        const lower = name.toLowerCase()
        for (let j = headers.length - 1; j >= 0; j--) {
          if (String(headers[j]).toLowerCase().includes(lower)) return row[j] || null
        }
        return null
      }

      const txCode = masterTxIdx >= 0 ? String(row[masterTxIdx] || '').trim() : ''
      const detailRows = detailMap.get(txCode) || []

      try {
        const tanggal = normalizeDate(getValue('tanggal'))
        const purchaseNumber = await generatePurchaseNumber(tanggal, isReturn)
        const supplierCode = String(getValue('supplier code') || '').trim()
        const subtotal = Number(getValue('subtotal') || 0)
        const discountPercent = Number(getValue('discount %') || 0)
        const discountAmount = Number(getValue('discount amount') || 0)
        const ppnRaw = getValue('ppn %')
        const ppnPercent = ppnRaw !== null && ppnRaw !== '' ? Number(ppnRaw) : 11
        const total = Number(getValue('total') || 0)
        const notes = String(getValue('notes') || '')
        const warehouseId = Number(getValue('warehouse') || 1)
        const isReturnRaw = getValue('is_return')
        const isReturn = isReturnRaw !== null && String(isReturnRaw).match(/^(1|true|yes)$/i) ? 1 : 0
        const movementRefType = isReturn ? 'purchase_return' : 'purchase'
        const movementType = isReturn ? 'out' : 'in'
        const deltaFactor = isReturn ? -1 : 1

        const suppCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='master_supplier'")
        const hasTerm = new Set(suppCols.map((c: any) => String(c.name).toLowerCase())).has('term')
        const suppQuery = hasTerm
          ? 'SELECT id, code, name, term FROM master_supplier WHERE code = $1 AND isdelete = 0'
          : 'SELECT id, code, name FROM master_supplier WHERE code = $1 AND isdelete = 0'
        const supplier = await rawGet<any>(suppQuery, [supplierCode])
        if (!supplier) throw new Error(`Supplier dengan kode "${supplierCode}" tidak ditemukan`)

        const period = await getPeriodByDate(tanggal)
        if (!period) throw new Error(`Tidak ada periode aktif untuk tanggal ${tanggal}`)
        if (Number(period.is_closed) === 1) throw new Error(`Periode "${period.name}" sudah ditutup`)

        const items: any[] = []
        for (const dr of detailRows) {
          const dGet = (name: string) => {
            const lower = name.toLowerCase()
            for (let j = detailHeaders.length - 1; j >= 0; j--) {
              if (String(detailHeaders[j]).toLowerCase().includes(lower)) return dr[j] || null
            }
            return null
          }
          const barangCode = String(dGet('kode barang') || '').trim()
          if (!barangCode) throw new Error('Kode barang wajib diisi')
          const barang = await rawGet<any>('SELECT id, code, name, jenis FROM master_barang WHERE code = $1 AND isdelete = 0', [barangCode])
          if (!barang) throw new Error(`Barang dengan kode "${barangCode}" tidak ditemukan`)

          const qty = Number(dGet('quantity') || 0)
          if (qty <= 0) throw new Error('Quantity harus lebih dari 0')
          const unit = String(dGet('unit') || 'pcs')
          const unitPrice = Number(dGet('harga satuan') || 0)
          const discPct = Number(dGet('disc%') || 0)
          const disc1Pct = Number(dGet('disc1%') || 0)
          const disc2Pct = Number(dGet('disc2%') || 0)
          const disc3Pct = Number(dGet('disc3%') || 0)
          const discNominal = Number(dGet('discrp') || 0)
          const perUnitNominal = qty > 0 ? roundRp(discNominal / qty) : 0
          const lineTotal = Number(dGet('total') || 0)

          const calc = calculateTieredDiscount(qty, unitPrice, discPct, disc1Pct, disc2Pct, disc3Pct, perUnitNominal * qty)
          if (lineTotal > 0 && Math.abs(lineTotal - calc.netAmount) > 100)
            throw new Error(`Total barang tidak valid. Seharusnya: ${calc.netAmount}, Diberikan: ${lineTotal}`)

          const discNominalStored = qty > 0 ? roundRp(calc.discNominal / qty) : 0
          items.push({
            barangId: barang.id, qty, unit, unitPrice,
            discPct, disc1Pct, disc2Pct, disc3Pct, discNominal: discNominalStored,
            calc, jenis: barang.jenis,
          })
        }

        if (items.length === 0) throw new Error('Tidak ada item valid')

        // hitung dari items, mirip form API
        const itemsGrossTotal = roundRp(items.reduce((s, it) => s + it.calc.grossAmount, 0))
        const itemsNetTotal = roundRp(items.reduce((s, it) => s + it.calc.netAmount, 0))
        if (subtotal > 0 && Math.abs(subtotal - itemsGrossTotal) > 100)
          throw new Error(`Subtotal tidak sesuai. Dari item: ${itemsGrossTotal}, diberikan: ${subtotal}`)

        const headerDiscAmt = discountAmount > 0 ? discountAmount : roundRp(itemsNetTotal * discountPercent / 100)
        const dpp = Math.max(0, itemsNetTotal - headerDiscAmt)
        const ppn = roundRp(dpp * ppnPercent / 100)
        const calcTotal = dpp + ppn
        if (Math.abs(total - calcTotal) > 100)
          throw new Error(`Total tidak valid. Seharusnya: ${calcTotal}, Diberikan: ${total}`)

        const costRatio = itemsNetTotal > 0 ? (total - ppn) / itemsNetTotal : 1

        const createdAt = tanggal + ' 00:00:00'
        const hdrResult = await pool.query(`
          INSERT INTO purchases (purchase_number, supplier_id, warehouse_id, purchase_date, subtotal,
            discount_percent, discount_amount, total_discount, ppn_percent, ppn_amount, total, is_return, status, user_create, created_at, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', $13, $14, $15)
          RETURNING id
        `, [purchaseNumber, supplier.id, warehouseId, tanggal, itemsGrossTotal,
          discountPercent, headerDiscAmt, headerDiscAmt, ppnPercent, ppn, total, isReturn, userId, createdAt, notes])
        const purchaseId = Number(hdrResult.rows[0].id)

        for (const it of items) {
          const c = it.calc
          await rawRun(`
            INSERT INTO purchase_items (purchase_id, barang_id, quantity, unit_name, unit_ratio, unit_price,
              discount_percent, discount_amount, total_price,
              disc1_percent, disc1_amount, disc2_percent, disc2_amount, disc3_percent, disc3_amount,
              disc_nominal, gross_amount, net_amount)
            VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          `, [purchaseId, it.barangId, it.qty, it.unit, it.unitPrice,
            c.discountPercent, c.discountAmount, c.netAmount,
            c.disc1Percent, c.disc1Amount, c.disc2Percent, c.disc2Amount, c.disc3Percent, c.disc3Amount,
            it.discNominal, c.grossAmount, c.netAmount])

          const qtyBase = it.qty * deltaFactor
          const invCost = Number((c.netAmount * costRatio).toFixed(2))
          const unitCostBase = invCost / it.qty

          try {
            const curBal = await rawGet<any>('SELECT quantity, total_cost, avg_cost FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2', [it.barangId, warehouseId])
            const prevQty = curBal ? Number(curBal.quantity) || 0 : 0
            const prevCost = curBal ? Number(curBal.total_cost) || 0 : 0
            const isHpp = Number(it.jenis) === 1 || Number(it.jenis) === 2 || Number(it.jenis) === 3
            const deltaCost = isHpp ? (isReturn ? -invCost : invCost) : 0
            const newQty = prevQty + qtyBase
            const newCost = prevCost + deltaCost
            const newAvg = isHpp && newQty > 0 ? newCost / newQty : (curBal ? Number(curBal.avg_cost) || 0 : 0)

            await rawRun(`
              INSERT INTO stock_movements (ingredient_id, warehouse_id, movement_type, quantity, unit,
                reference_type, reference_id, period_id, transaction_date, notes, created_at,
                unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'import pembelian', $10,
                $11, $12, $13, $14, $15)
            `, [it.barangId, warehouseId, movementType, Math.abs(qtyBase), it.unit, movementRefType, purchaseId, period.id, tanggal, createdAt,
              isHpp ? unitCostBase : null, isHpp ? Math.abs(invCost) : null, newQty, isHpp ? newCost : prevCost, newAvg])

            if (curBal) {
              await rawRun(`UPDATE stock_balance SET quantity = quantity + $1, total_cost = COALESCE(total_cost,0) + $2,
                avg_cost = CASE WHEN (quantity + $3) > 0 THEN (COALESCE(total_cost,0) + $4) / (quantity + $5) ELSE 0 END,
                updated_at = $6 WHERE ingredient_id = $7 AND warehouse_id = $8`,
                [qtyBase, deltaCost, qtyBase, deltaCost, qtyBase, createdAt, it.barangId, warehouseId])
            } else {
              await rawRun(`INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, total_cost, avg_cost, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [it.barangId, warehouseId, qtyBase, isHpp ? invCost : 0, newAvg, createdAt, createdAt])
            }
          } catch (stockErr) {
            console.warn('Stock update error:', stockErr)
          }
        }

        // Save journal entries
        try {
          const srcType = isReturn ? 'Retur Pembelian' : 'Pembelian'
          const entries = await generateEntriesForSingleSource(srcType, purchaseNumber, tanggal)
          if (entries.length > 0) {
            await saveJournalEntriesForSource(srcType, purchaseId, purchaseNumber, tanggal, entries)
          }
        } catch (jeErr) {
          console.error('Failed to save journal entries for import:', jeErr)
        }

        results.push({ row: i + 1, success: true, purchase: purchaseNumber, message: 'Berhasil' })
      } catch (error: any) {
        results.push({ row: i + 1, success: false, error: error.message })
      }
    }

    const successCount = results.filter(r => r.success).length
    const errorCount = results.filter(r => !r.success).length
    return NextResponse.json({
      success: errorCount === 0,
      message: `Import selesai. Sukses: ${successCount}, Gagal: ${errorCount}`,
      results,
    })
  } catch (error: any) {
    console.error('Import pembelian error:', error)
    return NextResponse.json({ error: error.message || 'Import gagal' }, { status: 500 })
  }
}
