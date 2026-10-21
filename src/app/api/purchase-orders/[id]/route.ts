import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

async function ensurePurchaseTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      po_number TEXT UNIQUE,
      supplier_id INTEGER,
      supplier_name TEXT,
      order_date TEXT,
      period_id INTEGER,
      expected_date TEXT,
      subtotal REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      ppn_percent REAL DEFAULT 0,
      ppn_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      po_status TEXT DEFAULT 'outstanding',
      realisasi_manual INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      void INTEGER DEFAULT 0,
      notes TEXT,
      user_create INTEGER,
      user_edit INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id SERIAL PRIMARY KEY,
      po_id INTEGER NOT NULL,
      barang_id INTEGER,
      barang_code TEXT,
      barang_name TEXT,
      quantity REAL DEFAULT 0,
      unit_name TEXT,
      unit_ratio REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      discount_total REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      received_qty REAL DEFAULT 0,
      received_qty_base REAL DEFAULT 0,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
    );
  `)
  try {
    const poiCols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_order_items'"
    )
    const poiNames = new Set(poiCols.map((c: any) => c.column_name))
    if (!poiNames.has('discount_total')) await rawRun("ALTER TABLE purchase_order_items ADD COLUMN discount_total REAL DEFAULT 0")
    await rawRun(`UPDATE purchase_order_items SET discount_amount = ROUND(COALESCE(unit_price, 0) * discount_percent / 100) WHERE quantity > 1 AND discount_percent > 0 AND ABS(discount_amount - ROUND(quantity * COALESCE(unit_price, 0) * discount_percent / 100)) < 10`)
  } catch {}
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request, 'po', 'view') && !hasPermission(request, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat purchase order' }, { status: 403 })
    }
    await ensurePurchaseTables()
    const id = params.id

    const po = await rawGet<any>(`
      SELECT po.*, ms.name AS supplier_name_join, ms.code AS supplier_code_join
      FROM purchase_orders po
      LEFT JOIN master_supplier ms ON ms.id = po.supplier_id
      WHERE po.id = $1 OR po.po_number = $2
      LIMIT 1
    `, [id, id])

    if (!po) return NextResponse.json({ error: 'PO tidak ditemukan' }, { status: 404 })

    po.supplier_name = po.supplier_name_join ?? po.supplier_name
    po.supplier_code = po.supplier_code_join ?? null

    const items = await rawAll<any>(`
      SELECT poi.*, mb.code AS barang_code_join, mb.name AS barang_name_join
      FROM purchase_order_items poi
      LEFT JOIN master_barang mb ON mb.id = poi.barang_id
      WHERE poi.po_id = $1
      ORDER BY poi.id ASC
    `, [po.id])

    const enrichedItems = items.map((it: any) => ({
      ...it,
      barang_code: it.barang_code_join ?? it.barang_code,
      barang_name: it.barang_name_join ?? it.barang_name,
    }))

    return NextResponse.json({ ...po, items: enrichedItems })
  } catch (e: any) {
    console.error('GET /api/purchase-orders/[id] error:', e)
    return NextResponse.json({ error: 'Gagal mengambil purchase order' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request, 'po', 'edit') && !hasPermission(request, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah purchase order' }, { status: 403 })
    }
    await ensurePurchaseTables()
    const id = Number(params.id)
    if (!id || isNaN(id)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const data = await request.json()

    const requestVoid = Number(data?.void || 0) === 1 || String(data?.void || '').toLowerCase() === 'true'
    if (requestVoid) {
      await rawRun(`
        CREATE TABLE IF NOT EXISTS purchases (
          id SERIAL PRIMARY KEY,
          po_id INTEGER,
          void INTEGER DEFAULT 0
        );
      `)
      const row = await rawGet<any>(`SELECT COUNT(1) AS cnt FROM purchases WHERE po_id = $1 AND COALESCE(void,0) = 0`, [id])
      if (Number(row?.cnt || 0) > 0) {
        return NextResponse.json({ error: 'PO sudah digunakan di pembelian dan tidak dapat di-void' }, { status: 400 })
      }
    }

    const payload: Record<string, any> = {}
    const supplierId = data.supplierId ?? data.supplier_id ?? data.supplier?.id
    if (supplierId != null) payload.supplier_id = Number(supplierId)
    const orderDate = data.orderDate ? String(data.orderDate).slice(0, 10) : (data.order_date ? String(data.order_date).slice(0, 10) : null)
    if (orderDate != null) payload.order_date = orderDate
    const expectedDate = data.expectedDate ? String(data.expectedDate).slice(0, 10) : (data.expected_date ? String(data.expected_date).slice(0, 10) : null)
    if (expectedDate != null) payload.expected_date = expectedDate
    if (data.discountPercent != null) payload.discount_percent = Number(data.discountPercent)
    else if (data.discount_percent != null) payload.discount_percent = Number(data.discount_percent)
    if (data.discountAmount != null) payload.discount_amount = Number(data.discountAmount)
    else if (data.discount_amount != null) payload.discount_amount = Number(data.discount_amount)
    if (data.ppnPercent != null) payload.ppn_percent = Number(data.ppnPercent)
    else if (data.ppn_percent != null) payload.ppn_percent = Number(data.ppn_percent)
    if (data.ppnAmount != null) payload.ppn_amount = Number(data.ppnAmount)
    else if (data.ppn_amount != null) payload.ppn_amount = Number(data.ppn_amount)
    if (data.subtotal != null) payload.subtotal = Number(data.subtotal)
    if (data.total != null) payload.total = Number(data.total)
    if (data.po_status != null) payload.po_status = String(data.po_status)
    else if (data.poStatus != null) payload.po_status = String(data.poStatus)
    if (data.status != null) payload.status = String(data.status)
    if (data.void != null) payload.void = typeof data.void === 'number' ? data.void : (data.void ? 1 : 0)
    if (data.notes != null) payload.notes = String(data.notes)
    else if (data.note != null) payload.notes = String(data.note)

    const sets: string[] = []
    const vals: any[] = []
    let pidx = 0
    for (const [k, v] of Object.entries(payload)) {
      if (v !== null && v !== undefined) { pidx++; sets.push(`${k} = $${pidx}`); vals.push(v) }
    }
    if (sets.length === 0) return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 })

    const userId = getUserId(request)
    pidx++; sets.push(`user_edit = $${pidx}`); vals.push(userId)
    const sql = `UPDATE purchase_orders SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${pidx + 1}`
    vals.push(id)
    const res = await rawRun(sql, vals)
    if (res.rowCount === 0) return NextResponse.json({ error: 'PO tidak ditemukan' }, { status: 404 })

    const poStatusVal = payload.po_status
    const manualFlag = poStatusVal === 'realisasi' ? 1 : 0
    await rawRun(`UPDATE purchase_orders SET realisasi_manual = $1 WHERE id = $2`, [manualFlag, id])

    if (Array.isArray(data.items)) {
      const ppnPercent = Number(data.ppnPercent ?? data.ppn_percent) || (await rawGet<any>("SELECT setting_value FROM settings WHERE setting_key = 'purchase_default_ppn_percent'").then(r => Number(r?.setting_value || 11)).catch(() => 11))
      const ppnRate = Math.max(0, ppnPercent) / 100
      const roundRp = (n: number) => Math.round(n)
      await rawRun(`DELETE FROM purchase_order_items WHERE po_id = $1`, [id])
      for (const it of data.items) {
        const barangId = it.barangId ?? it.barang_id ?? it.productId ?? null
        if (!barangId) continue
        const qty = Number(it.quantity ?? it.qty) || 0
        const unitPrice = Number(it.unitPrice ?? it.price) || 0
        const gross = unitPrice * qty
        const discAmt = Number(it.discountAmount ?? it.discount_amount) || 0
        const lineDisc = Math.round(discAmt * qty)
        const dpp = Math.max(0, gross - lineDisc)
        const tax = roundRp(dpp * ppnRate)
        const totalPrice = dpp + tax
        await rawRun(`
          INSERT INTO purchase_order_items (
            po_id, barang_id, barang_code, barang_name,
            quantity, unit_name, unit_ratio, unit_price,
            discount_percent, discount_amount, discount_total, total_price,
            received_qty, received_qty_base
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          id, barangId,
          it.barangCode ?? it.barang_code ?? it.code ?? '',
          it.barangName ?? it.barang_name ?? it.name ?? '',
          qty,
          it.unitName ?? it.unit_name ?? it.unit ?? 'PCS',
          Number(it.unitRatio ?? it.unit_ratio) || 1,
          unitPrice,
          Number(it.discountPercent ?? it.discount_percent) || 0,
          discAmt,
          lineDisc,
          totalPrice,
          Number(it.receivedQty ?? it.received_qty) || 0,
          Number(it.receivedQtyBase ?? it.received_qty_base) || 0,
        ])
      }
    }

    const updated = await rawGet<any>('SELECT * FROM purchase_orders WHERE id = $1', [id])
    const items = await rawAll<any>('SELECT * FROM purchase_order_items WHERE po_id = $1 ORDER BY id ASC', [id])
    return NextResponse.json({ ...(updated || {}), items })
  } catch (e: any) {
    console.error('PUT /api/purchase-orders/[id] error:', e)
    return NextResponse.json({ error: 'Gagal mengupdate purchase order', details: e.message }, { status: 500 })
  }
}
