import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun, withTransaction } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'
import { getStockAllowNegative } from '@/lib/stockValidation'
import { getUserId } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(_req as any, 'stock_transfer', 'view') && !hasPermission(_req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat transfer stok' }, { status: 403 })
    }
    const id = Number(params.id)
    const pool = (getDb() as any).$client
    let header: any
    try {
      header = await rawGet<any>(`
        SELECT st.id, st.number, st.tdate as tdate, st.from_warehouse_id, st.to_warehouse_id, st.notes, st.void, st.user_create, st.user_edit, st.created_at, st.updated_at, st.period_id,
        (SELECT name FROM master_gudang WHERE id = st.from_warehouse_id) as from_warehouse,
        (SELECT name FROM master_gudang WHERE id = st.to_warehouse_id) as to_warehouse
        FROM stock_transfers st
        WHERE st.id = $1
      `, [id])
    } catch {
      header = await rawGet<any>('SELECT st.id, st.number, st.tdate as tdate, st.from_warehouse_id, st.to_warehouse_id, st.notes, st.void, st.user_create, st.user_edit, st.created_at, st.updated_at, st.period_id FROM stock_transfers st WHERE st.id=$1', [id])
    }
    if (!header) return NextResponse.json({ error: 'Transfer tidak ditemukan' }, { status: 404 })

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
      FROM stock_transfer_items si
      LEFT JOIN master_barang mb ON mb.id = si.barang_id
      LEFT JOIN barang_units bu ON bu.id = si.unit_id AND bu.barang_id = si.barang_id
      WHERE si.transfer_id = $1
      ORDER BY si.id
    `, [id])
    return NextResponse.json({ header, items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to get transfer' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!hasPermission(req as any, 'stock_transfer', 'edit') && !hasPermission(req as any, 'transaksi', 'edit')) {
    return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah transfer stok' }, { status: 403 })
  }
  const id = Number(params.id)
  const body = await req.json().catch(()=>({})) as any
  const tdate = String(body.tdate || '').slice(0,10)
  const fromId = Number(body.from_warehouse_id)
  const toId = Number(body.to_warehouse_id)
  const items = Array.isArray(body.items) ? body.items : []
  const notes = String(body.notes || '')

  if (!tdate || !fromId || !toId || fromId === toId || items.length === 0) {
    return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
  }
  for (const it of items) {
    if (!Number(it.barang_id) || Number(it.qty) <= 0) {
      return NextResponse.json({ error: 'Item tidak valid' }, { status: 400 })
    }
  }

  const userId = getUserId(req)

  try {
    const pool = (getDb() as any).$client
    const header = await rawGet<any>('SELECT * FROM stock_transfers WHERE id=$1', [id])
    if (!header) return NextResponse.json({ error: 'Transfer tidak ditemukan' }, { status: 404 })
    const allowNegativeStock = await getStockAllowNegative(pool)

    const oldItems = await rawAll<any>('SELECT * FROM stock_transfer_items WHERE transfer_id=$1', [id])

    await withTransaction(async (q) => {
      for (const it of oldItems) {
        const b = Number(it.barang_id)
        const qty = Number(it.qty)
        const ratio = Number((it as any).unit_ratio || 1) || 1
        const baseQ = qty * ratio

        const srcBal = (await q('SELECT quantity FROM stock_balance WHERE ingredient_id=$1 AND warehouse_id=$2', [b, header.from_warehouse_id]))[0]
        const srcNext = Number(srcBal?.quantity || 0) + baseQ
        if (srcBal) await q('UPDATE stock_balance SET quantity=$1, updated_at=NOW() WHERE ingredient_id=$2 AND warehouse_id=$3', [srcNext, b, header.from_warehouse_id])
        else await q('INSERT INTO stock_balance(ingredient_id, warehouse_id, quantity) VALUES($1,$2,$3)', [b, header.from_warehouse_id, srcNext])

        const dstBal = (await q('SELECT quantity FROM stock_balance WHERE ingredient_id=$1 AND warehouse_id=$2', [b, header.to_warehouse_id]))[0]
        const dstNext = Number(dstBal?.quantity || 0) - baseQ
        if (dstBal) await q('UPDATE stock_balance SET quantity=$1, updated_at=NOW() WHERE ingredient_id=$2 AND warehouse_id=$3', [dstNext, b, header.to_warehouse_id])
        else await q('INSERT INTO stock_balance(ingredient_id, warehouse_id, quantity) VALUES($1,$2,$3)', [b, header.to_warehouse_id, Math.max(0, dstNext)])
      }

      await q('DELETE FROM stock_transfer_items WHERE transfer_id=$1', [id])
      await q("DELETE FROM stock_movements WHERE reference_type='stock_transfer' AND reference_id=$1", [id])

      await q('UPDATE stock_transfers SET tdate=$1, from_warehouse_id=$2, to_warehouse_id=$3, notes=$4, user_edit=$5 WHERE id=$6', [tdate, fromId, toId, notes, userId || null, id])

      const mvCols = await q("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_movements'")
      const mvCi = mvCols || []
      const mvNames = mvCi.map((c: any) => String(c.name || c.column_name).toLowerCase())
      const mvHas = (n: string) => mvNames.includes(n)
      const movementIdCol = mvHas('ingredient_id') ? 'ingredient_id' : 'barang_id'

      const sbCols = await q("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_balance'")
      const sbCi = sbCols || []
      const sbNames = sbCi.map((c: any) => String(c.name || c.column_name).toLowerCase())
      const sbHas = (n: string) => sbNames.includes(n)
      const sbIdCol = sbHas('ingredient_id') ? 'ingredient_id' : 'barang_id'

      const buCols = await q("SELECT column_name as name FROM information_schema.columns WHERE table_name='barang_units'")
      const buCi = buCols || []
      const buNames = buCi.map((c: any) => String(c.name || c.column_name).toLowerCase())
      const buHas = (n: string) => buNames.includes(n)
      const ratioCol = buHas('unit_ratio') ? 'unit_ratio' : (buHas('ratio') ? 'ratio' : 'unit_ratio')

      const getUnit = async (barangId: number, unitId: number) => {
        const res = await q(`SELECT id, ${ratioCol} as unit_ratio FROM barang_units WHERE barang_id=$1 AND id=$2`, [barangId, unitId])
        return (res || [])[0] || null
      }
      const getDefaultUnit = async (barangId: number) => {
        const res = await q(`
          SELECT id, ${ratioCol} as unit_ratio FROM barang_units
          WHERE barang_id=$1
          ORDER BY CASE WHEN COALESCE(${ratioCol},1)=1 THEN 0 ELSE 1 END, id LIMIT 1
        `, [barangId])
        return (res || [])[0] || null
      }

      for (const it of items) {
        const barangId = Number(it.barang_id)
        const qty = Number(it.qty)
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
        const baseQ = qty * unitRatio

        if (!allowNegativeStock) {
          const src = (await q(`SELECT quantity FROM stock_balance WHERE ${sbIdCol}=$1 AND warehouse_id=$2`, [barangId, fromId]))[0]
          const srcQty = Number(src?.quantity || 0)
          if (srcQty < baseQ) throw new Error(`Stok tidak cukup untuk barang ID ${barangId} di gudang asal (tersedia: ${srcQty}, perlu: ${baseQ})`)
        }
        await q('INSERT INTO stock_transfer_items(transfer_id, barang_id, qty, unit_id, unit_ratio, qty_total) VALUES($1,$2,$3,$4,$5,$6)', [id, barangId, qty, unitId, unitRatio, baseQ])

        const jenisRow = (await q('SELECT jenis FROM master_barang WHERE id = $1', [barangId]))[0]
        const isEligible = jenisRow && (Number(jenisRow.jenis) === 1 || Number(jenisRow.jenis) === 2 || Number(jenisRow.jenis) === 3)

        const srcBal = (await q(`SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ${sbIdCol}=$1 AND warehouse_id=$2`, [barangId, fromId]))[0]
        const srcQtyPrev = Number(srcBal?.quantity ?? 0)
        const srcAvgPrev = Number(srcBal?.avg_cost ?? 0)
        const srcTotalPrev = Number(srcBal?.total_cost ?? 0)
        const srcOutUnitCost = isEligible ? srcAvgPrev : null
        const srcOutTotalCost = isEligible ? (srcAvgPrev * baseQ) : null
        const srcQtyNew = srcQtyPrev - baseQ
        const srcTotalNew = isEligible ? (srcTotalPrev - (srcOutTotalCost||0)) : srcTotalPrev
        const srcAvgNew = srcQtyNew > 0 ? (isEligible ? (srcTotalNew / srcQtyNew) : srcAvgPrev) : 0

        await q(`INSERT INTO stock_movements (${movementIdCol}, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, period_id, transaction_date, unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [barangId, fromId, 'out', baseQ, 'unit', 'stock_transfer', id, header.period_id || null, tdate, srcOutUnitCost, srcOutTotalCost, srcQtyNew, isEligible ? srcTotalNew : srcTotalPrev, srcAvgNew])

        if (srcBal) await q(`UPDATE stock_balance SET quantity=$1, avg_cost=$2, total_cost=$3, updated_at=NOW() WHERE ${sbIdCol}=$4 AND warehouse_id=$5`, [srcQtyNew, srcAvgNew, isEligible ? srcTotalNew : srcTotalPrev, barangId, fromId])
        else await q(`INSERT INTO stock_balance(${sbIdCol}, warehouse_id, quantity, avg_cost, total_cost) VALUES($1,$2,$3,$4,$5)`, [barangId, fromId, Math.max(0, srcQtyNew), srcAvgNew, isEligible ? srcTotalNew : srcTotalPrev])

        const dstBal = (await q(`SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ${sbIdCol}=$1 AND warehouse_id=$2`, [barangId, toId]))[0]
        const dstQtyPrev = Number(dstBal?.quantity ?? 0)
        const dstTotalPrev = Number(dstBal?.total_cost ?? 0)
        const inUnitCost = isEligible ? srcAvgPrev : null
        const inTotalCost = isEligible ? (srcAvgPrev * baseQ) : null
        const dstQtyNew = dstQtyPrev + baseQ
        const dstTotalNew = isEligible ? (dstTotalPrev + (inTotalCost||0)) : dstTotalPrev
        const dstAvgNew = dstQtyNew > 0 ? (isEligible ? (dstTotalNew / dstQtyNew) : Number(dstBal?.avg_cost || 0)) : 0

        await q(`INSERT INTO stock_movements (${movementIdCol}, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, period_id, transaction_date, unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [barangId, toId, 'in', baseQ, 'unit', 'stock_transfer', id, header.period_id || null, tdate, inUnitCost, inTotalCost, dstQtyNew, isEligible ? dstTotalNew : dstTotalPrev, dstAvgNew])

        if (dstBal) await q(`UPDATE stock_balance SET quantity=$1, avg_cost=$2, total_cost=$3, updated_at=NOW() WHERE ${sbIdCol}=$4 AND warehouse_id=$5`, [dstQtyNew, dstAvgNew, isEligible ? dstTotalNew : dstTotalPrev, barangId, toId])
        else await q(`INSERT INTO stock_balance(${sbIdCol}, warehouse_id, quantity, avg_cost, total_cost) VALUES($1,$2,$3,$4,$5)`, [barangId, toId, dstQtyNew, dstAvgNew, isEligible ? dstTotalNew : dstTotalPrev])
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('PUT /api/stock-transfers/[id] error:', e)
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan perubahan' }, { status: 500 })
  }
}
