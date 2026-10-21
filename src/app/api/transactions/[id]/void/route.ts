import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getPeriodByDate } from '@/lib/period'
import { deleteJournalEntriesForSource } from '@/lib/journalHelpers'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!hasPermission(request as any, 'sales_list', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses void transaksi penjualan' }, { status: 403 })
    }
    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 })
    }

    const db = getDb()
    const pool = (db as any).$client
    
    const transaction = await rawGet<any>('SELECT id, void, is_return FROM transactions WHERE id = ?', [id])
    
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }
    
    if (transaction.void === 1) {
      return NextResponse.json({ error: 'Transaction already voided' }, { status: 400 })
    }

    const voidTx = await rawGet<any>('SELECT id, transaction_date, period_id FROM transactions WHERE id = ?', [id])
    if (voidTx) {
      const voidPeriod = voidTx.period_id
        ? await rawGet<any>('SELECT id, name, is_closed, status_buku FROM master_periode WHERE id = ? AND isdelete = 0', [voidTx.period_id])
        : null
      const fallbackPeriod = voidPeriod || await getPeriodByDate(voidTx.transaction_date || '')
      if (fallbackPeriod) {
        const voidClosed = fallbackPeriod?.status_buku ? (String(fallbackPeriod.status_buku).toUpperCase() === 'CLOSED' ? 1 : 0) : Number(fallbackPeriod.is_closed)
        if (voidClosed === 1) {
          return NextResponse.json({ error: `Periode '${fallbackPeriod.name}' sudah ditutup, tidak dapat void transaksi.` }, { status: 400 })
        }
      }
    }
    
    const hasPosPayments = await rawGet<any>('SELECT COUNT(*) as cnt FROM transaction_payments WHERE transaction_id = ?', [id])
    const isPosAutoAr = Number(hasPosPayments?.cnt || 0) > 0

    if (isPosAutoAr) {
      try {
        const arPayments = await rawAll<any>("SELECT ap.id FROM ar_payments ap JOIN ar_payment_items ai ON ai.payment_id = ap.id WHERE ai.sale_id = ? AND ap.status = 'active'", [id])
        for (const ar of arPayments) {
          await rawRun("UPDATE ar_payments SET status = 'void', void = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [Number(ar.id)])
          await deleteJournalEntriesForSource('Terima Piutang', Number(ar.id))
          console.log(`[Void Transaction] Auto-voided AR payment ${ar.id} for transaction ${id}`)
        }
      } catch (e) {
        console.warn('[Void Transaction] gagal auto-void AR payment:', e)
      }
    } else {
      try {
        await rawRun("CREATE TABLE IF NOT EXISTS ar_payments (id SERIAL PRIMARY KEY, status TEXT DEFAULT 'active')")
        await rawRun("CREATE TABLE IF NOT EXISTS ar_payment_items (id SERIAL PRIMARY KEY, payment_id INTEGER NOT NULL, sale_id INTEGER NOT NULL, pay_amount REAL DEFAULT 0)")
        const paidRow = await rawGet<any>(`
          SELECT COALESCE(SUM(ai.pay_amount),0) AS paid
          FROM ar_payment_items ai
          JOIN ar_payments ap ON ap.id = ai.payment_id AND ap.status <> 'void'
          WHERE ai.sale_id = ?
        `, [id])
        if (Number(paidRow?.paid || 0) > 0) {
          return NextResponse.json({ error: 'Invoice penjualan yang sudah dibayarkan tidak dapat di-void' }, { status: 400 })
        }
      } catch {}
    }

    try {
      const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transactions'")
      const has = (n: string) => cols.some(c => String(c.name).toLowerCase() === n)
      if (!has('user_void')) await rawRun('ALTER TABLE transactions ADD COLUMN user_void INTEGER')
    } catch {}

    const userId = getUserId(request)
    const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transactions'")
    const has = (n: string) => cols.some(c => String(c.name).toLowerCase() === n)
    const hasStatus = has('status')
    const hasUserVoid = has('user_void')
    const hasUserEdit = has('user_edit')
    if (hasUserVoid && hasStatus && hasUserEdit) {
      await rawRun("UPDATE transactions SET void = 1, status = 'void', user_void = ?, user_edit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [userId || null, userId || null, id])
    } else if (hasUserVoid && hasUserEdit) {
      await rawRun('UPDATE transactions SET void = 1, user_void = ?, user_edit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId || null, userId || null, id])
    } else if (hasUserVoid && hasStatus) {
      await rawRun("UPDATE transactions SET void = 1, status = 'void', user_void = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [userId || null, id])
    } else if (hasUserVoid) {
      await rawRun('UPDATE transactions SET void = 1, user_void = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId || null, id])
    } else if (hasStatus) {
      await rawRun("UPDATE transactions SET void = 1, status = 'void', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id])
    } else {
      await rawRun('UPDATE transactions SET void = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id])
    }

    // --- SO REALIZATION DECREMENT (best-effort, after void) ---
    try {
      const txInfo = await rawGet<any>("SELECT so_id, transaction_type, is_return FROM transactions WHERE id = ?", [id])
      const soId = txInfo?.so_id ? Number(txInfo.so_id) : null
      if (soId && Number(txInfo?.transaction_type || 0) === 3 && Number(txInfo?.is_return || 0) === 0) {
        const soHeader = await rawGet<any>("SELECT id, so_status, realisasi_manual FROM sales_order WHERE id = ? AND COALESCE(so_status,'') != 'void'", [soId])
        if (soHeader && Number(soHeader.realisasi_manual || 0) !== 1) {
          const items = await rawAll<any>("SELECT barang_id, quantity, unit_ratio FROM transaction_items WHERE transaction_id = ?", [id])
          if (items && items.length > 0) {
            for (const it of items) {
              const barangId = Number(it.barang_id)
              const qty = Number(it.quantity || 0)
              const unitRatio = Number(it.unit_ratio || 1)
              const qtyBase = qty * unitRatio
              if (qtyBase <= 0) continue
              const soi = await rawGet<any>("SELECT id, realized_qty_base, realized_qty, unit_ratio FROM sales_order_items WHERE sales_order_id = ? AND barang_id = ?", [soId, barangId])
              if (!soi) continue
              const currentRealized = Number(soi.realized_qty_base || 0)
              const newRealized = Math.max(0, currentRealized - qtyBase)
              const soiUnitRatio = Number(soi.unit_ratio || 1)
              const newRealizedQty = soiUnitRatio > 0 ? Math.round((newRealized / soiUnitRatio) * 100) / 100 : 0
              await rawRun("UPDATE sales_order_items SET realized_qty_base = ?, realized_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newRealized, newRealizedQty, soi.id])
            }
            // Recalculate so_status
            const remainingItems = await rawAll<any>("SELECT id, quantity, unit_ratio, realized_qty_base FROM sales_order_items WHERE sales_order_id = ?", [soId])
            let allFullyRealized = true
            if (remainingItems) {
              for (const soi of remainingItems) {
                const maxQty = Number(soi.quantity || 0) * Number(soi.unit_ratio || 1)
                const currentRealized = Number(soi.realized_qty_base || 0)
                if (maxQty > currentRealized + 0.0001) {
                  allFullyRealized = false
                  break
                }
              }
            }
            await rawRun("UPDATE sales_order SET so_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [allFullyRealized ? 'realisasi' : 'outstanding', soId])
            console.log(`[Void Transaction] Updated SO ${soId} realization: status=${allFullyRealized ? 'realisasi' : 'outstanding'}`)
          }
        }
      }
    } catch (e) {
      console.warn('[Void Transaction] gagal update SO realization:', e instanceof Error ? e.message : e)
    }
    
    const voidSettings = await rawAll<any>("SELECT setting_key, setting_value FROM settings WHERE setting_group = 'penjualan'")
    const voidSettingMap: Record<string, string> = {}
    for (const r of voidSettings) voidSettingMap[r.setting_key] = String(r.setting_value ?? '')
    const voidTanpaStok = voidSettingMap['sales_tanpa_stok'] === '1'
    
    if (!voidTanpaStok) {
      try {
        const movements = await rawAll<any>(`
          SELECT ingredient_id, warehouse_id, quantity, COALESCE(total_cost,0) as total_cost, reference_type
          FROM stock_movements
          WHERE (reference_type = 'sale' OR reference_type = 'sale_return') AND reference_id = ?
        `, [id])
        
        for (const m of movements) {
          const revertQty = Number(m.quantity) || 0
          const revertCost = Number(m.total_cost) || 0
          const isOutbound = m.reference_type === 'sale'
          const adjQty = isOutbound ? revertQty : -revertQty
          const adjCost = isOutbound ? revertCost : -revertCost
          await rawRun(`
            UPDATE stock_balance 
            SET quantity = quantity + $1,
                total_cost = COALESCE(total_cost,0) + $2,
                avg_cost = CASE WHEN (quantity + $3) > 0 THEN (COALESCE(total_cost,0) + $4) / (quantity + $3) ELSE 0 END,
                updated_at = CURRENT_TIMESTAMP
            WHERE ingredient_id = $5 AND warehouse_id = $6
          `, [adjQty, adjCost, adjQty, adjCost, m.ingredient_id, m.warehouse_id])
        }
        
        await rawRun("DELETE FROM stock_movements WHERE (reference_type = 'sale' OR reference_type = 'sale_return') AND reference_id = ?", [id])
        
        console.log(`[Void Transaction] Deleted ${movements.length} stock movements for transaction ${id}`)
      } catch (e) {
        console.error('Error deleting stock movements:', e)
        throw e
      }
    } else {
      console.log(`[Void Transaction] SKIPPED stock return for transaction ${id} (tanpaStok=true)`)
    }
    
    try {
      const txRecord = await rawGet<any>('SELECT transaction_number FROM transactions WHERE id = ?', [id])
      if (txRecord?.transaction_number) {
        const mfEntries = await rawAll<any>(`
          SELECT id, barang_id, quantity, warehouse_id FROM manufaktur 
          WHERE notes LIKE ? AND status = 'approved'
        `, [`%Auto-produksi dari penjualan ${txRecord.transaction_number}%`])
        for (const mf of mfEntries) {
          const mfId = Number(mf.id)
          const mfBarangId = Number(mf.barang_id)
          const mfQty = Number(mf.quantity) || 0
          const mfWarehouseId = Number(mf.warehouse_id) || 1
          const mfDetails = await rawAll<any>('SELECT barang_id, quantity FROM manufaktur_detail WHERE manufaktur_id = ?', [mfId])
          const mfMovements = await rawAll<any>(`
            SELECT ingredient_id, quantity, COALESCE(total_cost,0) as total_cost
            FROM stock_movements WHERE reference_type = 'manufaktur' AND reference_id = ?
          `, [mfId])
          const mfMovMap = new Map<number, { qty: number; cost: number }>()
          for (const mm of mfMovements) {
            const prev = mfMovMap.get(Number(mm.ingredient_id)) || { qty: 0, cost: 0 }
            prev.qty += Number(mm.quantity) || 0
            prev.cost += Number(mm.total_cost) || 0
            mfMovMap.set(Number(mm.ingredient_id), prev)
          }
          for (const d of mfDetails) {
            const qty = Number(d.quantity) || 0
            if (qty <= 0) continue
            const movData = mfMovMap.get(Number(d.barang_id))
            const revertCost = movData ? movData.cost : 0
            await rawRun(`
              UPDATE stock_balance 
              SET quantity = quantity + $1,
                  total_cost = COALESCE(total_cost,0) + $2,
                  avg_cost = CASE WHEN (quantity + $3) > 0 THEN (COALESCE(total_cost,0) + $4) / (quantity + $3) ELSE 0 END,
                  updated_at = CURRENT_TIMESTAMP
              WHERE ingredient_id = $5 AND warehouse_id = $6
            `, [qty, revertCost, qty, revertCost, d.barang_id, mfWarehouseId])
          }
          if (mfQty > 0) {
            const mfMovData = mfMovMap.get(Number(mfBarangId))
            const revertCost = mfMovData ? mfMovData.cost : 0
            await rawRun(`
              UPDATE stock_balance 
              SET quantity = CASE WHEN (quantity - $1) >= 0 THEN quantity - $1 ELSE 0 END,
                  total_cost = CASE WHEN (quantity - $2) >= 0 THEN COALESCE(total_cost,0) - $3 ELSE 0 END,
                  avg_cost = CASE WHEN (quantity - $4) > 0 AND COALESCE(total_cost,0) - $5 > 0 THEN (COALESCE(total_cost,0) - $6) / (quantity - $7) ELSE 0 END,
                  updated_at = CURRENT_TIMESTAMP
              WHERE ingredient_id = $8 AND warehouse_id = $9
            `, [mfQty, mfQty, revertCost, mfQty, revertCost, revertCost, mfQty, mfBarangId, mfWarehouseId])
          }
          await rawRun("DELETE FROM stock_movements WHERE reference_type = 'manufaktur' AND reference_id = ?", [mfId])
          await rawRun("UPDATE manufaktur SET status = 'void', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [mfId])
          console.log(`[Void Transaction] Auto-voided manufaktur ${mfId} for transaction ${id}`)
        }
      }
    } catch (e) {
      console.warn('[Void Transaction] gagal void manufaktur:', e)
    }

    // --- RESTO TEMP ORDER RESET (best-effort, after void) ---
    try {
      const txRecordForTemp = await rawGet<any>('SELECT resto_temp_id FROM transactions WHERE id = ?', [id])
      const tempId = txRecordForTemp?.resto_temp_id ? Number(txRecordForTemp.resto_temp_id) : null
      if (tempId) {
        await rawRun("UPDATE resto_temp_orders SET status = 'open', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'paid'", [tempId])
        console.log(`[Void Transaction] Reset resto_temp_order ${tempId} status to open`)
      }
    } catch (e) {
      console.warn('[Void Transaction] gagal reset resto_temp_order:', e)
    }

    try {
      await deleteJournalEntriesForSource('Penjualan', id)
      await deleteJournalEntriesForSource('Retur Penjualan', id)
      await deleteJournalEntriesForSource('Terima Piutang', id)
    } catch (e) {
      console.warn('[Transaction Void] failed to delete journal entries:', e)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Transaction voided successfully' 
    })
  } catch (error) {
    console.error('Error voiding transaction:', error)
    return NextResponse.json({ error: 'Failed to void transaction' }, { status: 500 })
  }
}
