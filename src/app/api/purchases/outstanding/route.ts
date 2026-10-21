import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const supplierId = Number(searchParams.get('supplierId'))
    if (!supplierId) return NextResponse.json([], { status: 200 })

    const db = getDb()
    const pool = (db as any).$client

    // Ensure minimal tables exist
    try {
      await rawRun(`
        CREATE TABLE IF NOT EXISTS purchases (
          id SERIAL PRIMARY KEY,
          purchase_number TEXT,
          supplier_id INTEGER,
          purchase_date TEXT,
          invoice_number TEXT,
          total REAL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ap_payments (
          id SERIAL PRIMARY KEY,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ap_payment_items (
          id SERIAL PRIMARY KEY,
          payment_id INTEGER NOT NULL,
          purchase_id INTEGER NOT NULL,
          pay_amount REAL DEFAULT 0
        );
      `)
    } catch {}

    const rows = await rawAll(`
      SELECT 
        p.id,
        p.purchase_number,
        p.invoice_number,
        p.purchase_date,
        p.total,
        COALESCE(pp.paid, 0) AS paid,
        MAX(0, p.total - COALESCE(pp.paid, 0)) AS outstanding
      FROM purchases p
      LEFT JOIN (
        SELECT pi.purchase_id, SUM(pi.pay_amount) AS paid
        FROM ap_payment_items pi
        JOIN ap_payments ap ON ap.id = pi.payment_id AND ap.status <> 'void'
        GROUP BY pi.purchase_id
      ) pp ON pp.purchase_id = p.id
      WHERE p.supplier_id = ? AND (p.total - COALESCE(pp.paid, 0)) > 0
      ORDER BY p.purchase_date ASC, p.id ASC
    `, [supplierId])

    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to get outstanding invoices', details: e?.message }, { status: 500 })
  }
}
