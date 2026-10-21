import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getPeriodByDate } from '@/lib/period'
import { generateEntriesForSingleSource, saveJournalEntriesForSource } from '@/lib/journalHelpers'

const pool = (getDb() as any).$client

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS memorial_journals (
      id SERIAL PRIMARY KEY,
      journal_number TEXT NOT NULL,
      journal_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      total_debit REAL NOT NULL DEFAULT 0,
      total_credit REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      user_create INTEGER,
      user_update INTEGER,
      CONSTRAINT uq_memorial_journals_number UNIQUE (journal_number)
    )
  `)
  await rawRun('CREATE INDEX IF NOT EXISTS idx_mj_date ON memorial_journals (journal_date)').catch(()=>{})
  await pool.query(`
    CREATE TABLE IF NOT EXISTS memorial_journal_details (
      id SERIAL PRIMARY KEY,
      memorial_journal_id INTEGER NOT NULL,
      line_no INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      account_code TEXT NOT NULL,
      notes TEXT DEFAULT '',
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (memorial_journal_id) REFERENCES memorial_journals(id) ON DELETE CASCADE
    )
  `)
  await rawRun('CREATE INDEX IF NOT EXISTS idx_mjd_hdr ON memorial_journal_details (memorial_journal_id)').catch(()=>{})
  await rawRun('CREATE INDEX IF NOT EXISTS idx_mjd_acc ON memorial_journal_details (account_id)').catch(()=>{})
}

function nextNumber(): string {
  const today = new Date()
  const year = String(today.getFullYear())
  // This is called in a transaction; number generation is best-effort
  const next = Math.floor(Math.random() * 999999) + 1
  return `JM/${year}/${next.toString().padStart(6, '0')}`
}

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_jurnal_memorial', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensureTables()
    const url = new URL(req.url)
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')

    let sql = 'SELECT id, journal_number, journal_date::text as journal_date, notes, total_debit, total_credit, status, created_at FROM memorial_journals'
    const conds: string[] = []
    const params: any[] = []
    let pidx = 0
    if (dateFrom) { pidx++; conds.push(`journal_date >= $${pidx}`); params.push(dateFrom) }
    if (dateTo) { pidx++; conds.push(`journal_date <= $${pidx}`); params.push(dateTo) }
    if (conds.length > 0) sql += ' WHERE ' + conds.join(' AND ')
    sql += ' ORDER BY id DESC LIMIT 200'

    const rows = (await rawAll<any>(sql, params)).map(r => ({ ...r, void: r.status === 'void' ? 1 : 0 }))
    return NextResponse.json(rows)
  } catch (e) {
    console.error('GET memorial-journals error', e)
    return NextResponse.json({ error: 'Failed to fetch memorial journals' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_jurnal_memorial', 'create') && !hasPermission(req as any, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensureTables()
    const body = await req.json().catch(() => ({}))

    const journal_date = String(body.journal_date || '').slice(0, 10)
    const notes = String(body.notes || '')
    const detail = Array.isArray(body.detail) ? body.detail : []

    if (!journal_date || detail.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const normalized = detail.map((d: any) => ({
      account_id: Number(d.account_id || 0),
      account_code: String(d.account_code || ''),
      notes: String(d.notes || ''),
      debit: Math.max(0, Number(d.debit || 0)),
      credit: Math.max(0, Number(d.credit || 0)),
    }))

    for (const r of normalized) {
      if (!r.account_id || !r.account_code) {
        return NextResponse.json({ error: 'Invalid detail row' }, { status: 400 })
      }
      const hasDebit = r.debit > 0
      const hasCredit = r.credit > 0
      if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
        return NextResponse.json({ error: 'Set salah satu debit atau kredit pada setiap baris' }, { status: 400 })
      }
    }

    const total_debit = normalized.reduce((a: number, b: any) => a + (Number(b.debit) || 0), 0)
    const total_credit = normalized.reduce((a: number, b: any) => a + (Number(b.credit) || 0), 0)

    if (total_debit <= 0 || total_credit <= 0 || Math.abs(total_debit - total_credit) > 0.0001) {
      return NextResponse.json({ error: 'Total debit dan kredit harus balance' }, { status: 400 })
    }

    const mjPeriod = await getPeriodByDate(journal_date)
    if (!mjPeriod) {
      return NextResponse.json({ error: `Periode belum ada untuk tanggal ${journal_date}.` }, { status: 400 })
    }
    if (Number(mjPeriod.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${mjPeriod.name}' sudah ditutup.` }, { status: 400 })
    }

    // Generate number inside transaction using sequence-based approach
    const number = nextNumber()
    const userId = getUserId(req)

    let id: number
    await pool.query('BEGIN')
    try {
      // Find max sequence number safely
      const lastRow = await rawGet<any>(`SELECT journal_number FROM memorial_journals WHERE journal_number LIKE $1 ORDER BY id DESC LIMIT 1`, [`JM/${new Date().getFullYear()}/%`])
      let maxSeq = 0
      if (lastRow) {
        const m = /^JM\/(\d{4})\/(\d+)$/.exec(lastRow.journal_number || '')
        if (m) maxSeq = Number(m[2]) || 0
      }
      const finalNumber = `JM/${new Date().getFullYear()}/${(maxSeq + 1).toString().padStart(6, '0')}`

      const res = await pool.query(`
        INSERT INTO memorial_journals (
          journal_number, journal_date, notes, total_debit, total_credit, status, created_at, updated_at, user_create
        ) VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $6)
        RETURNING id
      `, [finalNumber, journal_date, notes, total_debit, total_credit, userId])
      id = Number(res.rows[0].id)

      for (let idx = 0; idx < normalized.length; idx++) {
        const d = normalized[idx]
        await rawRun(`
          INSERT INTO memorial_journal_details (
            memorial_journal_id, line_no, account_id, account_code, notes, debit, credit, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [id, idx + 1, d.account_id, d.account_code, d.notes, d.debit, d.credit])
      }

      await pool.query('COMMIT')

      // Save journal entries for memorial journal
      try {
        const mjEntries = await generateEntriesForSingleSource('Jurnal Memorial', String(finalNumber), journal_date)
        if (mjEntries.length > 0) {
          await saveJournalEntriesForSource('Jurnal Memorial', id, String(finalNumber), journal_date, mjEntries)
        }
      } catch (e) {
        console.warn('[Memorial Journal] failed to save journal entries:', e)
      }

      return NextResponse.json({ id, journal_number: finalNumber })
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (e) {
    console.error('POST memorial-journals error', e)
    return NextResponse.json({ error: 'Failed to create memorial journal' }, { status: 500 })
  }
}
