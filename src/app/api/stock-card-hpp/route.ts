import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'stock_card_hpp', 'view') && !hasPermission(request as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat kartu stok HPP' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const ingredientId = searchParams.get('ingredientId')
    const warehouseId = searchParams.get('warehouseId') || '1'
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!ingredientId) {
      return NextResponse.json({ error: 'ingredientId is required' }, { status: 400 })
    }

    const pool = (getDb() as any).$client
    const ingId = parseInt(ingredientId)

    const ingredient = await rawGet<any>(`
      SELECT id, code, name, hpp
      FROM master_barang
      WHERE id = $1
    `, [ingId])
    if (!ingredient) {
      return NextResponse.json({ error: 'Bahan baku not found' }, { status: 404 })
    }

    const units = await rawAll<any>(`
      SELECT name, ratio
      FROM barang_units
      WHERE barang_id = $1
      ORDER BY ratio ASC
    `, [ingId])
    const baseUnit = units[0]?.name || 'unit'

    // Opening balance qty
    let openingBalance = 0
    if (from) {
      const openAgg = await rawGet<any>(`
        SELECT 
          COALESCE(SUM(CASE WHEN sm.movement_type = 'in' THEN sm.quantity ELSE 0 END), 0) as in_qty,
          COALESCE(SUM(CASE WHEN sm.movement_type = 'out' THEN sm.quantity ELSE 0 END), 0) as out_qty
        FROM stock_movements sm
        LEFT JOIN purchases p 
          ON sm.reference_type = 'purchase' AND sm.reference_id = p.id
        LEFT JOIN transactions t 
          ON (sm.reference_type = 'transaction' OR sm.reference_type = 'sale' OR sm.reference_type = 'sale_return') AND sm.reference_id = t.id
        LEFT JOIN stock_usage su
          ON (sm.reference_type = 'usage' OR sm.reference_type = 'stock_usage') AND sm.reference_id = su.id
        WHERE sm.ingredient_id = $1
          AND sm.warehouse_id = $2
          AND COALESCE(sm.created_at::text, sm.transaction_date::text) < $3
          AND (
            sm.reference_type IS NULL
            OR (sm.reference_type = 'purchase' AND COALESCE(p.void, 0) = 0)
            OR ((sm.reference_type = 'transaction' OR sm.reference_type = 'sale' OR sm.reference_type = 'sale_return') AND COALESCE(t.void, 0) = 0)
            OR (sm.reference_type = 'initial_stock')
            OR ((sm.reference_type = 'usage' OR sm.reference_type = 'stock_usage') AND COALESCE(su.void, 0) = 0 AND COALESCE(su.status, 'draft') = 'approved')
          )
      `, [ingId, warehouseId, from])
      openingBalance = (openAgg?.in_qty || 0) - (openAgg?.out_qty || 0)
    }

    // Opening average cost (last before from)
    const openingAvg = from ? (await rawGet<any>(`
      SELECT balance_avg_cost
      FROM stock_movements
      WHERE ingredient_id = $1 AND warehouse_id = $2
        AND COALESCE(transaction_date::text, movement_date::text, created_at::text) < $3
      ORDER BY COALESCE(transaction_date::text, movement_date::text, created_at::text) DESC, id DESC
      LIMIT 1
    `, [ingId, warehouseId, from]))?.balance_avg_cost : null
    const defaultHpp = ingredient.hpp || 0
    const openingAvgCost = (openingAvg ?? defaultHpp) || 0

    // Movements in range with avg cost (hpp) per movement
    const movements = await rawAll<any>(`
      SELECT 
        id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        COALESCE(transaction_date::text, movement_date::text, created_at::text) as created_at,
        unit_cost,
        balance_avg_cost
      FROM stock_movements
      WHERE ingredient_id = $1
        AND warehouse_id = $2
        AND (CASE WHEN $3::text IS NOT NULL THEN COALESCE(transaction_date::text, movement_date::text, created_at::text) >= $3 ELSE 1=1 END)
        AND (CASE WHEN $4::text IS NOT NULL THEN COALESCE(transaction_date::text, movement_date::text, created_at::text) <= $4 ELSE 1=1 END)
      ORDER BY COALESCE(transaction_date::text, movement_date::text, created_at::text) ASC, id ASC
      LIMIT 500
    `, [ingId, warehouseId, from, to])

    // Reference map (reuse minimal like stock-card)
    const transactionIds = movements.filter(m => m.reference_id && (m.reference_type === 'transaction' || m.reference_type === 'sale' || m.reference_type === 'sale_return')).map(m => m.reference_id)
    const purchaseIds = movements.filter(m => m.reference_id && m.reference_type === 'purchase').map(m => m.reference_id)
    const transferIds = movements.filter(m => m.reference_id && m.reference_type === 'stock_transfer').map(m => m.reference_id)
    const usageIds = movements.filter(m => m.reference_id && (m.reference_type === 'stock_usage' || m.reference_type === 'usage')).map(m => m.reference_id)
    const returIds = movements.filter(m => m.reference_id && (m.reference_type === 'retur' || m.reference_type === 'retur_penjualan' || m.reference_type === 'retur_pembelian')).map(m => m.reference_id)
    const opnameIds = movements.filter(m => m.reference_id && m.reference_type === 'stock_opname').map(m => m.reference_id)
    const manufakturIds = movements.filter(m => m.reference_id && (m.reference_type === 'manufaktur_in' || m.reference_type === 'manufaktur_out')).map(m => m.reference_id)

    const referenceMap = new Map<string, { reference_number: string | null; void: number; notes?: string }>()
    if (transactionIds.length > 0) {
      const transactions = await rawAll<any>(`
        SELECT id, transaction_number, COALESCE(void, 0) as void
        FROM transactions 
        WHERE id = ANY($1::int[])
      `, [transactionIds])
      transactions.forEach(t => {
        referenceMap.set(`transaction_${t.id}`, { reference_number: t.transaction_number, void: t.void })
        referenceMap.set(`sale_${t.id}`, { reference_number: t.transaction_number, void: t.void })
        referenceMap.set(`sale_return_${t.id}`, { reference_number: t.transaction_number, void: t.void })
      })
    }
    if (purchaseIds.length > 0) {
      let purchases: any[] = []
      try {
        purchases = await rawAll<any>(`
          SELECT id, purchase_number, status
          FROM purchases 
          WHERE id = ANY($1::int[])
        `, [purchaseIds])
      } catch {
        try {
          purchases = await rawAll<any>(`
            SELECT id, purchase_number
            FROM purchases 
            WHERE id = ANY($1::int[])
          `, [purchaseIds])
        } catch {}
      }
      const mapById = new Map<number, any>()
      purchases.forEach(p => mapById.set(Number(p.id), p))
      purchaseIds.forEach((pid: any) => {
        const p = mapById.get(Number(pid))
        const isVoid = p && 'status' in p ? (String(p.status || '').toLowerCase() === 'void') : false
        referenceMap.set(`purchase_${pid}`, { reference_number: p?.purchase_number || null, void: isVoid ? 1 : 0 })
      })
    }
    if (transferIds.length > 0) {
      const transfers = await rawAll<any>(`
        SELECT id, number, COALESCE(void, 0) as void
        FROM stock_transfers
        WHERE id = ANY($1::int[])
      `, [transferIds])
      transfers.forEach(tr => {
        referenceMap.set(`stock_transfer_${tr.id}`, { reference_number: tr.number, void: tr.void || 0, notes: 'Transfer Stok' })
      })
    }
    if (usageIds.length > 0) {
      const usages = await rawAll<any>(`
        SELECT id, number, COALESCE(void, 0) as void, COALESCE(status, 'draft') as status
        FROM stock_usage
        WHERE id = ANY($1::int[])
      `, [usageIds])
      usages.forEach(us => {
        const isVoid = Number(us.void || 0) === 1 || String(us.status || 'draft') !== 'approved'
        referenceMap.set(`usage_${us.id}`, { reference_number: us.number, void: isVoid ? 1 : 0, notes: 'Pemakaian Stok' })
        referenceMap.set(`stock_usage_${us.id}`, { reference_number: us.number, void: isVoid ? 1 : 0, notes: 'Pemakaian Stok' })
      })
    }
    if (returIds.length > 0) {
      const returPenjualan = await rawAll<any>(`
        SELECT id, retur_number, COALESCE(void, 0) as void
        FROM retur_penjualan
        WHERE id = ANY($1::int[])
      `, [returIds])
      returPenjualan.forEach(r => {
        referenceMap.set(`retur_penjualan_${r.id}`, { reference_number: r.retur_number, void: r.void || 0, notes: 'Retur Penjualan' })
      })
      
      const returPembelian = await rawAll<any>(`
        SELECT id, retur_number, COALESCE(void, 0) as void
        FROM retur_pembelian
        WHERE id = ANY($1::int[])
      `, [returIds])
      returPembelian.forEach(r => {
        referenceMap.set(`retur_pembelian_${r.id}`, { reference_number: r.retur_number, void: r.void || 0, notes: 'Retur Pembelian' })
      })
    }
    if (opnameIds.length > 0) {
      const opnames = await rawAll<any>(`
        SELECT id, session_number, COALESCE(void, 0) as void
        FROM stock_opname
        WHERE id = ANY($1::int[])
      `, [opnameIds])
      opnames.forEach(o => {
        referenceMap.set(`stock_opname_${o.id}`, { reference_number: o.session_number, void: o.void || 0, notes: 'Stock Opname' })
      })
    }
    if (manufakturIds.length > 0) {
      const manufakturs = await rawAll<any>(`
        SELECT id, nomor, COALESCE(void, 0) as void, COALESCE(status, 'draft') as status
        FROM manufaktur
        WHERE id = ANY($1::int[])
      `, [manufakturIds])
      manufakturs.forEach(m => {
        const isVoid = Number(m.void || 0) === 1 || String(m.status || 'draft') !== 'approved'
        referenceMap.set(`manufaktur_in_${m.id}`, { reference_number: m.nomor, void: isVoid ? 1 : 0, notes: 'Manufaktur' })
        referenceMap.set(`manufaktur_out_${m.id}`, { reference_number: m.nomor, void: isVoid ? 1 : 0, notes: 'Manufaktur' })
      })
    }

    const nonVoided = movements.filter(m => {
      if (!m.reference_id || !m.reference_type) return true
      const ref = referenceMap.get(`${m.reference_type}_${m.reference_id}`)
      if (!ref) return true
      return ref.void === 0
    })

    let runningQty = openingBalance
    let runningAvg = openingAvgCost
    let totalInQty = 0
    let totalOutQty = 0
    let totalValueIn = 0
    let totalValueOut = 0

    const rows = nonVoided.map(m => {
      const inQty = m.movement_type === 'in' ? Number(m.quantity) || 0 : 0
      const outQty = m.movement_type === 'out' ? Number(m.quantity) || 0 : 0
      let rowHpp = runningAvg
      let valueIn = 0
      let valueOut = 0

      if (inQty > 0) {
        let unitCost = (m.unit_cost != null && !Number.isNaN(Number(m.unit_cost))) ? Number(m.unit_cost) : NaN
        if (!Number.isFinite(unitCost) || unitCost <= 0) {
          if (m.reference_type === 'purchase' && m.reference_id) {
            try {
              const it = rawGet<any>(`
                SELECT quantity, unit_ratio, total_price
                FROM purchase_items
                WHERE purchase_id = $1 AND barang_id = $2
                ORDER BY id ASC LIMIT 1
              `, [m.reference_id, ingId]) as any
              if (it) {
                const qtyBase = (Number(it.quantity)||0) * (Number(it.unit_ratio)||1)
                if (qtyBase > 0) unitCost = (Number(it.total_price)||0) / qtyBase
              }
            } catch {}
          }
        }
        if (!Number.isFinite(unitCost) || unitCost <= 0) unitCost = runningAvg
        valueIn = unitCost * inQty
        const prevQty = runningQty
        const prevVal = runningQty * runningAvg
        const newQty = prevQty + inQty
        const newVal = prevVal + valueIn
        runningAvg = newQty > 0 ? (newVal / newQty) : runningAvg
        rowHpp = runningAvg
        runningQty = newQty
        totalInQty += inQty
        totalValueIn += valueIn
      } else if (outQty > 0) {
        valueOut = runningAvg * outQty
        runningQty = runningQty - outQty
        if (runningQty < 0) runningQty = 0
        totalOutQty += outQty
        totalValueOut += valueOut
      }

      const refKey = m.reference_id && m.reference_type ? `${m.reference_type}_${m.reference_id}` : null
      const reference = refKey ? referenceMap.get(refKey) : null
      const notesMap: Record<string, string> = {
        purchase: 'Pembelian',
        transaction: 'Penjualan',
        sale: 'Penjualan',
        sale_return: 'Retur Penjualan',
        stock_transfer: 'Transfer Stok',
        stock_usage: 'Pemakaian Stok',
        usage: 'Pemakaian Stok',
        initial_stock: 'Saldo Awal',
        'stock-opname': 'Stok Opname',
        manufaktur_in: 'Manufaktur Masuk',
        manufaktur_out: 'Manufaktur Keluar',
      }
      let notes: string | null = reference?.notes || null
      if (!notes) {
        notes = notesMap[m.reference_type || ''] || null
      }

      return {
        id: m.id,
        movement_type: m.movement_type,
        created_at: m.created_at,
        reference_type: m.reference_type,
        reference_id: m.reference_id,
        in_qty: inQty,
        out_qty: outQty,
        balance: runningQty,
        reference_number: reference ? reference.reference_number : null,
        notes,
        hpp: rowHpp,
        value_in: valueIn,
        value_out: valueOut,
      }
    })

    const closingBalance = openingBalance + totalInQty - totalOutQty
    const closingAvgRow = await rawGet<any>(`
      SELECT balance_avg_cost
      FROM stock_movements
      WHERE ingredient_id = $1 AND warehouse_id = $2
        AND (CASE WHEN $3::text IS NOT NULL THEN COALESCE(transaction_date::text, movement_date::text, created_at::text) <= $3 ELSE 1=1 END)
      ORDER BY COALESCE(transaction_date::text, movement_date::text, created_at::text) DESC, id DESC
      LIMIT 1
    `, [ingId, warehouseId, to])
    const closingAvgCost = (runningQty > 0 ? runningAvg : (closingAvgRow?.balance_avg_cost ?? defaultHpp) || 0)

    return NextResponse.json({
      ingredient: { id: ingredient.id, code: ingredient.code, name: ingredient.name, base_unit: baseUnit },
      period: { from, to },
      opening_balance: openingBalance,
      opening_avg_cost: openingAvgCost,
      movements: rows,
      total_in: totalInQty,
      total_out: totalOutQty,
      total_value_in: totalValueIn,
      total_value_out: totalValueOut,
      closing_balance: closingBalance,
      closing_avg_cost: closingAvgCost,
    })
  } catch (error: any) {
    console.error('Error fetching stock card HPP:', error)
    return NextResponse.json({ error: 'Failed to fetch stock card HPP', details: error.message }, { status: 500 })
  }
}
