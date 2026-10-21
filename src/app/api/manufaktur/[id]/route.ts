import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getPeriodByDate } from '@/lib/period'
import { generateEntriesForSingleSource, saveJournalEntriesForSource, deleteJournalEntriesForSource } from '@/lib/journalHelpers'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(_req as any, 'manufaktur', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const header = await rawGet(`
      SELECT m.*, b.code as barang_code_join, b.name as barang_name_join, b.jenis as barang_jenis,
             g.name as warehouse_name
      FROM manufaktur m
      LEFT JOIN master_barang b ON b.id = m.barang_id
      LEFT JOIN master_gudang g ON g.id = m.warehouse_id
      WHERE m.id = ?
    `, [id]) as any

    if (!header) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    header.barang_code = header.barang_code_join || header.barang_code
    header.barang_name = header.barang_name_join || header.barang_name

    const details = await rawAll(`
      SELECT md.*, mb.code as barang_code_join, mb.name as barang_name_join
      FROM manufaktur_detail md
      LEFT JOIN master_barang mb ON mb.id = md.barang_id
      WHERE md.manufaktur_id = ?
      ORDER BY md.id ASC
    `, [id]) as any[]

    const enrichedDetails = details.map((d: any) => ({
      ...d,
      barang_code: d.barang_code_join || d.barang_code,
      barang_name: d.barang_name_join || d.barang_name,
    }))

    const biaya = await rawAll(`SELECT * FROM manufaktur_biaya WHERE manufaktur_id = ? ORDER BY id ASC`, [id])

    return NextResponse.json({ ...header, details: enrichedDetails, biaya })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'manufaktur', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = getDb(); const pool = (db as any).$client
    addAuditColumns(db)
    const userId = getUserId(request)

    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const existing = await rawGet(`SELECT * FROM manufaktur WHERE id = ?`, [id]) as any
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (String(existing.status) !== 'draft') {
      return NextResponse.json({ error: 'Hanya dokumen draft yang bisa diedit' }, { status: 400 })
    }

    const body = await request.json()

    const barangId = Number(body.barang_id) || existing.barang_id
    const barang = await rawGet(`SELECT id, code, name, jenis, hpp FROM master_barang WHERE id = ?`, [barangId]) as any
    if (!barang) return NextResponse.json({ error: 'Barang tidak ditemukan' }, { status: 400 })
    if (Number(barang.jenis) !== 1 && Number(barang.jenis) !== 3) {
      return NextResponse.json({ error: 'Barang harus berjenis Barang Jadi (1) atau Barang Setengah Jadi (3)' }, { status: 400 })
    }

    const quantity = Number(body.quantity) || existing.quantity
    if (quantity <= 0) return NextResponse.json({ error: 'quantity harus > 0' }, { status: 400 })

    const details = Array.isArray(body.details) ? body.details : []
    if (details.length === 0) return NextResponse.json({ error: 'Minimal 1 detail item' }, { status: 400 })

    for (const d of details) {
      const dBarang = await rawGet(`SELECT id, code, name, jenis FROM master_barang WHERE id = ?`, [Number(d.barang_id)]) as any
      if (!dBarang) return NextResponse.json({ error: `Detail barang ID ${d.barang_id} tidak ditemukan` }, { status: 400 })
      if (Number(dBarang.jenis) !== 2 && Number(dBarang.jenis) !== 3) {
        return NextResponse.json({ error: `Barang ${dBarang.name} harus berjenis Bahan Baku (2) atau Barang Setengah Jadi (3)` }, { status: 400 })
      }
      if (Number(d.quantity) <= 0) {
        return NextResponse.json({ error: `Quantity detail barang ${dBarang.name} harus > 0` }, { status: 400 })
      }
    }

    const biayaList = Array.isArray(body.biaya) ? body.biaya : []

    let totalBiayaBahan = 0
    for (const d of details) {
      const hppSatuan = Number(d.hpp_satuan) || 0
      const qty = Number(d.quantity) || 0
      totalBiayaBahan += hppSatuan * qty
    }

    let totalBiayaLain = 0
    for (const b of biayaList) {
      totalBiayaLain += (Number(b.debit) || 0) - (Number(b.credit) || 0)
    }

    const totalBiaya = totalBiayaBahan + totalBiayaLain
    const warehouseId = Number(body.warehouse_id) || existing.warehouse_id
    const notes = body.notes !== undefined ? body.notes : existing.notes
    const tanggal = body.tanggal ? String(body.tanggal).slice(0, 10) : existing.tanggal

    await pool.query('BEGIN')
    try {
      await rawRun(`
        UPDATE manufaktur SET
          tanggal = ?, barang_id = ?, barang_code = ?, barang_name = ?,
          quantity = ?, notes = ?, warehouse_id = ?,
          hpp_sebelum = ?, total_biaya_bahan = ?, total_biaya_lain = ?, total_biaya = ?,
          user_edit = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        tanggal, barang.id, barang.code, barang.name,
        quantity, notes, warehouseId,
        Number(barang.hpp) || 0, totalBiayaBahan, totalBiayaLain, totalBiaya,
        userId || null, id,
      ])

      await rawRun(`DELETE FROM manufaktur_detail WHERE manufaktur_id = ?`, [id])
      await rawRun(`DELETE FROM manufaktur_biaya WHERE manufaktur_id = ?`, [id])

      for (const d of details) {
        const dBarang = await rawGet(`SELECT id, code, name FROM master_barang WHERE id = ?`, [Number(d.barang_id)]) as any
        const hppSatuan = Number(d.hpp_satuan) || 0
        const qty = Number(d.quantity) || 0
        await rawRun(`
          INSERT INTO manufaktur_detail (manufaktur_id, barang_id, barang_code, barang_name, quantity, hpp_satuan, total_hpp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [id, dBarang.id, dBarang.code, dBarang.name, qty, hppSatuan, hppSatuan * qty])
      }

      if (biayaList.length > 0) {
        for (const b of biayaList) {
          const acctId = b.account_id ? Number(b.account_id) : null
          let acctCode = b.account_code || null
          let acctName = b.account_name || null
          if (acctId && (!acctCode || !acctName)) {
            const found = await rawGet(`SELECT code, name FROM accounts WHERE id = ?`, [acctId]) as any
            if (found) {
              acctCode = found.code
              acctName = found.name
            }
          }
          const rawDebit = Number(b.debit) || 0
          const rawCredit = Number(b.credit) || 0
          const amt = rawDebit - rawCredit
          await rawRun(`
            INSERT INTO manufaktur_biaya (manufaktur_id, account_id, account_code, account_name, notes, debit, credit)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            id, acctId, acctCode, acctName, b.notes || null,
            amt > 0 ? amt : 0, amt < 0 ? Math.abs(amt) : 0,
          ])
        }
      }
      await pool.query('COMMIT')
    } catch(e) {
      await pool.query('ROLLBACK')
      throw e
    }

    const updated = await rawGet(`
      SELECT m.*, b.code as barang_code_join, b.name as barang_name_join
      FROM manufaktur m
      LEFT JOIN master_barang b ON b.id = m.barang_id
      WHERE m.id = ?
    `, [id]) as any

    const detailsUpdated = await rawAll(`
      SELECT md.*, mb.code as barang_code_join, mb.name as barang_name_join
      FROM manufaktur_detail md
      LEFT JOIN master_barang mb ON mb.id = md.barang_id
      WHERE md.manufaktur_id = ?
      ORDER BY md.id ASC
    `, [id]) as any[]

    const biayaUpdated = await rawAll(`SELECT * FROM manufaktur_biaya WHERE manufaktur_id = ? ORDER BY id ASC`, [id])

    updated.barang_code = updated.barang_code_join || updated.barang_code
    updated.barang_name = updated.barang_name_join || updated.barang_name

    try {
      const mfRow = await rawGet(`SELECT id, nomor, tanggal FROM manufaktur WHERE id = ?`, [id]) as any
      if (mfRow) {
        deleteJournalEntriesForSource('Manufaktur', id)
        const entries = await generateEntriesForSingleSource('Manufaktur', mfRow.nomor || '', mfRow.tanggal || '')
        if (entries.length > 0) {
          await saveJournalEntriesForSource('Manufaktur', id, mfRow.nomor || '', mfRow.tanggal || '', entries)
        }
      }
    } catch (e) {
      console.warn('[Manufaktur Edit] failed to save journal entries:', e)
    }

    return NextResponse.json({ ...updated, details: detailsUpdated, biaya: biayaUpdated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'manufaktur', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = getDb(); const pool = (db as any).$client
    addAuditColumns(db)
    const userId = getUserId(request)

    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const existing = await rawGet(`SELECT * FROM manufaktur WHERE id = ?`, [id]) as any
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (String(existing.status) === 'void') {
      return NextResponse.json({ error: 'Dokumen sudah di-void' }, { status: 400 })
    }

    const wasApproved = String(existing.status) === 'approved'

    await pool.query('BEGIN')
    try {
      if (wasApproved) {
        const period = await getPeriodByDate(String(existing.tanggal).slice(0, 10))
        if (!period) throw new Error('Periode tidak ditemukan')
        if (Number(period.is_closed) === 1) throw new Error(`Periode '${period.name}' sudah ditutup`)

        const movements = await rawAll(`
          SELECT ingredient_id, warehouse_id, movement_type, quantity, unit, unit_cost, total_cost
          FROM stock_movements WHERE reference_type = 'manufaktur' AND reference_id = ?
        `, [id]) as any[]

        for (const m of movements) {
          const qty = Number(m.quantity) || 0
          const totalCost = Number(m.total_cost) || 0
          const unitCost = Number(m.unit_cost) || 0
          if (qty <= 0) continue

          const reverseType = m.movement_type === 'manufaktur_out' ? 'manufaktur_in' : 'manufaktur_out'
          const deltaQty = m.movement_type === 'manufaktur_out' ? qty : -qty
          const deltaCost = m.movement_type === 'manufaktur_out' ? totalCost : -totalCost

          const bal = await rawGet(`SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ?`,
            [m.ingredient_id, m.warehouse_id]) as any
          const prevQty = bal ? Number(bal.quantity) || 0 : 0
          const prevTotalCost = bal ? Number(bal.total_cost) || 0 : 0
          const newQty = Math.max(0, prevQty + deltaQty)
          const newTotalCost = Math.max(0, prevTotalCost + deltaCost)
          const newAvgCost = newQty > 0 ? newTotalCost / newQty : 0

          await rawRun(`
            INSERT INTO stock_movements (ingredient_id, warehouse_id, movement_type, quantity, unit,
              reference_type, reference_id, period_id, transaction_date, notes,
              unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost)
            VALUES (?, ?, ?, ?, ?, 'manufaktur', ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            m.ingredient_id, m.warehouse_id, reverseType, qty, m.unit,
            id, period.id, String(existing.tanggal).slice(0, 10), `void_${reverseType}: ${existing.nomor}`,
            unitCost, totalCost, newQty, newTotalCost, newAvgCost,
          ])

          if (bal) {
            await rawRun(`
              UPDATE stock_balance SET
                quantity = COALESCE(quantity,0) + ?,
                total_cost = COALESCE(total_cost,0) + ?,
                avg_cost = CASE WHEN (COALESCE(quantity,0) + ?) > 0 THEN (COALESCE(total_cost,0) + ?) / (COALESCE(quantity,0) + ?) ELSE 0 END,
                updated_at = CURRENT_TIMESTAMP
              WHERE ingredient_id = ? AND warehouse_id = ?
            `, [deltaQty, deltaCost, deltaQty, deltaCost, deltaQty, m.ingredient_id, m.warehouse_id])
          }
        }

        const hasilBalAfter = await rawGet(`SELECT avg_cost FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ?`,
          [existing.barang_id, existing.warehouse_id]) as any
        await rawRun(`UPDATE master_barang SET hpp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [hasilBalAfter ? Number(hasilBalAfter.avg_cost) || 0 : 0, existing.barang_id])
      }

      await rawRun(`UPDATE manufaktur SET status = 'void', user_edit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [userId || null, id])
      await pool.query('COMMIT')
    } catch(e) {
      await pool.query('ROLLBACK')
      throw e
    }

    try {
      deleteJournalEntriesForSource('Manufaktur', id)
    } catch (e) {
      console.warn('[Manufaktur Void] failed to delete journal entries:', e)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
