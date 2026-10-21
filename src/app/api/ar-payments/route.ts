import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { getUserId } from '@/lib/audit'
import { generateEntriesForSingleSource, saveJournalEntriesForSource } from '@/lib/journalHelpers'

const pool = (getDb() as any).$client

async function ensureArPaymentTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ar_payments (
      id SERIAL PRIMARY KEY,
      payment_number TEXT UNIQUE NOT NULL,
      payment_date TEXT NOT NULL,
      customer_id INTEGER NOT NULL,
      customer_name TEXT,
      period_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'void')),
      void INTEGER DEFAULT 0,
      subtotal REAL DEFAULT 0,
      total REAL DEFAULT 0,
      notes TEXT,
      user_create INTEGER,
      user_update INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ar_payment_items (
      id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL,
      sale_id INTEGER NOT NULL,
      invoice_number TEXT,
      due_amount REAL DEFAULT 0,
      pay_amount REAL DEFAULT 0,
      remarks TEXT,
      source_type TEXT,
      source_id INTEGER DEFAULT 0,
      FOREIGN KEY (payment_id) REFERENCES ar_payments(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ar_payment_methods (
      id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      account_code TEXT,
      account_name TEXT,
      amount REAL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (payment_id) REFERENCES ar_payments(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ar_payment_extras (
      id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      account_code TEXT,
      account_name TEXT,
      notes TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      FOREIGN KEY (payment_id) REFERENCES ar_payments(id) ON DELETE CASCADE
    );
  `)
  try {
    const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name = 'ar_payments'")
    const names = new Set(cols.map(c => String(c.name)))
    if (!names.has('auto_created')) {
      await rawRun('ALTER TABLE ar_payments ADD COLUMN auto_created INTEGER NOT NULL DEFAULT 0')
    }
  } catch {}
}

export async function GET(req: NextRequest) {
  try {
    await ensureArPaymentTables()

    const rows = await rawAll<any>(`
      SELECT p.id, p.payment_number, p.payment_date, p.status, p.void, p.created_at,
             p.total, p.subtotal, p.auto_created,
             c.name AS customer_name
      FROM ar_payments p
      LEFT JOIN master_customer c ON p.customer_id = c.id
      ORDER BY p.created_at DESC
    `)

    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to list AR payments', details: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customerId, paymentDate, paymentNumber, notes, advanceTotal = 0, details = [], methods = [], extras = [] } = body

    if (!customerId || !paymentDate) {
      return NextResponse.json({ error: 'Customer and payment date are required' }, { status: 400 })
    }

    await ensureArPaymentTables()

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
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_ar_adv_number UNIQUE (kode_nota)
      )
    `)
    await rawRun(`
      CREATE TABLE IF NOT EXISTS ar_advance_lines (
        id SERIAL PRIMARY KEY,
        ar_advance_id INTEGER NOT NULL,
        line_no INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        account_code TEXT NOT NULL,
        notes TEXT DEFAULT '',
        amount REAL NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ar_advance_id) REFERENCES ar_advances(id) ON DELETE CASCADE
      )
    `)

    const period = await getPeriodByDate(paymentDate)
    if (!period) {
      return NextResponse.json({ error: 'No active period found for this date' }, { status: 400 })
    }
    if (Number(period.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${period.name}' sudah ditutup.` }, { status: 400 })
    }

    const subtotal = details.reduce((sum: number, d: any) => {
      const amt = Number(d.payAmount || d.pay_amount || 0)
      const st = String(d.sourceType || d.source_type || '').toLowerCase()
      if (st === 'ar_advance') return sum
      const sign = (st === 'sales_return') ? -1 : 1
      return sum + (sign * Math.abs(amt))
    }, 0)
    const advanceTotalVal = Math.max(0, Number(advanceTotal))
    const totalMethods = methods.reduce((sum: number, m: any) => sum + Number(m.amount || 0), 0)
    const totalExtraDebit = extras.reduce((sum: number, e: any) => sum + Number(e.debit || 0), 0)
    const totalExtraCredit = extras.reduce((sum: number, e: any) => sum + Number(e.credit || 0), 0)
    const expectedMethods = subtotal - advanceTotalVal - totalExtraDebit + totalExtraCredit

    let overpayment = 0
    if (totalMethods < expectedMethods - 0.0001) {
      return NextResponse.json({
        error: `AR formula mismatch: Methods (${totalMethods}) should equal Detail (${subtotal}) - UangMuka (${advanceTotalVal}) - Debit (${totalExtraDebit}) + Credit (${totalExtraCredit}) = ${expectedMethods}`
      }, { status: 400 })
    }
    if (totalMethods > expectedMethods + 0.0001) {
      overpayment = totalMethods - expectedMethods
    }

    const total = totalMethods

    let finalPaymentNumber = paymentNumber
    if (!finalPaymentNumber) {
      const year = new Date(paymentDate).getFullYear()
      const last = await rawGet<any>(`
        SELECT payment_number FROM ar_payments 
        WHERE payment_number LIKE 'AR/${year}/%' 
        ORDER BY payment_number DESC LIMIT 1
      `)

      let seq = 1
      if (last?.payment_number) {
        const parts = String(last.payment_number).split('/')
        const lastSeq = parseInt(parts[2]||'0', 10)
        seq = isNaN(lastSeq) ? 1 : lastSeq + 1
      }
      finalPaymentNumber = `AR/${year}/${seq.toString().padStart(6, '0')}`
    }

    const userId = getUserId(req)

    let paymentId: number | null = null
    await pool.query('BEGIN')
    try {
      const res = await pool.query(`
        INSERT INTO ar_payments (payment_number, payment_date, customer_id, period_id, status, subtotal, total, notes, user_create, created_at)
        VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING id
      `, [finalPaymentNumber, paymentDate, customerId, period.id, subtotal, total, body?.notes || null, userId])
      paymentId = Number(res.rows[0].id)

      for (const d of details) {
        const st = String(d.sourceType || d.source_type || 'transaction')
        if (st === 'transaction') {
          const tx = await rawGet<any>(`SELECT id, transaction_number, total FROM transactions WHERE id = $1`, [Number(d.saleId||d.sale_id||d.sourceId||d.source_id)])
          if (!tx) throw new Error('Invoice (transaction) not found')
          const paidRow = await rawGet<any>(`
            SELECT COALESCE(SUM(si.pay_amount),0) AS paid
            FROM ar_payment_items si 
            JOIN ar_payments sp ON si.payment_id = sp.id AND sp.status = 'active'
            WHERE (si.sale_id = $1 OR (si.source_type='transaction' AND si.source_id = $2))
          `, [tx.id, tx.id])
          const alreadyPaid = Number(paidRow?.paid || 0)
          const outstanding = Math.max(0, Number(tx.total||0) - alreadyPaid)
          const payAmount = Number(d.payAmount || d.pay_amount || 0)
          if (payAmount > outstanding + 0.01) {
            throw new Error(`Nominal bayar ${payAmount} melebihi sisa ${outstanding} untuk nota ${tx.transaction_number}`)
          }
          await rawRun(`
            INSERT INTO ar_payment_items (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
            VALUES ($1, $2, $3, $4, $5, $6, 'transaction', $7)
          `, [paymentId, tx.id, tx.transaction_number, outstanding, payAmount, d?.remarks || null, tx.id])
        } else if (st === 'ar_opening') {
          const op = await rawGet<any>(`SELECT id, kode_nota as number, nominal FROM ar_opening_balances WHERE id = $1`, [Number(d.sourceId||d.source_id)])
          if (!op) throw new Error('Saldo awal piutang tidak ditemukan')
          const paidRow = await rawGet<any>(`
            SELECT COALESCE(SUM(si.pay_amount),0) AS paid
            FROM ar_payment_items si 
            JOIN ar_payments sp ON si.payment_id = sp.id AND sp.status = 'active'
            WHERE si.source_type = 'ar_opening' AND si.source_id = $1
          `, [op.id])
          const alreadyPaid = Number(paidRow?.paid || 0)
          const outstanding = Math.max(0, Number(op.nominal||0) - alreadyPaid)
          const payAmount = Math.min(outstanding, Math.max(0, Number(d.payAmount||d.pay_amount||0)))
          await rawRun(`
            INSERT INTO ar_payment_items (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
            VALUES ($1, 0, $2, $3, $4, $5, 'ar_opening', $6)
          `, [paymentId, op.number, outstanding, payAmount, d?.remarks || null, op.id])
        } else if (st === 'sales_return') {
          const ret = await rawGet<any>(`SELECT id, transaction_number as number, total FROM transactions WHERE id = $1 AND is_return = 1`, [Number(d.sourceId||d.source_id)])
          if (!ret) throw new Error('Retur penjualan tidak ditemukan')
          const allocatedRow = await rawGet<any>(`
            SELECT COALESCE(SUM(si.pay_amount),0) AS used
            FROM ar_payment_items si 
            JOIN ar_payments sp ON si.payment_id = sp.id AND sp.status = 'active'
            WHERE si.source_type = 'sales_return' AND si.source_id = $1
          `, [ret.id])
          const nominal = Math.abs(Number(ret.total||0))
          const remaining = Math.max(0, nominal - Number(allocatedRow?.used||0))
          const payAmount = Math.min(remaining, Math.max(0, Number(d.payAmount||d.pay_amount||0)))
          await rawRun(`
            INSERT INTO ar_payment_items (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
            VALUES ($1, 0, $2, $3, $4, $5, 'sales_return', $6)
          `, [paymentId, ret.number, remaining, payAmount, d?.remarks || null, ret.id])
        } else if (st === 'ar_advance') {
          const advId = Number(d.sourceId||d.source_id)
          let payAmount = Math.max(0, Number(d.payAmount||d.pay_amount||0))
          if (advId > 0) {
            const adv = await rawGet<any>(`SELECT id, kode_nota as number, total_amount as nominal FROM ar_advances WHERE id = $1`, [advId])
            if (!adv) throw new Error('Uang muka customer tidak ditemukan')
            const usedRow = await rawGet<any>(`
              SELECT COALESCE(SUM(pi.pay_amount),0) AS used
              FROM ar_payment_items pi
              JOIN ar_payments p ON p.id = pi.payment_id AND p.status <> 'void'
              WHERE pi.source_type = 'ar_advance' AND pi.source_id = $1
            `, [adv.id])
            const remaining = Math.max(0, Number(adv.nominal||0) - Number(usedRow?.used||0))
            payAmount = Math.min(payAmount, remaining)
            await rawRun(`
              INSERT INTO ar_payment_items (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
              VALUES ($1, 0, $2, $3, $4, $5, 'ar_advance', $6)
            `, [paymentId, adv.number, remaining, payAmount, d?.remarks || null, adv.id])
          } else if (payAmount > 0) {
            const advances = await rawAll<any>(`SELECT id, kode_nota as number, total_amount as nominal FROM ar_advances WHERE customer_id = $1 ORDER BY id`, [body.customerId])
            let remainingPay = payAmount
            for (const adv of advances) {
              if (remainingPay <= 0) break
              const usedRow = await rawGet<any>(`
                SELECT COALESCE(SUM(pi.pay_amount),0) AS used
                FROM ar_payment_items pi
                JOIN ar_payments p ON p.id = pi.payment_id AND p.status <> 'void'
                WHERE pi.source_type = 'ar_advance' AND pi.source_id = $1
              `, [adv.id])
              const remaining = Math.max(0, Number(adv.nominal||0) - Number(usedRow?.used||0))
              if (remaining <= 0) continue
              const alloc = Math.min(remainingPay, remaining)
              await rawRun(`
                INSERT INTO ar_payment_items (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
                VALUES ($1, 0, $2, $3, $4, $5, 'ar_advance', $6)
              `, [paymentId, adv.number, remaining, alloc, d?.remarks || null, adv.id])
              remainingPay -= alloc
            }
            if (remainingPay > 0.01) throw new Error('Saldo uang muka customer tidak mencukupi')
          }
        } else {
          throw new Error(`Unsupported source_type: ${st}`)
        }
      }

      for (const m of methods) {
        await rawRun(`
          INSERT INTO ar_payment_methods (payment_id, account_id, account_code, account_name, amount, notes) VALUES ($1, $2, $3, $4, $5, $6)
        `, [paymentId, Number(m.accountId||m.account_id), m?.accountCode||m?.account_code||null, m?.accountName||m?.account_name||null, Number(m.amount||0), m?.notes || null])
      }

      for (const e of extras) {
        await rawRun(`
          INSERT INTO ar_payment_extras (payment_id, account_id, notes, debit, credit) VALUES ($1, $2, $3, $4, $5)
        `, [paymentId, Number(e.accountId||e.account_id), e?.notes || null, Number(e.debit||0), Number(e.credit||0)])
      }

      if (overpayment > 0.005) {
        const advYear = new Date(paymentDate).getFullYear()
        const advRows = await rawAll<any>('SELECT kode_nota FROM ar_advances WHERE kode_nota LIKE $1', [`UC/${advYear}/%`])
        let advMax = 0
        for (const r of advRows) {
          const m = /^UC\/(\d{4})\/(\d+)$/.exec(r.kode_nota || '')
          if (m) { const n = Number(m[2]); if (!Number.isNaN(n) && n > advMax) advMax = n }
        }
        const advNumber = `UC/${advYear}/${(advMax + 1).toString().padStart(6, '0')}`

        const advRes = await pool.query(`
          INSERT INTO ar_advances (kode_nota, tanggal, customer_id, total_amount, period_id, notes, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'active')
          RETURNING id
        `, [advNumber, paymentDate, customerId, overpayment, period.id, `Auto-created from ${finalPaymentNumber}`])
        const advId = Number(advRes.rows[0].id)

        let lineNo = 0
        for (const m of methods) {
          const proportion = Number(m.amount||0) / totalMethods
          const lineAmount = Math.round(proportion * overpayment * 100) / 100
          if (lineAmount > 0) {
            lineNo++
            await rawRun(`
              INSERT INTO ar_advance_lines (ar_advance_id, advance_id, line_no, account_id, account_code, amount, notes)
              VALUES ($1, $1, $2, $3, $4, $5, $6)
            `, [advId, lineNo, Number(m.accountId||m.account_id), String(m.accountCode||m.account_code||''), lineAmount, `Auto from ${finalPaymentNumber}`])
          }
        }
      }

      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    // Save journal entries for AR payment
    try {
      const arEntries = await generateEntriesForSingleSource('Terima Piutang', finalPaymentNumber, paymentDate)
      if (arEntries.length > 0) {
        await saveJournalEntriesForSource('Terima Piutang', Number(paymentId), finalPaymentNumber, paymentDate, arEntries)
      }
    } catch (e) {
      console.warn('[AR Payment] failed to save journal entries:', e)
    }

    return NextResponse.json({ success: true, id: Number(paymentId), paymentNumber: finalPaymentNumber })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to save AR payment', details: e?.message }, { status: 500 })
  }
}
