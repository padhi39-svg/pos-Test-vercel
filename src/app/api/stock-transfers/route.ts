import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun, withTransaction } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getStockAllowNegative } from '@/lib/stockValidation'

async function generateNumber() {
  const year = new Date().getFullYear()
  const prefix = `TF/${year}/`
  const last = await rawGet<any>('SELECT number FROM stock_transfers WHERE number LIKE $1 ORDER BY id DESC LIMIT 1', [`${prefix}%`])
  let seq = 1
  if (last?.number) {
    const m = String(last.number).match(/(\d{6})$/)
    if (m) seq = Number(m[1]) + 1
  }
  return prefix + String(seq).padStart(6, '0')
}

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'stock_transfer', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat transfer stok' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').toLowerCase()

    const pool = (getDb() as any).$client
    let rows: any[] = []
    try {
      rows = await rawAll<any>(`
       SELECT st.id, st.number, st.tdate as tdate,
              st.from_warehouse_id, st.to_warehouse_id, st.notes, st.void,
              st.user_create, st.user_edit, st.created_at, st.updated_at, st.period_id,
              (SELECT name FROM master_gudang WHERE id = st.from_warehouse_id) as from_warehouse,
              (SELECT name FROM master_gudang WHERE id = st.to_warehouse_id) as to_warehouse,
              (SELECT COUNT(*)::int FROM stock_transfer_items si WHERE si.transfer_id = st.id) as item_count
       FROM stock_transfers st
       ORDER BY st.id DESC
       LIMIT 200`)
    } catch {
      rows = await rawAll<any>(`
       SELECT st.id, st.number, st.tdate as tdate,
              st.from_warehouse_id, st.to_warehouse_id, st.notes, st.void,
              st.user_create, st.user_edit, st.created_at, st.updated_at, st.period_id,
              COALESCE(fw.name, fw.nama) as from_warehouse,
              COALESCE(tw.name, tw.nama) as to_warehouse,
              (SELECT COUNT(*)::int FROM stock_transfer_items si WHERE si.transfer_id = st.id) as item_count
       FROM stock_transfers st
       LEFT JOIN master_gudang fw ON fw.id = st.from_warehouse_id
       LEFT JOIN master_gudang tw ON tw.id = st.to_warehouse_id
       ORDER BY st.id DESC
       LIMIT 200`)
    }
    const filtered = q
      ? rows.filter(r => `${r.number} ${r.from_warehouse} ${r.to_warehouse}`.toLowerCase().includes(q))
      : rows
    return NextResponse.json({ rows: filtered })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Failed to get transfers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!hasPermission(req as any, 'stock_transfer', 'create') && !hasPermission(req as any, 'transaksi', 'create')) {
    return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat transfer stok' }, { status: 403 })
  }
  const pool = (getDb() as any).$client
  addAuditColumns(pool)
  const body = await req.json().catch(()=>({})) as any
  const tdate = String(body.tdate || '').slice(0,10)
  const fromId = Number(body.from_warehouse_id)
  const toId = Number(body.to_warehouse_id)
  const items = Array.isArray(body.items) ? body.items : []
  const notes = String(body.notes || '')
  const userId = getUserId(req)

  if (!tdate || !fromId || !toId || fromId === toId || items.length === 0) {
    return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
  }

  for (const it of items) {
    if (!Number(it.barang_id) || Number(it.qty) <= 0) {
      return NextResponse.json({ error: 'Item tidak valid' }, { status: 400 })
    }
  }

  const getActivePeriod = async ()=>{
    try { const p = await rawGet<any>('SELECT id FROM master_periode WHERE is_active=1 ORDER BY id DESC LIMIT 1'); return p?.id||null } catch { return null }
  }
  const periodId = await getActivePeriod()
  const allowNegativeStock = await getStockAllowNegative(pool)
  const number = await generateNumber()

  const { id: transferId, number: tfNumber } = await withTransaction(async (q) => {
      const cols = await q("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_transfers'")
      const ci = cols || []
    const colNames = ci.map((c: any) => String(c.name || c.column_name).toLowerCase())
    const has = (n: string) => colNames.includes(n)
    const hasPeriod = has('period_id')
    const hasUserCreate = has('user_create')

    let r: any
    if (hasPeriod && hasUserCreate){
      r = await q('INSERT INTO stock_transfers(number, tdate, from_warehouse_id, to_warehouse_id, notes, user_create, period_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [number, tdate, fromId, toId, notes, userId || null, periodId])
    } else if (hasUserCreate){
      r = await q('INSERT INTO stock_transfers(number, tdate, from_warehouse_id, to_warehouse_id, notes, user_create) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [number, tdate, fromId, toId, notes, userId || null])
    } else if (hasPeriod){
      r = await q('INSERT INTO stock_transfers(number, tdate, from_warehouse_id, to_warehouse_id, notes, period_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [number, tdate, fromId, toId, notes, periodId])
    } else {
      r = await q('INSERT INTO stock_transfers(number, tdate, from_warehouse_id, to_warehouse_id, notes) VALUES($1,$2,$3,$4,$5) RETURNING id', [number, tdate, fromId, toId, notes])
    }
      const transferId = r[0].id

    const mvCols = await q("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_movements'")
    const mvCi = mvCols?.rows || mvCols || []
    const mvNames = mvCi.map((c: any) => String(c.name || c.column_name).toLowerCase())
    const mvHas = (n: string) => mvNames.includes(n)
    const movementIdCol = mvHas('ingredient_id') ? 'ingredient_id' : 'barang_id'

    const sbCols = await q("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_balance'")
    const sbCi = sbCols?.rows || sbCols || []
    const sbNames = sbCi.map((c: any) => String(c.name || c.column_name).toLowerCase())
    const sbHas = (n: string) => sbNames.includes(n)
    const sbIdCol = sbHas('ingredient_id') ? 'ingredient_id' : 'barang_id'

    const sbbwRes = await q("SELECT 1 FROM stock_balance_by_warehouse LIMIT 1")
    const hasSBBW = (sbbwRes?.length || 0) > 0

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
        ORDER BY CASE WHEN COALESCE(${ratioCol},1)=1 THEN 0 ELSE 1 END, id
        LIMIT 1
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
        if (u) {
          unitRatio = Number(u.unit_ratio || 1) || 1
        } else {
          unitId = null
        }
      }
      if (!unitId) {
        const u = await getDefaultUnit(barangId)
        if (!u) throw new Error(`Satuan master tidak ditemukan untuk barang ID ${barangId}`)
        unitId = Number(u.id)
        unitRatio = Number(u.unit_ratio || 1) || 1
      }
      const baseQty = qty * unitRatio

      if (!allowNegativeStock) {
        const srcBal = await q(`SELECT quantity FROM stock_balance WHERE ${sbIdCol}=$1 AND warehouse_id=$2`, [barangId, fromId])
        const srcArr = srcBal?.rows || srcBal || []
        const srcQty = Number(srcArr[0]?.quantity ?? 0)
        if (srcQty < baseQty) {
          throw new Error(`Stok tidak cukup untuk barang ID ${barangId} di gudang asal (tersedia: ${srcQty}, perlu: ${baseQty})`)
        }
      }
      await q('INSERT INTO stock_transfer_items(transfer_id, barang_id, qty, unit_id, unit_ratio, qty_total) VALUES($1,$2,$3,$4,$5,$6)', [transferId, barangId, qty, unitId, unitRatio, baseQty])

      const jenisRes = await q('SELECT jenis FROM master_barang WHERE id = $1', [barangId])
      const jenisArr = jenisRes?.rows || jenisRes || []
      const jenisRow = jenisArr[0]
      const isEligible = jenisRow && (Number(jenisRow.jenis) === 1 || Number(jenisRow.jenis) === 2 || Number(jenisRow.jenis) === 3)

      const srcBalRes = await q(`SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ${sbIdCol}=$1 AND warehouse_id=$2`, [barangId, fromId])
      const srcBalArr = srcBalRes?.rows || srcBalRes || []
      const srcBalRow = srcBalArr[0]
      const srcQtyPrev = Number(srcBalRow?.quantity ?? 0)
      const srcAvgPrev = Number(srcBalRow?.avg_cost ?? 0)
      const srcTotalPrev = Number(srcBalRow?.total_cost ?? 0)
      const srcOutUnitCost = isEligible ? srcAvgPrev : null
      const srcOutTotalCost = isEligible ? (srcAvgPrev * baseQty) : null
      const srcQtyNew = srcQtyPrev - baseQty
      const srcTotalNew = isEligible ? (srcTotalPrev - (srcOutTotalCost||0)) : srcTotalPrev
      const srcAvgNew = srcQtyNew > 0 ? (isEligible ? (srcTotalNew / srcQtyNew) : srcAvgPrev) : 0

      await q(`INSERT INTO stock_movements (${movementIdCol}, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, period_id, transaction_date, unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [barangId, fromId, 'out', baseQty, 'unit', 'stock_transfer', transferId, periodId, tdate, srcOutUnitCost, srcOutTotalCost, srcQtyNew, isEligible ? srcTotalNew : srcTotalPrev, srcAvgNew])

      if (srcBalRow) await q(`UPDATE stock_balance SET quantity=$1, avg_cost=$2, total_cost=$3, updated_at=NOW() WHERE ${sbIdCol}=$4 AND warehouse_id=$5`, [srcQtyNew, srcAvgNew, isEligible ? srcTotalNew : srcTotalPrev, barangId, fromId])
      else await q(`INSERT INTO stock_balance(${sbIdCol}, warehouse_id, quantity, avg_cost, total_cost) VALUES($1,$2,$3,$4,$5)`, [barangId, fromId, Math.max(0, srcQtyNew), srcAvgNew, isEligible ? srcTotalNew : srcTotalPrev])

      const dstBalRes = await q(`SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ${sbIdCol}=$1 AND warehouse_id=$2`, [barangId, toId])
      const dstBalArr = dstBalRes?.rows || dstBalRes || []
      const dstBalRow = dstBalArr[0]
      const dstQtyPrev = Number(dstBalRow?.quantity ?? 0)
      const dstTotalPrev = Number(dstBalRow?.total_cost ?? 0)
      const inUnitCost = isEligible ? srcAvgPrev : null
      const inTotalCost = isEligible ? (srcAvgPrev * baseQty) : null
      const dstQtyNew = dstQtyPrev + baseQty
      const dstTotalNew = isEligible ? (dstTotalPrev + (inTotalCost||0)) : dstTotalPrev
      const dstAvgNew = dstQtyNew > 0 ? (isEligible ? (dstTotalNew / dstQtyNew) : Number(dstBalRow?.avg_cost || 0)) : 0

      await q(`INSERT INTO stock_movements (${movementIdCol}, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, period_id, transaction_date, unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [barangId, toId, 'in', baseQty, 'unit', 'stock_transfer', transferId, periodId, tdate, inUnitCost, inTotalCost, dstQtyNew, isEligible ? dstTotalNew : dstTotalPrev, dstAvgNew])

      if (dstBalRow) await q(`UPDATE stock_balance SET quantity=$1, avg_cost=$2, total_cost=$3, updated_at=NOW() WHERE ${sbIdCol}=$4 AND warehouse_id=$5`, [dstQtyNew, dstAvgNew, isEligible ? dstTotalNew : dstTotalPrev, barangId, toId])
      else await q(`INSERT INTO stock_balance(${sbIdCol}, warehouse_id, quantity, avg_cost, total_cost) VALUES($1,$2,$3,$4,$5)`, [barangId, toId, dstQtyNew, dstAvgNew, isEligible ? dstTotalNew : dstTotalPrev])

      if (hasSBBW) {
        const srcOldRes = await q('SELECT qty FROM stock_balance_by_warehouse WHERE barang_id=$1 AND warehouse_id=$2', [barangId, fromId])
        const srcOldArr = srcOldRes?.rows || srcOldRes || []
        const srcOld = srcOldArr[0]
        const srcOldNext = Number(srcOld?.qty ?? 0) - baseQty
        if (srcOld) await q('UPDATE stock_balance_by_warehouse SET qty=$1 WHERE barang_id=$2 AND warehouse_id=$3', [srcOldNext, barangId, fromId])
        else await q('INSERT INTO stock_balance_by_warehouse(barang_id, warehouse_id, qty) VALUES($1,$2,$3)', [barangId, fromId, Math.max(0, srcOldNext)])

        const dstOldRes = await q('SELECT qty FROM stock_balance_by_warehouse WHERE barang_id=$1 AND warehouse_id=$2', [barangId, toId])
        const dstOldArr = dstOldRes?.rows || dstOldRes || []
        const dstOld = dstOldArr[0]
        const dstOldNext = Number(dstOld?.qty ?? 0) + baseQty
        if (dstOld) await q('UPDATE stock_balance_by_warehouse SET qty=$1 WHERE barang_id=$2 AND warehouse_id=$3', [dstOldNext, barangId, toId])
        else await q('INSERT INTO stock_balance_by_warehouse(barang_id, warehouse_id, qty) VALUES($1,$2,$3)', [barangId, toId, dstOldNext])
      }
    }

    return { id: transferId, number }
  })

  return NextResponse.json({ ok: true, id: transferId, number: tfNumber })
}
