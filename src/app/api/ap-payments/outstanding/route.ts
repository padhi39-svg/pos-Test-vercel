import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const supplierId = Number(url.searchParams.get('supplier_id') || 0) || 0
    const q = (url.searchParams.get('q') || '').trim().toLowerCase()

    const db = getDb()

    // Ensure required tables (non-destructive)
    try {
      await rawRun(`
        CREATE TABLE IF NOT EXISTS purchases (
          id SERIAL PRIMARY KEY,
          purchase_number TEXT,
          supplier_id INTEGER,
          purchase_date TEXT,
          total REAL DEFAULT 0,
          is_return INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active'
        );
        CREATE TABLE IF NOT EXISTS ap_opening_balances (
          id SERIAL PRIMARY KEY,
          kode_nota TEXT,
          tanggal TEXT,
          supplier_id INTEGER,
          nominal REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS ap_payments (
          id SERIAL PRIMARY KEY,
          status TEXT DEFAULT 'active'
        );
        CREATE TABLE IF NOT EXISTS ap_payment_items (
          id SERIAL PRIMARY KEY,
          payment_id INTEGER,
          purchase_id INTEGER,
          pay_amount REAL DEFAULT 0,
          source_type TEXT,
          source_id INTEGER
        );
      `)
    } catch {}

    // Non-destructive migration to ensure 'status' column exists on purchases
    try {
      const cols = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases'`)
      const names = new Set(cols.map((c: any) => c.name))
      if (!names.has('status')) {
        await rawRun("ALTER TABLE purchases ADD COLUMN status TEXT DEFAULT 'active'")
      }
    } catch {}

    // Build paid map for purchases
    const paidRows = await rawAll(`
      SELECT pi.purchase_id AS id, COALESCE(SUM(pi.pay_amount),0) AS paid
      FROM ap_payment_items pi
      JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
      GROUP BY pi.purchase_id
    `) as any[]
    const paidMap = new Map<number, number>()
    for (const r of paidRows) paidMap.set(Number(r.id), Number(r.paid) || 0)

    // Load purchases (invoices and returns)
    const pRows = await rawAll(`
      SELECT p.id, p.purchase_number, p.purchase_date, p.supplier_id, p.total, COALESCE(p.is_return,0) AS is_return,
             s.code AS supplier_code, s.name AS supplier_name
      FROM purchases p
      LEFT JOIN master_supplier s ON s.id = p.supplier_id
      WHERE (? = 0 OR p.supplier_id = ?) AND COALESCE(p.status,'active') <> 'void'
      ORDER BY p.purchase_date DESC, p.id DESC
    `, [supplierId, supplierId]) as any[]

    // Build paid map for purchase returns (source_type = 'purchase_return')
    const paidReturnRows = await rawAll(`
      SELECT pi.source_id AS id, COALESCE(SUM(pi.pay_amount),0) AS paid
      FROM ap_payment_items pi
      JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
      WHERE pi.source_type = 'purchase_return'
      GROUP BY pi.source_id
    `) as any[]
    const paidReturnMap = new Map<number, number>()
    for (const r of paidReturnRows) paidReturnMap.set(Number(r.id), Number(r.paid) || 0)

    const purchases = pRows
      .filter((r: any) => {
        if (!q) return true
        const code = String(r.purchase_number || '').toLowerCase()
        const supp = String(r.supplier_name || '').toLowerCase()
        return code.includes(q) || supp.includes(q)
      })
      .map((r: any) => {
        const total = Number(r.total || 0)
        const amount = (Number(r.is_return) === 1) ? -Math.abs(total) : Math.abs(total)
        const paid = Number(r.is_return) === 1
          ? Number(paidReturnMap.get(Number(r.id)) || 0)
          : Number(paidMap.get(Number(r.id)) || 0)
        const outstanding = Number(r.is_return) === 1 ? amount + paid : amount - paid
        return {
          id: r.id,
          source_type: Number(r.is_return) === 1 ? 'purchase_return' : 'purchase',
          source_id: r.id,
          invoice_number: r.purchase_number,
          invoice_date: r.purchase_date,
          partner_id: r.supplier_id,
          partner_name: r.supplier_name,
          amount,
          paid: Number(r.is_return) === 1 ? 0 : paid,
          due_amount: outstanding,
        }
      })

    // Load AP opening balances
    const obRows = await rawAll(`
      SELECT ap.id, ap.kode_nota, ap.tanggal, ap.supplier_id, ap.nominal,
             s.name AS supplier_name
      FROM ap_opening_balances ap
      LEFT JOIN master_supplier s ON s.id = ap.supplier_id
      WHERE (? = 0 OR ap.supplier_id = ?)
      ORDER BY ap.tanggal DESC, ap.id DESC
    `, [supplierId, supplierId]) as any[]

    // Build paid map for openings via source_type='ap_opening'
    const paidOpenRows = await rawAll(`
      SELECT pi.source_id AS id, COALESCE(SUM(pi.pay_amount),0) AS paid
      FROM ap_payment_items pi
      JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
      WHERE pi.source_type = 'ap_opening'
      GROUP BY pi.source_id
    `) as any[]
    const paidOpenMap = new Map<number, number>()
    for (const r of paidOpenRows) paidOpenMap.set(Number(r.id), Number(r.paid) || 0)

    const openings = obRows
      .filter((r: any) => {
        if (!q) return true
        const code = String(r.kode_nota || '').toLowerCase()
        const supp = String(r.supplier_name || '').toLowerCase()
        return code.includes(q) || supp.includes(q)
      })
      .map((r: any) => {
        const nominal = Math.abs(Number(r.nominal || 0))
        const paid = Number(paidOpenMap.get(Number(r.id)) || 0)
        const outstanding = Math.max(0, nominal - paid)
        return {
          id: r.id,
          source_type: 'ap_opening',
          source_id: r.id,
          invoice_number: r.kode_nota,
          invoice_date: r.tanggal,
          partner_id: r.supplier_id,
          partner_name: r.supplier_name,
          amount: nominal,
          paid,
          due_amount: outstanding,
        }
      })

    const data = [...openings, ...purchases]

    // Load AP advances (uang muka supplier) with outstanding > 0
    try {
      // Ensure ap_advances table exists
      await rawRun(`
        CREATE TABLE IF NOT EXISTS ap_advances (
          id SERIAL PRIMARY KEY,
          kode_nota TEXT NOT NULL,
          tanggal TEXT NOT NULL,
          supplier_id INTEGER NOT NULL,
          notes TEXT DEFAULT '',
          total_amount REAL NOT NULL DEFAULT 0,
          period_id INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_ap_adv_number UNIQUE (kode_nota)
        )
      `)
      // Handle legacy column names for ap_advances
      const advCols = (await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='ap_advances'`)).map((x: any) => String(x.name).toLowerCase())
      const nominalCol = advCols.includes('total_amount') ? 'a.total_amount' : 'a.total'

      const advRows = await rawAll(`
        SELECT a.id, a.kode_nota, a.tanggal, a.supplier_id, ${nominalCol} as nominal,
               s.name AS supplier_name
        FROM ap_advances a
        LEFT JOIN master_supplier s ON s.id = a.supplier_id
        WHERE (? = 0 OR a.supplier_id = ?) AND a.status = 'active'
        ORDER BY a.tanggal DESC, a.id DESC
      `, [supplierId, supplierId]) as any[]

      const paidAdvMap = new Map<number, number>()
      const paidAdvRows = await rawAll(`
        SELECT pi.source_id AS id, COALESCE(SUM(pi.pay_amount),0) AS paid
        FROM ap_payment_items pi
        JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
        WHERE pi.source_type = 'ap_advance'
        GROUP BY pi.source_id
      `) as any[]
      for (const r of paidAdvRows) paidAdvMap.set(Number(r.id), Number(r.paid) || 0)

      const advances = advRows
        .filter((r: any) => {
          if (!q) return true
          const code = String(r.kode_nota || '').toLowerCase()
          const supp = String(r.supplier_name || '').toLowerCase()
          return code.includes(q) || supp.includes(q)
        })
        .map((r: any) => {
          const nominal = Math.abs(Number(r.nominal || 0))
          const paid = Number(paidAdvMap.get(Number(r.id)) || 0)
          const outstanding = Math.max(0, nominal - paid)
          return {
            id: r.id,
            source_type: 'ap_advance',
            source_id: r.id,
            invoice_number: r.kode_nota,
            invoice_date: r.tanggal,
            partner_id: r.supplier_id,
            partner_name: r.supplier_name,
            amount: nominal,
            paid,
            due_amount: outstanding,
          }
        })
        .filter(a => a.due_amount > 0)

      data.push(...advances)
    } catch (e) { console.warn('Failed to load AP advances:', e) }

    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: 'Gagal mengambil outstanding AP', details: e?.message }, { status: 500 })
  }
}
