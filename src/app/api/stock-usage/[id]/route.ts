import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun, withTransaction } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getStockAllowNegative } from '@/lib/stockValidation'
import { getPeriodByDate } from '@/lib/period'
import { generateEntriesForSingleSource, saveJournalEntriesForSource, deleteJournalEntriesForSource } from '@/lib/journalHelpers'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(_req as any, 'stock_usage', 'view') && !hasPermission(_req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat pemakaian stok' }, { status: 403 })
    }
    const id = Number(params.id)
    const pool = (getDb() as any).$client
    addAuditColumns(pool)
    const tables = await rawAll<{name:string}>("SELECT table_name as name FROM information_schema.tables WHERE table_schema='public'")
    const tableNames = tables.map(t => t.name)
    const whTable = (['gudang','warehouses','warehouse','master_gudang','gudangs'].find(n => tableNames.includes(n)) )
    let header: any
    if (whTable) {
      const cols = await rawAll<any>(`SELECT column_name as name FROM information_schema.columns WHERE table_name=$1`, [whTable])
      const has = (n:string)=> cols.some((c: any) => String(c.name).toLowerCase()===n)
      const nameCol = has('name') ? 'name' : (has('nama') ? 'nama' : 'name')
      header = await rawGet<any>(`SELECT su.id, su.number, su.tdate as tdate, su.warehouse_id, su.notes, su.status, su.void, su.user_create, su.user_edit, su.created_at, su.updated_at, su.period_id, w.${nameCol} as warehouse FROM stock_usage su LEFT JOIN ${whTable} w ON w.id=su.warehouse_id WHERE su.id=$1`, [id])
    } else {
      header = await rawGet<any>('SELECT su.id, su.number, su.tdate as tdate, su.warehouse_id, su.notes, su.status, su.void, su.user_create, su.user_edit, su.created_at, su.updated_at, su.period_id FROM stock_usage su WHERE su.id=$1', [id])
    }
    if (!header) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })

    const buCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='barang_units'")
    const buHas = (n:string)=> buCols.some((c: any) => String(c.name).toLowerCase()===n)
    const buNameCol = buHas('unit_name') ? 'unit_name' : (buHas('name') ? 'name' : 'unit_name')
    const buRatioCol = buHas('unit_ratio') ? 'unit_ratio' : (buHas('ratio') ? 'ratio' : 'unit_ratio')

    const items = await rawAll<any>(`
      SELECT si.id, si.barang_id, si.qty, si.unit_id, si.unit_ratio, si.qty_total,
             mb.code as barang_code, mb.name as barang_name,
             COALESCE(bu.${buNameCol}, (
               SELECT bu2.${buNameCol}
               FROM barang_units bu2
               WHERE bu2.barang_id = si.barang_id
               ORDER BY CASE WHEN COALESCE(bu2.${buRatioCol},1)=1 THEN 0 ELSE 1 END, bu2.id
               LIMIT 1
             )) as unit_name
      FROM stock_usage_items si
      LEFT JOIN master_barang mb ON mb.id = si.barang_id
      LEFT JOIN barang_units bu ON bu.id = si.unit_id AND bu.barang_id = si.barang_id
      WHERE si.usage_id = $1
      ORDER BY si.id
    `, [id])

    return NextResponse.json({ header, items })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Failed to get usage' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'stock_usage', 'edit') && !hasPermission(req as any, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah pemakaian stok' }, { status: 403 })
    }
    const id = Number(params.id)
    const body = await req.json()
    const { tdate, warehouse_id, notes, items, status } = body || {}

    const pool = (getDb() as any).$client
    const userId = getUserId(req)

    const header = await rawGet<any>('SELECT id, number, tdate as tdate, warehouse_id, notes, status, user_create, user_edit, created_at, updated_at, period_id FROM stock_usage WHERE id=$1', [id])
    if (!header) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })
    const currStatus = String(header.status || 'draft')

    if (typeof status === 'string') {
      const target = status.toLowerCase()
      if (!['draft','approved'].includes(target)) return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
      if (target === currStatus) return NextResponse.json({ ok: true })

      if (target === 'approved') {
        const suPeriod = await getPeriodByDate(String(header.tdate || '').slice(0,10))
        if (!suPeriod) {
          return NextResponse.json({ error: `Periode belum ada untuk tanggal ${String(header.tdate).slice(0,10)}.` }, { status: 400 })
        }
        if (Number(suPeriod.is_closed) === 1) {
          return NextResponse.json({ error: `Periode '${suPeriod.name}' sudah ditutup.` }, { status: 400 })
        }
      }

      const allowNegativeStock = await getStockAllowNegative(pool)
      const result = await withTransaction(async (q) => {
        const buCols = await q<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='barang_units'")
        const buHas = (n:string)=> buCols.some((c: any) => String(c.name).toLowerCase()===n)
        const ratioCol = buHas('unit_ratio') ? 'unit_ratio' : (buHas('ratio') ? 'ratio' : 'unit_ratio')

        const itemsRows = await q<any>('SELECT barang_id, qty, unit_id, unit_ratio, qty_total FROM stock_usage_items WHERE usage_id=$1', [id])
        if (itemsRows.length === 0) throw new Error('Detail belum diisi')
        const whId = Number(header.warehouse_id)
        const tdateEff = String(header.tdate).slice(0,10)

        if (target === 'approved') {
          if (!allowNegativeStock) {
            for (const it of itemsRows) {
              const barangId = Number(it.barang_id)
              const baseQty = Number(it.qty_total || 0)
              const src = (await q<any>('SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ingredient_id=$1 AND warehouse_id=$2', [barangId, whId]))[0]
              const srcQty = Number(src?.quantity || 0)
              if (srcQty < baseQty) throw new Error(`Stok tidak cukup untuk barang ID ${barangId} di gudang (tersedia: ${srcQty}, perlu: ${baseQty})`)
            }
          }
          for (const it of itemsRows) {
            const barangId = Number(it.barang_id)
            const baseQty = Number(it.qty_total || 0)
            const rawQty = Number(it.qty || 0)

            const jenisRow = (await q<any>('SELECT jenis FROM master_barang WHERE id = $1', [barangId]))[0]
            const isEligible = jenisRow && (Number(jenisRow.jenis) === 1 || Number(jenisRow.jenis) === 2 || Number(jenisRow.jenis) === 3)
            try {
              const ex = (await q<any>('SELECT 1 FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2 LIMIT 1', [barangId, whId]))[0]
              if (!ex) await q('INSERT INTO stock_balance(ingredient_id, warehouse_id, quantity, unit, created_at, updated_at) VALUES($1,$2,0,$3,NOW(),NOW())', [barangId, whId, 'unit'])
            } catch {}
            const bal = (await q<any>('SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ingredient_id=$1 AND warehouse_id=$2', [barangId, whId]))[0]
            const prevQty = bal ? Number(bal.quantity)||0 : 0
            const prevAvg = bal ? Number(bal.avg_cost)||0 : 0
            const prevTotalCost = bal ? Number(bal.total_cost)||0 : 0
            const unitCost = isEligible ? prevAvg : null
            const outTotalCost = isEligible ? (prevAvg * baseQty) : null
            const newQtyStock = prevQty - baseQty
            const newTotalCost = isEligible ? (prevTotalCost - (outTotalCost||0)) : prevTotalCost
            const newAvg = newQtyStock > 0 ? (isEligible ? (newTotalCost / newQtyStock) : prevAvg) : 0

            await q(`INSERT INTO stock_movements(ingredient_id, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, period_id, movement_date, unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [barangId, whId, 'out', baseQty, 'unit', 'usage', id, header.period_id || null, tdateEff, unitCost, outTotalCost, newQtyStock, newTotalCost, newAvg])

            if (isEligible) {
              const cogsTotal = Number(outTotalCost)||0
              const cogsUnit = rawQty > 0 ? (cogsTotal / rawQty) : 0
              await q('UPDATE stock_usage_items SET cogs_unit = $1, cogs_total = $2 WHERE usage_id = $3 AND barang_id = $4', [cogsUnit, cogsTotal, id, barangId])
            }

            if (bal) await q('UPDATE stock_balance SET quantity=$1, total_cost=$2, avg_cost=$3, updated_at=NOW() WHERE ingredient_id=$4 AND warehouse_id=$5', [newQtyStock, newTotalCost, newAvg, barangId, whId])
            else await q('INSERT INTO stock_balance(ingredient_id, warehouse_id, quantity, total_cost, avg_cost, unit, created_at, updated_at) VALUES($1,$2,$3,$4,$5,$6,NOW(),NOW())', [barangId, whId, Math.max(0, newQtyStock), newTotalCost, newAvg, 'unit'])
          }
          await q("UPDATE stock_usage SET status='approved', updated_at=NOW() WHERE id=$1", [id])
        } else {
          const existingMoves = (await q<any>("SELECT COUNT(1)::int as c FROM stock_movements WHERE reference_type='usage' AND reference_id=$1", [id]))[0]
          if (Number(existingMoves?.c || 0) > 0) {
            for (const it of itemsRows) {
              const barangId = Number(it.barang_id)
              const baseQty = Number(it.qty_total || 0)
              const curr = (await q<any>('SELECT quantity FROM stock_balance WHERE ingredient_id=$1 AND warehouse_id=$2', [barangId, whId]))[0]
              const qty = Number(curr?.quantity || 0) + baseQty
              if (curr) {
                await q('UPDATE stock_balance SET quantity=$1, updated_at=NOW() WHERE ingredient_id=$2 AND warehouse_id=$3', [qty, barangId, whId])
              } else {
                await q('INSERT INTO stock_balance(ingredient_id, warehouse_id, quantity, unit, created_at, updated_at) VALUES($1,$2,0,$3,NOW(),NOW())', [barangId, whId, 'unit'])
              }
            }
            await q("DELETE FROM stock_movements WHERE reference_type='usage' AND reference_id=$1", [id])
          }
          await q('UPDATE stock_usage_items SET cogs_unit=0, cogs_total=0 WHERE usage_id=$1', [id])
          await q("UPDATE stock_usage SET status='draft', updated_at=NOW() WHERE id=$1", [id])
        }
        try {
            const suRow = (await q<any>('SELECT id, number, tdate as tdate FROM stock_usage WHERE id = $1', [id]))[0]
          if (suRow) {
            deleteJournalEntriesForSource('Pemakaian Stok', id)
            const entries = await generateEntriesForSingleSource('Pemakaian Stok', suRow.number || '', suRow.tdate || '')
            if (entries.length > 0) {
              await saveJournalEntriesForSource('Pemakaian Stok', id, suRow.number || '', suRow.tdate || '', entries)
            }
          }
        } catch (e) {
          console.warn('[Stock Usage Approve] failed to save journal entries:', e)
        }
        return { ok: true }
      })
      return NextResponse.json(result)
    }

    if (!tdate) return NextResponse.json({ error: 'Tanggal wajib' }, { status: 400 })
    if (!warehouse_id) return NextResponse.json({ error: 'Gudang wajib' }, { status: 400 })
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'Detail belum diisi' }, { status: 400 })

    await pool.query('BEGIN')
    try {
      await rawRun('DELETE FROM stock_usage_items WHERE usage_id=$1', [id])

      const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_usage'")
      const hasUserEdit = cols.some((c: any) => String(c.name).toLowerCase()==='user_edit')
      if (hasUserEdit) {
        await rawRun('UPDATE stock_usage SET tdate=$1, warehouse_id=$2, notes=$3, user_edit=$4 WHERE id=$5', [String(tdate).slice(0,10), Number(warehouse_id), notes || null, userId || null, id])
      } else {
        await rawRun('UPDATE stock_usage SET tdate=$1, warehouse_id=$2, notes=$3 WHERE id=$4', [String(tdate).slice(0,10), Number(warehouse_id), notes || null, id])
      }

      const buCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='barang_units'")
      const buHas = (n:string)=> buCols.some((c: any) => String(c.name).toLowerCase()===n)
      const ratioCol = buHas('unit_ratio') ? 'unit_ratio' : (buHas('ratio') ? 'ratio' : 'unit_ratio')
      const getUnit = (barangId: number, unitId: number) => rawGet<any>(`SELECT id, ${ratioCol} as unit_ratio FROM barang_units WHERE barang_id=$1 AND id=$2`, [barangId, unitId])
      const getDefaultUnit = (barangId: number) => rawGet<any>(`
        SELECT id, ${ratioCol} as unit_ratio FROM barang_units
        WHERE barang_id=$1
        ORDER BY CASE WHEN COALESCE(${ratioCol},1)=1 THEN 0 ELSE 1 END, id LIMIT 1
      `, [barangId])

      for (const it of items) {
        const barangId = Number(it.barang_id)
        let qty = Number(it.qty || 0)
        if (!barangId || qty <= 0) throw new Error('Detail tidak valid')
        let unitId = it.unit_id ? Number(it.unit_id) : null
        let unitRatio = 1
        if (unitId) {
          const u = await getUnit(barangId, unitId)
          if (u) unitRatio = Number(u.unit_ratio || 1) || 1
          else unitId = null
        }
        if (!unitId) {
          const u = await getDefaultUnit(barangId)
          if (!u) throw new Error(`Satuan master tidak ditemukan untuk barang ID ${barangId}`)
          unitId = Number(u.id)
          unitRatio = Number(u.unit_ratio || 1) || 1
        }
        const baseQty = qty * unitRatio
        await rawRun('INSERT INTO stock_usage_items(usage_id, barang_id, qty, unit_id, unit_ratio, qty_total) VALUES($1,$2,$3,$4,$5,$6)', [id, barangId, qty, unitId, unitRatio, baseQty])
      }
      try {
        const suRow = await rawGet<any>('SELECT id, number, tdate FROM stock_usage WHERE id = $1', [id])
        if (suRow) {
          deleteJournalEntriesForSource('Pemakaian Stok', id)
          const entries = await generateEntriesForSingleSource('Pemakaian Stok', suRow.number || '', suRow.tdate || '')
          if (entries.length > 0) {
            await saveJournalEntriesForSource('Pemakaian Stok', id, suRow.number || '', suRow.tdate || '', entries)
          }
        }
      } catch (e) {
        console.warn('[Stock Usage Edit] failed to save journal entries:', e)
      }
      await pool.query('COMMIT')
      return NextResponse.json({ id })
    } catch (e:any) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Failed to update usage' }, { status: 500 })
  }
}
