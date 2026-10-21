import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { getUserId } from '@/lib/audit'
import { generateEntriesForSingleSource, saveJournalEntriesForSource } from '@/lib/journalHelpers'

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
  // Backfill columns for existing tables
  await rawRun('ALTER TABLE ap_payments ADD COLUMN IF NOT EXISTS void INTEGER DEFAULT 0').catch(()=>{})
  await rawRun('ALTER TABLE ap_payments ADD COLUMN IF NOT EXISTS subtotal REAL DEFAULT 0').catch(()=>{})
  await rawRun('ALTER TABLE ap_payments ADD COLUMN IF NOT EXISTS total REAL DEFAULT 0').catch(()=>{})
}

const pool = (getDb() as any).$client

export async function GET(req: NextRequest) {
  try {
    await ensureApTables()

    const rows = await rawAll<any>(`
      SELECT p.id, p.payment_number, p.payment_date, p.status, COALESCE(p.void,0) AS void, p.total AS total,
             COALESCE(s.name,'') AS supplier_name
      FROM ap_payments p
      LEFT JOIN master_supplier s ON s.id = p.supplier_id
      LEFT JOIN ap_payment_items pi ON pi.payment_id = p.id
      GROUP BY p.id, s.name
      ORDER BY p.created_at DESC
    `)
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to list AP payments', details: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supplierId = Number(body?.supplierId)
    const paymentDate = String(body?.paymentDate || new Date().toISOString().slice(0,10)).slice(0,10)
    const details = Array.isArray(body?.details) ? body.details : []
    const methods = Array.isArray(body?.methods) ? body.methods : []
    if (!supplierId) return NextResponse.json({ error: 'supplierId required' }, { status: 400 })

    await ensureApTables()

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
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_ap_adv_number UNIQUE (kode_nota)
      )
    `)
    await rawRun(`
      CREATE TABLE IF NOT EXISTS ap_advance_lines (
        id SERIAL PRIMARY KEY,
        ap_advance_id INTEGER NOT NULL,
        line_no INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        account_code TEXT NOT NULL,
        notes TEXT DEFAULT '',
        amount REAL NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ap_advance_id) REFERENCES ap_advances(id) ON DELETE CASCADE
      )
    `)

    const period = await getPeriodByDate(paymentDate)
    if (!period) return NextResponse.json({ error: 'Periode belum dibuat untuk tanggal ini' }, { status: 400 })
    if (Number(period.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${period.name}' sudah ditutup` }, { status: 400 })
    }

    const extras = Array.isArray(body?.extras) ? body.extras : []
    const subtotal = details.reduce((a:number,b:any)=> {
      const amt = Number(b.payAmount||b.pay_amount)||0
      const st = String(b.sourceType||b.source_type||'').toLowerCase()
      if (st === 'ap_advance') return a
      const sign = (st === 'purchase_return') ? -1 : 1
      return a + (sign * Math.abs(amt))
    }, 0)
    const advanceTotal = Math.max(0, Number(body?.advanceTotal||body?.advance_total||0))
    const totalExtraDebit = extras.reduce((a:number,b:any)=> a + (Number(b.debit)||0), 0)
    const totalExtraCredit = extras.reduce((a:number,b:any)=> a + (Number(b.credit)||0), 0)
    const expectedMethods = subtotal - advanceTotal + totalExtraDebit - totalExtraCredit
    const total = methods.reduce((a:number,b:any)=> a + (Number(b.amount)||0), 0)

    let overpayment = 0
    if (total < expectedMethods - 0.0001) {
      return NextResponse.json({ error: 'Total metode pembayaran kurang dari yang dibutuhkan' }, { status: 400 })
    }
    if (total > expectedMethods + 0.0001) {
      overpayment = total - expectedMethods
    }

    const year = new Date(paymentDate).getFullYear()
    const last = await rawGet<any>(`SELECT payment_number FROM ap_payments WHERE payment_number LIKE $1 ORDER BY id DESC LIMIT 1`, [`AP/${year}/%`])
    let seq = 1
    if (last?.payment_number) {
      const parts = String(last.payment_number).split('/')
      const lastSeq = parseInt(parts[2]||'0', 10)
      seq = isNaN(lastSeq) ? 1 : lastSeq + 1
    }
    const paymentNumber = `AP/${year}/${seq.toString().padStart(6, '0')}`

    const userId = getUserId(req)

    let paymentId: number | null = null
    const affectedPurchaseIds: number[] = []

    await pool.query('BEGIN')
    try {
      const ins = await pool.query(`
        INSERT INTO ap_payments (payment_number, payment_date, supplier_id, period_id, status, subtotal, total, notes, user_create, created_at)
        VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING id
      `, [paymentNumber, paymentDate, supplierId, period.id, subtotal, total, body?.notes || null, userId])
      paymentId = Number(ins.rows[0].id)

      for (const d of details) {
        const st = String(d.sourceType || d.source_type || 'purchase')
        if (st === 'purchase') {
          const pr = await rawGet<any>(`SELECT id, purchase_number, total FROM purchases WHERE id = $1`, [Number(d.purchaseId||d.purchase_id||d.sourceId||d.source_id)])
          if (!pr) throw new Error('Purchase not found')
          const paidRow = await rawGet<any>(`
            SELECT COALESCE(SUM(pi.pay_amount),0) AS paid
            FROM ap_payment_items pi
            JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
            WHERE (pi.purchase_id = $1 OR (pi.source_type='purchase' AND pi.source_id = $2))
          `, [pr.id, pr.id])
          const paid = Number(paidRow?.paid||0)
          const outstanding = Math.max(0, Number(pr.total||0) - paid)
          const payAmount = Math.max(0, Math.min(Number(d.payAmount||d.pay_amount||0), outstanding))
          await rawRun(`
            INSERT INTO ap_payment_items (payment_id, purchase_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
            VALUES ($1, $2, $3, $4, $5, $6, 'purchase', $7)
          `, [paymentId, pr.id, pr.purchase_number, outstanding, payAmount, d?.remarks || null, pr.id])
          affectedPurchaseIds.push(Number(pr.id))
        } else if (st === 'ap_opening') {
          const op = await rawGet<any>(`SELECT id, kode_nota as number, nominal FROM ap_opening_balances WHERE id = $1`, [Number(d.sourceId||d.source_id)])
          if (!op) throw new Error('Saldo awal hutang tidak ditemukan')
          const usedRow = await rawGet<any>(`
            SELECT COALESCE(SUM(pi.pay_amount),0) AS used
            FROM ap_payment_items pi
            JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
            WHERE pi.source_type = 'ap_opening' AND pi.source_id = $1
          `, [op.id])
          const remaining = Math.max(0, Number(op.nominal||0) - Number(usedRow?.used||0))
          const payAmount = Math.min(remaining, Math.max(0, Number(d.payAmount||d.pay_amount||0)))
          await rawRun(`
            INSERT INTO ap_payment_items (payment_id, purchase_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
            VALUES ($1, 0, $2, $3, $4, $5, 'ap_opening', $6)
          `, [paymentId, op.number, remaining, payAmount, d?.remarks || null, op.id])
        } else if (st === 'purchase_return') {
          const ret = await rawGet<any>(`SELECT id, purchase_number as number, total, is_return FROM purchases WHERE id = $1 AND is_return = 1`, [Number(d.sourceId||d.source_id)])
          if (!ret) throw new Error('Retur pembelian tidak ditemukan')
          const usedRow = await rawGet<any>(`
            SELECT COALESCE(SUM(pi.pay_amount),0) AS used
            FROM ap_payment_items pi
            JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
            WHERE pi.source_type = 'purchase_return' AND pi.source_id = $1
          `, [ret.id])
          const nominal = Math.abs(Number(ret.total||0))
          const remaining = Math.max(0, nominal - Number(usedRow?.used||0))
          const payAmount = Math.min(remaining, Math.max(0, Number(d.payAmount||d.pay_amount||0)))
          await rawRun(`
            INSERT INTO ap_payment_items (payment_id, purchase_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
            VALUES ($1, 0, $2, $3, $4, $5, 'purchase_return', $6)
          `, [paymentId, ret.number, remaining, payAmount, d?.remarks || null, ret.id])
        } else if (st === 'ap_advance') {
          const advId = Number(d.sourceId||d.source_id)
          let payAmount = Math.max(0, Number(d.payAmount||d.pay_amount||0))
          if (advId > 0) {
            const adv = await rawGet<any>(`SELECT id, kode_nota as number, total_amount as nominal FROM ap_advances WHERE id = $1`, [advId])
            if (!adv) throw new Error('Uang muka supplier tidak ditemukan')
            const usedRow = await rawGet<any>(`
              SELECT COALESCE(SUM(pi.pay_amount),0) AS used
              FROM ap_payment_items pi
              JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
              WHERE pi.source_type = 'ap_advance' AND pi.source_id = $1
            `, [adv.id])
            const remaining = Math.max(0, Number(adv.nominal||0) - Number(usedRow?.used||0))
            payAmount = Math.min(payAmount, remaining)
            await rawRun(`
              INSERT INTO ap_payment_items (payment_id, purchase_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
              VALUES ($1, 0, $2, $3, $4, $5, 'ap_advance', $6)
            `, [paymentId, adv.number, remaining, payAmount, d?.remarks || null, adv.id])
          } else if (payAmount > 0) {
            const advances = await rawAll<any>(`SELECT id, kode_nota as number, total_amount as nominal FROM ap_advances WHERE supplier_id = $1 ORDER BY id`, [supplierId])
            let remainingPay = payAmount
            for (const adv of advances) {
              if (remainingPay <= 0) break
              const usedRow = await rawGet<any>(`
                SELECT COALESCE(SUM(pi.pay_amount),0) AS used
                FROM ap_payment_items pi
                JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
                WHERE pi.source_type = 'ap_advance' AND pi.source_id = $1
              `, [adv.id])
              const remaining = Math.max(0, Number(adv.nominal||0) - Number(usedRow?.used||0))
              if (remaining <= 0) continue
              const alloc = Math.min(remainingPay, remaining)
              await rawRun(`
                INSERT INTO ap_payment_items (payment_id, purchase_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id)
                VALUES ($1, 0, $2, $3, $4, $5, 'ap_advance', $6)
              `, [paymentId, adv.number, remaining, alloc, d?.remarks || null, adv.id])
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
        `, [paymentId, Number(m.accountId||m.account_id), Number(m.amount||0), m?.notes || null])
      }

      for (const e of extras) {
        await rawRun(`
          INSERT INTO ap_payment_extras (payment_id, account_id, notes, debit, credit) VALUES ($1, $2, $3, $4, $5)
        `, [paymentId, Number(e.accountId||e.account_id), e?.notes || null, Number(e.debit||0), Number(e.credit||0)])
      }

      if (overpayment > 0.005) {
        const advYear = new Date(paymentDate).getFullYear()
        const advRows = await rawAll<any>('SELECT kode_nota FROM ap_advances WHERE kode_nota LIKE $1', [`US/${advYear}/%`])
        let advMax = 0
        for (const r of advRows) {
          const m = /^US\/(\d{4})\/(\d+)$/.exec(r.kode_nota || '')
          if (m) { const n = Number(m[2]); if (!Number.isNaN(n) && n > advMax) advMax = n }
        }
        const advNumber = `US/${advYear}/${(advMax + 1).toString().padStart(6, '0')}`

        const advRes = await pool.query(`
          INSERT INTO ap_advances (kode_nota, tanggal, supplier_id, total_amount, period_id, notes, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'active')
          RETURNING id
        `, [advNumber, paymentDate, supplierId, overpayment, period.id, `Auto-created from ${paymentNumber}`])
        const advId = Number(advRes.rows[0].id)

        let lineNo = 0
        for (const m of methods) {
          const proportion = Number(m.amount||0) / total
          const lineAmount = Math.round(proportion * overpayment * 100) / 100
          if (lineAmount > 0) {
            lineNo++
            await rawRun(`
              INSERT INTO ap_advance_lines (ap_advance_id, advance_id, line_no, account_id, account_code, amount, notes)
              VALUES ($1, $1, $2, $3, $4, $5, $6)
            `, [advId, lineNo, Number(m.accountId||m.account_id), String(m.accountCode||m.account_code||''), lineAmount, `Auto from ${paymentNumber}`])
          }
        }
      }

      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    // Ensure purchases has payment_status & paid_amount columns
    await rawRun(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Belum Dibayar'`).catch(()=>{})
    await rawRun(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS paid_amount REAL DEFAULT 0`).catch(()=>{})

    // Backfill all purchases
    try {
      const all = await rawAll<any>(`SELECT id, total, COALESCE(void,0) AS void FROM purchases`)
      for (const row of all) {
        const pid = Number(row.id)
        const sumRow = await rawGet<any>(`
          SELECT COALESCE(SUM(pi.pay_amount),0) AS paid
          FROM ap_payment_items pi
          JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
          WHERE (pi.purchase_id = $1 OR (pi.source_type = 'purchase' AND pi.source_id = $2))
        `, [pid, pid])
        const paid = Number(sumRow?.paid||0)
        const pTotal = Number(row.total||0)
        const isVoid = Number(row.void||0) === 1
        let status = 'Belum Dibayar'
        if (paid > 0 && paid + 0.0001 < pTotal) status = 'Belum Lunas'
        if (paid >= pTotal - 0.0001) status = 'Lunas'
        if (isVoid) status = 'Void'
        await rawRun(`UPDATE purchases SET paid_amount = $1, payment_status = $2 WHERE id = $3`, [paid, status, pid])
      }
    } catch {}

    // Recalculate payments for affected purchases
    try {
      const uniqIds = Array.from(new Set(affectedPurchaseIds)).filter(n=>Number.isFinite(n))
      for (const pid of uniqIds) {
        const sumRow = await rawGet<any>(`
          SELECT COALESCE(SUM(pi.pay_amount),0) AS paid
          FROM ap_payment_items pi
          JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
          WHERE (pi.purchase_id = $1 OR (pi.source_type = 'purchase' AND pi.source_id = $2))
        `, [pid, pid])
        const hdr = await rawGet<any>(`SELECT total, COALESCE(void,0) AS void FROM purchases WHERE id = $1`, [pid])
        const paid = Number(sumRow?.paid||0)
        const pTotal = Number(hdr?.total||0)
        const isVoid = Number(hdr?.void||0) === 1
        let pStatus = 'Belum Dibayar'
        if (paid > 0 && paid + 0.0001 < pTotal) pStatus = 'Belum Lunas'
        if (paid >= pTotal - 0.0001) pStatus = 'Lunas'
        if (isVoid) pStatus = 'Void'
        await rawRun(`UPDATE purchases SET paid_amount = $1, payment_status = $2 WHERE id = $3`, [paid, pStatus, pid])
      }
    } catch {}

    // Save journal entries for AP payment
    try {
      const apEntries = await generateEntriesForSingleSource('Bayar Hutang', paymentNumber, paymentDate)
      if (apEntries.length > 0) {
        await saveJournalEntriesForSource('Bayar Hutang', Number(paymentId), paymentNumber, paymentDate, apEntries)
      }
    } catch (e) {
      console.warn('[AP Payment] failed to save journal entries:', e)
    }

    return NextResponse.json({ success: true, id: Number(paymentId), paymentNumber })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to save AP payment', details: e?.message }, { status: 500 })
  }
}
