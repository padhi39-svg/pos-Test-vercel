import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawRun } from '@/db/raw'
import { getDb } from '@/db'

async function ensureViews() {
  // Detect real columns and build views accordingly
  const colsMov = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_movements'")
  const hasMov = (n: string) => colsMov.some(c => String(c.name).toLowerCase() === n)
  const idCol = hasMov('ingredient_id') ? 'ingredient_id' : (hasMov('barang_id') ? 'barang_id' : 'ingredient_id')
  const hasRefType = hasMov('reference_type')
  const hasRefId = hasMov('reference_id')
  const hasMoveDate = hasMov('movement_date')
  const hasUpdated = hasMov('updated_at')

  const selectMov = `SELECT\n  id,\n  ${idCol} AS barang_id,\n  warehouse_id,\n  movement_type,\n  quantity,\n  ${hasRefType ? 'reference_type' : "'' AS reference_type"},\n  ${hasRefId ? 'reference_id' : 'NULL AS reference_id'},\n  ${hasMoveDate ? 'movement_date' : 'created_at AS movement_date'},\n  created_at${hasUpdated ? ', updated_at' : ''}\nFROM stock_movements`

  await rawRun(`DROP VIEW IF EXISTS stock_movements_view;`)
  await rawRun(`CREATE OR REPLACE VIEW stock_movements_view AS ${selectMov};`)

  // Balance view
  const colsBal = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_balance'")
  const hasBal = (n: string) => colsBal.some(c => String(c.name).toLowerCase() === n)
  const balIdCol = hasBal('ingredient_id') ? 'ingredient_id' : (hasBal('barang_id') ? 'barang_id' : 'ingredient_id')
  const balQtyCol = hasBal('qty') ? 'qty' : (hasBal('quantity') ? 'quantity' : 'quantity')
  const hasBalCreated = hasBal('created_at')
  const hasBalUpdated = hasBal('updated_at')

  const selectBal = `SELECT\n  ${balIdCol} AS barang_id,\n  warehouse_id,\n  ${balQtyCol} AS qty\n  ${hasBalCreated ? ', created_at' : ''}\n  ${hasBalUpdated ? ', updated_at' : ''}\nFROM stock_balance`

  await rawRun(`DROP VIEW IF EXISTS stock_balance_view;`)
  await rawRun(`CREATE OR REPLACE VIEW stock_balance_view AS ${selectBal};`)
}

export async function GET(_req: NextRequest) {
  try {
    await ensureViews()
    return NextResponse.json({ ok: true, created: ['stock_movements_view', 'stock_balance_view'] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to create views' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
