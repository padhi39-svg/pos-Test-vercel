import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getAllowBackdate } from '@/lib/settingsHelper'
import { calculateTieredDiscount, allocateHeaderDiscountProportional, calculatePpn, roundRp } from '@/lib/discountUtils'
import { generateEntriesForSingleSource, saveJournalEntriesForSource, deleteJournalEntriesForSource } from '@/lib/journalHelpers'

async function ensurePurchaseTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      purchase_number TEXT UNIQUE,
      po_id INTEGER,
      supplier_id INTEGER,
      warehouse_id INTEGER DEFAULT 1,
      purchase_date TEXT,
      invoice_number TEXT,
      period_id INTEGER,
      expected_date TEXT,
      subtotal REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      ppn_percent REAL DEFAULT 0,
      ppn_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'unpaid',
      paid_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      void INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS purchase_items (
      id SERIAL PRIMARY KEY,
      purchase_id INTEGER NOT NULL,
      po_item_id INTEGER,
      barang_id INTEGER,
      quantity REAL DEFAULT 0,
      unit_name TEXT,
      unit_ratio REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
    );
  `)
  try {
    const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='purchases'")
    const names = new Set(cols.map(c=>c.name))
    if (!names.has('warehouse_id')) await rawRun("ALTER TABLE purchases ADD COLUMN warehouse_id INTEGER DEFAULT 1")
    if (!names.has('discount_percent')) await rawRun("ALTER TABLE purchases ADD COLUMN discount_percent REAL DEFAULT 0")
    if (!names.has('discount_amount')) await rawRun("ALTER TABLE purchases ADD COLUMN discount_amount REAL DEFAULT 0")
    if (!names.has('ppn_percent')) await rawRun("ALTER TABLE purchases ADD COLUMN ppn_percent REAL DEFAULT 0")
    if (!names.has('ppn_amount')) await rawRun("ALTER TABLE purchases ADD COLUMN ppn_amount REAL DEFAULT 0")
    if (!names.has('faktur_pajak')) await rawRun("ALTER TABLE purchases ADD COLUMN faktur_pajak TEXT")
    if (!names.has('period_id')) await rawRun("ALTER TABLE purchases ADD COLUMN period_id INTEGER")
    if (!names.has('expected_date')) await rawRun("ALTER TABLE purchases ADD COLUMN expected_date TEXT")
    if (!names.has('payment_status')) await rawRun("ALTER TABLE purchases ADD COLUMN payment_status TEXT DEFAULT 'unpaid'")
    if (!names.has('paid_amount')) await rawRun("ALTER TABLE purchases ADD COLUMN paid_amount REAL DEFAULT 0")
    if (!names.has('void')) await rawRun("ALTER TABLE purchases ADD COLUMN void INTEGER DEFAULT 0")
    if (!names.has('po_id')) await rawRun("ALTER TABLE purchases ADD COLUMN po_id INTEGER")
    if (!names.has('total_discount')) await rawRun("ALTER TABLE purchases ADD COLUMN total_discount REAL DEFAULT 0")
  } catch {}
  try {
    const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='purchase_items'")
    const names = new Set(cols.map(c=>c.name))
    if (!names.has('po_item_id')) await rawRun('ALTER TABLE purchase_items ADD COLUMN po_item_id INTEGER')
  } catch {}
  try {
    const piCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='purchase_items'")
    const piNames = new Set(piCols.map(c=>c.name))
    if (!piNames.has('disc1_percent')) await rawRun("ALTER TABLE purchase_items ADD COLUMN disc1_percent REAL DEFAULT 0")
    if (!piNames.has('disc1_amount')) await rawRun("ALTER TABLE purchase_items ADD COLUMN disc1_amount REAL DEFAULT 0")
    if (!piNames.has('disc2_percent')) await rawRun("ALTER TABLE purchase_items ADD COLUMN disc2_percent REAL DEFAULT 0")
    if (!piNames.has('disc2_amount')) await rawRun("ALTER TABLE purchase_items ADD COLUMN disc2_amount REAL DEFAULT 0")
    if (!piNames.has('disc3_percent')) await rawRun("ALTER TABLE purchase_items ADD COLUMN disc3_percent REAL DEFAULT 0")
    if (!piNames.has('disc3_amount')) await rawRun("ALTER TABLE purchase_items ADD COLUMN disc3_amount REAL DEFAULT 0")
    if (!piNames.has('gross_amount')) await rawRun("ALTER TABLE purchase_items ADD COLUMN gross_amount REAL DEFAULT 0")
    if (!piNames.has('net_amount')) await rawRun("ALTER TABLE purchase_items ADD COLUMN net_amount REAL DEFAULT 0")
    if (!piNames.has('disc_nominal')) await rawRun("ALTER TABLE purchase_items ADD COLUMN disc_nominal REAL DEFAULT 0")
    if (!piNames.has('bonus_barang_id')) await rawRun("ALTER TABLE purchase_items ADD COLUMN bonus_barang_id INTEGER")
    if (!piNames.has('bonus_name')) await rawRun("ALTER TABLE purchase_items ADD COLUMN bonus_name TEXT")
    if (!piNames.has('bonus_qty')) await rawRun("ALTER TABLE purchase_items ADD COLUMN bonus_qty REAL DEFAULT 0")
    if (!piNames.has('bonus_unit')) await rawRun("ALTER TABLE purchase_items ADD COLUMN bonus_unit TEXT")
    if (!piNames.has('bonus_unit_ratio')) await rawRun("ALTER TABLE purchase_items ADD COLUMN bonus_unit_ratio REAL DEFAULT 1")
    await rawRun(`UPDATE purchase_items SET disc_nominal = ROUND(disc_nominal / NULLIF(quantity, 0)) WHERE quantity > 1 AND disc_nominal > COALESCE(unit_price, 0) AND disc_nominal > 0`)
  } catch {}
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(_req as any, 'purchase_list', 'view') && !hasPermission(_req as any, 'purchase', 'view') && !hasPermission(_req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat pembelian' }, { status: 403 })
    }
    const pool = (getDb() as any).$client
    await ensurePurchaseTables()
    
    await rawRun(`CREATE TABLE IF NOT EXISTS ap_payments (id SERIAL PRIMARY KEY, status TEXT DEFAULT 'active')`)
    await rawRun(`CREATE TABLE IF NOT EXISTS ap_payment_items (id SERIAL PRIMARY KEY, payment_id INTEGER NOT NULL, purchase_id INTEGER NOT NULL, pay_amount REAL DEFAULT 0)`)

    try {
      const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='ap_payment_items'")
      const names = new Set(cols.map((c:any) => String(c.name)))
      if (!names.has('pay_amount')) { await rawRun("ALTER TABLE ap_payment_items ADD COLUMN pay_amount REAL DEFAULT 0") }
      if (!names.has('purchase_id')) { await rawRun("ALTER TABLE ap_payment_items ADD COLUMN purchase_id INTEGER DEFAULT 0") }
    } catch {}
    try {
      const apCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='ap_payments'")
      const apNames = new Set(apCols.map((c:any)=> String(c.name)))
      if (!apNames.has('status')) { await rawRun("ALTER TABLE ap_payments ADD COLUMN status TEXT DEFAULT 'active'") }
    } catch {}
    
    const id = params.id

    const purchase = await rawGet<any>(`
      SELECT p.*, ms.name AS supplier_name_join, ms.code AS supplier_code_join,
             g.code AS warehouse_code, g.name AS warehouse_name,
             src.purchase_number AS pembelian_number
      FROM purchases p
      LEFT JOIN master_supplier ms ON ms.id = p.supplier_id
      LEFT JOIN master_gudang g ON g.id = p.warehouse_id
      LEFT JOIN purchases src ON src.id = p.pembelian_id
      WHERE p.id = $1 OR p.purchase_number = $2
      LIMIT 1
    `, [id, id])
    
    if (!purchase) return NextResponse.json({ error: 'Pembelian tidak ditemukan' }, { status: 404 })
    
    purchase.supplier_name = purchase.supplier_name_join ?? purchase.supplier_name
    purchase.supplier_code = purchase.supplier_code_join ?? null
    
    const items = await rawAll<any>(`
      SELECT pi.*, mb.code AS barang_code_join, mb.name AS barang_name_join
      FROM purchase_items pi
      LEFT JOIN master_barang mb ON mb.id = pi.barang_id
      WHERE pi.purchase_id = $1
      ORDER BY pi.id ASC
    `, [purchase.id])
    
    const enrichedItems = items.map((it: any) => ({
      ...it,
      barang_code: it.barang_code_join ?? it.barang_code,
      barang_name: it.barang_name_join ?? it.barang_name,
    }))

    return NextResponse.json({ ...purchase, items: enrichedItems })
  } catch (e: any) {
    console.error('GET /api/purchases/[id] error:', e)
    return NextResponse.json({ error: 'Gagal mengambil data pembelian', details: e.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'purchase', 'edit') && !hasPermission(request as any, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah pembelian' }, { status: 403 })
    }
    const pool = (getDb() as any).$client
    await ensurePurchaseTables()
    const id = Number(params.id)
    if (!id || isNaN(id)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const data = await request.json().catch(()=>({}))
    const url = new URL(request.url)
    const qpVoid = url.searchParams.get('void')
    const qpVoidFlag = (qpVoid === '1' || (qpVoid||'').toLowerCase() === 'true')
    const hasBodyVoid = Object.prototype.hasOwnProperty.call(data, 'void')
    const bodyVoidTruthy = hasBodyVoid ? (Number((data as any)?.void) === 1 || String((data as any)?.void).toLowerCase() === 'true') : false
    const requestVoid = qpVoidFlag || bodyVoidTruthy
    if (requestVoid) {
      await rawRun(`CREATE TABLE IF NOT EXISTS ap_payments (id SERIAL PRIMARY KEY, status TEXT DEFAULT 'active')`)
      await rawRun(`CREATE TABLE IF NOT EXISTS ap_payment_items (id SERIAL PRIMARY KEY, payment_id INTEGER NOT NULL, purchase_id INTEGER NOT NULL, pay_amount REAL DEFAULT 0, source_type TEXT, source_id INTEGER, invoice_number TEXT)`)
      try {
        const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='ap_payment_items'")
        const names = new Set(cols.map((c:any) => String(c.name)))
        if (!names.has('pay_amount')) { await rawRun("ALTER TABLE ap_payment_items ADD COLUMN pay_amount REAL DEFAULT 0") }
        if (!names.has('purchase_id')) { await rawRun("ALTER TABLE ap_payment_items ADD COLUMN purchase_id INTEGER DEFAULT 0") }
        if (!names.has('source_type')) { await rawRun("ALTER TABLE ap_payment_items ADD COLUMN source_type TEXT") }
        if (!names.has('source_id')) { await rawRun("ALTER TABLE ap_payment_items ADD COLUMN source_id INTEGER") }
        if (!names.has('invoice_number')) { await rawRun("ALTER TABLE ap_payment_items ADD COLUMN invoice_number TEXT") }
      } catch {}
      try {
        const apCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='ap_payments'")
        const apNames = new Set(apCols.map((c:any)=> String(c.name)))
        if (!apNames.has('status')) { await rawRun("ALTER TABLE ap_payments ADD COLUMN status TEXT DEFAULT 'active'") }
      } catch {}
      const refRow = await rawGet<any>(`
        SELECT COUNT(1) AS cnt, COALESCE(SUM(pi.pay_amount),0) AS paid
        FROM ap_payment_items pi
        JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
        WHERE (pi.purchase_id = $1 OR (pi.source_type = 'purchase' AND pi.source_id = $2) OR pi.invoice_number = $3)
      `, [id, id, String(id)])
      const hasPaymentRef = Number(refRow?.cnt || 0) > 0
      if (hasPaymentRef) {
        return NextResponse.json({ error: 'Pembelian yang sudah memiliki pembayaran hutang tidak dapat di-void' }, { status: 400 })
      }

      const hdr = await rawGet<any>(`SELECT purchase_date, warehouse_id, po_id, is_return, total, ppn_amount FROM purchases WHERE id = $1`, [id])
      if (!hdr) return NextResponse.json({ error: 'Pembelian tidak ditemukan' }, { status: 404 })
      const isReturn = Number(hdr.is_return || 0) === 1
      const movementRefType = isReturn ? 'purchase_return' : 'purchase'
      const rawDate = hdr.purchase_date || new Date().toISOString().slice(0,10)
      const effPurchaseDate = rawDate instanceof Date ? rawDate.toISOString().slice(0,10) : String(rawDate).slice(0,10)
      const period = await getPeriodByDate(effPurchaseDate)
      if (!period) {
        return NextResponse.json({ error: `Periode belum ada untuk tanggal ${effPurchaseDate}.` }, { status: 400 })
      }
      if (Number(period.is_closed) === 1) {
        return NextResponse.json({ error: `Periode '${period.name}' sudah ditutup.` }, { status: 400 })
      }

      const userId = getUserId(request)
      const items = await rawAll<any>(`SELECT po_item_id, barang_id, quantity, unit_ratio, net_amount FROM purchase_items WHERE purchase_id = $1`, [id])
      const whId = Number(hdr.warehouse_id || 1)
      const poId = hdr.po_id ? Number(hdr.po_id) : null
      const hdrTotal = Number(hdr.total) || 0
      const hdrPpn = Number(hdr.ppn_amount) || 0
      const itemsNetTotal = items.reduce((s: number, it: any) => s + (Number(it.net_amount) || 0), 0)
      const costRatio = itemsNetTotal > 0 ? (hdrTotal - hdrPpn) / itemsNetTotal : 1

      await pool.query('BEGIN')
      try {
        for (const it of items) {
          const qtyBase = (Number(it.quantity)||0) * (Number(it.unit_ratio)||1)
          const netAmount = Number(it.net_amount) || 0
          await rawRun(`DELETE FROM stock_movements WHERE reference_type = $1 AND reference_id = $2 AND ingredient_id = $3 AND warehouse_id = $4`, [movementRefType, id, it.barang_id, whId])
          const barangRow = await rawGet<any>(`SELECT jenis FROM master_barang WHERE id = $1`, [it.barang_id])
          const isHpp = barangRow && (Number(barangRow.jenis) === 1 || Number(barangRow.jenis) === 2 || Number(barangRow.jenis) === 3)
          const exist = await rawGet<any>(`SELECT quantity, total_cost, avg_cost FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2`, [it.barang_id, whId])
          if (exist) {
            const revertQty = isReturn ? qtyBase : -qtyBase
            if (isHpp) {
              const invCost = Number((netAmount * costRatio).toFixed(2))
              const revertCost = isReturn ? invCost : -invCost
              const prevTotalCost = Number(exist.total_cost) || 0
              const newTotalCost = prevTotalCost + revertCost
              const prevQty = Number(exist.quantity) || 0
              const newQty = prevQty + revertQty
              const newAvg = (isHpp && newQty > 0) ? (newTotalCost / newQty) : 0
              await rawRun(`UPDATE stock_balance SET quantity = quantity + $1, total_cost = COALESCE(total_cost,0) + $2, avg_cost = CASE WHEN (quantity + $3) > 0 THEN (COALESCE(total_cost,0) + $4) / (quantity + $5) ELSE 0 END, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = $6 AND warehouse_id = $7`, [revertQty, revertCost, revertQty, revertCost, revertQty, it.barang_id, whId])
            } else {
              await rawRun(`UPDATE stock_balance SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = $2 AND warehouse_id = $3`, [revertQty, it.barang_id, whId])
            }
          }
        }

        if (poId) {
          try {
            await rawRun(`CREATE TABLE IF NOT EXISTS purchase_orders (id SERIAL PRIMARY KEY, po_status TEXT DEFAULT 'outstanding', realisasi_manual INTEGER DEFAULT 0, void INTEGER DEFAULT 0)`)
            await rawRun(`CREATE TABLE IF NOT EXISTS purchase_order_items (id SERIAL PRIMARY KEY, po_id INTEGER NOT NULL, barang_id INTEGER, quantity REAL DEFAULT 0, unit_ratio REAL DEFAULT 1, received_qty REAL DEFAULT 0, received_qty_base REAL DEFAULT 0)`)
          } catch {}

          const poHdr = await rawGet<any>(`SELECT id, COALESCE(realisasi_manual,0) AS realisasi_manual FROM purchase_orders WHERE id = $1`, [poId])

          for (const it of items) {
            const qty = Number(it.quantity || 0)
            const unitRatioPurchase = Number(it.unit_ratio || 1) || 1
            let decBase = qty * unitRatioPurchase
            if (decBase <= 0) continue

            const poItemId = it.po_item_id != null ? Number(it.po_item_id) : null
            if (poItemId) {
              const row = await rawGet<any>(`SELECT id, quantity, unit_ratio, received_qty_base FROM purchase_order_items WHERE id = $1 AND po_id = $2`, [poItemId, poId])
              if (!row?.id) continue
              const poUnitRatio = Number(row.unit_ratio || 1) || 1
              const prevBase = Number(row.received_qty_base || 0) || 0
              const nextBase = Math.max(0, prevBase - decBase)
              const nextReceived = poUnitRatio > 0 ? (nextBase / poUnitRatio) : 0
              await rawRun(`UPDATE purchase_order_items SET received_qty_base = $1, received_qty = $2 WHERE id = $3`, [nextBase, nextReceived, row.id])
              continue
            }

            const rows = await rawAll<any>(`SELECT id, quantity, unit_ratio, received_qty_base FROM purchase_order_items WHERE po_id = $1 AND barang_id = $2 ORDER BY id ASC`, [poId, it.barang_id])
            if (!rows || rows.length === 0) {
              const row = await rawGet<any>(`SELECT id, quantity, unit_ratio, received_qty_base FROM purchase_order_items WHERE po_id = $1 AND barang_id = $2 ORDER BY id ASC LIMIT 1`, [poId, it.barang_id])
              if (!row?.id) continue
              const poUnitRatio = Number(row.unit_ratio || 1) || 1
              const prevBase = Number(row.received_qty_base || 0) || 0
              const nextBase = Math.max(0, prevBase - decBase)
              const nextReceived = poUnitRatio > 0 ? (nextBase / poUnitRatio) : 0
              await rawRun(`UPDATE purchase_order_items SET received_qty_base = $1, received_qty = $2 WHERE id = $3`, [nextBase, nextReceived, row.id])
              continue
            }

            for (const row of rows) {
              if (decBase <= 0) break
              const poUnitRatio = Number(row.unit_ratio || 1) || 1
              const prevBase = Number(row.received_qty_base || 0) || 0
              if (prevBase <= 0) continue
              const decHere = Math.min(prevBase, decBase)
              const nextBase = Math.max(0, prevBase - decHere)
              const nextReceived = poUnitRatio > 0 ? (nextBase / poUnitRatio) : 0
              await rawRun(`UPDATE purchase_order_items SET received_qty_base = $1, received_qty = $2 WHERE id = $3`, [nextBase, nextReceived, row.id])
              decBase -= decHere
            }
          }

          if (poHdr && Number(poHdr.realisasi_manual || 0) !== 1) {
            const rem = await rawGet<any>(`
              SELECT COUNT(1) AS open_cnt
              FROM purchase_order_items
              WHERE po_id = $1 AND (quantity * COALESCE(unit_ratio,1)) > COALESCE(received_qty_base,0) + 0.0001
            `, [poId])
            const openCnt = Number(rem?.open_cnt || 0)
            await rawRun(`UPDATE purchase_orders SET po_status = $1 WHERE id = $2`, [openCnt === 0 ? 'realisasi' : 'outstanding', poId])
          }
        }

        await rawRun(`UPDATE purchases SET void = 1, status = 'void', user_edit = ?, updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes,'') || ' [VOID]', paid_amount = 0 WHERE id = ?`, [userId || null, id])
        await pool.query('COMMIT')
      } catch (e) {
        await pool.query('ROLLBACK')
        throw e
      }

      const voidHdr = await rawGet<any>(`SELECT purchase_number, is_return FROM purchases WHERE id = $1`, [id])
      if (voidHdr) {
        deleteJournalEntriesForSource(voidHdr.is_return ? 'Retur Pembelian' : 'Pembelian', id)
      }

      return NextResponse.json({ success: true })
    }

    await rawRun(`CREATE TABLE IF NOT EXISTS ap_payments (id SERIAL PRIMARY KEY, status TEXT DEFAULT 'active')`)
    await rawRun(`CREATE TABLE IF NOT EXISTS ap_payment_items (id SERIAL PRIMARY KEY, payment_id INTEGER NOT NULL, purchase_id INTEGER NOT NULL, pay_amount REAL DEFAULT 0)`)
    try {
      const cols2 = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='ap_payment_items'")
      const names2 = new Set(cols2.map((c:any) => String(c.name)))
      if (!names2.has('pay_amount')) { await rawRun("ALTER TABLE ap_payment_items ADD COLUMN pay_amount REAL DEFAULT 0") }
      if (!names2.has('purchase_id')) { await rawRun("ALTER TABLE ap_payment_items ADD COLUMN purchase_id INTEGER DEFAULT 0") }
    } catch {}
    try {
      const apCols2 = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='ap_payments'")
      const apNames2 = new Set(apCols2.map((c:any)=> String(c.name)))
      if (!apNames2.has('status')) { await rawRun("ALTER TABLE ap_payments ADD COLUMN status TEXT DEFAULT 'active'") }
    } catch {}
    const refRow2 = await rawGet<any>(`
      SELECT COUNT(1) AS cnt, COALESCE(SUM(pi.pay_amount),0) AS paid
      FROM ap_payment_items pi
      JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
      WHERE (pi.purchase_id = $1 OR (pi.source_type = 'purchase' AND pi.source_id = $2) OR pi.invoice_number = $3)
    `, [id, id, String(id)])
    const hasPaymentRef2 = Number(refRow2?.cnt || 0) > 0
    if (hasPaymentRef2) {
      return NextResponse.json({ error: 'Pembelian yang sudah memiliki pembayaran hutang tidak dapat diedit' }, { status: 400 })
    }

    const canBackdate = await getAllowBackdate(pool) || hasPermission(request as any, 'purchase', 'backdate')
    let existingPurchaseDate: string | null = null
    if (!canBackdate) {
      try {
        const hdr = await rawGet<any>(`SELECT purchase_date FROM purchases WHERE id = $1`, [id])
        existingPurchaseDate = (hdr?.purchase_date || null) ? String(hdr.purchase_date).slice(0, 10) : null
      } catch {
        existingPurchaseDate = null
      }
    }
    const payload = {
      supplier_id: data.supplierId ?? data.supplier_id ?? data.supplier?.id ?? null,
      warehouse_id: data.warehouseId ?? data.warehouse_id ?? null,
      purchase_date: canBackdate
        ? (data.purchaseDate ? String(data.purchaseDate).slice(0, 10) : (data.purchase_date ? String(data.purchase_date).slice(0, 10) : null))
        : null,
      invoice_number: data.invoiceNumber ?? data.invoice_number ?? null,
      expected_date: data.expectedDate ? String(data.expectedDate).slice(0, 10) : (data.expected_date ? String(data.expected_date).slice(0, 10) : null),
      discount_percent: data.discountPercent ?? data.discount_percent ?? null,
      discount_amount: data.discountAmount ?? data.discount_amount ?? null,
      ppn_percent: data.ppnPercent ?? data.ppn_percent ?? null,
      ppn_amount: data.ppnAmount ?? data.ppn_amount ?? null,
      subtotal: data.subtotal ?? null,
      total: data.total ?? null,
      payment_status: data.payment_status ?? data.paymentStatus ?? null,
      paid_amount: data.paid_amount ?? data.paidAmount ?? null,
      status: data.status ?? null,
      void: typeof data.void === 'number' ? data.void : (typeof data.void === 'boolean' ? (data.void ? 1 : 0) : null),
      notes: data.notes ?? data.note ?? null,
      faktur_pajak: data.fakturPajak ?? data.faktur_pajak ?? null,
    }

    const rawDate = payload.purchase_date || existingPurchaseDate || new Date().toISOString().slice(0,10)
    const effPurchaseDate = rawDate instanceof Date ? rawDate.toISOString().slice(0,10) : String(rawDate).slice(0,10)
    const period = await getPeriodByDate(effPurchaseDate)
    if (!period) {
      return NextResponse.json({ error: `Periode belum ada untuk tanggal ${effPurchaseDate}.`, code: 'PERIOD_NOT_FOUND' }, { status: 400 })
    }
    if (Number(period.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${period.name}' sudah ditutup.`, code: 'PERIOD_CLOSED' }, { status: 400 })
    }
    ;(payload as any).period_id = period.id

    const sets: string[] = []
    const vals: any[] = []
    let pidx = 0
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== null && v !== undefined) { pidx++; sets.push(`${k} = $${pidx}`); vals.push(v) }
    })
    if (sets.length === 0) return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 })

    const userId = getUserId(request)
    pidx++; sets.push(`user_edit = $${pidx}`)
    vals.push(userId)
    pidx++; const sql = `UPDATE purchases SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${pidx}`
    vals.push(id)
    const res = await rawRun(sql, vals)
    if (res.rowCount === 0) return NextResponse.json({ error: 'Pembelian tidak ditemukan' }, { status: 404 })

    if (Array.isArray(data.items)) {
      const purchaseData = await rawGet<any>(`SELECT warehouse_id, COALESCE(is_return,0) as is_return, total, ppn_amount FROM purchases WHERE id = $1`, [id])
      const oldWarehouseId = Number(purchaseData?.warehouse_id) || 1
      const warehouseId = (data.warehouseId ?? oldWarehouseId) || 1
      const isReturn = Number(purchaseData?.is_return || 0) === 1
      const movementRefType = isReturn ? 'purchase_return' : 'purchase'
      const movementType = isReturn ? 'out' : 'in'
      const revertFactor = isReturn ? 1 : -1
      const purchaseDate = effPurchaseDate

      const txClient = await pool.connect()
      try {
        await txClient.query('BEGIN')

        const oldItems = (await txClient.query(`SELECT * FROM purchase_items WHERE purchase_id = $1`, [id])).rows
        const oldItemsNetTotal = oldItems.reduce((s: number, it: any) => s + (Number(it.net_amount) || 0), 0)
        const oldHdrTotal = Number(purchaseData?.total) || 0
        const oldHdrPpn = Number(purchaseData?.ppn_amount) || 0
        const oldCostRatio = oldItemsNetTotal > 0 ? (oldHdrTotal - oldHdrPpn) / oldItemsNetTotal : 1
        for (const oldItem of oldItems) {
          const qtyBase = (Number(oldItem.quantity) || 0) * (Number(oldItem.unit_ratio) || 1)
          const oldNetAmount = Number(oldItem.net_amount) || 0
          const barangRow = (await txClient.query(`SELECT jenis FROM master_barang WHERE id = $1`, [oldItem.barang_id])).rows[0]
          const isHpp = barangRow && (Number(barangRow.jenis) === 1 || Number(barangRow.jenis) === 2 || Number(barangRow.jenis) === 3)
          if (isHpp) {
            const bal = (await txClient.query(`SELECT total_cost, avg_cost FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2`, [oldItem.barang_id, oldWarehouseId])).rows[0]
            const prevTotalCost = bal ? Number(bal.total_cost) || 0 : 0
            const oldInvCost = Number((oldNetAmount * oldCostRatio).toFixed(2))
            const revertCost = isReturn ? oldInvCost : -oldInvCost
            const newTotalCost = prevTotalCost + revertCost
            await txClient.query(`UPDATE stock_balance SET quantity = quantity + $1, total_cost = COALESCE(total_cost,0) + $2, avg_cost = CASE WHEN (quantity + $3) > 0 THEN (COALESCE(total_cost,0) + $4) / (quantity + $5) ELSE 0 END, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = $6 AND warehouse_id = $7`, [revertFactor * qtyBase, revertCost, revertFactor * qtyBase, revertCost, revertFactor * qtyBase, oldItem.barang_id, oldWarehouseId])
          } else {
            await txClient.query(`UPDATE stock_balance SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = $2 AND warehouse_id = $3`, [revertFactor * qtyBase, oldItem.barang_id, oldWarehouseId])
          }
        }

        await txClient.query(`DELETE FROM purchase_items WHERE purchase_id = $1`, [id])
        await txClient.query(`DELETE FROM stock_movements WHERE reference_type = $1 AND reference_id = $2`, [movementRefType, id])

        let newItemsNetTotal = 0
        const newItemCalcs: any[] = []
        for (const it of data.items) {
          const barangId = it.barangId ?? it.barang_id ?? it.productId ?? null
          if (!barangId) continue

          const qty = Number(it.quantity ?? it.qty) || 0
          const ratio = Number(it.unitRatio ?? it.unit_ratio) || 1
          const qtyBase = qty * ratio

          const unitPrice = Number(it.unitPrice ?? it.price) || 0
          const perUnitNominal = Number(it.discNominal ?? 0)
          const calc = calculateTieredDiscount(
            qty,
            unitPrice,
            Number(it.discountPercent ?? it.discount_percent ?? 0),
            Number(it.disc1Percent ?? 0),
            Number(it.disc2Percent ?? 0),
            Number(it.disc3Percent ?? 0),
            perUnitNominal * qty,
          )
          await txClient.query(`
            INSERT INTO purchase_items (
              purchase_id, barang_id, quantity, unit_name, unit_ratio, unit_price,
              discount_percent, discount_amount, total_price,
              disc1_percent, disc1_amount, disc2_percent, disc2_amount, disc3_percent, disc3_amount,
              gross_amount, net_amount,
              disc_nominal, bonus_barang_id, bonus_name, bonus_qty, bonus_unit, bonus_unit_ratio
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
          `, [
            id, barangId, qty, it.unitName ?? it.unit_name ?? it.unit ?? 'PCS', ratio, unitPrice,
            calc.discountPercent, calc.discountAmount, calc.netAmount,
            calc.disc1Percent, calc.disc1Amount,
            calc.disc2Percent, calc.disc2Amount,
            calc.disc3Percent, calc.disc3Amount,
            calc.grossAmount, calc.netAmount, perUnitNominal,
            it.bonusBarangId ?? it.bonus_barang_id ?? null,
            it.bonusName ?? it.bonus_name ?? null,
            it.bonusQty ?? it.bonus_qty ?? 0,
            it.bonusUnit ?? it.bonus_unit ?? null,
            it.bonusUnitRatio ?? it.bonus_unit_ratio ?? 1,
          ])

          newItemsNetTotal += calc.netAmount
          newItemCalcs.push({ barangId, qty, ratio, qtyBase, calc, perUnitNominal, unitName: it.unitName ?? it.unit_name ?? it.unit ?? 'PCS' })
        }

        const headerDiscPct = Math.min(Math.max(Number(data.discountPercent ?? data.discount_percent ?? 0), 0), 100)
        const headerDiscAmt = Number(data.discountAmount ?? data.discount_amount ?? 0) || roundRp(newItemsNetTotal * (headerDiscPct/100))
        const ppnPct = Math.min(Math.max(Number(data.ppnPercent ?? data.ppn_percent ?? 0), 0), 100)
        const ppnResult = calculatePpn(newItemsNetTotal - headerDiscAmt, ppnPct, false)
        const totalAfter = ppnResult.grandTotal
        const costRatio = newItemsNetTotal > 0 ? (totalAfter - ppnResult.ppnAmount) / newItemsNetTotal : 1

        for (const nc of newItemCalcs) {
          const barangRow = (await txClient.query(`SELECT jenis FROM master_barang WHERE id = $1`, [nc.barangId])).rows[0]
          const isHpp = barangRow && (Number(barangRow.jenis) === 1 || Number(barangRow.jenis) === 2 || Number(barangRow.jenis) === 3)
          const invCost = Number((nc.calc.netAmount * costRatio).toFixed(2))
          const invUnitCost = nc.qtyBase > 0 ? (invCost / nc.qtyBase) : 0

          if (isReturn && nc.qtyBase > 0) {
            const cur = (await txClient.query(`SELECT quantity FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2`, [nc.barangId, warehouseId])).rows[0]
            const currentQty = cur ? Number(cur.quantity) || 0 : 0
            if (currentQty < nc.qtyBase) {
              throw new Error(`Stok tidak mencukupi: tersedia ${currentQty}, dibutuhkan ${nc.qtyBase}`)
            }
          }

          const deltaQty = isReturn ? -nc.qtyBase : nc.qtyBase
          const deltaCost = isHpp ? (isReturn ? -invCost : invCost) : 0
          const bal = (await txClient.query(`SELECT quantity, total_cost, avg_cost FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2`, [nc.barangId, warehouseId])).rows[0]
          const prevQty = bal ? Number(bal.quantity) || 0 : 0
          const prevTotalCost = bal ? Number(bal.total_cost) || 0 : 0
          const newQty = prevQty + deltaQty
          const newTotalCost = prevTotalCost + deltaCost
          const newAvg = (isHpp && newQty > 0) ? (newTotalCost / newQty) : (bal ? Number(bal.avg_cost)||0 : 0)

          await txClient.query(`
            INSERT INTO stock_movements (
              ingredient_id, warehouse_id, movement_type, quantity, unit,
              reference_type, reference_id, period_id, transaction_date, notes, created_at,
              unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          `, [nc.barangId, warehouseId, movementType, Math.abs(nc.qtyBase), nc.unitName,
            movementRefType, id, period.id, purchaseDate,
            isReturn ? 'retur pembelian' : 'pembelian', purchaseDate,
            isHpp ? invUnitCost : null, isHpp ? Math.abs(invCost) : null,
            newQty, isHpp ? newTotalCost : (bal ? prevTotalCost : 0), isHpp ? newAvg : (bal ? Number(bal.avg_cost)||0 : 0)
          ])

          if (bal) {
            await txClient.query(`UPDATE stock_balance SET quantity = quantity + $1, total_cost = COALESCE(total_cost,0) + $2, avg_cost = CASE WHEN (quantity + $3) > 0 THEN (COALESCE(total_cost,0) + $4) / (quantity + $5) ELSE 0 END, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = $6 AND warehouse_id = $7`, [deltaQty, deltaCost, deltaQty, deltaCost, deltaQty, nc.barangId, warehouseId])
          } else {
            await txClient.query(`INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, total_cost, avg_cost, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [nc.barangId, warehouseId, deltaQty, isHpp ? (isReturn ? -invCost : invCost) : 0, isHpp ? (nc.qtyBase > 0 ? (invCost / nc.qtyBase) : 0) : 0])
          }
        }

        const itemsRows = (await txClient.query(`SELECT gross_amount, net_amount, disc_nominal FROM purchase_items WHERE purchase_id = $1`, [id])).rows
        let itemsGrossTotal = 0
        for (const r of itemsRows) {
          itemsGrossTotal += Number(r.gross_amount || 0)
        }
        const totalItemDiscount = itemsRows.reduce((s, r) => s + Number(r.gross_amount || 0) - Number(r.net_amount || 0), 0)
        const totalDiscount = totalItemDiscount + headerDiscAmt
        await txClient.query(`UPDATE purchases SET subtotal = $1, discount_percent = $2, discount_amount = $3, total_discount = $4, ppn_percent = $5, ppn_amount = $6, total = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8`, [itemsGrossTotal, headerDiscPct, headerDiscAmt, totalDiscount, ppnPct, ppnResult.ppnAmount, totalAfter, id])

        await txClient.query('COMMIT')
      } catch (e) {
        await txClient.query('ROLLBACK').catch(() => {})
        throw e
      } finally {
        txClient.release()
      }
    }

    try {
      const editHdr = await rawGet<any>(`SELECT purchase_number, purchase_date, is_return FROM purchases WHERE id = $1`, [id])
      if (editHdr) {
        const srcType = editHdr.is_return ? 'Retur Pembelian' : 'Pembelian'
        await deleteJournalEntriesForSource(srcType, id)
        const pdate = editHdr.purchase_date instanceof Date ? editHdr.purchase_date.toISOString().slice(0,10) : String(editHdr.purchase_date || '').slice(0,10)
        const entries = await generateEntriesForSingleSource(srcType, editHdr.purchase_number || '', pdate)
        if (entries.length > 0) {
          await saveJournalEntriesForSource(srcType, id, editHdr.purchase_number || '', pdate, entries)
        }
      }
    } catch (jeErr) {
      console.warn('Journal entry update skipped:', jeErr)
    }

    const updated = await rawGet<any>(`SELECT * FROM purchases WHERE id = $1`, [id])
    const items = await rawAll<any>(`SELECT * FROM purchase_items WHERE purchase_id = $1 ORDER BY id ASC`, [id])
    return NextResponse.json({ ...updated, items })
  } catch (e: any) {
    console.error('PUT /api/purchases/[id] error:', e?.message || e, e?.stack ? '\n' + e.stack : '')
    return NextResponse.json({ error: 'Gagal mengupdate pembelian', details: e?.message || String(e) }, { status: 500 })
  }
}
