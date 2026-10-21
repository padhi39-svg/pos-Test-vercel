import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { getUserId } from '@/lib/audit'
import { generateEntriesForSingleSource, saveJournalEntriesForSource, deleteJournalEntriesForSource } from '@/lib/journalHelpers'

async function ensureApTables() {
  const pool = (getDb() as any).$client
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ap_payments (
      id SERIAL PRIMARY KEY,
      payment_number TEXT UNIQUE,
      payment_date TEXT,
      supplier_id INTEGER NOT NULL,
      period_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      void INTEGER DEFAULT 0,
      subtotal REAL DEFAULT 0,
      total REAL DEFAULT 0,
      notes TEXT,
      user_create INTEGER,
      user_update INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ap_payment_items (
      id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL,
      purchase_id INTEGER NOT NULL,
      invoice_number TEXT,
      due_amount REAL DEFAULT 0,
      pay_amount REAL DEFAULT 0,
      remarks TEXT,
      source_type TEXT,
      source_id INTEGER DEFAULT 0,
      FOREIGN KEY (payment_id) REFERENCES ap_payments(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ap_payment_methods (
      id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (payment_id) REFERENCES ap_payments(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS ap_payment_extras (
      id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      notes TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      FOREIGN KEY (payment_id) REFERENCES ap_payments(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
  `)
  await rawRun('ALTER TABLE ap_payments ADD COLUMN IF NOT EXISTS void INTEGER DEFAULT 0').catch(()=>{})
  await rawRun('ALTER TABLE ap_payments ADD COLUMN IF NOT EXISTS subtotal REAL DEFAULT 0').catch(()=>{})
  await rawRun('ALTER TABLE ap_payments ADD COLUMN IF NOT EXISTS total REAL DEFAULT 0').catch(()=>{})
}

const pool = (getDb() as any).$client

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id || 0) || 0
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    await ensureApTables()

    const payment = await rawGet<any>(`
      SELECT p.*, s.name AS supplier_name
      FROM ap_payments p
      LEFT JOIN master_supplier s ON s.id = p.supplier_id
      WHERE p.id = $1
    `, [id])

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const detail = await rawAll<any>(`
      SELECT pi.*
      FROM ap_payment_items pi
      WHERE pi.payment_id = $1
      ORDER BY pi.id
    `, [id])

    const methods = await rawAll<any>(`
      SELECT pm.*, a.code AS account_code, a.name AS account_name
      FROM ap_payment_methods pm
      LEFT JOIN accounts a ON a.id = pm.account_id
      WHERE pm.payment_id = $1
      ORDER BY pm.id
    `, [id])

    const extras = await rawAll<any>(`
      SELECT pe.*, a.code AS account_code, a.name AS account_name
      FROM ap_payment_extras pe
      LEFT JOIN accounts a ON a.id = pe.account_id
      WHERE pe.payment_id = $1
      ORDER BY pe.id
    `, [id])

    const enrichedDetail: any[] = []
    for (const d of detail) {
      let invoiceNumber = d.invoice_number || ''
      let invoiceDate = ''
      let totalAmount: number | undefined
      if (d.source_type === 'purchase' || d.source_type === 'purchase_return') {
        const lookupId = Number(d.source_id) || Number(d.purchase_id)
        const pr = await rawGet<any>(`SELECT purchase_number, invoice_number, purchase_date FROM purchases WHERE id = $1`, [lookupId])
        if (pr) {
          invoiceNumber = pr.purchase_number || invoiceNumber
          invoiceDate = pr.purchase_date || ''
        }
      } else if (d.source_type === 'ap_opening') {
        const op = await rawGet<any>(`SELECT kode_nota FROM ap_opening_balances WHERE id = $1`, [Number(d.source_id)])
        if (op) invoiceNumber = op.kode_nota || invoiceNumber
      } else if (d.source_type === 'ap_advance') {
        const adv = await rawGet<any>(`SELECT kode_nota, total_amount FROM ap_advances WHERE id = $1`, [Number(d.source_id)])
        if (adv) {
          invoiceNumber = adv.kode_nota || invoiceNumber
          totalAmount = Number(adv.total_amount || 0)
        }
      }
      const base: any = {
        id: d.source_type === 'ap_advance' ? d.source_id : (d.purchase_id || d.source_id),
        invoice_number: invoiceNumber,
        invoice_supplier_number: '',
        invoice_date: invoiceDate,
        due_amount: Number(d.due_amount || 0),
        pay_amount: Number(d.pay_amount || 0),
        remarks: d.remarks,
        source_type: d.source_type,
        source_id: d.source_id,
      }
      if (totalAmount !== undefined) base.total_amount = totalAmount
      enrichedDetail.push(base)
    }

    const result = {
      ...payment,
      detail: enrichedDetail,
      methods: methods.map((m: any) => ({
        temp_id: String(m.account_id),
        account_id: m.account_id,
        account_code: m.account_code,
        account_name: m.account_name,
        amount: Number(m.amount || 0),
        notes: m.notes
      })),
      extras: extras.map((e: any) => ({
        temp_id: String(e.id),
        account_id: e.account_id,
        account_code: e.account_code,
        account_name: e.account_name,
        notes: e.notes,
        debit: Number(e.debit || 0),
        credit: Number(e.credit || 0)
      }))
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to get AP payment', details: e?.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id || 0) || 0
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const body = await req.json()
    const supplierId = Number(body?.supplier_id)
    const paymentDate = String(body?.payment_date || new Date().toISOString().slice(0,10)).slice(0,10)
    const details = Array.isArray(body?.detail || body?.details) ? (body.detail || body.details) : []
    const methods = Array.isArray(body?.methods) ? body.methods : []
    const extras = Array.isArray(body?.extras) ? body.extras : []

    if (!supplierId) return NextResponse.json({ error: 'supplier_id required' }, { status: 400 })

    await ensureApTables()

    const existing = await rawGet<any>(`SELECT id, status FROM ap_payments WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    if (existing.status === 'void') return NextResponse.json({ error: 'Cannot edit voided payment' }, { status: 400 })

    const period = await getPeriodByDate(paymentDate)
    if (!period) return NextResponse.json({ error: 'Periode belum dibuat untuk tanggal ini' }, { status: 400 })
    if (Number(period.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${period.name}' sudah ditutup` }, { status: 400 })
    }

    const subtotal = details.reduce((a:number,b:any)=> {
      const amt = Number(b.pay_amount||b.payAmount)||0
      const st = String(b.source_type||b.sourceType||'').toLowerCase()
      if (st === 'ap_advance') return a
      const sign = (st === 'purchase_return') ? -1 : 1
      return a + (sign * Math.abs(amt))
    }, 0)
    const advanceTotal = Math.max(0, Number(body?.advanceTotal||body?.advance_total||0))
    const totalExtraDebit = extras.reduce((a:number,b:any)=> a + (Number(b.debit)||0), 0)
    const totalExtraCredit = extras.reduce((a:number,b:any)=> a + (Number(b.credit)||0), 0)
    const expectedMethods = subtotal - advanceTotal + totalExtraDebit - totalExtraCredit
    const total = methods.reduce((a:number,b:any)=> a + (Number(b.amount)||0), 0)
    if (Math.abs(expectedMethods - total) > 0.0001) {
      return NextResponse.json({ error: 'Total metode harus sama dengan (Total Bayar - Uang Muka + Debit Lain-lain - Kredit Lain-lain)' }, { status: 400 })
    }

    const userId = getUserId(req)

    await pool.query('BEGIN')
    try {
      await pool.query(`
        UPDATE ap_payments 
        SET payment_date = $1, supplier_id = $2, period_id = $3, subtotal = $4, total = $5, notes = $6, user_update = $7, updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
      `, [paymentDate, supplierId, period.id, subtotal, total, body?.notes || null, userId, id])

      await rawRun(`DELETE FROM ap_payment_items WHERE payment_id = $1`, [id])
      await rawRun(`DELETE FROM ap_payment_methods WHERE payment_id = $1`, [id])
      await rawRun(`DELETE FROM ap_payment_extras WHERE payment_id = $1`, [id])

      for (const d of details) {
        const st = String(d.source_type || d.sourceType || 'purchase')
        if (st === 'purchase') {
          const pr = await rawGet<any>(`SELECT id, purchase_number, total FROM purchases WHERE id = $1`, [Number(d.id || d.source_id)])
          if (!pr) throw new Error('Purchase not found')
          const paidRow = await rawGet<any>(`
            SELECT COALESCE(SUM(pi.pay_amount),0) AS paid
            FROM ap_payment_items pi
            JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
            WHERE (pi.purchase_id = $1 OR (pi.source_type='purchase' AND pi.source_id = $2)) AND pi.payment_id <> $3
          `, [pr.id, pr.id, id])
          const paid = Number(paidRow?.paid||0)
          const outstanding = Math.max(0, Number(pr.total||0) - paid)
          const payAmount = Math.max(0, Math.min(Number(d.pay_amount||d.payAmount||0), outstanding))
          await rawRun(`
            INSERT INTO ap_payment_items (payment_id, purchase_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
            VALUES ($1, $2, $3, $4, $5, $6, 'purchase', $7)
          `, [id, pr.id, pr.purchase_number, outstanding, payAmount, d?.remarks || null, pr.id])
        } else if (st === 'ap_opening') {
          const op = await rawGet<any>(`SELECT id, kode_nota as number, nominal FROM ap_opening_balances WHERE id = $1`, [Number(d.source_id || d.id)])
          if (!op) throw new Error('Saldo awal hutang tidak ditemukan')
          const usedRow = await rawGet<any>(`
            SELECT COALESCE(SUM(pi.pay_amount),0) AS used
            FROM ap_payment_items pi
            JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
            WHERE pi.source_type = 'ap_opening' AND pi.source_id = $1 AND pi.payment_id <> $2
          `, [op.id, id])
          const remaining = Math.max(0, Number(op.nominal||0) - Number(usedRow?.used||0))
          const payAmount = Math.min(remaining, Math.max(0, Number(d.pay_amount||d.payAmount||0)))
          await rawRun(`
            INSERT INTO ap_payment_items (payment_id, purchase_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
            VALUES ($1, 0, $2, $3, $4, $5, 'ap_opening', $6)
          `, [id, op.number, remaining, payAmount, d?.remarks || null, op.id])
        } else if (st === 'purchase_return') {
          const ret = await rawGet<any>(`SELECT id, purchase_number as number, total, is_return FROM purchases WHERE id = $1 AND is_return = 1`, [Number(d.source_id || d.id)])
          if (!ret) throw new Error('Retur pembelian tidak ditemukan')
          const usedRow = await rawGet<any>(`
            SELECT COALESCE(SUM(pi.pay_amount),0) AS used
            FROM ap_payment_items pi
            JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
            WHERE pi.source_type = 'purchase_return' AND pi.source_id = $1 AND pi.payment_id <> $2
          `, [ret.id, id])
          const nominal = Math.abs(Number(ret.total||0))
          const remaining = Math.max(0, nominal - Number(usedRow?.used||0))
          const payAmount = Math.min(remaining, Math.max(0, Number(d.pay_amount||d.payAmount||0)))
          await rawRun(`
            INSERT INTO ap_payment_items (payment_id, purchase_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
            VALUES ($1, 0, $2, $3, $4, $5, 'purchase_return', $6)
          `, [id, ret.number, remaining, payAmount, d?.remarks || null, ret.id])
        } else if (st === 'ap_advance') {
          const advId = Number(d.source_id || d.id)
          let payAmount = Math.max(0, Number(d.pay_amount||d.payAmount||0))
          if (advId > 0) {
            const adv = await rawGet<any>(`SELECT id, kode_nota as number, total_amount as nominal FROM ap_advances WHERE id = $1`, [advId])
            if (!adv) throw new Error('Uang muka supplier tidak ditemukan')
            const usedRow = await rawGet<any>(`
              SELECT COALESCE(SUM(pi.pay_amount),0) AS used
              FROM ap_payment_items pi
              JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
              WHERE pi.source_type = 'ap_advance' AND pi.source_id = $1 AND pi.payment_id <> $2
            `, [adv.id, id])
            const remaining = Math.max(0, Number(adv.nominal||0) - Number(usedRow?.used||0))
            payAmount = Math.min(payAmount, remaining)
            await rawRun(`
              INSERT INTO ap_payment_items (payment_id, purchase_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
              VALUES ($1, 0, $2, $3, $4, $5, 'ap_advance', $6)
            `, [id, adv.number, remaining, payAmount, d?.remarks || null, adv.id])
          } else if (payAmount > 0) {
            const advances = await rawAll<any>(`SELECT id, kode_nota as number, total_amount as nominal FROM ap_advances WHERE supplier_id = $1 ORDER BY id`, [supplierId])
            let remainingPay = payAmount
            for (const adv of advances) {
              if (remainingPay <= 0) break
              const usedRow = await rawGet<any>(`
                SELECT COALESCE(SUM(pi.pay_amount),0) AS used
                FROM ap_payment_items pi
                JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
                WHERE pi.source_type = 'ap_advance' AND pi.source_id = $1 AND pi.payment_id <> $2
              `, [adv.id, id])
              const remaining = Math.max(0, Number(adv.nominal||0) - Number(usedRow?.used||0))
              if (remaining <= 0) continue
              const alloc = Math.min(remainingPay, remaining)
              await rawRun(`
                INSERT INTO ap_payment_items (payment_id, purchase_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
                VALUES ($1, 0, $2, $3, $4, $5, 'ap_advance', $6)
              `, [id, adv.number, remaining, alloc, d?.remarks || null, adv.id])
              remainingPay -= alloc
            }
            if (remainingPay > 0.01) throw new Error('Saldo uang muka supplier tidak mencukupi')
          }
        } else {
          throw new Error(`Unsupported source_type: ${st}`)
        }
      }

      for (const m of methods) {
        await rawRun(`
          INSERT INTO ap_payment_methods (payment_id, account_id, amount, notes) VALUES ($1, $2, $3, $4)
        `, [id, Number(m.account_id||m.accountId), Number(m.amount||0), m?.notes || null])
      }

      for (const e of extras) {
        await rawRun(`
          INSERT INTO ap_payment_extras (payment_id, account_id, notes, debit, credit) VALUES ($1, $2, $3, $4, $5)
        `, [id, Number(e.account_id||e.accountId), e?.notes || null, Number(e.debit||0), Number(e.credit||0)])
      }

      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    // Re-generate journal entries for edited AP payment
    try {
      const apRow = await rawGet<any>(`SELECT id, payment_number, payment_date FROM ap_payments WHERE id = $1`, [id])
      if (apRow) {
        deleteJournalEntriesForSource('Bayar Hutang', id)
        const entries = await generateEntriesForSingleSource('Bayar Hutang', apRow.payment_number || '', apRow.payment_date || '')
        if (entries.length > 0) {
          await saveJournalEntriesForSource('Bayar Hutang', id, apRow.payment_number || '', apRow.payment_date || '', entries)
        }
      }
    } catch (e) {
      console.warn('[AP Payment Edit] failed to save journal entries:', e)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to update AP payment', details: e?.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id || 0) || 0
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const url = new URL(req.url)
    const qpVoid = url.searchParams.get('void')
    const qpVoidFlag = (qpVoid === '1' || (qpVoid||'').toLowerCase() === 'true')

    if (qpVoidFlag) {
      await ensureApTables()

      const existing = await rawGet<any>(`SELECT id, status, payment_date FROM ap_payments WHERE id = $1`, [id])
      if (!existing) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      if (existing.status === 'void') return NextResponse.json({ error: 'Payment already voided' }, { status: 400 })

      const period = await getPeriodByDate(existing.payment_date)
      if (!period) return NextResponse.json({ error: 'Periode belum dibuat untuk tanggal ini' }, { status: 400 })
      if (Number(period.is_closed) === 1) {
        return NextResponse.json({ error: `Periode '${period.name}' sudah ditutup` }, { status: 400 })
      }

      const userId = getUserId(req)

      const result = await rawRun(`
        UPDATE ap_payments 
        SET status = 'void', void = 1, user_update = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [userId, id])

      console.log('Void result:', { changes: result.rowCount })

      if (result.rowCount === 0) {
        return NextResponse.json({ error: 'No rows updated - payment might already be void' }, { status: 400 })
      }

      try {
        deleteJournalEntriesForSource('Bayar Hutang', id)
      } catch (e) {
        console.warn('[AP Payment Void] failed to delete journal entries:', e)
      }

      return NextResponse.json({ success: true, changes: result.rowCount })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to update AP payment', details: e?.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id || 0) || 0
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    await ensureApTables()

    const existing = await rawGet<any>(`SELECT id, status, payment_date FROM ap_payments WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    if (existing.status === 'void') return NextResponse.json({ error: 'Payment already voided' }, { status: 400 })

    const period = await getPeriodByDate(existing.payment_date)
    if (!period) return NextResponse.json({ error: 'Periode belum dibuat untuk tanggal ini' }, { status: 400 })
    if (Number(period.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${period.name}' sudah ditutup` }, { status: 400 })
    }

    const userId = getUserId(req)

    const result = await rawRun(`
      UPDATE ap_payments 
      SET status = 'void', user_update = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [userId, id])

    console.log('Void result:', { changes: result.rowCount })

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'No rows updated - payment might already be void' }, { status: 400 })
    }

    const updated = await rawGet<any>('SELECT * FROM ap_payments WHERE id = $1', [id])
    return NextResponse.json({ success: true, changes: result.rowCount, payment: updated })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to delete AP payment', details: e?.message }, { status: 500 })
  }
}
