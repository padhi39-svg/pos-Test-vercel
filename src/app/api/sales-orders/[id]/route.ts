import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'
import { getUserId } from '@/lib/audit'

async function ensureSalesOrderTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS sales_order (
      id SERIAL PRIMARY KEY,
      so_number TEXT UNIQUE,
      so_date TEXT NOT NULL,
      customer_id INTEGER,
      warehouse_id INTEGER,
      sales_id INTEGER,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_percent REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      ppn_percent REAL NOT NULL DEFAULT 0,
      ppn_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      price_include_tax INTEGER NOT NULL DEFAULT 0,
      tax_rate_percent REAL NOT NULL DEFAULT 11,
      is_fully_invoiced INTEGER NOT NULL DEFAULT 0,
      so_status TEXT NOT NULL DEFAULT 'outstanding',
      realisasi_manual INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)

  try {
    const cols = await rawAll<any>("SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_order'")
    const names = new Set(cols.map((c: any) => String(c.column_name).toLowerCase()))
    if (!names.has('user_edit')) await rawRun("ALTER TABLE sales_order ADD COLUMN user_edit INTEGER")
    if (!names.has('so_status')) await rawRun("ALTER TABLE sales_order ADD COLUMN so_status TEXT NOT NULL DEFAULT 'outstanding'")
    if (!names.has('realisasi_manual')) await rawRun("ALTER TABLE sales_order ADD COLUMN realisasi_manual INTEGER NOT NULL DEFAULT 0")
    if (names.has('status')) {
      await rawRun("UPDATE sales_order SET so_status = 'void' WHERE COALESCE(status,'') = 'void'")
      await rawRun("ALTER TABLE sales_order DROP COLUMN status")
    }
  } catch {}

  try {
    const cols2 = await rawAll<any>("SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_order_items'")
    const names2 = new Set(cols2.map((c: any) => String(c.column_name).toLowerCase()))
    if (!names2.has('realized_qty')) await rawRun("ALTER TABLE sales_order_items ADD COLUMN realized_qty REAL NOT NULL DEFAULT 0")
    if (!names2.has('realized_qty_base')) await rawRun("ALTER TABLE sales_order_items ADD COLUMN realized_qty_base REAL NOT NULL DEFAULT 0")
  } catch {}

  await rawRun(`
    CREATE TABLE IF NOT EXISTS sales_order_items (
      id SERIAL PRIMARY KEY,
      sales_order_id INTEGER NOT NULL,
      barang_id INTEGER NOT NULL,
      barang_name TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      realized_qty REAL NOT NULL DEFAULT 0,
      realized_qty_base REAL NOT NULL DEFAULT 0,
      unit_name TEXT,
      unit_ratio REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      discount_percent REAL NOT NULL DEFAULT 0,
      discon_total REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'invoice', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat sales order' }, { status: 403 })
    }
    await ensureSalesOrderTables()
    const id = parseInt(params.id, 10)

    const header = await rawGet<any>(
      `SELECT so.*, c.name as customer_name, c.code as customer_code, s.name as sales_name
       FROM sales_order so
       LEFT JOIN master_customer c ON so.customer_id = c.id
       LEFT JOIN master_sales s ON so.sales_id = s.id
       WHERE so.id = $1`,
      [id]
    )

    if (!header) {
      return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 })
    }

    const items = await rawAll<any>(
      'SELECT * FROM sales_order_items WHERE sales_order_id = $1 ORDER BY id ASC',
      [id]
    )

    return NextResponse.json({ ...header, items })
  } catch (e: any) {
    console.error('GET /api/sales-orders/[id] error:', e)
    return NextResponse.json({ error: 'Failed to fetch sales order' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'invoice', 'edit') && !hasPermission(req as any, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah sales order' }, { status: 403 })
    }
    await ensureSalesOrderTables()
    const id = parseInt(params.id, 10)
    const body = await req.json()

    const so = await rawGet<any>('SELECT so.*, COALESCE(SUM(soi.realized_qty_base),0) as total_realized FROM sales_order so LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id WHERE so.id = $1 GROUP BY so.id', [id])
    if (!so) {
      return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 })
    }
    if (String(so.so_status) === 'void') {
      return NextResponse.json({ error: 'Sales Order sudah void dan tidak bisa diubah' }, { status: 400 })
    }
    if (Number(so.total_realized) > 0) {
      return NextResponse.json({ error: 'Sales Order sudah digunakan di invoice dan tidak bisa diubah' }, { status: 400 })
    }

    const soDate = (body.so_date || body.soDate || so.so_date).toString().slice(0,10)
    const customerId = body.customer_id ? Number(body.customer_id) : (body.customerId ? Number(body.customerId) : so.customer_id)
    const warehouseId = body.warehouse_id ? Number(body.warehouse_id) : (body.warehouseId ? Number(body.warehouseId) : so.warehouse_id)
    const salesId = body.sales_id ? Number(body.sales_id) : (body.salesId ? Number(body.salesId) : so.sales_id)
    const notes = (body.notes ?? so.notes ?? '').toString()

    const priceIncludeTax = body.price_include_tax === 1 || body.priceIncludeTax === 1 || so.price_include_tax === 1
    const taxRatePercent = Number(body.tax_rate_percent ?? body.taxRatePercent ?? so.tax_rate_percent ?? 11) || 11
    const r = Math.max(0, taxRatePercent) / 100
    const roundRp = (n: number) => Math.round(Number(n) || 0)

    const itemsInputRaw = Array.isArray(body.items) ? body.items : []
    const items = itemsInputRaw.filter((it: any) => Number(it?.barangId || it?.barang_id) > 0 && Number(it?.quantity) > 0)

    if (items.length === 0) {
      return NextResponse.json({ error: 'Sales Order harus memiliki minimal 1 item' }, { status: 400 })
    }

    let subtotal = 0
    let includeSum = 0
    for (const it of items) {
      const qty = Number(it.quantity) || 0
      const unitPriceEx = Number(it.unitPrice ?? it.unit_price ?? 0) || 0
      const disconTotal = Number(it.discon_total ?? it.discountAmount ?? 0) || 0
      const totalProvided = Number(it.totalPrice ?? it.total_price ?? 0) || 0

      let lineNetEx: number, lineTotal: number
      if (priceIncludeTax) {
        if (totalProvided > 0) {
          lineTotal = totalProvided
          lineNetEx = roundRp(lineTotal / (1 + r))
        } else {
          const grossEx = unitPriceEx * qty
          lineNetEx = Math.max(0, grossEx - disconTotal)
          const tax = roundRp(lineNetEx * r)
          lineTotal = lineNetEx + tax
        }
      } else {
        const grossEx = unitPriceEx * qty
        lineNetEx = Math.max(0, grossEx - disconTotal)
        const tax = roundRp(lineNetEx * r)
        lineTotal = lineNetEx + tax
      }
      subtotal += lineNetEx
      includeSum += lineTotal
    }

    const headerDiscPct = Number(body.discount_percent ?? body.discountPercent ?? so.discount_percent ?? 0) || 0
    const headerDiscAmtReq = Number(body.discount_amount ?? body.discountAmount ?? so.discount_amount ?? 0) || 0
    const headerDiscount = headerDiscAmtReq > 0 ? roundRp(headerDiscAmtReq) : roundRp(subtotal * (Math.max(0, headerDiscPct) / 100))
    const headerDiscInclude = roundRp(headerDiscount + roundRp(headerDiscount * r))
    const adjustedInclude = Math.max(0, includeSum - headerDiscInclude)
    const dppAfter = roundRp(adjustedInclude / (1 + r))
    const ppnAmount = adjustedInclude - dppAfter
    const total = adjustedInclude

    // Determine so_status
    let soStatus = body.so_status || body.soStatus || so.so_status || 'outstanding'
    let realisasiManual = body.realisasi_manual != null ? Number(body.realisasi_manual) : (body.realisasiManual != null ? Number(body.realisasiManual) : Number(so.realisasi_manual || 0))
    if (soStatus === 'realisasi') {
      realisasiManual = 1
    }

    const userId = getUserId(req)
    const db = getDb()
    const pool = (db as any).$client

    await pool.query('BEGIN')
    try {
      await pool.query(
        `UPDATE sales_order SET
          so_date = $1, customer_id = $2, warehouse_id = $3, sales_id = $4,
          subtotal = $5, discount_percent = $6, discount_amount = $7,
          ppn_percent = $8, ppn_amount = $9, total = $10,
          notes = $11, price_include_tax = $12, tax_rate_percent = $13,
          so_status = $14, realisasi_manual = $15,
          user_edit = $16, updated_at = CURRENT_TIMESTAMP
        WHERE id = $17`,
        [soDate, customerId, warehouseId, salesId, subtotal, headerDiscPct, headerDiscount, taxRatePercent, ppnAmount, total, notes, priceIncludeTax ? 1 : 0, taxRatePercent, soStatus, realisasiManual, userId || null, id]
      )

      await pool.query('DELETE FROM sales_order_items WHERE sales_order_id = $1', [id])

      for (const it of items) {
        const barangId = Number(it.barangId ?? it.barang_id)
        const qty = Number(it.quantity) || 0
        const unitName = (it.unitName ?? it.unit_name ?? 'PCS').toString()
        const unitRatio = Number(it.unitRatio ?? it.unit_ratio ?? 1) || 1
        const unitPrice = Number(it.unitPrice ?? it.unit_price ?? 0) || 0
        const disconTotal = Number(it.discon_total ?? it.discountAmount ?? 0) || 0
        const totalPrice = Number(it.totalPrice ?? it.total_price ?? 0) || 0
        const discountPercent = Number(it.discount_percent ?? it.discountPercent ?? 0) || 0
        const realizedQty = it.realized_qty != null ? Number(it.realized_qty) : 0
        const realizedQtyBase = it.realized_qty_base != null ? Number(it.realized_qty_base) : 0

        const barang = await rawGet<any>('SELECT name FROM master_barang WHERE id = $1', [barangId])
        const barangName = barang?.name || (it.barangName ?? it.barang_name ?? 'Item')

        await pool.query(
          `INSERT INTO sales_order_items (
            sales_order_id, barang_id, barang_name, quantity,
            realized_qty, realized_qty_base,
            unit_name, unit_ratio,
            unit_price, discount_percent, discon_total, total_price,
            created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
          [id, barangId, barangName, qty, realizedQty, realizedQtyBase, unitName, unitRatio, unitPrice, discountPercent, disconTotal, totalPrice]
        )
      }

      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ success: true, id, message: 'Sales Order updated successfully' })
  } catch (e: any) {
    console.error('PUT /api/sales-orders/[id] error:', e)
    return NextResponse.json({ error: 'Failed to update sales order', details: e?.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'invoice', 'delete') && !hasPermission(req as any, 'transaksi', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus sales order' }, { status: 403 })
    }
    await ensureSalesOrderTables()
    const id = parseInt(params.id, 10)

    const db = getDb()
    const pool = (db as any).$client

    await pool.query('BEGIN')
    try {
      await pool.query('DELETE FROM sales_order_items WHERE sales_order_id = $1', [id])
      const res = await pool.query('DELETE FROM sales_order WHERE id = $1', [id])
      await pool.query('COMMIT')
      if (res.rowCount === 0) {
        return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 })
      }
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ success: true, message: 'Sales Order deleted successfully' })
  } catch (e: any) {
    console.error('DELETE /api/sales-orders/[id] error:', e)
    return NextResponse.json({ error: 'Failed to delete sales order' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'invoice', 'delete') && !hasPermission(req as any, 'transaksi', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses void sales order' }, { status: 403 })
    }
    await ensureSalesOrderTables()
    const id = parseInt(params.id, 10)
    const so = await rawGet<any>('SELECT so.*, COALESCE(SUM(soi.realized_qty_base),0) as total_realized FROM sales_order so LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id WHERE so.id = $1 GROUP BY so.id', [id])
    if (!so) {
      return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 })
    }
    if (String(so.so_status) === 'void') {
      return NextResponse.json({ error: 'Sales Order sudah void' }, { status: 400 })
    }
    if (Number(so.total_realized) > 0) {
      return NextResponse.json({ error: 'SO sudah digunakan di invoice dan tidak dapat di-void' }, { status: 400 })
    }

    const userId = getUserId(req)
    await rawRun('UPDATE sales_order SET so_status = $1, user_edit = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', ['void', userId || null, id])
    return NextResponse.json({ success: true, message: 'Sales Order voided successfully' })
  } catch (e: any) {
    console.error('PATCH /api/sales-orders/[id] error:', e)
    return NextResponse.json({ error: 'Failed to void sales order' }, { status: 500 })
  }
}
