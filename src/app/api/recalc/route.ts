import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun, withTransaction } from '@/db/raw'
import { getDb } from '@/db'

export type HppMethod = 'periodic' | 'moving'

/** Cari metode HPP dari setting `stock_cost_method` (nilai 'moving' = Moving Average, selain itu = Periodic Weighted Average). */
async function resolveHppMethod(): Promise<HppMethod> {
  const row = await rawGet<any>("SELECT setting_value FROM settings WHERE setting_key = 'stock_cost_method'")
  return String(row?.setting_value || 'periodic').toLowerCase() === 'moving' ? 'moving' : 'periodic'
}

export async function recalcHPP(db: any, periodId: number, hppMethod?: HppMethod) {
  const period = await rawGet<any>(
    `SELECT id, name, start_date, end_date, is_active, COALESCE(status_buku,'OPEN') AS status_buku
     FROM master_periode WHERE id = $1`,
    [periodId]
  )
  if (!period) throw new Error('Periode tidak ditemukan')
  if (String(period.status_buku).toUpperCase() === 'CLOSED') {
    throw new Error('Periode sudah ditutup. Buka periode terlebih dahulu jika ingin rekalkulasi ulang.')
  }

  const method: HppMethod = hppMethod || (await resolveHppMethod())

  try {
    try {
      const smCols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_movements'"
      )
      const smNames = new Set(smCols.map(c => c.column_name))
      if (!smNames.has('unit_cost')) await rawRun('ALTER TABLE stock_movements ADD COLUMN unit_cost REAL')
      if (!smNames.has('total_cost')) await rawRun('ALTER TABLE stock_movements ADD COLUMN total_cost REAL')
      if (!smNames.has('balance_qty')) await rawRun('ALTER TABLE stock_movements ADD COLUMN balance_qty REAL')
      if (!smNames.has('balance_cost')) await rawRun('ALTER TABLE stock_movements ADD COLUMN balance_cost REAL')
      if (!smNames.has('balance_avg_cost')) await rawRun('ALTER TABLE stock_movements ADD COLUMN balance_avg_cost REAL')
      if (!smNames.has('warehouse_id')) await rawRun('ALTER TABLE stock_movements ADD COLUMN warehouse_id INTEGER DEFAULT 1')
      if (!smNames.has('transaction_date')) await rawRun('ALTER TABLE stock_movements ADD COLUMN transaction_date TEXT')
    } catch {}
    try {
      const sbCols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_balance'"
      )
      const sbNames = new Set(sbCols.map(c => c.column_name))
      if (!sbNames.has('avg_cost')) await rawRun('ALTER TABLE stock_balance ADD COLUMN avg_cost REAL DEFAULT 0')
      if (!sbNames.has('total_cost')) await rawRun('ALTER TABLE stock_balance ADD COLUMN total_cost REAL DEFAULT 0')
      if (!sbNames.has('warehouse_id')) await rawRun('ALTER TABLE stock_balance ADD COLUMN warehouse_id INTEGER DEFAULT 1')
    } catch {}
    try {
      await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'transaction_items'"
      )
      try { await rawRun('ALTER TABLE transaction_items ADD COLUMN cogs_unit REAL DEFAULT 0') } catch {}
      try { await rawRun('ALTER TABLE transaction_items ADD COLUMN cogs_total REAL DEFAULT 0') } catch {}
    } catch {}
    try {
      await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_usage_items'"
      )
      try { await rawRun('ALTER TABLE stock_usage_items ADD COLUMN cogs_unit REAL DEFAULT 0') } catch {}
      try { await rawRun('ALTER TABLE stock_usage_items ADD COLUMN cogs_total REAL DEFAULT 0') } catch {}
    } catch {}
    try {
      const hppCols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'barang_monthly_hpp'"
      )
      const hppNames = new Set(hppCols.map(c => c.column_name))
      if (!hppNames.has('hpp')) await rawRun('ALTER TABLE barang_monthly_hpp ADD COLUMN hpp DECIMAL(15,2) NOT NULL DEFAULT 0')
      if (!hppNames.has('year')) await rawRun('ALTER TABLE barang_monthly_hpp ADD COLUMN year INTEGER NOT NULL DEFAULT 0')
      if (!hppNames.has('month')) await rawRun('ALTER TABLE barang_monthly_hpp ADD COLUMN month INTEGER NOT NULL DEFAULT 0')
      if (!hppNames.has('avg_cost')) await rawRun('ALTER TABLE barang_monthly_hpp ADD COLUMN avg_cost DECIMAL(15,2) NOT NULL DEFAULT 0')
      if (!hppNames.has('calculated_at')) await rawRun('ALTER TABLE barang_monthly_hpp ADD COLUMN calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
      try { await rawRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_barang_monthly_hpp_uniq ON barang_monthly_hpp(barang_id, year, month)') } catch {}
    } catch {}
    try {
      const sbMonCols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_balance_monthly'"
      )
      if (!sbMonCols.length) {
        await rawRun(`
          CREATE TABLE IF NOT EXISTS stock_balance_monthly (
            id SERIAL PRIMARY KEY,
            barang_id INTEGER NOT NULL,
            warehouse_id INTEGER DEFAULT 1,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            quantity REAL DEFAULT 0,
            avg_cost REAL DEFAULT 0,
            total_cost REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(barang_id, warehouse_id, year, month)
          )
        `)
      }
    } catch {}

    const toDateStr = (d: any): string => {
      if (d instanceof Date) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
      }
      return String(d).slice(0, 10)
    }
    const start = toDateStr(period.start_date)
    const end = toDateStr(period.end_date)
    const periodYear = Number(start.slice(0, 4))
    const periodMonth = Number(start.slice(5, 7))

    const pairs = await rawAll<any>(
      `SELECT DISTINCT ingredient_id, warehouse_id
       FROM stock_movements
       WHERE DATE(COALESCE(transaction_date::text, created_at::text)) BETWEEN DATE($1) AND DATE($2)`,
      [start, end]
    )

    await withTransaction(async (query) => {
      const all = async (sql: string, params?: any[]) => query(sql, params)
      const one = async (sql: string, params?: any[]) => (await query(sql, params))[0] ?? null

      for (const p of pairs) {
        const barangId = Number(p.ingredient_id)
        const warehouseId = Number(p.warehouse_id) || 1
        const jenisRow = await one('SELECT jenis FROM master_barang WHERE id = $1', [barangId])
        const jenis = jenisRow ? Number(jenisRow.jenis) : 0
        const eligible = jenis === 1 || jenis === 2 || jenis === 3

        if (!eligible) {
          const movements = await all(
            `SELECT * FROM stock_movements
             WHERE ingredient_id = $1 AND warehouse_id = $2
               AND DATE(COALESCE(transaction_date::text, created_at::text)) BETWEEN DATE($3) AND DATE($4)
             ORDER BY COALESCE(transaction_date::text, created_at::text) ASC, id ASC`,
            [barangId, warehouseId, start, end]
          )

          let runQty = 0
          const opening = await one(
            `SELECT balance_qty FROM stock_movements
             WHERE ingredient_id = $1 AND warehouse_id = $2
               AND DATE(COALESCE(transaction_date::text, created_at::text)) < DATE($3)
             ORDER BY COALESCE(transaction_date::text, created_at::text) DESC, id DESC LIMIT 1`,
            [barangId, warehouseId, start]
          )
          if (opening) runQty = Number(opening.balance_qty) || 0

          for (const m of movements) {
            const rawQty = Number(m.quantity) || 0
            if (rawQty > 0) runQty += rawQty
            else runQty -= Math.abs(rawQty)
            await query(
              `UPDATE stock_movements
                SET unit_cost = $1, total_cost = $2,
                    balance_qty = $3, balance_cost = $4,
                    balance_avg_cost = $5
              WHERE id = $6`,
              [null, null, runQty, null, null, m.id]
            )
          }

          const bal = await one('SELECT id FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2 FOR UPDATE', [barangId, warehouseId])
          if (bal) {
            await query('UPDATE stock_balance SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [runQty, bal.id])
          } else {
            await query('INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, created_at, updated_at) VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)', [barangId, warehouseId, runQty])
          }

          await query(
            `INSERT INTO stock_balance_monthly (barang_id, warehouse_id, year, month, quantity, avg_cost, total_cost)
             VALUES ($1,$2,$3,$4,$5,0,0)
             ON CONFLICT (barang_id, warehouse_id, year, month) DO UPDATE SET quantity = $5, avg_cost = 0, total_cost = 0`,
            [barangId, warehouseId, periodYear, periodMonth, runQty]
          )
          continue
        }

        const opening = await one(
          `SELECT balance_qty, balance_cost, balance_avg_cost
           FROM stock_movements
           WHERE ingredient_id = $1 AND warehouse_id = $2
             AND DATE(COALESCE(transaction_date::text, created_at::text)) < DATE($3)
           ORDER BY COALESCE(transaction_date::text, created_at::text) DESC, id DESC
           LIMIT 1`,
          [barangId, warehouseId, start]
        )

        let openingQty = opening ? Number(opening.balance_qty) || 0 : 0
        let openingCost = opening ? Number(opening.balance_cost) || 0 : 0

        const movements = await all(
          `SELECT * FROM stock_movements
           WHERE ingredient_id = $1 AND warehouse_id = $2
             AND DATE(COALESCE(transaction_date::text, created_at::text)) BETWEEN DATE($3) AND DATE($4)
           ORDER BY COALESCE(transaction_date::text, created_at::text) ASC, id ASC`,
          [barangId, warehouseId, start, end]
        )

        let totalInQty = 0
        let totalInCost = 0
        let totalOutQty = 0

        const outMovements: any[] = []

        for (const m of movements) {
          const rawQty = Number(m.quantity) || 0
          const type = String(m.movement_type || '').toLowerCase()
          const isAdj = type === 'adjustment' || type === 'manufaktur_adjustment'
          let isIn: boolean
          if (type === 'in' || type === 'manufaktur_in' || (isAdj && rawQty > 0) || (type === 'out' && rawQty < 0)) {
            isIn = true
          } else if (type === 'out' || type === 'manufaktur_out' || (isAdj && rawQty < 0) || (type === 'in' && rawQty < 0)) {
            isIn = false
          } else {
            continue
          }
          const qty = Math.abs(rawQty)
          if (isIn) {
            let cost = Number(m.total_cost)
            if (!isFinite(cost) || cost === 0) {
              const unitCost = Number(m.unit_cost)
              cost = isFinite(unitCost) && unitCost > 0 ? unitCost * qty : 0
            }
            totalInQty += qty
            totalInCost += cost
          } else {
            totalOutQty += qty
            outMovements.push(m)
          }
        }

        const totalQtyAvail = openingQty + totalInQty
        const totalCostAvail = openingCost + totalInCost
        const weightedAvg = totalQtyAvail > 0 ? (totalCostAvail / totalQtyAvail) : 0

        let runQty = openingQty
        let runCost = openingCost

        for (const m of movements) {
          const rawQty = Number(m.quantity) || 0
          const type = String(m.movement_type || '').toLowerCase()
          const isAdj = type === 'adjustment' || type === 'manufaktur_adjustment'
          // Untuk Moving Average, biaya keluar = rata-rata berjalan saat itu.
          const avgNow = method === 'moving' ? (runQty > 0 ? runCost / runQty : 0) : weightedAvg
          let isIn: boolean
          if (type === 'in' || type === 'manufaktur_in' || (isAdj && rawQty > 0) || (type === 'out' && rawQty < 0)) {
            isIn = true
          } else if (type === 'out' || type === 'manufaktur_out' || (isAdj && rawQty < 0) || (type === 'in' && rawQty < 0)) {
            isIn = false
          } else {
            await query(
              `UPDATE stock_movements
                SET unit_cost = $1, total_cost = $2,
                    balance_qty = $3, balance_cost = $4,
                    balance_avg_cost = $5
              WHERE id = $6`,
              [m.unit_cost ?? null, m.total_cost ?? null, runQty, eligible ? runCost : null, eligible ? avgNow : null, m.id]
            )
            continue
          }

          const qty = Math.abs(rawQty)
          if (isIn) {
            let unitCost = Number(m.unit_cost)
            let totalCost = Number(m.total_cost)
            if (!isFinite(totalCost) || totalCost === 0) {
              if (isFinite(unitCost) && unitCost > 0) totalCost = unitCost * qty
              else totalCost = 0
            }
            if (!isFinite(unitCost) || unitCost === 0) {
              unitCost = qty > 0 ? (totalCost / qty) : 0
            }
            runQty += qty
            runCost += totalCost
            await query(
              `UPDATE stock_movements
                SET unit_cost = $1, total_cost = $2,
                    balance_qty = $3, balance_cost = $4,
                    balance_avg_cost = $5
              WHERE id = $6`,
              [unitCost, totalCost, runQty, runCost, avgNow, m.id]
            )
          } else {
            const unitCost = avgNow
            const totalCostVal = unitCost * qty
            runQty -= qty
            runCost -= totalCostVal
            if (runQty < 0.0000001 && runQty > -0.0000001) runQty = 0
            if (runCost < 0.0000001 && runCost > -0.0000001) runCost = 0
            await query(
              `UPDATE stock_movements
                SET unit_cost = $1, total_cost = $2,
                    balance_qty = $3, balance_cost = $4,
                    balance_avg_cost = $5
              WHERE id = $6`,
              [unitCost, totalCostVal, runQty, runCost, avgNow, m.id]
            )

            const refType = String(m.reference_type || '').toLowerCase()
            const refId = Number(m.reference_id) || 0
            if (refType === 'sale' && refId > 0) {
              await query('UPDATE transaction_items SET cogs_unit = $1, cogs_total = $2 WHERE transaction_id = $3 AND barang_id = $4', [unitCost, totalCostVal, refId, barangId])
            } else if (refType === 'usage' && refId > 0) {
              await query('UPDATE stock_usage_items SET cogs_unit = $1, cogs_total = $2 WHERE usage_id = $3 AND barang_id = $4', [unitCost, totalCostVal, refId, barangId])
            }
          }
        }

        const bal = await one('SELECT id FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2 FOR UPDATE', [barangId, warehouseId])
        if (bal) {
          await query(
            'UPDATE stock_balance SET quantity = $1, total_cost = $2, avg_cost = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
            [runQty, runCost, runQty > 0 ? (runCost / runQty) : 0, bal.id]
          )
        } else {
          await query(
            `INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, total_cost, avg_cost, created_at, updated_at)
             VALUES ($1,$2,$3,$4,CASE WHEN $3 > 0 THEN ($4 / $3) ELSE 0 END,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
            [barangId, warehouseId, runQty, runCost]
          )
        }

        const endAvg = runQty > 0 ? (runCost / runQty) : 0
        await query(
          `INSERT INTO stock_balance_monthly (barang_id, warehouse_id, year, month, quantity, avg_cost, total_cost)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (barang_id, warehouse_id, year, month) DO UPDATE SET quantity = $5, avg_cost = $6, total_cost = $7`,
          [barangId, warehouseId, periodYear, periodMonth, runQty, endAvg, runCost]
        )

        const hppValue = method === 'moving' ? endAvg : weightedAvg
        if (hppValue > 0) {
          await query(
            `INSERT INTO barang_monthly_hpp (barang_id, tahun, bulan, year, month, hpp, avg_cost, calculated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)
             ON CONFLICT (barang_id, year, month) DO UPDATE SET
               tahun = $2, bulan = $3, hpp = $6, avg_cost = $7, calculated_at = CURRENT_TIMESTAMP`,
            [barangId, periodYear, periodMonth, periodYear, periodMonth, hppValue, hppValue]
          )
        }
      }
    })

    return { success: true, message: `Rekalkulasi periode ${period.name} selesai (${method === 'moving' ? 'Moving Average' : 'Periodic Weighted Average'}). ${pairs.length} barang diproses.` }
  } catch (error: any) {
    throw new Error(error?.message || 'Gagal rekalkulasi')
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const periodId = Number(body?.periodId)
    if (!periodId) return NextResponse.json({ error: 'periodId is required' }, { status: 400 })
    const db = getDb()
    const result = await recalcHPP(db, periodId)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal rekalkulasi', details: error?.message }, { status: 500 })
  }
}
