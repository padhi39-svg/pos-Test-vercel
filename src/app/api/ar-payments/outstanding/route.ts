import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const customerId = Number(url.searchParams.get('customer_id') || 0) || 0
    const q = (url.searchParams.get('q') || '').trim().toLowerCase()

    const db = getDb()

    // Ensure required tables (non-destructive)
    try {
      await rawRun(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          transaction_number TEXT,
          customer_id INTEGER,
          tgl_nota TEXT,
          total REAL DEFAULT 0,
          is_return INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS ar_opening_balances (
          id SERIAL PRIMARY KEY,
          kode_nota TEXT,
          tanggal TEXT,
          customer_id INTEGER,
          nominal REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS master_customer (
          id SERIAL PRIMARY KEY,
          code TEXT,
          name TEXT
        );
        CREATE TABLE IF NOT EXISTS ar_payment_items (
          id SERIAL PRIMARY KEY,
          payment_id INTEGER,
          sale_id INTEGER,
          pay_amount REAL DEFAULT 0
        );
      `)
    } catch {}

    // Build paid map for transactions (include legacy sale_id and new source_type='transaction')
    const paidRows = await rawAll(`
      SELECT COALESCE(ai.sale_id, ai.source_id) AS id, COALESCE(SUM(ai.pay_amount),0) AS paid
      FROM ar_payment_items ai
      JOIN ar_payments ap ON ap.id = ai.payment_id AND ap.status <> 'void'
      WHERE (ai.sale_id IS NOT NULL AND ai.sale_id > 0) OR (ai.source_type = 'transaction')
      GROUP BY COALESCE(ai.sale_id, ai.source_id)
    `) as any[]
    const paidMap = new Map<number, number>()
    for (const r of paidRows) paidMap.set(Number(r.id), Number(r.paid) || 0)

    // Load transactions (invoices and returns)
    const tRows = await rawAll(`
      SELECT t.id, t.transaction_number, COALESCE(t.tgl_nota::text, SUBSTRING(t.created_at::text,1,10)) AS invoice_date,
             t.customer_id, t.total, COALESCE(t.is_return, 0) AS is_return,
             c.code AS customer_code, c.name AS customer_name
      FROM transactions t
      LEFT JOIN master_customer c ON c.id = t.customer_id
      WHERE (? = 0 OR t.customer_id = ?)
        AND COALESCE(t.void, 0) = 0
      ORDER BY invoice_date DESC, t.id DESC
    `, [customerId, customerId]) as any[]

    // Build used map for sales returns via source_type='sales_return'
    const usedReturnRows = await rawAll(`
      SELECT ai.source_id AS id, COALESCE(SUM(ai.pay_amount),0) AS used
      FROM ar_payment_items ai
      JOIN ar_payments ap ON ap.id = ai.payment_id AND ap.status <> 'void'
      WHERE ai.source_type = 'sales_return'
      GROUP BY ai.source_id
    `) as any[]
    const usedReturnMap = new Map<number, number>()
    for (const r of usedReturnRows) usedReturnMap.set(Number(r.id), Number(r.used)||0)

    const txs = tRows
      .filter((r: any) => {
        if (!q) return true
        const code = String(r.transaction_number || '').toLowerCase()
        const cust = String(r.customer_name || '').toLowerCase()
        return code.includes(q) || cust.includes(q)
      })
      .map((r: any) => {
        const total = Math.abs(Number(r.total || 0))
        const isReturn = Number(r.is_return) === 1
        if (isReturn) {
          const used = Number(usedReturnMap.get(Number(r.id)) || 0)
          const remaining = Math.max(0, total - used)
          return {
            id: r.id,
            invoice_number: r.transaction_number,
            invoice_date: r.invoice_date,
            due_amount: remaining,
            source_type: 'sales_return',
            amount: -total,
            paid: used,
          }
        } else {
          const paid = Number(paidMap.get(Number(r.id)) || 0)
          const outstanding = Math.max(0, total - paid)
          return {
            id: r.id,
            invoice_number: r.transaction_number,
            invoice_date: r.invoice_date,
            due_amount: outstanding,
            source_type: 'transaction',
            amount: total,
            paid,
          }
        }
      })
      .filter((x: any) => x.due_amount > 0)

    // Load AR opening balances
    const obRows = await rawAll(`
      SELECT ar.id, ar.kode_nota, ar.tanggal, ar.customer_id, ar.nominal,
             c.name AS customer_name
      FROM ar_opening_balances ar
      LEFT JOIN master_customer c ON c.id = ar.customer_id
      WHERE (? = 0 OR ar.customer_id = ?)
      ORDER BY ar.tanggal DESC, ar.id DESC
    `, [customerId, customerId]) as any[]

    // Build paid map for openings via source_type='ar_opening'
    const paidOpenRows = await rawAll(`
      SELECT ai.source_id AS id, COALESCE(SUM(ai.pay_amount),0) AS paid
      FROM ar_payment_items ai
      JOIN ar_payments ap ON ap.id = ai.payment_id AND ap.status <> 'void'
      WHERE ai.source_type = 'ar_opening'
      GROUP BY ai.source_id
    `) as any[]
    const paidOpenMap = new Map<number, number>()
    for (const r of paidOpenRows) paidOpenMap.set(Number(r.id), Number(r.paid) || 0)

    const openings = obRows
      .filter((r: any) => {
        if (!q) return true
        const code = String(r.kode_nota || '').toLowerCase()
        const cust = String(r.customer_name || '').toLowerCase()
        return code.includes(q) || cust.includes(q)
      })
      .map((r: any) => {
        const nominal = Math.max(0, Number(r.nominal || 0))
        const paid = Number(paidOpenMap.get(Number(r.id)) || 0)
        const outstanding = Math.max(0, nominal - paid)
        return {
          id: -Number(r.id), // keep negative id space for compatibility
          invoice_number: r.kode_nota,
          invoice_date: r.tanggal,
          due_amount: outstanding,
          source_type: 'ar_opening',
          amount: nominal,
          paid,
        }
      })

    const data = [...openings, ...txs]

    // Load AR advances (uang muka customer) with outstanding > 0
    try {
      await rawRun(`
        CREATE TABLE IF NOT EXISTS ar_advances (
          id SERIAL PRIMARY KEY,
          kode_nota TEXT NOT NULL,
          tanggal TEXT NOT NULL,
          customer_id INTEGER NOT NULL,
          notes TEXT DEFAULT '',
          total_amount REAL NOT NULL DEFAULT 0,
          period_id INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_ar_adv_number UNIQUE (kode_nota)
        )
      `)
      const advCols = (await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='ar_advances'`)).map((x: any) => String(x.name).toLowerCase())
      const nominalCol = advCols.includes('total_amount') ? 'a.total_amount' : 'a.total'

      const advRows = await rawAll(`
        SELECT a.id, a.kode_nota, a.tanggal, a.customer_id, ${nominalCol} as nominal,
               c.name AS customer_name
        FROM ar_advances a
        LEFT JOIN master_customer c ON c.id = a.customer_id
        WHERE (? = 0 OR a.customer_id = ?) AND a.status = 'active'
        ORDER BY a.tanggal DESC, a.id DESC
      `, [customerId, customerId]) as any[]

      const paidAdvMap = new Map<number, number>()
      const paidAdvRows = await rawAll(`
        SELECT pi.source_id AS id, COALESCE(SUM(pi.pay_amount),0) AS paid
        FROM ar_payment_items pi
        JOIN ar_payments p ON p.id = pi.payment_id AND p.status <> 'void'
        WHERE pi.source_type = 'ar_advance'
        GROUP BY pi.source_id
      `) as any[]
      for (const r of paidAdvRows) paidAdvMap.set(Number(r.id), Number(r.paid) || 0)

      const advances = advRows
        .filter((r: any) => {
          if (!q) return true
          const code = String(r.kode_nota || '').toLowerCase()
          const cust = String(r.customer_name || '').toLowerCase()
          return code.includes(q) || cust.includes(q)
        })
        .map((r: any) => {
          const nominal = Math.abs(Number(r.nominal || 0))
          const paid = Number(paidAdvMap.get(Number(r.id)) || 0)
          const outstanding = Math.max(0, nominal - paid)
          return {
            id: r.id,
            invoice_number: r.kode_nota,
            invoice_date: r.tanggal,
            due_amount: outstanding,
            source_type: 'ar_advance',
            amount: nominal,
            paid,
          }
        })
        .filter((a: any) => a.due_amount > 0)

      data.push(...advances)
    } catch (e) { console.warn('Failed to load AR advances:', e) }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: 'Gagal mengambil outstanding AR', details: e?.message }, { status: 500 })
  }
}
