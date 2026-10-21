import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'stock_card', 'view') && !hasPermission(request as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat kartu stok' }, { status: 403 })
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
      SELECT id, code, name, jenis
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

    let openingBalance = 0
    if (from) {
      const openAgg = await rawGet<any>(`
        SELECT 
          COALESCE(SUM(CASE WHEN sm.movement_type = 'in' THEN sm.quantity ELSE 0 END), 0) as in_qty,
          COALESCE(SUM(CASE WHEN sm.movement_type = 'out' THEN sm.quantity ELSE 0 END), 0) as out_qty
        FROM stock_movements sm
        LEFT JOIN purchases p 
          ON (sm.reference_type = 'purchase' OR sm.reference_type = 'purchase_return') AND sm.reference_id = p.id
        LEFT JOIN transactions t 
          ON (sm.reference_type = 'transaction' OR sm.reference_type = 'sale' OR sm.reference_type = 'sale_return') AND sm.reference_id = t.id
        WHERE sm.ingredient_id = $1 
          AND sm.warehouse_id = $2 
          AND COALESCE(sm.transaction_date::text, sm.movement_date::text, sm.created_at::text) < $3
          AND (
            sm.reference_type IS NULL
            OR ((sm.reference_type = 'purchase' OR sm.reference_type = 'purchase_return') AND COALESCE(p.void, 0) = 0)
            OR ((sm.reference_type = 'transaction' OR sm.reference_type = 'sale' OR sm.reference_type = 'sale_return') AND COALESCE(t.void, 0) = 0)
            OR (sm.reference_type = 'initial_stock')
          )
      `, [ingId, warehouseId, from])
      openingBalance = (openAgg?.in_qty || 0) - (openAgg?.out_qty || 0)
    }

    const movements = await rawAll<any>(`
      SELECT 
        id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        COALESCE(transaction_date::text, movement_date::text, created_at::text) as created_at
      FROM stock_movements
      WHERE ingredient_id = $1
        AND warehouse_id = $2
        AND (CASE WHEN $3::text IS NOT NULL THEN COALESCE(transaction_date::text, movement_date::text, created_at::text) >= $3 ELSE 1=1 END)
        AND (CASE WHEN $4::text IS NOT NULL THEN COALESCE(transaction_date::text, movement_date::text, created_at::text) <= $4 ELSE 1=1 END)
      ORDER BY COALESCE(transaction_date::text, movement_date::text, created_at::text) ASC, id ASC
      LIMIT 500
    `, [ingId, warehouseId, from, to])

    console.log(`[Stock Card] ingredient_id=${ingId}, warehouse_id=${warehouseId}, from=${from}, to=${to}`)
    console.log(`[Stock Card] Found ${movements.length} movements`)
    console.log(`[Stock Card] Opening balance: ${openingBalance}`)

    const transactionIds = movements
      .filter(m => m.reference_id && (m.reference_type === 'transaction' || m.reference_type === 'sale' || m.reference_type === 'sale_return'))
      .map(m => m.reference_id)
    
    const purchaseIds = movements
      .filter(m => m.reference_id && m.reference_type === 'purchase')
      .map(m => m.reference_id)

    const transferIds = movements
      .filter(m => m.reference_id && m.reference_type === 'stock_transfer')
      .map(m => m.reference_id)

    const usageIds = movements
      .filter(m => m.reference_id && m.reference_type === 'stock_usage')
      .map(m => m.reference_id)

    const manufakturIds = movements
      .filter(m => m.reference_id && (m.reference_type === 'manufaktur_in' || m.reference_type === 'manufaktur_out'))
      .map(m => m.reference_id)

    const purchaseReturnIds = movements
      .filter(m => m.reference_id && m.reference_type === 'purchase_return')
      .map(m => m.reference_id)

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
      const purchases = await rawAll<any>(`
        SELECT id, purchase_number, COALESCE(void, 0) as void
        FROM purchases 
        WHERE id = ANY($1::int[])
      `, [purchaseIds])
      
      purchases.forEach(p => {
        const refNumber = p.purchase_number
        referenceMap.set(`purchase_${p.id}`, { reference_number: refNumber, void: p.void || 0 })
      })
    }

    if (transferIds.length > 0) {
      const transfers = await rawAll<any>(`
        SELECT id, number, COALESCE(void, 0) as void
        FROM stock_transfers
        WHERE id = ANY($1::int[])
      `, [transferIds])

      transfers.forEach(tr => {
        referenceMap.set(`stock_transfer_${tr.id}`, {
          reference_number: tr.number,
          void: tr.void || 0,
          notes: 'Transfer Stok'
        })
      })
    }

    if (usageIds.length > 0) {
      const usages = await rawAll<any>(`
        SELECT id, number, COALESCE(void, 0) as void
        FROM stock_usage
        WHERE id = ANY($1::int[])
      `, [usageIds])

      usages.forEach(us => {
        referenceMap.set(`stock_usage_${us.id}`, {
          reference_number: us.number,
          void: us.void || 0,
          notes: 'Pemakaian Stok'
        })
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
        referenceMap.set(`manufaktur_in_${m.id}`, {
          reference_number: m.nomor,
          void: isVoid ? 1 : 0,
          notes: 'Manufaktur'
        })
        referenceMap.set(`manufaktur_out_${m.id}`, {
          reference_number: m.nomor,
          void: isVoid ? 1 : 0,
          notes: 'Manufaktur'
        })
      })
    }

    if (purchaseReturnIds.length > 0) {
      const purchaseReturns = await rawAll<any>(`
        SELECT id, purchase_number, COALESCE(void, 0) as void
        FROM purchases
        WHERE id = ANY($1::int[]) AND COALESCE(is_return, 0) = 1
      `, [purchaseReturnIds])

      purchaseReturns.forEach(r => {
        referenceMap.set(`purchase_return_${r.id}`, {
          reference_number: r.purchase_number,
          void: r.void || 0,
          notes: 'Retur Pembelian'
        })
      })
    }

    const nonVoidedMovements = movements.filter(m => {
      if (!m.reference_id || !m.reference_type) return true
      const refKey = `${m.reference_type}_${m.reference_id}`
      const reference = referenceMap.get(refKey)
      return !reference || reference.void === 0
    })

    let runningBalance = openingBalance
    const movementsWithBalance = nonVoidedMovements.map((m) => {
      const inQty = m.movement_type === 'in' ? m.quantity : 0
      const outQty = m.movement_type === 'out' ? m.quantity : 0
      runningBalance += inQty - outQty

      const refKey = m.reference_id && m.reference_type ? `${m.reference_type}_${m.reference_id}` : null
      const reference = refKey ? referenceMap.get(refKey) : null

      const notesMap: Record<string, string> = {
        purchase: 'Pembelian',
        transaction: 'Penjualan',
        sale: 'Penjualan',
        sale_return: 'Retur Penjualan',
        stock_transfer: 'Transfer Stok',
        stock_usage: 'Pemakaian Stok',
        initial_stock: 'Saldo Awal',
        'stock-opname': 'Stok Opname',
        manufaktur_in: 'Manufaktur Masuk',
        manufaktur_out: 'Manufaktur Keluar',
        purchase_return: 'Retur Pembelian',
      }
      let notes: string | null = reference?.notes || null
      if (!notes) {
        notes = notesMap[m.reference_type || ''] || null
      }

      return {
        ...m,
        in_qty: inQty,
        out_qty: outQty,
        balance: runningBalance,
        reference_number: reference ? reference.reference_number : null,
        notes
      }
    })

    const totalIn = nonVoidedMovements
      .filter((m) => m.movement_type === 'in')
      .reduce((sum, m) => sum + m.quantity, 0)
    const totalOut = nonVoidedMovements
      .filter((m) => m.movement_type === 'out')
      .reduce((sum, m) => sum + m.quantity, 0)
    const closingBalance = openingBalance + totalIn - totalOut

    return NextResponse.json({
      ingredient: {
        id: ingredient.id,
        code: ingredient.code,
        name: ingredient.name,
        base_unit: baseUnit
      },
      period: { from, to },
      opening_balance: openingBalance,
      movements: movementsWithBalance,
      total_in: totalIn,
      total_out: totalOut,
      closing_balance: closingBalance
    })
  } catch (error: any) {
    console.error('Error fetching stock card:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock card', details: error.message },
      { status: 500 }
    )
  }
}
