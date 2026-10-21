import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import * as XLSX from 'xlsx'

let __invoice_seq_cache: Record<string, { base: number; next: number }> = {}

export async function POST(request: NextRequest) {
  __invoice_seq_cache = {}
  try {
    if (!await hasPermission(request as any, 'invoice', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat invoice' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      return NextResponse.json({ error: 'File harus berformat Excel (.xlsx atau .xls)' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    if (!workbook.SheetNames.includes('MASTER') || !workbook.SheetNames.includes('DETAIL')) {
      return NextResponse.json({ error: 'File harus memiliki 2 sheet: MASTER dan DETAIL' }, { status: 400 })
    }

    const masterSheet = workbook.Sheets['MASTER']
    const masterData = XLSX.utils.sheet_to_json(masterSheet, { header: 1 }) as any[][]

    if (masterData.length < 2) {
      return NextResponse.json({ error: 'Sheet MASTER harus memiliki minimal 2 baris (header + data)' }, { status: 400 })
    }

    const detailSheet = workbook.Sheets['DETAIL']
    const detailData = XLSX.utils.sheet_to_json(detailSheet, { header: 1 }) as any[][]

    if (detailData.length < 2) {
      return NextResponse.json({ error: 'Sheet DETAIL harus memiliki minimal 2 baris (header + data)' }, { status: 400 })
    }

    const db = getDb()
    const pool = (db as any).$client
    await addAuditColumns()
    const currentUserId = getUserId(request as any)

    const detailHeaders = detailData[0]
    const txCodeColIdx = detailHeaders.findIndex((h: any) =>
      String(h).toLowerCase().includes('transaction code') ||
      String(h).toLowerCase().includes('transactioncode')
    )
    const detailMap = new Map<string, any[][]>()
    if (txCodeColIdx >= 0) {
      for (let d = 1; d < detailData.length; d++) {
        const detailRow = detailData[d]
        if (!detailRow || detailRow.length === 0) continue
        const key = detailRow[txCodeColIdx] !== null && detailRow[txCodeColIdx] !== undefined
          ? String(detailRow[txCodeColIdx]).trim()
          : ''
        if (!key) continue
        if (!detailMap.has(key)) detailMap.set(key, [])
        detailMap.get(key)!.push(detailRow)
      }
    }

    const results = []
    const headers = masterData[0]

    for (let i = 1; i < masterData.length; i++) {
      const row = masterData[i]
      if (!row || row.length === 0) continue

      const masterTxCode = String(
        row[headers.findIndex((h: any) =>
          String(h).toLowerCase().includes('transaction code') ||
          String(h).toLowerCase().includes('transactioncode')
        )] || ''
      ).trim()
      const detailRows = detailMap.get(masterTxCode) || []

      try {
        const result = await processInvoiceRow(db, pool, headers, row, detailHeaders, detailRows, currentUserId)
        results.push({ row: i + 1, success: true, invoice: result.invoice_number, message: 'Berhasil' })
      } catch (error: any) {
        results.push({ row: i + 1, success: false, error: error.message })
      }
    }

    const successCount = results.filter(r => r.success).length
    const errorCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: errorCount === 0,
      message: `Import selesai. Sukses: ${successCount}, Gagal: ${errorCount}`,
      results
    })

  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json({ error: error.message || 'Import gagal' }, { status: 500 })
  }
}

async function processInvoiceRow(db: any, pool: any, headers: string[], row: any[], detailHeaders: string[], detailRows: any[][], userId: number) {
  const getValue = (headerName: string) => {
    const lower = headerName.toLowerCase()
    for (let i = headers.length - 1; i >= 0; i--) {
      if (String(headers[i]).toLowerCase().includes(lower)) {
        return row[i] || null
      }
    }
    return null
  }

  const tglNota = normalizeDate(getValue('tanggal nota'))
  const invoiceNumber = await generateInvoiceNumber(db, pool, tglNota)
  const customerCode = String(getValue('customer code') || '').trim()
  const subtotal = Number(getValue('subtotal') || 0)
  const discountPercent = Number(getValue('discount %') || 0)
  const discountAmount = Number(getValue('discount amount') || 0)
  const ppnPercent = Number(getValue('ppn %') || 11)
  const total = Number(getValue('total') || 0)
  const notes = String(getValue('notes') || '')
  const warehouseId = Number(getValue('warehouse') || 1)

  const customerCols = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='master_customer'`) as { name: string }[]
  const custHasPaymentTerms = new Set(customerCols.map(c => String(c.name).toLowerCase())).has('payment_terms')
  const custQuery = custHasPaymentTerms
    ? 'SELECT id, name, payment_terms FROM master_customer WHERE code = ? AND isdelete = 0'
    : 'SELECT id, name FROM master_customer WHERE code = ? AND isdelete = 0'
  const customer = await rawGet(custQuery, [customerCode]) as any
  if (!customer) {
    throw new Error(`Customer dengan kode "${customerCode}" tidak ditemukan`)
  }
  const paymentTerms = Number(customer.payment_terms || 30)
  const dueDate = new Date(tglNota)
  dueDate.setDate(dueDate.getDate() + paymentTerms)
  const dueDateStr = dueDate.toISOString().slice(0, 10)

  const existingInvoice = await rawGet('SELECT id FROM transactions WHERE transaction_number = ?', [invoiceNumber])
  if (existingInvoice) {
    throw new Error(`Invoice dengan nomor "${invoiceNumber}" sudah ada`)
  }

  const period = await getPeriodByDate(tglNota)
  if (!period) {
    throw new Error(`Tidak ada periode aktif untuk tanggal ${tglNota}`)
  }

  const calculatedDiscount = discountAmount > 0 ? discountAmount : Math.round(subtotal * discountPercent / 100)
  const dppAfterDiscount = Math.max(0, subtotal - calculatedDiscount)
  const ppnAmount = Math.round(dppAfterDiscount * ppnPercent / 100)
  const calculatedTotal = dppAfterDiscount + ppnAmount

  if (Math.abs(total - calculatedTotal) > 100) {
    throw new Error(`Total tidak valid. Seharusnya: ${calculatedTotal}, Diberikan: ${total}`)
  }

  const createdAt = tglNota + ' 00:00:00'
  const r = await pool.query(`
    INSERT INTO transactions (
      transaction_number, customer_id, customer_name, customer_code,
      subtotal, discount_percent, discount_amount,
      ppn_percent, ppn_amount, total,
      payment_method, payment_amount, status,
      transaction_type, period_id, due_date, payment_terms, notes,
      warehouse_id, tgl_nota, user_create, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    RETURNING id
  `, [
    invoiceNumber, customer.id, customer.name, customer.code,
    subtotal, discountPercent, discountAmount,
    ppnPercent, ppnAmount, total,
     'piutang', 0, 'pending',
     3, period.id, dueDateStr, paymentTerms, notes,
    warehouseId, tglNota, userId, createdAt, createdAt
  ])

  const transactionId = r.rows[0].id

  for (const detailRow of detailRows) {
    await processDetailRow(db, detailHeaders, detailRow, transactionId)
  }

  return {
    invoice_number: invoiceNumber,
    transaction_id: transactionId
  }
}

async function processDetailRow(db: any, headers: string[], row: any[], transactionId: number) {
  const getValue = (headerName: string) => {
    const lower = headerName.toLowerCase()
    for (let i = headers.length - 1; i >= 0; i--) {
      if (String(headers[i]).toLowerCase().includes(lower)) {
        return row[i] || null
      }
    }
    return null
  }

  const barangCode = String(getValue('kode barang') || '').trim()
  const quantity = Number(getValue('quantity') || 0)
  const unit = String(getValue('unit') || 'pcs')
  const unitPrice = Number(getValue('harga satuan') || 0)
  const discountPercent = Number(getValue('discount %') || 0)
  const discountAmount = Number(getValue('discount amount') || 0)
  const total = Number(getValue('total') || 0)

  if (!barangCode) {
    throw new Error('Kode barang wajib diisi')
  }

  if (quantity <= 0) {
    throw new Error('Quantity harus lebih dari 0')
  }

  const barang = await rawGet('SELECT id, name FROM master_barang WHERE code = ? AND aktif = 1', [barangCode]) as any
  if (!barang) {
    throw new Error(`Barang dengan kode "${barangCode}" tidak ditemukan`)
  }

  const calculatedDiscount = discountAmount > 0 ? discountAmount : (unitPrice * quantity) * discountPercent / 100
  const calculatedTotal = (unitPrice * quantity) - calculatedDiscount

  if (Math.abs(total - calculatedTotal) > 100) {
    throw new Error(`Total barang tidak valid. Seharusnya: ${calculatedTotal}, Diberikan: ${total}`)
  }

  await rawRun(`
    INSERT INTO transaction_items (
      transaction_id, barang_id, barang_code, barang_name,
      quantity, unit_name, unit_price, discount_percent, discount_amount, total_price,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    transactionId, barang.id, barangCode, barang.name,
    quantity, unit, unitPrice, discountPercent, discountAmount, total
  ])
}

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

async function generateInvoiceNumber(db: any, pool: any, date: string): Promise<string> {
  const year = new Date(date).getFullYear()
  const prefix = `JL/${year}`
  const cacheKey = prefix

  if (!__invoice_seq_cache[cacheKey]) {
    const last = await rawGet(`
      SELECT transaction_number 
      FROM transactions 
      WHERE transaction_number LIKE ? 
      AND transaction_type = 3
      ORDER BY transaction_number DESC 
      LIMIT 1
    `, [`${prefix}%`]) as any

    let lastNumber = 0
    if (last) {
      const match = last.transaction_number.match(/\/(\d{6})$/)
      if (match) {
        lastNumber = parseInt(match[1])
      }
    }
    __invoice_seq_cache[cacheKey] = { base: lastNumber, next: lastNumber + 1 }
  }

  const seq = __invoice_seq_cache[cacheKey]
  const num = seq.next
  seq.next++
  return `${prefix}/${String(num).padStart(6, '0')}`
}
