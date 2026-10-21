import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getAllowBackdate } from '@/lib/settingsHelper'

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

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request, 'po', 'view') && !hasPermission(request, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat purchase order' }, { status: 403 })
    }
    await ensurePurchaseTables()

    await rawRun(`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        po_id INTEGER,
        void INTEGER DEFAULT 0
      );
    `)

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || '').toLowerCase()
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const supplierIdParam = searchParams.get('supplier_id') || searchParams.get('supplierId')
    const supplierId = supplierIdParam ? Number(supplierIdParam) : null

    const where: string[] = []
    const args: any[] = []
    let pidx = 0
    if (status === 'outstanding') {
      where.push("po.po_status = 'outstanding' AND po.void = 0")
    } else if (status === 'realisasi') {
      where.push("po.po_status = 'realisasi' AND po.void = 0")
    } else if (status === 'void') {
      where.push('po.void = 1')
    }

    if (q) {
      pidx++; where.push(`(po.po_number ILIKE $${pidx} OR COALESCE(ms.name, po.supplier_name, '') ILIKE $${pidx})`)
      args.push(`%${q}%`)
    }

    if (supplierId && Number.isFinite(supplierId)) {
      pidx++; where.push(`po.supplier_id = $${pidx}`)
      args.push(supplierId)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = await rawAll<any>(`
      SELECT
        po.*,
        ms.name AS supplier_name_join,
        (
          SELECT COUNT(1)
          FROM purchases p
          WHERE p.po_id = po.id AND COALESCE(p.void,0) = 0
        ) AS active_purchase_count
      FROM purchase_orders po
      LEFT JOIN master_supplier ms ON ms.id = po.supplier_id
      ${whereSql}
      ORDER BY po.created_at DESC
    `, args)

    const list: any[] = []
    for (const po of rows) {
      const supplier_name = po.supplier_name_join ?? po.supplier_name ?? null
      const items = await rawAll<any>('SELECT * FROM purchase_order_items WHERE po_id = $1 ORDER BY id ASC', [po.id])
      list.push({ ...po, supplier_name, supplierName: supplier_name, items, active_purchase_count: Number(po.active_purchase_count || 0) })
    }

    return NextResponse.json(list)
  } catch (e: any) {
    console.error('GET /api/purchase-orders error:', e)
    return NextResponse.json({ error: 'Gagal mengambil purchase orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request, 'po', 'create') && !hasPermission(request, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat purchase order' }, { status: 403 })
    }
    await ensurePurchaseTables()

    const data = await request.json()

    const pool = (getDb() as any).$client
    const today = new Date().toISOString().slice(0, 10)
    const canBackdate = await getAllowBackdate(pool) || hasPermission(request as any, 'po', 'backdate')
    const orderDate = ((canBackdate ? (data.orderDate || today) : today) || today).slice(0, 10)

    const year = new Date(orderDate).getFullYear()
    const last = await rawGet<any>(`SELECT po_number FROM purchase_orders WHERE po_number LIKE $1 ORDER BY po_number DESC LIMIT 1`, [`PO/${year}/%`])
    let seq = 1
    if (last) {
      const parts = String(last.po_number).split('/')
      const lastSeq = parseInt(parts[2] || '0')
      seq = (isNaN(lastSeq) ? 0 : lastSeq) + 1
    }
    const poNumber = `PO/${year}/${seq.toString().padStart(6, '0')}`

    const srows = await rawAll<any>(`SELECT setting_key, setting_value FROM settings WHERE setting_group = 'pembelian'`)
    const smap: Record<string, string> = {}
    for (const r of srows) smap[r.setting_key] = String(r.setting_value ?? '')
    const ppnPercent = Number(smap['purchase_default_ppn_percent'] || smap['sales_default_ppn_percent'] || '11') || 0
    const r = Math.max(0, ppnPercent) / 100
    const roundRp = (n: number) => Math.round(n)

    let dppSum = 0
    const items = Array.isArray(data.items) ? data.items : []
    const normalizedItems = items
      .filter((it: any) => (it?.barangId ?? it?.barang_id ?? it?.productId) != null)
      .map((it: any) => {
        const qty = Number(it.quantity ?? it.qty) || 0
        const uiPrice = Number(it.unitPrice ?? it.price) || 0
        const unitPriceEx = uiPrice
        const gross = unitPriceEx * qty
        const discPercent = Number(it.discountPercent ?? it.discount_percent) || 0
        const discAmountGiven = Number(it.discountAmount ?? it.discount_amount) || 0
        const perUnitDisc = discAmountGiven > 0 ? discAmountGiven : (discPercent > 0 ? roundRp(unitPriceEx * (Math.max(0, discPercent) / 100)) : 0)
        const lineDisc = roundRp(perUnitDisc * qty)
        const dpp = Math.max(0, gross - lineDisc)
        const tax = roundRp(dpp * r)
        const total = dpp + tax
        dppSum += dpp
        return {
          barang_id: it.barangId ?? it.barang_id ?? it.productId ?? null,
          barang_code: it.barangCode ?? it.barang_code ?? it.code ?? '',
          barang_name: it.barangName ?? it.barang_name ?? it.name ?? '',
          quantity: qty,
          unit_name: it.unitName ?? it.unit_name ?? it.unit ?? 'PCS',
          unit_ratio: Number(it.unitRatio ?? it.unit_ratio) || 1,
          unit_price: unitPriceEx,
          discount_percent: discPercent,
          discount_amount: perUnitDisc,
          discount_total: lineDisc,
          total_price: total,
        }
      })

    const headerDiscPercent = Number(data.discountPercent) || 0
    const headerDiscAmount = roundRp(dppSum * (headerDiscPercent / 100))
    const dppHeader = Math.max(0, dppSum - headerDiscAmount)
    const ppnAmount = roundRp(dppHeader * r)
    const grandTotal = dppHeader + ppnAmount

    const userId = getUserId(request)

    const period = await getPeriodByDate(orderDate)
    if (!period) {
      return NextResponse.json({ error: `Periode belum ada untuk tanggal ${orderDate}. Silakan buat periode terlebih dahulu di menu Periode.` }, { status: 400 })
    }
    if (Number(period.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${period.name}' sudah ditutup.` }, { status: 400 })
    }
    const periodId = period.id

    const supplierId = data.supplierId ?? data.supplier_id ?? data.supplier?.id ?? null
    const supplierName = data.supplierName ?? data.supplier_name ?? data.supplier?.name ?? null
    const poStatusValue = data.poStatus ?? data.po_status ?? 'outstanding'

    const res = await pool.query(`
      INSERT INTO purchase_orders (
        po_number, supplier_id, supplier_name, order_date, period_id, expected_date,
        subtotal, discount_percent, discount_amount, ppn_percent, ppn_amount, total,
        po_status, status, notes, user_create, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active', $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `, [
      poNumber, supplierId, supplierName, orderDate, periodId,
      data.expectedDate ?? data.expected_date ?? null,
      dppHeader, headerDiscPercent, headerDiscAmount, ppnPercent, ppnAmount, grandTotal,
      poStatusValue, data.notes ?? data.note ?? null, userId
    ])
    const poId = Number(res.rows[0].id)

    for (const it of normalizedItems) {
      await rawRun(`
        INSERT INTO purchase_order_items (
          po_id, barang_id, barang_code, barang_name,
          quantity, unit_name, unit_ratio, unit_price,
          discount_percent, discount_amount, discount_total, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        poId, it.barang_id, it.barang_code, it.barang_name,
        it.quantity, it.unit_name, it.unit_ratio, it.unit_price,
        it.discount_percent, it.discount_amount, it.discount_total, it.total_price
      ])
    }

    return NextResponse.json({ id: poId, poNumber, message: 'Purchase Order berhasil dibuat' })
  } catch (e: any) {
    console.error('POST /api/purchase-orders error:', e)
    return NextResponse.json({ error: e.message || 'Gagal membuat purchase order' }, { status: 500 })
  }
}
