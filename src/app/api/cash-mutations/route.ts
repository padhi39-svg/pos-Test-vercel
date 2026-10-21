import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getPeriodByDate } from '@/lib/period'
import { generateEntriesForSingleSource, saveJournalEntriesForSource } from '@/lib/journalHelpers'

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
  try { await rawRun('CREATE INDEX IF NOT EXISTS idx_cm_date ON cash_mutations (mutation_date)') } catch {}
  try { await rawRun('CREATE INDEX IF NOT EXISTS idx_cm_cash_acc ON cash_mutations (cash_account_id)') } catch {}

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
  try { await rawRun('CREATE INDEX IF NOT EXISTS idx_cmd_hdr ON cash_mutation_details (cash_mutation_id)') } catch {}
  try { await rawRun('CREATE INDEX IF NOT EXISTS idx_cmd_acc ON cash_mutation_details (account_id)') } catch {}
}

async function nextNumber(): Promise<string> {
  const today = new Date()
  const year = String(today.getFullYear())
  const rows = await rawAll('SELECT mutation_number FROM cash_mutations WHERE mutation_number LIKE ?', [`MT/${year}/%`]) as { mutation_number: string }[]
  let max = 0
  for (const r of rows) {
    const m = /^MT\/(\d{4})\/(\d+)$/.exec(r.mutation_number || '')
    if (m) {
      const n = Number(m[2])
      if (!Number.isNaN(n) && n > max) max = n
    }
  }
  const next = (max + 1).toString().padStart(6, '0')
  return `MT/${year}/${next}`
}

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_mutasi_kas_bank', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensureTables()
    const url = new URL(req.url)
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')

    let sql = "SELECT cm.id, cm.mutation_number, cm.mutation_date, cm.cash_account_id, cm.cash_account_code, (SELECT a.name FROM accounts a WHERE a.id = cm.cash_account_id LIMIT 1) AS cash_account_name, cm.mutation_type, cm.notes, cm.total_amount, cm.status, cm.created_at FROM cash_mutations cm"
    const conds: string[] = []
    const params: any[] = []
    if (dateFrom) { conds.push('mutation_date >= ?'); params.push(dateFrom) }
    if (dateTo) { conds.push('mutation_date <= ?'); params.push(dateTo) }
    if (conds.length > 0) sql += ' WHERE ' + conds.join(' AND ')
    sql += ' ORDER BY mutation_date DESC, id DESC LIMIT 200'

    const rows = (await rawAll(sql, params.length > 0 ? params : undefined) as any[]).map(r => ({ ...r, void: r.status === 'void' ? 1 : 0 }))
    return NextResponse.json(rows)
  } catch (e) {
    console.error('GET cash-mutations error', e)
    return NextResponse.json({ error: 'Failed to fetch cash mutations' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_mutasi_kas_bank', 'create') && !hasPermission(req as any, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensureTables()
    const db = getDb(); const pool = (db as any).$client
    const body = await req.json()
    const mutation_date = String(body.mutation_date || '').slice(0,10)
    const cash_account_id = Number(body.cash_account_id)
    const cash_account_code = String(body.cash_account_code || '')
    const mutation_type = (String(body.mutation_type||'MASUK').toUpperCase() === 'KELUAR') ? 'KELUAR' : 'MASUK'
    const notes = String(body.notes || '')
    const detail = Array.isArray(body.detail) ? body.detail : []

    if (!mutation_date || !cash_account_id || !cash_account_code || detail.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const total_amount = detail.reduce((a:any,b:any)=> a + (Number(b.amount)||0), 0)
    const number = await nextNumber()
    const userId = getUserId(req)

    const cmPeriod = await getPeriodByDate(mutation_date)
    if (!cmPeriod) {
      return NextResponse.json({ error: `Periode belum ada untuk tanggal ${mutation_date}.` }, { status: 400 })
    }
    if (Number(cmPeriod.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${cmPeriod.name}' sudah ditutup.` }, { status: 400 })
    }

    await pool.query('BEGIN')
    let id: number
    try {
      const insHdr = await pool.query(`
        INSERT INTO cash_mutations (mutation_number, mutation_date, cash_account_id, cash_account_code, mutation_type, notes, total_amount, status, created_at, updated_at, user_create)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $8)
        RETURNING id
      `, [number, mutation_date, cash_account_id, cash_account_code, mutation_type, notes, total_amount, userId])
      id = Number(insHdr.rows[0].id)
      for (let idx = 0; idx < detail.length; idx++) {
        const d = detail[idx]
        await rawRun(`
          INSERT INTO cash_mutation_details (cash_mutation_id, line_no, account_id, account_code, notes, amount, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [id, idx + 1, Number(d.account_id), String(d.account_code||''), String(d.notes||''), Number(d.amount)||0])
      }
      await pool.query('COMMIT')
    } catch(e) {
      await pool.query('ROLLBACK')
      throw e
    }

    try {
      const cmEntries = await generateEntriesForSingleSource('Mutasi Kas', String(number), mutation_date)
      if (cmEntries.length > 0) {
        await saveJournalEntriesForSource('Mutasi Kas', id, String(number), mutation_date, cmEntries)
      }
    } catch (e) {
      console.warn('[Cash Mutation] failed to save journal entries:', e)
    }
    return NextResponse.json({ id, mutation_number: number })
  } catch (e) {
    console.error('POST cash-mutations error', e)
    return NextResponse.json({ error: 'Failed to create cash mutation' }, { status: 500 })
  }
}
