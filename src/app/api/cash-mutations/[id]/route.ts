import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'
import { getPeriodByDate } from '@/lib/period'
import { getUserId } from '@/lib/audit'
import { generateEntriesForSingleSource, saveJournalEntriesForSource, deleteJournalEntriesForSource } from '@/lib/journalHelpers'

async function ensureTables() {
  const db = getDb(); const pool = (db as any).$client
  await pool.query(`CREATE TABLE IF NOT EXISTS cash_mutations (
    id SERIAL PRIMARY KEY,
    mutation_number TEXT NOT NULL,
    mutation_date TEXT NOT NULL,
    cash_account_id INTEGER NOT NULL,
    cash_account_code TEXT NOT NULL,
    mutation_type TEXT NOT NULL CHECK (mutation_type IN ('MASUK','KELUAR')),
    notes TEXT DEFAULT '',
    total_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_create INTEGER,
    user_update INTEGER,
    CONSTRAINT uq_cash_mutations_number UNIQUE (mutation_number)
  )`)
  await pool.query(`CREATE TABLE IF NOT EXISTS cash_mutation_details (
    id SERIAL PRIMARY KEY,
    cash_mutation_id INTEGER NOT NULL,
    line_no INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    account_code TEXT NOT NULL,
    notes TEXT DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cash_mutation_id) REFERENCES cash_mutations(id) ON DELETE CASCADE
  )`)
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'keu_mutasi_kas_bank', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensureTables()
    const id = Number(params.id)
    const hdr = await rawGet(`
      SELECT
        cm.*,
        (SELECT name FROM accounts a WHERE a.id = cm.cash_account_id LIMIT 1) AS cash_account_name
      FROM cash_mutations cm
      WHERE cm.id = ?
    `, [id]) as any
    if (!hdr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const det = await rawAll(`
      SELECT 
        d.line_no, 
        d.account_id, 
        d.account_code, 
        (SELECT name FROM accounts a WHERE a.id = d.account_id LIMIT 1) AS account_name,
        d.notes, 
        d.amount 
      FROM cash_mutation_details d 
      WHERE d.cash_mutation_id = ? 
      ORDER BY d.line_no ASC
    `, [id])
    return NextResponse.json({ ...hdr, detail: det })
  } catch (e) {
    console.error('GET /cash-mutations/[id] error', e)
    return NextResponse.json({ error: 'Failed to fetch cash mutation' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'keu_mutasi_kas_bank', 'edit') && !hasPermission(req as any, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensureTables()
    const id = Number(params.id)
    const db = getDb(); const pool = (db as any).$client
    const body = await req.json().catch(()=>({}))
    const action = String(body.action || '').toLowerCase()

    const hdr = await rawGet('SELECT status FROM cash_mutations WHERE id = ?', [id]) as any
    if (!hdr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'void') {
      if (String(hdr.status) === 'void') {
        return NextResponse.json({ id, status: 'void' })
      }
      const userId = getUserId(req)
      await rawRun("UPDATE cash_mutations SET status = 'void', user_edit = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [userId || null, id])
    try {
      deleteJournalEntriesForSource('Mutasi Kas', id)
    } catch (e) {
      console.warn('[Cash Mutation Void] failed to delete journal entries:', e)
    }
      return NextResponse.json({ id, status: 'void' })
    }

    const payload = body || {}
    if (String(hdr.status) === 'void') {
      return NextResponse.json({ error: 'Tidak dapat mengubah transaksi yang sudah void' }, { status: 400 })
    }

    const existingCm = await rawGet('SELECT mutation_date FROM cash_mutations WHERE id = ?', [id]) as any
    const cmDate = String(payload?.mutation_date || existingCm?.mutation_date || '').slice(0,10)
    const cmPeriod = await getPeriodByDate(cmDate)
    if (!cmPeriod) {
      return NextResponse.json({ error: `Periode belum ada untuk tanggal ${cmDate}.` }, { status: 400 })
    }
    if (Number(cmPeriod.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${cmPeriod.name}' sudah ditutup.` }, { status: 400 })
    }

    const mutation_date = payload.mutation_date ? String(payload.mutation_date).slice(0,10) : undefined
    const cash_account_id = payload.cash_account_id !== undefined ? Number(payload.cash_account_id || 0) : undefined
    const cash_account_code = payload.cash_account_code !== undefined ? String(payload.cash_account_code || '') : undefined
    const mutation_type = payload.mutation_type !== undefined
      ? ((String(payload.mutation_type||'').toUpperCase() === 'KELUAR') ? 'KELUAR' : 'MASUK')
      : undefined
    const notes = payload.notes !== undefined ? String(payload.notes || '') : undefined
    const detail = Array.isArray(payload.detail) ? payload.detail : null
    const userId = getUserId(req)

    await pool.query('BEGIN')
    try {
      if (
        mutation_date !== undefined ||
        cash_account_id !== undefined ||
        cash_account_code !== undefined ||
        mutation_type !== undefined ||
        notes !== undefined
      ) {
        await rawRun(`
          UPDATE cash_mutations
          SET
            mutation_date = COALESCE(?, mutation_date),
            cash_account_id = COALESCE(?, cash_account_id),
            cash_account_code = COALESCE(?, cash_account_code),
            mutation_type = COALESCE(?, mutation_type),
            notes = COALESCE(?, notes),
            user_edit = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [mutation_date, cash_account_id, cash_account_code, mutation_type, notes, userId || null, id])
      }
      if (detail) {
        const total_amount = detail.reduce((a:any,b:any)=> a + (Number(b.amount)||0), 0)
        await rawRun('UPDATE cash_mutations SET total_amount = ?, user_edit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [total_amount, userId || null, id])
        await rawRun('DELETE FROM cash_mutation_details WHERE cash_mutation_id = ?', [id])
        for (let idx = 0; idx < detail.length; idx++) {
          const d = detail[idx]
          await rawRun(`
            INSERT INTO cash_mutation_details (cash_mutation_id, line_no, account_id, account_code, notes, amount, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [id, idx + 1, Number(d.account_id||0), String(d.account_code||''), String(d.notes||''), Number(d.amount)||0])
        }
      }
      await pool.query('COMMIT')
    } catch(e) {
      await pool.query('ROLLBACK')
      throw e
    }

    try {
      const cmRow = await rawGet(`SELECT id, mutation_number, mutation_date FROM cash_mutations WHERE id = ?`, [id]) as any
      if (cmRow) {
        deleteJournalEntriesForSource('Mutasi Kas', id)
        const entries = await generateEntriesForSingleSource('Mutasi Kas', cmRow.mutation_number || '', cmRow.mutation_date || '')
        if (entries.length > 0) {
          await saveJournalEntriesForSource('Mutasi Kas', id, cmRow.mutation_number || '', cmRow.mutation_date || '', entries)
        }
      }
    } catch (e) {
      console.warn('[Cash Mutation Edit] failed to save journal entries:', e)
    }
    return NextResponse.json({ id, status: 'active' })
  } catch (e) {
    console.error('PATCH /cash-mutations/[id] error', e)
    return NextResponse.json({ error: 'Failed to update cash mutation' }, { status: 500 })
  }
}
