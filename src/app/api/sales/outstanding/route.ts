import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawRun } from '@/db/raw'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }

    await rawRun(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        sale_number TEXT,
        sale_date TEXT,
        customer_id INTEGER,
        total REAL DEFAULT 0
      );
    `)
    await rawRun(`
      CREATE TABLE IF NOT EXISTS ar_payments (
        id SERIAL PRIMARY KEY,
        status TEXT DEFAULT 'active'
      );
    `)
    await rawRun(`
      CREATE TABLE IF NOT EXISTS ar_payment_items (
        id SERIAL PRIMARY KEY,
        payment_id INTEGER,
        sale_id INTEGER,
        pay_amount REAL DEFAULT 0
      );
    `)

    const rows = await rawAll<any>(
      `SELECT 
        s.id,
        s.sale_number,
        s.sale_date,
        s.total,
        COALESCE(paid.total_paid, 0) as total_paid,
        (s.total - COALESCE(paid.total_paid, 0)) as outstanding
      FROM sales s
      LEFT JOIN (
        SELECT 
          si.sale_id,
          SUM(si.pay_amount) as total_paid
        FROM ar_payment_items si
        JOIN ar_payments sp ON si.payment_id = sp.id
        WHERE sp.status = 'active'
        GROUP BY si.sale_id
      ) paid ON s.id = paid.sale_id
      WHERE s.customer_id = $1
        AND (s.total - COALESCE(paid.total_paid, 0)) > 0.01
      ORDER BY s.sale_date ASC, s.id ASC`,
      [Number(customerId)]
    )

    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to get outstanding sales', details: e?.message }, { status: 500 })
  }
}
