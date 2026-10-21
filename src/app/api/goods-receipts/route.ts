import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'

async function ensureTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS goods_receipts (
      id SERIAL PRIMARY KEY,
      gr_number TEXT NOT NULL UNIQUE,
      po_id INTEGER,
      po_number TEXT,
      supplier_id INTEGER,
      supplier_name TEXT,
      receipt_date TEXT NOT NULL,
      notes TEXT,
      subtotal REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      ppn_percent REAL DEFAULT 11,
      ppn_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      user_create INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS goods_receipt_items (
      id SERIAL PRIMARY KEY,
      gr_id INTEGER NOT NULL,
      barang_id INTEGER NOT NULL,
      barang_code TEXT,
      barang_name TEXT,
      quantity REAL NOT NULL,
      unit_name TEXT,
      unit_ratio REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_price REAL DEFAULT 0
    )
  `)
}

async function generateGRNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `GR/${year}/`
  const lastGR = await rawGet<any>(
    `SELECT gr_number FROM goods_receipts 
     WHERE gr_number LIKE ? 
     ORDER BY gr_number DESC LIMIT 1`,
    `${prefix}%`
  )
  let nextNumber = 1
  if (lastGR) {
    const lastNum = parseInt(lastGR.gr_number.split('/')[2])
    nextNumber = lastNum + 1
  }
  return `${prefix}${nextNumber.toString().padStart(6, '0')}`
}

async function updateStock(items: any[]) {
  for (const item of items) {
    const qtyInBaseUnit = item.quantity * item.unit_ratio
    await rawRun(`UPDATE master_barang SET stok = COALESCE(stok, 0) + ? WHERE id = ?`, [qtyInBaseUnit, item.barang_id])
  }
}

export async function GET() {
  try {
    await ensureTables()
    const receipts = await rawAll<any>(`
      SELECT gr.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', gri.id,
            'barang_id', gri.barang_id,
            'barang_code', gri.barang_code,
            'barang_name', gri.barang_name,
            'quantity', gri.quantity,
            'unit_name', gri.unit_name,
            'unit_ratio', gri.unit_ratio,
            'unit_price', gri.unit_price,
            'discount_percent', gri.discount_percent,
            'discount_amount', gri.discount_amount,
            'total_price', gri.total_price
          )) FROM goods_receipt_items gri WHERE gri.gr_id = gr.id),
          '[]'
        ) as items
      FROM goods_receipts gr
      ORDER BY gr.created_at DESC
    `)
    const result = receipts.map((gr: any) => ({
      ...gr,
      items: typeof gr.items === 'string' ? JSON.parse(gr.items) : gr.items
    }))
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching goods receipts:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      poId, poNumber, supplierId, supplierName, receiptDate, notes,
      discountPercent = 0, items = []
    } = body

    if (!receiptDate || items.length === 0) {
      return NextResponse.json({ error: 'Receipt date and items are required' }, { status: 400 })
    }

    await ensureTables()
    const grNumber = await generateGRNumber()
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0)
    const discountAmount = Math.round(subtotal * (discountPercent / 100))
    const dpp = subtotal - discountAmount
    const ppnPercent = 11
    const ppnAmount = Math.round(dpp * (ppnPercent / 100))
    const total = dpp + ppnAmount

    const userId = getUserId(request)
    const result = await rawRun<any>(
      `INSERT INTO goods_receipts (gr_number, po_id, po_number, supplier_id, supplier_name,
        receipt_date, notes, subtotal, discount_percent, discount_amount,
        ppn_percent, ppn_amount, total, status, user_create, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [grNumber, poId, poNumber, supplierId, supplierName,
        receiptDate, notes, dpp, discountPercent, discountAmount,
        ppnPercent, ppnAmount, total, userId]
    )
    const grId = result?.rows?.[0]?.id || result?.id || 0

    for (const item of items) {
      await rawRun(
        `INSERT INTO goods_receipt_items (gr_id, barang_id, barang_code, barang_name, quantity,
          unit_name, unit_ratio, unit_price, discount_percent, discount_amount, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [grId, item.barang_id, item.barang_code, item.barang_name, item.quantity,
          item.unit_name, item.unit_ratio || 1, item.unit_price || 0,
          item.discount_percent || 0, item.discount_amount || 0, item.total_price || 0]
      )
    }

    await updateStock(items)

    if (poId) {
      await rawRun(`UPDATE purchase_orders SET status = 'realisasi' WHERE id = ?`, [poId])
    }

    return NextResponse.json({
      success: true, grNumber,
      message: 'Goods receipt created and stock updated successfully'
    })
  } catch (error: any) {
    console.error('Error creating goods receipt:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
