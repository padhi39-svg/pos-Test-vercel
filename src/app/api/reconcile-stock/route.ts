import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, withTransaction } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 500

async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await rawGet<any>('SELECT setting_value FROM settings WHERE setting_key = ?', [key])
  const v = row?.setting_value
  return v === null || v === undefined || v === '' ? fallback : String(v)
}

async function getOpenPeriods() {
  return rawAll<any>(
    `SELECT id, name, start_date, end_date
     FROM master_periode
     WHERE isdelete = 0 AND COALESCE(status_buku, 'OPEN') <> 'CLOSED'
     ORDER BY start_date ASC`,
  )
}

function isInMovement(type: string, rawQty: number): boolean {
  return (
    type === 'in' ||
    type === 'manufaktur_in' ||
    ((type === 'adjustment' || type === 'manufaktur_adjustment') && rawQty > 0) ||
    (type === 'out' && rawQty < 0)
  )
}

function isOutMovement(type: string, rawQty: number): boolean {
  return (
    type === 'out' ||
    type === 'manufaktur_out' ||
    ((type === 'adjustment' || type === 'manufaktur_adjustment') && rawQty < 0) ||
    (type === 'in' && rawQty < 0)
  )
}

type QueryFn = (sql: string, params?: any[]) => Promise<any[]>

/** Reconcile quantity non-destruktif: betulkan stock_balance.quantity agar sesuai
 *  dengan pergerakan stock_movements, hanya untuk periode OPEN (skip CLOSED).
 *  avg_cost/total_cost TIDAK disentuh. Idempotent, batching + watermark.
 */
async function runReconcile(dryRun: boolean, limit: number) {
  const openPeriods = await getOpenPeriods()
  if (openPeriods.length === 0) {
    return { processed: 0, fixed: 0, mismatches: 0, details: [], openPeriods: 0, watermark: 0, hasMore: false }
  }
  const openIds = openPeriods.map((p: any) => Number(p.id))

  const watermark = Number(await getSetting('reconcile_watermark_last_id', '0')) || 0

  const candidates = await rawAll<any>(
    `SELECT ingredient_id, warehouse_id, MAX(id) AS max_id
     FROM stock_movements
     WHERE period_id = ANY($1::int[]) OR period_id IS NULL
     GROUP BY ingredient_id, warehouse_id
     HAVING MAX(id) > $2
     ORDER BY MAX(id) ASC
     LIMIT $3`,
    [openIds, watermark, limit],
  )

  const details: any[] = []
  let fixed = 0

  await withTransaction(async (q) => {
    const qOne = async (sql: string, params?: any[]) => (await q(sql, params))[0] ?? null

    for (const cand of candidates) {
      const ingredientId = Number(cand.ingredient_id)
      const warehouseId = Number(cand.warehouse_id) || 1

      // Kunci baris stock_balance agar tidak race dengan transaksi berjalan.
      await qOne('SELECT id FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ? FOR UPDATE', [ingredientId, warehouseId])

      const firstOpen = await qOne(
        `SELECT MIN(transaction_date) AS d
         FROM stock_movements
         WHERE ingredient_id = $1 AND warehouse_id = $2
           AND (period_id = ANY($3::int[]) OR period_id IS NULL)`,
        [ingredientId, warehouseId, openIds],
      )

      const opening = await qOne(
        `SELECT balance_qty
         FROM stock_movements
         WHERE ingredient_id = $1 AND warehouse_id = $2
           AND period_id IS NOT NULL AND NOT (period_id = ANY($3::int[]))
           AND transaction_date < $4
         ORDER BY transaction_date DESC, id DESC
         LIMIT 1`,
        [ingredientId, warehouseId, openIds, firstOpen?.d ?? null],
      )
      let runQty = opening ? Number(opening.balance_qty) || 0 : 0

      const movements = await q(
        `SELECT id, movement_type, quantity, balance_qty
         FROM stock_movements
         WHERE ingredient_id = $1 AND warehouse_id = $2
           AND (period_id = ANY($3::int[]) OR period_id IS NULL)
         ORDER BY transaction_date ASC NULLS LAST, created_at ASC, id ASC`,
        [ingredientId, warehouseId, openIds],
      )

      for (const m of movements) {
        const type = String(m.movement_type || '').toLowerCase()
        const rawQty = Number(m.quantity) || 0
        if (isInMovement(type, rawQty)) {
          runQty += Math.abs(rawQty)
        } else if (isOutMovement(type, rawQty)) {
          runQty -= Math.abs(rawQty)
        } else {
          continue
        }
        if (!dryRun && Number(m.balance_qty) !== runQty) {
          await q('UPDATE stock_movements SET balance_qty = ? WHERE id = ?', [runQty, m.id])
        }
      }

      const current = await qOne(
        'SELECT quantity FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ?',
        [ingredientId, warehouseId],
      )
      const currentQty = current ? Number(current.quantity) || 0 : 0
      const diff = runQty - currentQty

      if (Math.abs(diff) < 0.0000001) {
        continue
      }

      details.push({
        ingredient_id: ingredientId,
        warehouse_id: warehouseId,
        current_qty: currentQty,
        expected_qty: runQty,
        diff,
      })

      if (!dryRun) {
        if (current) {
          await q(
            'UPDATE stock_balance SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND warehouse_id = ?',
            [runQty, ingredientId, warehouseId],
          )
        } else {
          await q(
            'INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, created_at, updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
            [ingredientId, warehouseId, runQty],
          )
        }
        fixed++
      }
    }
  })

  const newWatermark = candidates.length > 0 ? Math.max(...candidates.map((c: any) => Number(c.max_id))) : watermark
  if (!dryRun && candidates.length > 0) {
    await rawGet<any>(
      `INSERT INTO settings (setting_key, setting_group, setting_value, created_at, updated_at)
       VALUES ('reconcile_watermark_last_id', 'reconcile', $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [String(newWatermark)],
    )
  }

  return {
    processed: candidates.length,
    fixed,
    mismatches: details.length,
    details: details.slice(0, 50),
    openPeriods: openIds.length,
    watermark: dryRun ? watermark : newWatermark,
    hasMore: candidates.length >= limit,
  }
}

export async function POST(request: NextRequest) {
  try {
    const canEdit =
      hasPermission(request as any, 'settings', 'edit') ||
      hasPermission(request as any, 'transaksi', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({} as any))
    const dryRun = Boolean(body?.dryRun)
    const limit = Math.min(2000, Math.max(1, Number(body?.limit) || DEFAULT_LIMIT))

    if (!dryRun) {
      const enabled = await getSetting('auto_reconcile_enabled', '1')
      if (enabled !== '1') {
        return NextResponse.json({ success: true, skipped: true, message: 'Auto-reconcile dinonaktifkan di Pengaturan' })
      }
    }

    const result = await runReconcile(dryRun, limit)
    return NextResponse.json({ success: true, dryRun, ...result })
  } catch (error: any) {
    console.error('POST /api/reconcile-stock error:', error)
    return NextResponse.json({ error: 'Gagal reconcile', details: error?.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const canView =
      hasPermission(request as any, 'settings', 'view') ||
      hasPermission(request as any, 'transaksi', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const enabled = await getSetting('auto_reconcile_enabled', '1')
    const interval = await getSetting('auto_reconcile_interval_minutes', '60')
    const method = await getSetting('stock_cost_method', 'periodic')

    const result = await runReconcile(true, 200)

    return NextResponse.json({
      settings: {
        auto_reconcile_enabled: enabled,
        auto_reconcile_interval_minutes: interval,
        hpp_method: method,
      },
      report: result,
    })
  } catch (error: any) {
    console.error('GET /api/reconcile-stock error:', error)
    return NextResponse.json({ error: 'Gagal mengambil laporan', details: error?.message }, { status: 500 })
  }
}