import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { getUserId } from '@/lib/audit'
import { generateEntriesForSingleSource, saveJournalEntriesForSource, deleteJournalEntriesForSource } from '@/lib/journalHelpers'

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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    if (!id) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 })
    }

    await ensureArPaymentTables()

    const payment = await rawGet<any>(`
      SELECT 
        p.*,
        c.name as customer_name
      FROM ar_payments p
      LEFT JOIN master_customer c ON p.customer_id = c.id
      WHERE p.id = $1
    `, [id])

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    let items = await rawAll<any>(`
      SELECT * FROM ar_payment_items WHERE payment_id = $1 ORDER BY id
    `, [id])

    // Fallback for auto-created payments with no items (legacy data before auto-creation fix)
    const isAutoCreated = Number(payment.auto_created) === 1
    if (isAutoCreated && items.length === 0) {
      let tx: any = null
      // Try to find transaction from notes field (format: "Auto: {name} - {transactionNumber}")
      if (payment.notes) {
        const match = payment.notes.match(/- (.+)$/)
        const txNumber = match ? match[1].trim() : null
        if (txNumber) {
          tx = await rawGet<any>(`SELECT id, transaction_number, transaction_date, total FROM transactions WHERE transaction_number = $1`, [txNumber])
        }
      }
      // Fallback: find transaction by customer_id and date
      if (!tx) {
        tx = await rawGet<any>(`SELECT id, transaction_number, transaction_date, total FROM transactions WHERE customer_id = $1 AND transaction_date::date = $2::date ORDER BY id DESC LIMIT 1`, [payment.customer_id, payment.payment_date])
      }
      if (tx) {
        items = [{
          id: null, payment_id: id, sale_id: tx.id, invoice_number: tx.transaction_number,
          due_amount: tx.total, pay_amount: tx.total, remarks: null, source_type: 'transaction', source_id: tx.id,
        }]
      }
    }

    const enrichedItems: any[] = []
    for (const d of items) {
      let invoiceNumber = d.invoice_number || ''
      let invoiceDate = ''
      let totalAmount: number | undefined
      if (d.source_type === 'transaction' || d.source_type === 'sales_return') {
        const lookupId = Number(d.source_id) || Number(d.sale_id)
        const tx = await rawGet<any>(`SELECT transaction_number, transaction_date FROM transactions WHERE id = $1`, [lookupId])
        if (tx) {
          invoiceNumber = tx.transaction_number || invoiceNumber
          invoiceDate = tx.transaction_date || ''
        }
      } else if (d.source_type === 'ar_opening') {
        const op = await rawGet<any>(`SELECT kode_nota, tanggal FROM ar_opening_balances WHERE id = $1`, [Number(d.source_id)])
        if (op) {
          invoiceNumber = op.kode_nota || invoiceNumber
          invoiceDate = op.tanggal || ''
        }
      } else if (d.source_type === 'ar_advance') {
        const adv = await rawGet<any>(`SELECT kode_nota, tanggal, total_amount FROM ar_advances WHERE id = $1`, [Number(d.source_id)])
        if (adv) {
          invoiceNumber = adv.kode_nota || invoiceNumber
          invoiceDate = adv.tanggal || ''
          totalAmount = Number(adv.total_amount || 0)
        }
      }
      const base: any = {
        id: d.source_type === 'ar_advance' ? d.source_id : (d.sale_id || d.source_id),
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_amount: Number(d.due_amount || 0),
        pay_amount: Number(d.pay_amount || 0),
        remarks: d.remarks,
        source_type: d.source_type,
        source_id: d.source_id,
      }
      if (totalAmount !== undefined) base.total_amount = totalAmount
      enrichedItems.push(base)
    }

    let methods = await rawAll<any>(`
      SELECT * FROM ar_payment_methods WHERE payment_id = $1 ORDER BY id
    `, [id])

    // Fallback for auto-created payments with no methods (legacy data)
    if (isAutoCreated && methods.length === 0 && enrichedItems.length > 0) {
      const saleId = enrichedItems[0]?.source_id || enrichedItems[0]?.id
      if (saleId) {
        const tps = await rawAll<any>(`SELECT method, amount, bank_id FROM transaction_payments WHERE transaction_id = $1 ORDER BY id`, [saleId])
        for (const tp of tps) {
          const m = String(tp.method).toLowerCase()
          let accountId = null
          if (m === 'cash' || m === 'tunai') {
            const mapping = await rawGet<any>(`SELECT account_id FROM account_mappings WHERE map_group = 'pelanggan' AND map_key = 'default_cash_account'`)
            accountId = mapping?.account_id ?? null
            if (!accountId) {
              const cashAcc = await rawGet<any>(`SELECT id FROM accounts WHERE is_cash = 1 AND is_active = 1 ORDER BY code LIMIT 1`)
              accountId = cashAcc?.id ?? null
            }
          } else if (tp.bank_id) {
            const bank = await rawGet<any>(`SELECT account_id FROM master_banks WHERE id = $1 AND account_id IS NOT NULL`, [tp.bank_id])
            accountId = bank?.account_id ?? null
            if (!accountId) {
              const bankAcc = await rawGet<any>(`SELECT id FROM accounts WHERE is_bank_account = 1 AND is_active = 1 ORDER BY code LIMIT 1`)
              accountId = bankAcc?.id ?? null
            }
          } else {
            const bankAcc = await rawGet<any>(`SELECT id FROM accounts WHERE is_bank_account = 1 AND is_active = 1 ORDER BY code LIMIT 1`)
            accountId = bankAcc?.id ?? null
          }
          let accCode = null, accName = null
          if (accountId) {
            const acc = await rawGet<any>(`SELECT code, name FROM accounts WHERE id = $1`, [accountId])
            if (acc) { accCode = acc.code; accName = acc.name }
          }
          methods.push({
            id: null, payment_id: id, account_id: accountId,
            account_code: accCode, account_name: accName,
            amount: tp.amount, notes: null,
          })
        }
      }
    }

    const extras = await rawAll<any>(`
      SELECT * FROM ar_payment_extras WHERE payment_id = $1 ORDER BY id
    `, [id])

    return NextResponse.json({
      ...payment,
      detail: enrichedItems,
      methods,
      extras
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch AR payment', details: e?.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    if (!id) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 })
    }

    const body = await request.json()
    const { payment_number, payment_date, customer_id, notes, advanceTotal = 0, details = [], methods = [], extras = [] } = body

    await ensureArPaymentTables()

    const existing = await rawGet<any>('SELECT * FROM ar_payments WHERE id = $1', [id])
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (existing.status === 'void') {
      return NextResponse.json({ error: 'Cannot edit voided payment' }, { status: 400 })
    }

    if (Number(existing.auto_created) === 1) {
      return NextResponse.json({ error: 'Cannot edit auto-created payment' }, { status: 400 })
    }

    const period = await getPeriodByDate(payment_date || existing.payment_date)
    if (!period) {
      return NextResponse.json({ error: 'No active period found for this date' }, { status: 400 })
    }
    if (Number(period.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${period.name}' sudah ditutup.` }, { status: 400 })
    }

    const subtotal = details.reduce((sum: number, d: any) => {
      const amt = Number(d.pay_amount || d.payAmount || 0)
      const st = String(d.source_type || d.sourceType || '').toLowerCase()
      if (st === 'ar_advance') return sum
      const sign = (st === 'sales_return') ? -1 : 1
      return sum + (sign * Math.abs(amt))
    }, 0)
    const advanceTotalVal = Math.max(0, Number(advanceTotal))
    const totalMethods = methods.reduce((sum: number, m: any) => sum + Number(m.amount || 0), 0)
    const totalExtraDebit = extras.reduce((sum: number, e: any) => sum + Number(e.debit || 0), 0)
    const totalExtraCredit = extras.reduce((sum: number, e: any) => sum + Number(e.credit || 0), 0)
    const expectedMethods = subtotal - advanceTotalVal + totalExtraDebit - totalExtraCredit

    if (Math.abs(expectedMethods - totalMethods) > 0.0001) {
      return NextResponse.json({
        error: `AR formula mismatch: Methods (${totalMethods}) should equal Detail (${subtotal}) - UangMuka (${advanceTotalVal}) + Debit (${totalExtraDebit}) - Credit (${totalExtraCredit}) = ${expectedMethods}`
      }, { status: 400 })
    }

    const total = totalMethods
    const userId = getUserId(request)

    await pool.query('BEGIN')
    try {
      await pool.query(`
        UPDATE ar_payments 
        SET payment_number = $1, payment_date = $2, customer_id = $3, period_id = $4, 
            subtotal = $5, total = $6, notes = $7, user_update = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
      `, [
        payment_number || existing.payment_number,
        payment_date || existing.payment_date,
        customer_id || existing.customer_id,
        period.id,
        subtotal,
        total,
        notes !== undefined ? notes : existing.notes,
        userId,
        id
      ])

      await rawRun('DELETE FROM ar_payment_items WHERE payment_id = $1', [id])
      await rawRun('DELETE FROM ar_payment_methods WHERE payment_id = $1', [id])
      await rawRun('DELETE FROM ar_payment_extras WHERE payment_id = $1', [id])

      for (const d of details) {
        const st = String(d.source_type || d.sourceType || 'transaction')
        if (st === 'transaction') {
          const tx = await rawGet<any>(`SELECT id, transaction_number, total FROM transactions WHERE id = $1`, [Number(d.source_id || d.sourceId || d.id)])
          if (!tx) throw new Error('Invoice (transaction) not found')
          const paidRow = await rawGet<any>(`
            SELECT COALESCE(SUM(si.pay_amount),0) AS paid
            FROM ar_payment_items si 
            JOIN ar_payments sp ON si.payment_id = sp.id AND sp.status = 'active'
            WHERE (si.sale_id = $1 OR (si.source_type='transaction' AND si.source_id = $2))
          `, [tx.id, tx.id])
          const alreadyPaid = Number(paidRow?.paid || 0)
          const outstanding = Math.max(0, Number(tx.total||0) - alreadyPaid)
          const payAmount = Math.min(Number(d.pay_amount || d.payAmount || 0), outstanding)
          await rawRun(`
            INSERT INTO ar_payment_items (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
            VALUES ($1, $2, $3, $4, $5, $6, 'transaction', $7)
          `, [id, tx.id, tx.transaction_number, outstanding, payAmount, d?.remarks || null, tx.id])
        } else if (st === 'ar_opening') {
          const op = await rawGet<any>(`SELECT id, kode_nota as number, nominal FROM ar_opening_balances WHERE id = $1`, [Number(d.source_id || d.sourceId)])
          if (!op) throw new Error('Saldo awal piutang tidak ditemukan')
          const paidRow = await rawGet<any>(`
            SELECT COALESCE(SUM(si.pay_amount),0) AS paid
            FROM ar_payment_items si 
            JOIN ar_payments sp ON si.payment_id = sp.id AND sp.status = 'active'
            WHERE si.source_type = 'ar_opening' AND si.source_id = $1
          `, [op.id])
          const alreadyPaid = Number(paidRow?.paid || 0)
          const outstanding = Math.max(0, Number(op.nominal||0) - alreadyPaid)
          const payAmount = Math.min(outstanding, Math.max(0, Number(d.pay_amount||d.payAmount||0)))
          await rawRun(`
            INSERT INTO ar_payment_items (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
            VALUES ($1, 0, $2, $3, $4, $5, 'ar_opening', $6)
          `, [id, op.number, outstanding, payAmount, d?.remarks || null, op.id])
        } else if (st === 'sales_return') {
          const ret = await rawGet<any>(`SELECT id, transaction_number as number, total FROM transactions WHERE id = $1 AND is_return = 1`, [Number(d.source_id || d.sourceId)])
          if (!ret) throw new Error('Retur penjualan tidak ditemukan')
          const allocatedRow = await rawGet<any>(`
            SELECT COALESCE(SUM(si.pay_amount),0) AS used
            FROM ar_payment_items si 
            JOIN ar_payments sp ON si.payment_id = sp.id AND sp.status = 'active'
            WHERE si.source_type = 'sales_return' AND si.source_id = $1
          `, [ret.id])
          const nominal = Math.abs(Number(ret.total||0))
          const remaining = Math.max(0, nominal - Number(allocatedRow?.used||0))
          const payAmount = Math.min(remaining, Math.max(0, Number(d.pay_amount||d.payAmount||0)))
          await rawRun(`
            INSERT INTO ar_payment_items (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
            VALUES ($1, 0, $2, $3, $4, $5, 'sales_return', $6)
          `, [id, ret.number, remaining, payAmount, d?.remarks || null, ret.id])
        } else if (st === 'ar_advance') {
          const advId = Number(d.source_id || d.sourceId || d.id)
          let payAmount = Math.max(0, Number(d.pay_amount||d.payAmount||0))
          if (advId > 0) {
            const adv = await rawGet<any>(`SELECT id, kode_nota as number, total_amount as nominal FROM ar_advances WHERE id = $1`, [advId])
            if (!adv) throw new Error('Uang muka customer tidak ditemukan')
            const usedRow = await rawGet<any>(`
              SELECT COALESCE(SUM(pi.pay_amount),0) AS used
              FROM ar_payment_items pi
              JOIN ar_payments p ON p.id = pi.payment_id AND p.status <> 'void'
              WHERE pi.source_type = 'ar_advance' AND pi.source_id = $1 AND pi.payment_id <> $2
            `, [adv.id, id])
            const remaining = Math.max(0, Number(adv.nominal||0) - Number(usedRow?.used||0))
            payAmount = Math.min(payAmount, remaining)
            await rawRun(`
              INSERT INTO ar_payment_items (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
              VALUES ($1, 0, $2, $3, $4, $5, 'ar_advance', $6)
            `, [id, adv.number, remaining, payAmount, d?.remarks || null, adv.id])
          } else if (payAmount > 0) {
            const advances = await rawAll<any>(`SELECT id, kode_nota as number, total_amount as nominal FROM ar_advances WHERE customer_id = $1 ORDER BY id`, [customer_id])
            let remainingPay = payAmount
            for (const adv of advances) {
              if (remainingPay <= 0) break
              const usedRow = await rawGet<any>(`
                SELECT COALESCE(SUM(pi.pay_amount),0) AS used
                FROM ar_payment_items pi
                JOIN ar_payments p ON p.id = pi.payment_id AND p.status <> 'void'
                WHERE pi.source_type = 'ar_advance' AND pi.source_id = $1 AND pi.payment_id <> $2
              `, [adv.id, id])
              const remaining = Math.max(0, Number(adv.nominal||0) - Number(usedRow?.used||0))
              if (remaining <= 0) continue
              const alloc = Math.min(remainingPay, remaining)
              await rawRun(`
                INSERT INTO ar_payment_items (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
                VALUES ($1, 0, $2, $3, $4, $5, 'ar_advance', $6)
              `, [id, adv.number, remaining, alloc, d?.remarks || null, adv.id])
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
        `, [id, Number(m.accountId||m.account_id), m?.accountCode||m?.account_code||null, m?.accountName||m?.account_name||null, Number(m.amount||0), m?.notes || null])
      }

      for (const e of extras) {
        await rawRun(`
          INSERT INTO ar_payment_extras (payment_id, account_id, notes, debit, credit) VALUES ($1, $2, $3, $4, $5)
        `, [id, Number(e.accountId||e.account_id), e?.notes || null, Number(e.debit||0), Number(e.credit||0)])
      }

      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    // Re-generate journal entries for edited AR payment
    try {
      const arRow = await rawGet<any>('SELECT id, payment_number, payment_date FROM ar_payments WHERE id = $1', [id])
      if (arRow) {
        deleteJournalEntriesForSource('Terima Piutang', id)
        const entries = await generateEntriesForSingleSource('Terima Piutang', arRow.payment_number || '', arRow.payment_date || '')
        if (entries.length > 0) {
          await saveJournalEntriesForSource('Terima Piutang', id, arRow.payment_number || '', arRow.payment_date || '', entries)
        }
      }
    } catch (e) {
      console.warn('[AR Payment Edit] failed to save journal entries:', e)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to update AR payment', details: e?.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    if (!id) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 })
    }

    await ensureArPaymentTables()

    const existing = await rawGet<any>('SELECT * FROM ar_payments WHERE id = $1', [id])
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (existing.status === 'void') {
      return NextResponse.json({ error: 'Payment already voided' }, { status: 400 })
    }

    const delPeriod = await getPeriodByDate(existing.payment_date)
    if (!delPeriod) {
      return NextResponse.json({ error: 'Periode tidak ditemukan untuk tanggal pembayaran' }, { status: 400 })
    }
    if (Number(delPeriod.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${delPeriod.name}' sudah ditutup, tidak dapat void pembayaran.` }, { status: 400 })
    }

    const userId = getUserId(request)

    await rawRun(`
      UPDATE ar_payments 
      SET status = 'void', user_update = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [userId, id])

    try {
      deleteJournalEntriesForSource('Terima Piutang', id)
    } catch (e) {
      console.warn('[AR Payment Delete Void] failed to delete journal entries:', e)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to void AR payment', details: e?.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    if (!id) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 })
    }

    const url = new URL(request.url)
    const qpVoid = url.searchParams.get('void')
    const qpVoidFlag = (qpVoid === '1' || (qpVoid||'').toLowerCase() === 'true')

    if (qpVoidFlag) {
      await ensureArPaymentTables()

      const existing = await rawGet<any>('SELECT id, status, payment_date FROM ar_payments WHERE id = $1', [id])
      if (!existing) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }

      if (existing.status === 'void') {
        return NextResponse.json({ error: 'Payment already voided' }, { status: 400 })
      }

      const period = await getPeriodByDate(existing.payment_date)
      if (!period) {
        return NextResponse.json({ error: 'Periode belum dibuat untuk tanggal ini' }, { status: 400 })
      }
      if (Number(period.is_closed) === 1) {
        return NextResponse.json({ error: `Periode '${period.name}' sudah ditutup` }, { status: 400 })
      }

      const userId = getUserId(request)

      const result = await rawRun(`
        UPDATE ar_payments 
        SET status = 'void', void = 1, user_update = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [userId, id])

      console.log('Void AR result:', { changes: result.rowCount })

      if (result.rowCount === 0) {
        return NextResponse.json({ error: 'No rows updated - payment might already be void' }, { status: 400 })
      }

      try {
        deleteJournalEntriesForSource('Terima Piutang', id)
      } catch (e) {
        console.warn('[AR Payment Void] failed to delete journal entries:', e)
      }

      return NextResponse.json({ success: true, changes: result.rowCount })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to update AR payment', details: e?.message }, { status: 500 })
  }
}
