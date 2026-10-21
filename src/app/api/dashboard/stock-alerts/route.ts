import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(_req: NextRequest) {
  try {
    const db = getDb()

    // Determine source table for stock balance
    // Prefer stock_balance table if exists
    const tables = await rawAll("SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema = CURRENT_SCHEMA")
    const hasStockBalance = tables.some(t => String(t.table_name).toLowerCase() === 'stock_balance')

    let rows: any[] = []
    if (hasStockBalance) {
      // Try find min_stock column
      const bcols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'master_barang'`)
      const hasMinStock = bcols.some(c => String(c.name).toLowerCase() === 'min_stock')
      rows = await rawAll(`
        SELECT mb.id, mb.code, mb.name, COALESCE(sb.quantity,0) as qty,
               ${hasMinStock ? 'COALESCE(mb.min_stock,0)' : '0'} as min_stock
        FROM master_barang mb
        LEFT JOIN stock_balance sb ON sb.ingredient_id = mb.id
        WHERE COALESCE(mb.isdelete,0)=0
        ORDER BY (COALESCE(sb.quantity,0) - ${hasMinStock ? 'COALESCE(mb.min_stock,0)' : '0'}) ASC
        LIMIT 5
      `)
    } else {
      // Fallback: show items with qty column on master_barang if exists
      const bcols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'master_barang'`)
      const hasQty = bcols.some(c => String(c.name).toLowerCase() === 'qty')
      const hasStock = bcols.some(c => String(c.name).toLowerCase() === 'stok' || String(c.name).toLowerCase() === 'stock')
      const qtyCol = hasQty ? 'qty' : (hasStock ? (bcols.find(c=>String(c.name).toLowerCase()==='stok')?'stok':'stock') : undefined)
      if (qtyCol) {
        rows = await rawAll(`
          SELECT id, code, name, COALESCE(${qtyCol},0) as qty, 0 as min_stock
          FROM master_barang
          WHERE COALESCE(isdelete,0)=0
          ORDER BY COALESCE(${qtyCol},0) ASC
          LIMIT 5
        `)
      } else {
        rows = []
      }
    }

    return NextResponse.json({ rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to get stock alerts' }, { status: 500 })
  }
}
