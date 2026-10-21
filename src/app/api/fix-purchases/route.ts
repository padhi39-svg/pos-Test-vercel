import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

async function ensureTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      purchase_number TEXT,
      supplier_id INTEGER,
      warehouse_id INTEGER DEFAULT 1,
      purchase_date TEXT,
      invoice_number TEXT,
      subtotal REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      ppn_percent REAL DEFAULT 0,
      ppn_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)

  await rawRun(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id SERIAL PRIMARY KEY,
      purchase_id INTEGER,
      barang_id INTEGER,
      quantity REAL DEFAULT 0,
      unit_name TEXT,
      unit_ratio INTEGER DEFAULT 1,
      unit_price REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_price REAL DEFAULT 0
    );
  `)

  try {
    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'purchases'"
    )
    const names = new Set(cols.map(c=>c.column_name))
    if (!names.has('discount_percent')) await rawRun("ALTER TABLE purchases ADD COLUMN discount_percent REAL DEFAULT 0")
    if (!names.has('discount_amount')) await rawRun("ALTER TABLE purchases ADD COLUMN discount_amount REAL DEFAULT 0")
    if (!names.has('ppn_percent')) await rawRun("ALTER TABLE purchases ADD COLUMN ppn_percent REAL DEFAULT 0")
    if (!names.has('ppn_amount')) await rawRun("ALTER TABLE purchases ADD COLUMN ppn_amount REAL DEFAULT 0")
  } catch {}
}

async function reconcile() {
  await ensureTables()
  const db = getDb()
  const pool = (db as any).$client

  const purchases = await rawAll<any>('SELECT * FROM purchases ORDER BY id ASC')
  const roundRp = (v:number)=> Math.round(v||0)

  let updatedCount = 0
  for (const p of purchases) {
    const items = await rawAll<any>('SELECT * FROM purchase_items WHERE purchase_id = $1', [p.id])

    let itemsSubtotal = 0
    for (const it of items) {
      const qty = Number(it.quantity || 0)
      const unitPrice = Number(it.unit_price || 0)
      const sub = qty * unitPrice
      let discAmt = Number(it.discount_amount || 0)
      if (!discAmt || discAmt < 0) {
        const discPct = Math.min(Math.max(Number(it.discount_percent || 0), 0), 100)
        discAmt = roundRp(sub * (discPct/100))
      }
      const totalPrice = roundRp(Math.max(0, sub - discAmt))
      itemsSubtotal += totalPrice

      if (Number(it.total_price || 0) !== totalPrice) {
        await rawRun('UPDATE purchase_items SET total_price = $1 WHERE id = $2', [totalPrice, it.id])
      }
    }

    const headerDiscPct = Math.min(Math.max(Number(p.discount_percent ?? 0), 0), 100)
    let headerDiscAmt = Number(p.discount_amount || 0)
    if (!headerDiscAmt && headerDiscPct) headerDiscAmt = roundRp(itemsSubtotal * (headerDiscPct/100))

    const dpp = Math.max(0, itemsSubtotal - headerDiscAmt)
    let ppnPct = p.ppn_percent
    if (ppnPct === null || ppnPct === undefined) ppnPct = 11
    ppnPct = Math.min(Math.max(Number(ppnPct || 0), 0), 100)
    let ppnAmt = Number(p.ppn_amount || 0)
    if (!ppnAmt && ppnPct) ppnAmt = roundRp(dpp * (ppnPct/100))
    const total = dpp + ppnAmt

    const result = await rawRun(
      `UPDATE purchases
       SET subtotal = $1, discount_percent = $2, discount_amount = $3, ppn_percent = $4, ppn_amount = $5, total = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [itemsSubtotal, headerDiscPct, headerDiscAmt, ppnPct, ppnAmt, total, p.id]
    )

    updatedCount += result.rowCount || 0
  }

  return { ok: true, updated: updatedCount }
}

export async function POST(_req: NextRequest) {
  try {
    const result = await reconcile()
    return NextResponse.json(result)
  } catch (e:any) {
    console.error('POST /api/fix-purchases error:', e)
    return NextResponse.json({ error: 'Gagal rekonsiliasi pembelian' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest) {
  try {
    const result = await reconcile()
    return NextResponse.json(result)
  } catch (e:any) {
    console.error('GET /api/fix-purchases error:', e)
    return NextResponse.json({ error: 'Gagal rekonsiliasi pembelian' }, { status: 500 })
  }
}
