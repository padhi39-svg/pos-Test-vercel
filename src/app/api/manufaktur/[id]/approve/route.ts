import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getStockAllowNegative } from '@/lib/stockValidation'
import { getPeriodByDate } from '@/lib/period'
import { generateEntriesForSingleSource, saveJournalEntriesForSource, deleteJournalEntriesForSource } from '@/lib/journalHelpers'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'manufaktur', 'approve')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = getDb(); const pool = (db as any).$client
    addAuditColumns(db)
    const userId = getUserId(request)
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const mf = await rawGet(`
      SELECT m.*, b.jenis as barang_jenis, b.hpp as current_hpp
      FROM manufaktur m
      LEFT JOIN master_barang b ON b.id = m.barang_id
      WHERE m.id = ?
    `, [id]) as any

    if (!mf) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (String(mf.status) !== 'draft') {
      return NextResponse.json({ error: 'Hanya dokumen draft yang bisa di-approve' }, { status: 400 })
    }

    const tanggal = String(mf.tanggal).slice(0, 10)
    if (tanggal < new Date().toISOString().slice(0, 10) && !hasPermission(request as any, 'manufaktur', 'backdate')) {
      return NextResponse.json({ error: 'Tidak diizinkan approve dengan tanggal mundur' }, { status: 403 })
    }
    const period = await getPeriodByDate(tanggal)
    if (!period) {
      return NextResponse.json({ error: `Periode belum ada untuk tanggal ${tanggal}` }, { status: 400 })
    }
    if (Number(period.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${period.name}' sudah ditutup` }, { status: 400 })
    }

    const details = await rawAll(`SELECT * FROM manufaktur_detail WHERE manufaktur_id = ?`, [id]) as any[]
    if (details.length === 0) {
      return NextResponse.json({ error: 'Detail items tidak ditemukan' }, { status: 400 })
    }

    const warehouseId = Number(mf.warehouse_id) || 1
    const allowNegative = await getStockAllowNegative(db as any)

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS stock_movements (
          id SERIAL PRIMARY KEY,
          ingredient_id INTEGER,
          warehouse_id INTEGER DEFAULT 1,
          movement_type TEXT,
          quantity REAL DEFAULT 0,
          unit TEXT,
          reference_type TEXT,
          reference_id INTEGER,
          period_id INTEGER,
          transaction_date TEXT,
          notes TEXT,
          unit_cost REAL,
          total_cost REAL,
          balance_qty REAL,
          balance_cost REAL,
          balance_avg_cost REAL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS stock_balance (
          id SERIAL PRIMARY KEY,
          ingredient_id INTEGER,
          warehouse_id INTEGER DEFAULT 1,
          quantity REAL DEFAULT 0,
          avg_cost REAL DEFAULT 0,
          total_cost REAL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `)
    } catch {}

    await pool.query('BEGIN')
    try {
      if (!allowNegative) {
        for (const d of details) {
          const qty = Number(d.quantity) || 0
          const bal = await rawGet(`SELECT quantity FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ?`, [d.barang_id, warehouseId]) as any
          const available = bal ? Number(bal.quantity) || 0 : 0
          if (available < qty) {
            throw new Error(`Stok tidak mencukupi untuk barang ${d.barang_code || d.barang_name || d.barang_id}: tersedia ${available}, dibutuhkan ${qty}`)
          }
        }
      }

      let wavgBahanTotal = 0

      for (const d of details) {
        const qty = Number(d.quantity) || 0
        if (qty <= 0) continue

        const currentBal = await rawGet(`SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ?`, [d.barang_id, warehouseId]) as any
        const prevQty = currentBal ? Number(currentBal.quantity) || 0 : 0
        const prevTotalCost = currentBal ? Number(currentBal.total_cost) || 0 : 0

        const avgCost = currentBal ? Number(currentBal.avg_cost) || 0 : 0
        const unitCost = avgCost
        const totalCost = avgCost * qty

        wavgBahanTotal += totalCost

        const deltaQty = -qty
        const deltaCost = -totalCost

        const newQty = Math.max(0, prevQty + deltaQty)
        const newTotalCost = Math.max(0, prevTotalCost + deltaCost)
        const newAvgCost = newQty > 0 ? newTotalCost / newQty : 0

        await rawRun(`
          INSERT INTO stock_movements (ingredient_id, warehouse_id, movement_type, quantity, unit,
            reference_type, reference_id, period_id, transaction_date, notes,
            unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost)
          VALUES (?, ?, 'manufaktur_out', ?, ?, 'manufaktur', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          d.barang_id, warehouseId, qty, null,
          id, period.id, tanggal, `manufaktur_out: ${mf.nomor}`,
          unitCost, totalCost, newQty, newTotalCost, newAvgCost,
        ])

        if (currentBal) {
          await rawRun(`
            UPDATE stock_balance SET
              quantity = quantity + ?,
              total_cost = COALESCE(total_cost,0) + ?,
              avg_cost = CASE WHEN (quantity + ?) > 0 THEN (COALESCE(total_cost,0) + ?) / (quantity + ?) ELSE 0 END,
              updated_at = CURRENT_TIMESTAMP
            WHERE ingredient_id = ? AND warehouse_id = ?
          `, [deltaQty, deltaCost, deltaQty, deltaCost, deltaQty, d.barang_id, warehouseId])
        } else {
          await rawRun(`
            INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, total_cost, avg_cost)
            VALUES (?, ?, 0, 0, 0)
          `, [d.barang_id, warehouseId])
        }

        await rawRun(`UPDATE manufaktur_detail SET hpp_satuan = ?, total_hpp = ? WHERE id = ?`, [unitCost, totalCost, d.id])
      }

      const barangId = Number(mf.barang_id)
      const hasilQty = Number(mf.quantity) || 0
      const totalBiayaLain = Number(mf.total_biaya_lain) || 0
      const actualTotalBiaya = wavgBahanTotal + totalBiayaLain
      const hppSatuanHasil = actualTotalBiaya > 0 && hasilQty > 0 ? actualTotalBiaya / hasilQty : 0

      const hasilBal = await rawGet(`SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ?`, [barangId, warehouseId]) as any
      const prevHasilQty = hasilBal ? Number(hasilBal.quantity) || 0 : 0
      const prevHasilTotalCost = hasilBal ? Number(hasilBal.total_cost) || 0 : 0

      const newHasilQty = prevHasilQty + hasilQty
      const newHasilTotalCost = prevHasilTotalCost + actualTotalBiaya
      const newHasilAvgCost = newHasilQty > 0 ? newHasilTotalCost / newHasilQty : 0

      await rawRun(`
        INSERT INTO stock_movements (ingredient_id, warehouse_id, movement_type, quantity, unit,
          reference_type, reference_id, period_id, transaction_date, notes,
          unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost)
        VALUES (?, ?, 'manufaktur_in', ?, ?, 'manufaktur', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        barangId, warehouseId, hasilQty, null,
        id, period.id, tanggal, `manufaktur_in: ${mf.nomor}`,
        hppSatuanHasil, actualTotalBiaya, newHasilQty, newHasilTotalCost, newHasilAvgCost,
      ])

      if (hasilBal) {
        await rawRun(`
          UPDATE stock_balance SET
            quantity = quantity + ?,
            total_cost = COALESCE(total_cost,0) + ?,
            avg_cost = CASE WHEN (quantity + ?) > 0 THEN (COALESCE(total_cost,0) + ?) / (quantity + ?) ELSE 0 END,
            updated_at = CURRENT_TIMESTAMP
          WHERE ingredient_id = ? AND warehouse_id = ?
        `, [hasilQty, actualTotalBiaya, hasilQty, actualTotalBiaya, hasilQty, barangId, warehouseId])
      } else {
        await rawRun(`
          INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, total_cost, avg_cost)
          VALUES (?, ?, ?, ?, ?)
        `, [barangId, warehouseId, hasilQty, actualTotalBiaya, hppSatuanHasil])
      }

      await rawRun(`UPDATE master_barang SET hpp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newHasilAvgCost, barangId])

      await rawRun(`
        UPDATE manufaktur SET
          status = 'approved',
          total_biaya_bahan = ?,
          total_biaya = ?,
          hpp_sesudah = ?,
          user_approve = ?,
          approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [wavgBahanTotal, actualTotalBiaya, newHasilAvgCost, userId || null, id])

      await pool.query('COMMIT')
    } catch(e) {
      await pool.query('ROLLBACK')
      throw e
    }

    try {
      const mfRow = await rawGet(`SELECT id, nomor, tanggal FROM manufaktur WHERE id = ?`, [id]) as any
      if (mfRow) {
        deleteJournalEntriesForSource('Manufaktur', id)
        const entries = generateEntriesForSingleSource('Manufaktur', mfRow.nomor || '', mfRow.tanggal || '')
        if (entries.length > 0) {
          saveJournalEntriesForSource('Manufaktur', id, mfRow.nomor || '', mfRow.tanggal || '', entries)
        }
      }
    } catch (e) {
      console.warn('[Manufaktur Approve] failed to save journal entries:', e)
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
