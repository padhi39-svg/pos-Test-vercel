import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun, withTransaction } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getAllowBackdate } from '@/lib/settingsHelper'
import { calculateTieredDiscount, allocateHeaderDiscountProportional, calculatePpn, roundRp } from '@/lib/discountUtils'
import { saveJournalEntriesForSource, generateEntriesForSingleSource } from '@/lib/journalHelpers'

let schemaEnsured = false
async function ensurePurchaseSchema() {
  if (schemaEnsured) return
  schemaEnsured = true
  const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='purchases'")
  const names = new Set(cols.map(c=>c.name))
  const mig: string[] = []
  if (!names.has('po_id')) mig.push('ALTER TABLE purchases ADD COLUMN po_id INTEGER')
  if (!names.has('warehouse_id')) mig.push("ALTER TABLE purchases ADD COLUMN warehouse_id INTEGER DEFAULT 1")
  if (!names.has('discount_percent')) mig.push("ALTER TABLE purchases ADD COLUMN discount_percent REAL DEFAULT 0")
  if (!names.has('discount_amount')) mig.push("ALTER TABLE purchases ADD COLUMN discount_amount REAL DEFAULT 0")
  if (!names.has('ppn_percent')) mig.push("ALTER TABLE purchases ADD COLUMN ppn_percent REAL DEFAULT 0")
  if (!names.has('ppn_amount')) mig.push("ALTER TABLE purchases ADD COLUMN ppn_amount REAL DEFAULT 0")
  if (!names.has('is_return')) mig.push("ALTER TABLE purchases ADD COLUMN is_return INTEGER DEFAULT 0")
  if (!names.has('payment_status')) mig.push("ALTER TABLE purchases ADD COLUMN payment_status TEXT DEFAULT 'Belum Bayar'")
  if (!names.has('paid_amount')) mig.push("ALTER TABLE purchases ADD COLUMN paid_amount REAL DEFAULT 0")
  if (!names.has('faktur_pajak')) mig.push("ALTER TABLE purchases ADD COLUMN faktur_pajak TEXT")
  if (!names.has('period_id')) mig.push("ALTER TABLE purchases ADD COLUMN period_id INTEGER")
  if (!names.has('expected_date')) mig.push("ALTER TABLE purchases ADD COLUMN expected_date TEXT")
  if (!names.has('void')) mig.push("ALTER TABLE purchases ADD COLUMN void INTEGER DEFAULT 0")
  if (!names.has('notes')) mig.push("ALTER TABLE purchases ADD COLUMN notes TEXT")
  if (!names.has('total_discount')) mig.push("ALTER TABLE purchases ADD COLUMN total_discount REAL DEFAULT 0")
  if (!names.has('pembelian_id')) mig.push("ALTER TABLE purchases ADD COLUMN pembelian_id INTEGER")
  for (const sql of mig) { try { await rawRun(sql) } catch {} }

  const piCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='purchase_items'")
  const piNames = new Set(piCols.map(c=>c.name))
  const migPi: string[] = []
  if (!piNames.has('po_item_id')) migPi.push('ALTER TABLE purchase_items ADD COLUMN po_item_id INTEGER')
  if (!piNames.has('unit_name')) migPi.push("ALTER TABLE purchase_items ADD COLUMN unit_name TEXT")
  if (!piNames.has('unit_ratio')) migPi.push("ALTER TABLE purchase_items ADD COLUMN unit_ratio INTEGER DEFAULT 1")
  if (!piNames.has('discount_percent')) migPi.push("ALTER TABLE purchase_items ADD COLUMN discount_percent REAL DEFAULT 0")
  if (!piNames.has('discount_amount')) migPi.push("ALTER TABLE purchase_items ADD COLUMN discount_amount REAL DEFAULT 0")
  if (!piNames.has('disc1_percent')) migPi.push("ALTER TABLE purchase_items ADD COLUMN disc1_percent REAL DEFAULT 0")
  if (!piNames.has('disc1_amount')) migPi.push("ALTER TABLE purchase_items ADD COLUMN disc1_amount REAL DEFAULT 0")
  if (!piNames.has('disc2_percent')) migPi.push("ALTER TABLE purchase_items ADD COLUMN disc2_percent REAL DEFAULT 0")
  if (!piNames.has('disc2_amount')) migPi.push("ALTER TABLE purchase_items ADD COLUMN disc2_amount REAL DEFAULT 0")
  if (!piNames.has('disc3_percent')) migPi.push("ALTER TABLE purchase_items ADD COLUMN disc3_percent REAL DEFAULT 0")
  if (!piNames.has('disc3_amount')) migPi.push("ALTER TABLE purchase_items ADD COLUMN disc3_amount REAL DEFAULT 0")
  if (!piNames.has('gross_amount')) migPi.push("ALTER TABLE purchase_items ADD COLUMN gross_amount REAL DEFAULT 0")
  if (!piNames.has('net_amount')) migPi.push("ALTER TABLE purchase_items ADD COLUMN net_amount REAL DEFAULT 0")
  if (!piNames.has('disc_nominal')) migPi.push("ALTER TABLE purchase_items ADD COLUMN disc_nominal REAL DEFAULT 0")
  if (!piNames.has('bonus_barang_id')) migPi.push("ALTER TABLE purchase_items ADD COLUMN bonus_barang_id INTEGER")
  if (!piNames.has('bonus_name')) migPi.push("ALTER TABLE purchase_items ADD COLUMN bonus_name TEXT")
  if (!piNames.has('bonus_qty')) migPi.push("ALTER TABLE purchase_items ADD COLUMN bonus_qty REAL DEFAULT 0")
  if (!piNames.has('bonus_unit')) migPi.push("ALTER TABLE purchase_items ADD COLUMN bonus_unit TEXT")
  if (!piNames.has('bonus_unit_ratio')) migPi.push("ALTER TABLE purchase_items ADD COLUMN bonus_unit_ratio REAL DEFAULT 1")
  for (const sql of migPi) { try { await rawRun(sql) } catch {} }

  const sbCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_balance'")
  const sbNames = new Set(sbCols.map(c=>c.name))
  const migSb: string[] = []
  if (!sbNames.has('avg_cost')) migSb.push("ALTER TABLE stock_balance ADD COLUMN avg_cost REAL DEFAULT 0")
  if (!sbNames.has('total_cost')) migSb.push("ALTER TABLE stock_balance ADD COLUMN total_cost REAL DEFAULT 0")
  for (const sql of migSb) { try { await rawRun(sql) } catch {} }

  const smCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_movements'")
  const smNames = new Set(smCols.map(c=>c.name))
  const migSm: string[] = []
  if (!smNames.has('unit_cost')) migSm.push("ALTER TABLE stock_movements ADD COLUMN unit_cost REAL")
  if (!smNames.has('total_cost')) migSm.push("ALTER TABLE stock_movements ADD COLUMN total_cost REAL")
  if (!smNames.has('balance_qty')) migSm.push("ALTER TABLE stock_movements ADD COLUMN balance_qty REAL")
  if (!smNames.has('balance_cost')) migSm.push("ALTER TABLE stock_movements ADD COLUMN balance_cost REAL")
  if (!smNames.has('balance_avg_cost')) migSm.push("ALTER TABLE stock_movements ADD COLUMN balance_avg_cost REAL")
  for (const sql of migSm) { try { await rawRun(sql) } catch {} }
}

const PAGE_DEFAULT = 50

// GET - List purchases
export async function GET(req: NextRequest) {
  try {
    const pool = (getDb() as any).$client

    const { searchParams } = new URL(req.url)
    const idParam = searchParams.get('id')
    const isReturnParam = searchParams.get('is_return')
    const voidParam = searchParams.get('void')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || String(PAGE_DEFAULT), 10) || PAGE_DEFAULT))
    const canTransaksi = hasPermission(req as any, 'transaksi', 'view')
    const requireReturnView = (isReturnParam === '1')
    if (requireReturnView) {
      if (!hasPermission(req as any, 'purchase_return', 'view') && !canTransaksi) {
        return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat retur pembelian' }, { status: 403 })
      }
    } else {
      if (!hasPermission(req as any, 'purchase_list', 'view') && !hasPermission(req as any, 'purchase', 'view') && !canTransaksi) {
        return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat pembelian' }, { status: 403 })
      }
    }

    // Detail by id
    if (idParam) {
      const id = Number(idParam)
      let purchase: any
      if (Number.isFinite(id)) {
        try {
          purchase = await rawGet<any>(`
            SELECT p.*, s.name as supplier_name, src.purchase_number as pembelian_number
            FROM purchases p
            LEFT JOIN master_supplier s ON s.id = p.supplier_id
            LEFT JOIN purchases src ON src.id = p.pembelian_id
            WHERE p.id = $1
          `, [id])
        } catch {
          purchase = await rawGet<any>(`SELECT p.*, NULL as supplier_name FROM purchases p WHERE p.id = $1`, [id])
        }
      } else {
        try {
          purchase = await rawGet<any>(`
            SELECT p.*, s.name as supplier_name
            FROM purchases p
            LEFT JOIN master_supplier s ON s.id = p.supplier_id
            WHERE p.purchase_number = $1
          `, [idParam])
        } catch {
          purchase = await rawGet<any>(`SELECT p.*, NULL as supplier_name, NULL as pembelian_number FROM purchases p WHERE p.purchase_number = $1`, [idParam])
        }
      }
      if (!purchase) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      if (isReturnParam !== null) {
        const expected = Number(isReturnParam) || 0
        if (Number(purchase.is_return) !== expected) {
          return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
      }
      const items = await rawAll<any>(`
        SELECT id, barang_id, quantity, unit_name, unit_ratio, unit_price,
               discount_percent, discount_amount, total_price,
               disc1_percent, disc1_amount, disc2_percent, disc2_amount,
               disc3_percent, disc3_amount, gross_amount, net_amount, disc_nominal,
               bonus_barang_id, bonus_name, bonus_qty, bonus_unit, bonus_unit_ratio
        FROM purchase_items WHERE purchase_id = $1
      `, [id])

      await rawRun(`CREATE TABLE IF NOT EXISTS ap_payments (id SERIAL PRIMARY KEY, status TEXT DEFAULT 'active')`)
      await rawRun(`CREATE TABLE IF NOT EXISTS ap_payment_items (id SERIAL PRIMARY KEY, payment_id INTEGER NOT NULL, purchase_id INTEGER NOT NULL, pay_amount REAL DEFAULT 0, source_type TEXT, source_id INTEGER, invoice_number TEXT)`)

      let paidAmt = 0
      let payCount = 0
      try {
        const row = await rawGet<any>(`
          SELECT COALESCE(SUM(pi.pay_amount),0) AS paid, COUNT(*) AS cnt
          FROM ap_payment_items pi
          JOIN ap_payments ap ON ap.id = pi.payment_id AND ap.status <> 'void'
          WHERE (NULLIF(pi.purchase_id,0) = $1 OR (pi.source_type IN ('purchase','purchase_return') AND pi.source_id = $2) OR pi.invoice_number = $3)
        `, [purchase.id, purchase.id, purchase.purchase_number])
        paidAmt = Number(row?.paid || 0)
        payCount = Number(row?.cnt || 0)
      } catch {}

      const totalAmt = Number(purchase.total || 0)
      const isVoid = Number(purchase.void || 0) === 1
      let label = 'Belum Bayar'
      if (paidAmt > 0 && paidAmt + 0.0001 < totalAmt) label = 'Belum Lunas'
      if (paidAmt >= totalAmt - 0.0001) label = 'Lunas'
      if (isVoid) label = 'Void'
      if (/^unpaid$/i.test(String(purchase.payment_status||''))) label = 'Belum Bayar'
      if (/^partial$/i.test(String(purchase.payment_status||''))) label = 'Belum Lunas'
      if (/^paid$/i.test(String(purchase.payment_status||''))) label = 'Lunas'
      if (/^void$/i.test(String(purchase.payment_status||''))) label = 'Void'

      return NextResponse.json({ ...purchase, items, paid_amount: paidAmt, payment_status: label, ap_payment_count: payCount })
    }

    const whereParts: string[] = []
    const whereArgs: any[] = []
    let paramIdx = 0
    if (isReturnParam !== null) {
      paramIdx++
      whereParts.push(`p.is_return = $${paramIdx}`)
      whereArgs.push(Number(isReturnParam) || 0)
    }
    if (voidParam !== null) {
      paramIdx++
      whereParts.push(`p.void = $${paramIdx}`)
      whereArgs.push(Number(voidParam) ? 1 : 0)
    }
    const filterClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

    const countSql = `SELECT COUNT(*)::int AS total FROM purchases p ${filterClause}`
    const countResult = await rawGet<{ total: number }>(countSql, whereArgs.length > 0 ? whereArgs : undefined)
    const totalRecords = countResult?.total || 0

    const offset = (page - 1) * limit
    paramIdx++
    const limitSql = ` LIMIT $${paramIdx}`
    paramIdx++
    const offsetSql = ` OFFSET $${paramIdx}`

    let purchases
    const listSql = `
      SELECT p.*, s.name as supplier_name, src.purchase_number as pembelian_number
      FROM purchases p
      LEFT JOIN master_supplier s ON s.id = p.supplier_id
      LEFT JOIN purchases src ON src.id = p.pembelian_id
      ${filterClause}
      ORDER BY p.created_at DESC
      ${limitSql} ${offsetSql}
    `
    try {
      purchases = await rawAll<any>(listSql, [...whereArgs, limit, offset])
    } catch (joinError) {
      purchases = await rawAll<any>(`
        SELECT p.*, NULL as supplier_name, NULL as pembelian_number
        FROM purchases p
        ${filterClause}
        ORDER BY p.created_at DESC
        ${limitSql} ${offsetSql}
      `, [...whereArgs, limit, offset])
    }

    if (purchases.length === 0) {
      const emptyResp = NextResponse.json([])
      emptyResp.headers.set('X-Total-Count', '0')
      emptyResp.headers.set('X-Page', String(page))
      emptyResp.headers.set('X-Per-Page', String(limit))
      return emptyResp
    }

    // Batch load payment amounts
    const purchaseIds = purchases.map((p: any) => Number(p.id))
    const paidMap = new Map<number, number>()
    const paymentCountMap = new Map<number, number>()
    try {
      const refTypes = ['purchase', 'purchase_return']
      const [paidRows, countRows] = await Promise.all([
        rawAll<any>(`
          SELECT COALESCE(NULLIF(pi.purchase_id,0), pi.source_id) AS pid, COALESCE(SUM(pi.pay_amount),0) AS paid
          FROM ap_payment_items pi
          JOIN ap_payments ap ON ap.id = pi.payment_id AND ap.status <> 'void'
          WHERE (NULLIF(pi.purchase_id,0) = ANY($1::int[]) OR (pi.source_type = ANY($2::text[]) AND pi.source_id = ANY($1::int[])))
          GROUP BY COALESCE(NULLIF(pi.purchase_id,0), pi.source_id)
        `, [purchaseIds, refTypes]),
        rawAll<any>(`
          SELECT COALESCE(NULLIF(pi.purchase_id,0), pi.source_id) AS pid, COUNT(*) AS cnt
          FROM ap_payment_items pi
          JOIN ap_payments ap ON ap.id = pi.payment_id AND ap.status <> 'void'
          WHERE (NULLIF(pi.purchase_id,0) = ANY($1::int[]) OR (pi.source_type = ANY($2::text[]) AND pi.source_id = ANY($1::int[])))
          GROUP BY COALESCE(NULLIF(pi.purchase_id,0), pi.source_id)
        `, [purchaseIds, refTypes]),
      ])
      for (const r of paidRows) paidMap.set(Number(r.pid), Number(r.paid))
      for (const r of countRows) paymentCountMap.set(Number(r.pid), Number(r.cnt))
    } catch {}

    const result = purchases.map((p: any) => {
      const isVoid = Number(p.void || 0) === 1
      const paidAmt = paidMap.get(Number(p.id)) || 0
      const payCount = paymentCountMap.get(Number(p.id)) || 0
      const total = Number(p.total || 0)
      let label = 'Belum Bayar'
      if (paidAmt > 0 && paidAmt + 0.0001 < total) label = 'Belum Lunas'
      if (paidAmt >= total - 0.0001) label = 'Lunas'
      if (isVoid) label = 'Void'
      if (/^unpaid$/i.test(String(p.payment_status || ''))) label = 'Belum Bayar'
      if (/^partial$/i.test(String(p.payment_status || ''))) label = 'Belum Lunas'
      if (/^paid$/i.test(String(p.payment_status || ''))) label = 'Lunas'
      if (/^void$/i.test(String(p.payment_status || ''))) label = 'Void'
      return { ...p, payment_status: label, paid_amount: paidAmt, ap_payment_count: payCount }
    })

    const response = NextResponse.json(result)
    response.headers.set('X-Total-Count', String(totalRecords))
    response.headers.set('X-Page', String(page))
    response.headers.set('X-Per-Page', String(limit))
    response.headers.set('X-Total-Pages', String(Math.ceil(totalRecords / limit)))
    return response
  } catch (error: any) {
    console.error('GET purchases error:', error)
    return NextResponse.json({ 
      error: 'Failed to get purchases',
      details: error.message,
      code: error.code 
    }, { status: 500 })
  }
}

// POST - Create purchase
export async function POST(request: NextRequest) {
  try {
    const pool = (getDb() as any).$client
    await ensurePurchaseSchema()
    
    const data = await request.json()

    if (!data.supplierId) {
      return NextResponse.json({ error: 'Missing supplier' }, { status: 400 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const canBackdate = await getAllowBackdate(pool) || hasPermission(request as any, 'purchase', 'backdate')
    const purchaseDate = ((canBackdate ? (data.purchaseDate || today) : today) || today).slice(0, 10)

    const period = await getPeriodByDate(purchaseDate)
    if (!period) {
      return NextResponse.json({ 
        error: `Periode belum ada untuk tanggal ${purchaseDate}.`,
        code: 'PERIOD_NOT_FOUND'
      }, { status: 400 })
    }
    if (Number(period.is_closed) === 1) {
      return NextResponse.json({ 
        error: `Periode '${period.name}' sudah ditutup.`,
        code: 'PERIOD_CLOSED'
      }, { status: 400 })
    }
    
    let isReturn = !!data.isReturn
    if (!('isReturn' in data)) {
      try {
        const ref = String(request.headers.get('referer') || '')
        if (ref.includes('/pembelian/retur')) isReturn = true
      } catch {}
    }
    const canTransaksiCreate = hasPermission(request as any, 'transaksi', 'create')
    if (isReturn) {
      if (!hasPermission(request as any, 'purchase_return', 'create') && !canTransaksiCreate) {
        return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat retur pembelian' }, { status: 403 })
      }
    } else {
      if (!hasPermission(request as any, 'purchase', 'create') && !canTransaksiCreate) {
        return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat pembelian' }, { status: 403 })
      }
    }
    const year = new Date(purchaseDate).getFullYear()
    const prefix = isReturn ? 'RET' : 'PB'
    const lastDoc = await rawGet<any>(`
      SELECT purchase_number FROM purchases 
      WHERE purchase_number LIKE $1 
      ORDER BY id DESC LIMIT 1
    `, [`${prefix}/${year}/%`])
    
    let seq = 1
    if (lastDoc && lastDoc.purchase_number) {
      const parts = lastDoc.purchase_number.split('/')
      const lastSeq = parseInt(parts[2] || '0', 10)
      seq = isNaN(lastSeq) ? 1 : lastSeq + 1
    }
    const purchaseNumber = `${prefix}/${year}/${seq.toString().padStart(6, '0')}`
    
    const itemCalculations: any[] = []
    let itemsNetTotal = 0
    let itemsGrossTotal = 0
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const qty = Number(item.quantity) || 0
        const unitPrice = Number(item.unitPrice || item.price || 0)
        const perUnitNominal = Number(item.discNominal ?? 0)
        const calc = calculateTieredDiscount(
          qty,
          unitPrice,
          Number(item.discountPercent ?? 0),
          Number(item.disc1Percent ?? 0),
          Number(item.disc2Percent ?? 0),
          Number(item.disc3Percent ?? 0),
          perUnitNominal * qty,
        )
        itemCalculations.push({ ...calc, perUnitNominal } as any)
        itemsNetTotal += calc.netAmount
        itemsGrossTotal += calc.grossAmount
      }
    }
    const headerDiscPct = Math.min(Math.max(Number(data.discountPercent || 0), 0), 100)
    const headerDiscAmt = Number(data.discountAmount || 0) || roundRp(itemsNetTotal * (headerDiscPct/100))
    const totalItemDiscount = itemsGrossTotal - itemsNetTotal
    const totalDiscount = totalItemDiscount + headerDiscAmt
    const dppBase = itemsNetTotal - headerDiscAmt
    const ppnPct = Math.min(Math.max(Number(data.ppnPercent || 0), 0), 100)
    const ppnResult = calculatePpn(dppBase, ppnPct, false)
    const total = ppnResult.grandTotal

    const warehouseId = data.warehouseId || 1
    const userId = getUserId(request)
    const poId = data.poId ? Number(data.poId) : null
    const pembelianId = isReturn ? (data.pembelianId ? Number(data.pembelianId) : null) : null
    const fakturPajak = data.fakturPajak || null
    let fakturCol = ', faktur_pajak'
    let fakturVal: any[] = []
    if (fakturPajak) {
      fakturVal = [fakturPajak]
    }

    const expectedDate = data.expectedDate ? String(data.expectedDate).slice(0, 10) : null
    const periodId = period.id

    await ensurePurchaseSchema()

    // Wrap critical operations in DB transaction
    const txClient = await (getDb() as any).$client.connect()
    let purchaseId: number
    try {
      await txClient.query('BEGIN')

      const nextParam = 16
      let paramIdx = nextParam - 1
      const addCols = ', period_id, void, payment_status, paid_amount, expected_date'
      const addVals = `, $${++paramIdx}, $${++paramIdx}, $${++paramIdx}, $${++paramIdx}, $${++paramIdx}`
      let vals: any[] = [
        purchaseNumber, poId, data.supplierId, warehouseId, purchaseDate, data.invoiceNumber,
        itemsGrossTotal, headerDiscPct, headerDiscAmt, totalDiscount, ppnPct, ppnResult.ppnAmount, total, isReturn ? 1 : 0, userId,
        periodId, 0, 'Belum Bayar', 0, expectedDate,
      ]
      if (fakturPajak) { vals.push(fakturPajak) }
      if (pembelianId) { vals.push(pembelianId) }

      const r = await txClient.query(`
        INSERT INTO purchases (
          purchase_number, po_id, supplier_id, warehouse_id, purchase_date, invoice_number,
          subtotal, discount_percent, discount_amount, total_discount, ppn_percent, ppn_amount, total, is_return, user_create, created_at
          ${addCols}
          ${fakturPajak ? ', faktur_pajak' : ''}
          ${pembelianId ? ', pembelian_id' : ''}
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP
          ${addVals}
          ${fakturPajak ? `, $${++paramIdx}` : ''}
          ${pembelianId ? `, $${++paramIdx}` : ''}
        )
        RETURNING id
      `, vals)
      purchaseId = Number(r.rows[0].id)

      const costRatio = itemsNetTotal > 0 ? (total - ppnResult.ppnAmount) / itemsNetTotal : 1

      if (data.items && data.items.length > 0) {
        for (let idx = 0; idx < data.items.length; idx++) {
          const item = data.items[idx]
          if (!item.barangId || !item.quantity) continue
          const qty = Number(item.quantity) || 0
          const unitPrice = Number(item.unitPrice || item.price || 0)
          const unitName = item.unitName || item.unit || null
          const unitRatio = Number(item.unitRatio || 1) || 1
          const poItemId = item.poItemId != null ? Number(item.poItemId) : null
          const calc = itemCalculations[idx]
          const { grossAmount, discountPercent, discountAmount, disc1Percent, disc1Amount, disc2Percent, disc2Amount, disc3Percent, disc3Amount, discNominal, totalDiscount, netAmount } = calc as any
          const discNominalStore = (calc as any).perUnitNominal ?? discNominal

          await txClient.query(`
            INSERT INTO purchase_items (
              purchase_id, po_item_id, barang_id, quantity, unit_name, unit_ratio, unit_price,
              discount_percent, discount_amount, total_price,
              disc1_percent, disc1_amount, disc2_percent, disc2_amount, disc3_percent, disc3_amount,
              gross_amount, net_amount,
              disc_nominal, bonus_barang_id, bonus_name, bonus_qty, bonus_unit, bonus_unit_ratio
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          `, [purchaseId, poItemId, item.barangId, qty, unitName, unitRatio, unitPrice,
            discountPercent, discountAmount, netAmount,
            disc1Percent, disc1Amount, disc2Percent, disc2Amount, disc3Percent, disc3Amount,
            grossAmount, netAmount, discNominalStore,
            item.bonusBarangId || null, item.bonusName || null, item.bonusQty || 0, item.bonusUnit || null, item.bonusUnitRatio || 1
          ])

          const qtyBase = qty * unitRatio
          const barangRow = (await txClient.query(`SELECT jenis FROM master_barang WHERE id = $1`, [item.barangId])).rows[0]
          const isHppEligible = barangRow && (Number(barangRow.jenis) === 1 || Number(barangRow.jenis) === 2 || Number(barangRow.jenis) === 3)
          const unitCostBase = qtyBase > 0 ? (netAmount / qtyBase) : 0

          const balRow = (await txClient.query(`SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2`, [item.barangId, warehouseId])).rows[0]
          const prevQty = balRow ? Number(balRow.quantity) || 0 : 0
          const prevTotalCost = balRow ? Number(balRow.total_cost) || 0 : 0
          const invCost = Number((netAmount * costRatio).toFixed(2))
          const invUnitCost = qtyBase > 0 ? (invCost / qtyBase) : 0

          // Stock validation for returns — always check, regardless of allowNegative setting
          if (isReturn && qtyBase > 0) {
            const currentQty = balRow ? Number(balRow.quantity) || 0 : 0
            if (currentQty < qtyBase) {
              throw new Error(`Stok tidak mencukupi: tersedia ${currentQty}, dibutuhkan ${qtyBase}`)
            }
          }

          const deltaQty = isReturn ? -qtyBase : qtyBase
          const deltaCost = isHppEligible ? (isReturn ? -invCost : invCost) : 0
          const newQty = prevQty + deltaQty
          const newTotalCost = prevTotalCost + deltaCost
          const newAvg = (isHppEligible && newQty > 0) ? (newTotalCost / newQty) : (balRow ? Number(balRow.avg_cost)||0 : 0)

          await txClient.query(`
            INSERT INTO stock_movements (
              ingredient_id, warehouse_id, movement_type, quantity, unit,
              reference_type, reference_id, period_id, transaction_date, notes, created_at,
              unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          `, [item.barangId, warehouseId, isReturn ? 'out' : 'in', Math.abs(qtyBase), unitName,
            isReturn ? 'purchase_return' : 'purchase', purchaseId, period.id, purchaseDate,
            isReturn ? 'retur pembelian' : 'pembelian', purchaseDate,
            isHppEligible ? invUnitCost : null, isHppEligible ? Math.abs(invCost) : null,
            newQty, isHppEligible ? newTotalCost : (balRow ? prevTotalCost : 0), isHppEligible ? newAvg : (balRow ? Number(balRow.avg_cost)||0 : 0)
          ])

          if (balRow) {
            await txClient.query(`
              UPDATE stock_balance SET quantity = quantity + $1, total_cost = COALESCE(total_cost,0) + $2,
                avg_cost = CASE WHEN (quantity + $3) > 0 THEN (COALESCE(total_cost,0) + $4) / (quantity + $5) ELSE 0 END,
                updated_at = CURRENT_TIMESTAMP
              WHERE ingredient_id = $6 AND warehouse_id = $7
            `, [deltaQty, deltaCost, deltaQty, deltaCost, deltaQty, item.barangId, warehouseId])
          } else {
            await txClient.query(`
              INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, total_cost, avg_cost, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [item.barangId, warehouseId, deltaQty, isHppEligible ? (isReturn ? -invCost : invCost) : 0, isHppEligible ? invUnitCost : 0])
          }
        }
      }

      await txClient.query('COMMIT')
    } catch (e) {
      await txClient.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      txClient.release()
    }

    // Save journal entries
    try {
      const srcType = isReturn ? 'Retur Pembelian' : 'Pembelian'
      const entries = await generateEntriesForSingleSource(srcType, purchaseNumber, purchaseDate)
      if (entries.length > 0) {
        await saveJournalEntriesForSource(srcType, purchaseId, purchaseNumber, purchaseDate, entries)
      }
    } catch (jeErr) {
      console.error('Failed to save journal entries for purchase:', jeErr)
    }

    return NextResponse.json({
      success: true,
      id: Number(purchaseId),
      purchaseId: Number(purchaseId),
      purchaseNumber,
    })
  } catch (error: any) {
    console.error('POST purchases error:', error)
    const msg = error?.message || 'Gagal menyimpan'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
