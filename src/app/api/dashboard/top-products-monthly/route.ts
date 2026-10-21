import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(_req: NextRequest) {
  try {
    const db = getDb()

    // Current month range
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const from = `${y}-${m}-01`
    const to = new Date(y, now.getMonth() + 1, 0).toISOString().slice(0, 10)

    // Detect columns
    const tcols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'transactions'`)
    const icols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'transaction_items'`)
    const bcols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'master_barang'`)

    const hasT = (n:string)=> tcols.some(c=> String(c.name).toLowerCase()===n)
    const hasI = (n:string)=> icols.some(c=> String(c.name).toLowerCase()===n)

    const tVoidCol = hasT('void') ? 'void' : undefined
    const tReturnCol = hasT('is_return') ? 'is_return' : undefined
    const tTypeCol = hasT('transaction_type') ? 'transaction_type' : undefined

    const iBarangCol = hasI('barang_id') ? 'barang_id' : (hasI('product_id') ? 'product_id' : undefined)
    const iQtyCol = hasI('quantity') ? 'quantity' : (hasI('qty') ? 'qty' : undefined)
    const iTotalCol = hasI('total') ? 'total' : (hasI('line_total') ? 'line_total' : undefined)

    if (!iBarangCol || !iQtyCol) {
      return NextResponse.json({ rows: [] })
    }

    const dateExpr = `DATE(COALESCE(t.transaction_date, t.tgl_nota, t.created_at))`
    const voidExpr = tVoidCol ? `COALESCE(t.${tVoidCol},0)=0` : `1=1`
    const returnExpr = tReturnCol ? `COALESCE(t.${tReturnCol},0)=0` : `1=1`
    const typeExpr = tTypeCol ? `t.${tTypeCol} IN (1,2,3)` : `1=1`
    // Determine latest unit price from barang_prices if exists
    const tables = await rawAll("SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema = CURRENT_SCHEMA")
    const hasHargaTable = tables.some(t => String(t.table_name).toLowerCase() === 'barang_prices')
    let rows: any[] = []
    if (hasHargaTable) {
      const pcols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'barang_prices'`)
      const pHas = (n:string)=> pcols.some(c=> String(c.name).toLowerCase()===n)
      const priceCol = pHas('price') ? 'price' : (pHas('harga') ? 'harga' : (pHas('selling_price') ? 'selling_price' : undefined))
      const effCol = pHas('effective_date') ? 'effective_date' : undefined
      const isActiveCol = pHas('isactive') ? 'isactive' : undefined

      if (priceCol) {
        // Build latest price subquery
        let latestJoin = ''
        if (effCol) {
          // Latest by effective_date <= to
          latestJoin = `
            LEFT JOIN (
              SELECT bp.barang_id, bp.${priceCol} as unit_price
              FROM barang_prices bp
              JOIN (
                SELECT barang_id, MAX(${effCol}) AS max_eff
                FROM barang_prices
                WHERE ${isActiveCol ? `COALESCE(${isActiveCol},1)=1 AND ` : ''} DATE(${effCol}) <= DATE(?)
                GROUP BY barang_id
              ) mx ON mx.barang_id = bp.barang_id AND mx.max_eff = bp.${effCol}
            ) p ON p.barang_id = i.${iBarangCol}
          `
        } else {
          // Latest by max(id)
          latestJoin = `
            LEFT JOIN (
              SELECT bp.barang_id, bp.${priceCol} as unit_price
              FROM barang_prices bp
              JOIN (
                SELECT barang_id, MAX(id) AS max_id
                FROM barang_prices
                ${isActiveCol ? `WHERE COALESCE(${isActiveCol},1)=1` : ''}
                GROUP BY barang_id
              ) mx ON mx.barang_id = bp.barang_id AND mx.max_id = bp.id
            ) p ON p.barang_id = i.${iBarangCol}
          `
        }

        const sql = `
          SELECT mb.id, mb.code, mb.name,
                 SUM(COALESCE(i.${iQtyCol},0)) AS qty,
                 SUM(COALESCE(i.${iQtyCol},0) * COALESCE(p.unit_price, 0)) AS omzet
          FROM transaction_items i
          JOIN transactions t ON t.id = i.transaction_id
          LEFT JOIN master_barang mb ON mb.id = i.${iBarangCol}
          ${latestJoin}
          WHERE ${voidExpr} AND ${returnExpr} AND ${typeExpr} AND ${dateExpr} >= ? AND ${dateExpr} <= ?
          GROUP BY mb.id, mb.code, mb.name
          ORDER BY qty DESC, omzet DESC
          LIMIT 10
        `
        // When using effCol, we need to pass 'to' for date condition in subquery as well
        rows = effCol ? (await rawAll(sql, [to, from, to])) : (await rawAll(sql, [from, to]))
      }
    }
    if (!rows.length) {
      // Fallback: use line total if available, else 0
      const totalExpr = iTotalCol ? `COALESCE(i.${iTotalCol},0)` : `0`
      rows = await rawAll(`
        SELECT mb.id, mb.code, mb.name,
               SUM(COALESCE(i.${iQtyCol},0)) AS qty,
               SUM(${totalExpr}) AS omzet
        FROM transaction_items i
        JOIN transactions t ON t.id = i.transaction_id
        LEFT JOIN master_barang mb ON mb.id = i.${iBarangCol}
        WHERE ${voidExpr} AND ${returnExpr} AND ${typeExpr} AND ${dateExpr} >= ? AND ${dateExpr} <= ?
        GROUP BY mb.id, mb.code, mb.name
        ORDER BY qty DESC, omzet DESC
        LIMIT 10
      `, [from, to])
    }

    return NextResponse.json({ rows })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Failed to get top products monthly' }, { status: 500 })
  }
}
