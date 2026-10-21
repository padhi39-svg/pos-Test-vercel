import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

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

  try {
    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_order'"
    )
    const names = new Set(cols.map(c => c.column_name))
    if (!names.has('is_fully_invoiced')) {
      await rawRun('ALTER TABLE sales_order ADD COLUMN is_fully_invoiced INTEGER NOT NULL DEFAULT 0')
    }
    if (!names.has('so_status')) {
      await rawRun("ALTER TABLE sales_order ADD COLUMN so_status TEXT NOT NULL DEFAULT 'outstanding'")
    }
    if (!names.has('realisasi_manual')) {
      await rawRun("ALTER TABLE sales_order ADD COLUMN realisasi_manual INTEGER NOT NULL DEFAULT 0")
    }
    if (names.has('status')) {
      await rawRun("UPDATE sales_order SET so_status = 'void' WHERE COALESCE(status,'') = 'void'")
      await rawRun("ALTER TABLE sales_order DROP COLUMN status")
    }
  } catch (e) {
    console.warn('ensureSalesOrderTables migration warning (sales_order):', e)
  }
  try {
    const cols2 = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_order_items'"
    )
    const names2 = new Set(cols2.map(c => c.column_name))
    if (!names2.has('realized_qty')) {
      await rawRun("ALTER TABLE sales_order_items ADD COLUMN realized_qty REAL NOT NULL DEFAULT 0")
    }
    if (!names2.has('realized_qty_base')) {
      await rawRun("ALTER TABLE sales_order_items ADD COLUMN realized_qty_base REAL NOT NULL DEFAULT 0")
    }
  } catch (e) {
    console.warn('ensureSalesOrderTables migration warning (sales_order_items):', e)
  }
}

async function generateSoNumber(): Promise<string> {
  const year = new Date().getFullYear().toString()
  const last = await rawGet<any>(
    "SELECT so_number FROM sales_order WHERE so_number LIKE 'SO/'||$1||'/%' ORDER BY id DESC LIMIT 1",
    [year]
  )
  let n = 0
  if (last?.so_number) {
    const m = /SO\/(\d{4})\/(\d{6})$/.exec(last.so_number)
    if (m) n = parseInt(m[2], 10)
  }
  const seq = (n + 1).toString().padStart(6, '0')
  return `SO/${year}/${seq}`
}

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'invoice', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat sales order' }, { status: 403 })
    }
    await ensureSalesOrderTables()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const soStatus = (searchParams.get('so_status') || '').trim()
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 20))
    const offset = (page - 1) * limit

    const db = getDb()
    const pool = (db as any).$client

    let where = 'WHERE 1=1'
    const params: any[] = []

    if (soStatus) {
      params.push(soStatus)
      where += ` AND so.so_status = $${params.length}`
    }
    if (q) {
      const likeVal = `%${q.toLowerCase()}%`
      params.push(likeVal)
      where += ` AND LOWER(COALESCE(so.so_number,'') || ' ' || COALESCE(c.name,'') || ' ' || COALESCE(c.code,'') || ' ' || COALESCE(s.name,'')) LIKE $${params.length}`
    }

    const countResult = await pool.query(`SELECT COUNT(*) as total FROM sales_order so LEFT JOIN master_customer c ON so.customer_id = c.id LEFT JOIN master_sales s ON so.sales_id = s.id ${where}`, params)
    const total = Number(countResult.rows[0]?.total || 0)

    const sortBy = searchParams.get('sort_by') || 'so_date'
    const sortDir = (searchParams.get('sort_dir') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    const SORT_COLUMNS: Record<string, string> = {
      so_number: 'so.so_number',
      so_date: 'so.so_date',
      customer_name: 'c.name',
      total: 'so.total',
      so_status: 'so.so_status',
    }
    const orderCol = SORT_COLUMNS[sortBy] || 'so.so_date'

    const sql = `
      SELECT so.*, c.name as customer_name, c.code as customer_code, s.name as sales_name,
        COALESCE((SELECT SUM(soi.realized_qty_base) FROM sales_order_items soi WHERE soi.sales_order_id = so.id), 0) > 0 as has_realization
      FROM sales_order so
      LEFT JOIN master_customer c ON so.customer_id = c.id
      LEFT JOIN master_sales s ON so.sales_id = s.id
      ${where}
      ORDER BY ${orderCol} ${sortDir}, so.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const result = await pool.query(sql, [...params, limit, offset])
    const rows = result.rows

    return NextResponse.json({ rows, total, page, limit })
  } catch (e: any) {
    console.error('GET /api/sales-orders error:', e)
    return NextResponse.json({ error: 'Failed to fetch sales orders' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'invoice', 'create') && !hasPermission(req as any, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat sales order' }, { status: 403 })
    }
    const db = getDb()
    const pool = (db as any).$client
    await ensureSalesOrderTables()
    await addAuditColumns(db as any)
    const userId = getUserId(req)

    const body = await req.json()
    const soDate = (body.so_date || body.soDate || new Date().toISOString().slice(0,10)).toString().slice(0,10)
    const customerId = body.customer_id ? Number(body.customer_id) : (body.customerId ? Number(body.customerId) : null)
    const warehouseId = body.warehouse_id ? Number(body.warehouse_id) : (body.warehouseId ? Number(body.warehouseId) : 1)
    const salesId = body.sales_id ? Number(body.sales_id) : (body.salesId ? Number(body.salesId) : null)
    const notes = (body.notes || '').toString()

    const period = await getPeriodByDate(soDate)
    if (!period) {
      return NextResponse.json({ error: `Periode belum ada untuk tanggal ${soDate}.` }, { status: 400 })
    }
    if (Number(period.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${period.name}' sudah ditutup.` }, { status: 400 })
    }

    const priceIncludeTax = body.price_include_tax === 1 || body.priceIncludeTax === 1
    const taxRatePercent = Number(body.tax_rate_percent ?? body.taxRatePercent ?? 11) || 11
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

    const headerDiscPct = Number(body.discount_percent ?? body.discountPercent ?? 0) || 0
    const headerDiscAmtReq = Number(body.discount_amount ?? body.discountAmount ?? 0) || 0
    const headerDiscount = headerDiscAmtReq > 0 ? roundRp(headerDiscAmtReq) : roundRp(subtotal * (Math.max(0, headerDiscPct) / 100))
    const headerDiscInclude = roundRp(headerDiscount + roundRp(headerDiscount * r))
    const adjustedInclude = Math.max(0, includeSum - headerDiscInclude)
    const dppAfter = roundRp(adjustedInclude / (1 + r))
    const ppnAmount = adjustedInclude - dppAfter
    const total = adjustedInclude

    const soNumber = await generateSoNumber()

    const soCols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_order'"
    )
    const hasUserCreate = soCols.some(c => c.column_name.toLowerCase() === 'user_create')
    if (hasUserCreate) {
      try { await addAuditColumns(db as any, 'sales_order') } catch {}
    }

    await pool.query('BEGIN')
    try {
      const insertSql = hasUserCreate
        ? `INSERT INTO sales_order (
            so_number, so_date, customer_id, warehouse_id, sales_id,
            subtotal, discount_percent, discount_amount, ppn_percent, ppn_amount, total,
            notes, price_include_tax, tax_rate_percent, is_fully_invoiced,
            so_status, realisasi_manual,
            user_create, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0,'outstanding',0,$15,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id`
        : `INSERT INTO sales_order (
            so_number, so_date, customer_id, warehouse_id, sales_id,
            subtotal, discount_percent, discount_amount, ppn_percent, ppn_amount, total,
            notes, price_include_tax, tax_rate_percent, is_fully_invoiced,
            so_status, realisasi_manual,
            created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0,'outstanding',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id`

      const insertParams = hasUserCreate
        ? [soNumber, soDate, customerId, warehouseId, salesId, subtotal, headerDiscPct, headerDiscount, taxRatePercent, ppnAmount, total, notes, priceIncludeTax ? 1 : 0, taxRatePercent, userId || null]
        : [soNumber, soDate, customerId, warehouseId, salesId, subtotal, headerDiscPct, headerDiscount, taxRatePercent, ppnAmount, total, notes, priceIncludeTax ? 1 : 0, taxRatePercent]

      const res = await pool.query(insertSql, insertParams)
      const soId = Number(res.rows[0].id)

      for (const it of items) {
        const barangId = Number(it.barangId ?? it.barang_id)
        const qty = Number(it.quantity) || 0
        const unitName = (it.unitName ?? it.unit_name ?? 'PCS').toString()
        const unitRatio = Number(it.unitRatio ?? it.unit_ratio ?? 1) || 1
        const unitPrice = Number(it.unitPrice ?? it.unit_price ?? 0) || 0
        const disconTotal = Number(it.discon_total ?? it.discountAmount ?? 0) || 0
        const totalPrice = Number(it.totalPrice ?? it.total_price ?? 0) || 0
        const discountPercent = Number(it.discount_percent ?? it.discountPercent ?? 0) || 0

        const barang = await rawGet<any>('SELECT name FROM master_barang WHERE id = $1', [barangId])
        const barangName = barang?.name || (it.barangName ?? it.barang_name ?? 'Item')

        await pool.query(
          `INSERT INTO sales_order_items (
            sales_order_id, barang_id, barang_name, quantity, unit_name, unit_ratio,
            unit_price, discount_percent, discon_total, total_price,
            created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
          [soId, barangId, barangName, qty, unitName, unitRatio, unitPrice, discountPercent, disconTotal, totalPrice]
        )
      }

      await pool.query('COMMIT')

      return NextResponse.json({
        success: true,
        id: soId,
        so_number: soNumber,
        message: 'Sales Order created successfully',
      })
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (e: any) {
    console.error('POST /api/sales-orders error:', e)
    return NextResponse.json({ error: 'Failed to create sales order', details: e?.message }, { status: 500 })
  }
}
