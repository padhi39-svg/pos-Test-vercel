import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getJournalEntriesFromTable } from '@/lib/journalHelpers'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_trial_balance', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const db = getDb()
    const pool = (db as any).$client

    const cols = await rawAll<any[]>("SELECT column_name FROM information_schema.columns WHERE table_name = 'akun_saldo_bulanan' AND table_schema = 'public'")
    if (!cols.length) {
      await rawRun(`
        CREATE TABLE akun_saldo_bulanan (
          id SERIAL PRIMARY KEY,
          account_code TEXT NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          saldo_akhir REAL NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(account_code, year, month)
        )
      `)
    }

    const accounts = await rawAll<any[]>(`
      SELECT id, code, name, normal_balance
      FROM accounts WHERE is_active = 1 AND posting_allowed = 1 AND is_header = 0
      ORDER BY code
    `)

    if (!accounts.length) {
      return NextResponse.json({ success: true, message: 'Tidak ada akun untuk dihitung' })
    }

    const yearRange = await rawGet<any>(`
      SELECT MIN(CAST(SUBSTRING(entry_date,1,4) AS INTEGER)) AS min_year,
             MAX(CAST(SUBSTRING(entry_date,1,4) AS INTEGER)) AS max_year
      FROM journal_entries
    `)
    const minYear = yearRange?.min_year || new Date().getFullYear()
    const maxYear = yearRange?.max_year || new Date().getFullYear()

    const allEntries = await getJournalEntriesFromTable('2000-01-01', `${maxYear}-12-31`)

    const entriesByYM: Map<string, typeof allEntries> = new Map()
    for (const e of allEntries) {
      const ed = e.entry_date || ''
      if (ed < '2000-01-01') continue
      const ym = ed.slice(0, 7)
      if (!entriesByYM.has(ym)) entriesByYM.set(ym, [])
      entriesByYM.get(ym)!.push(e)
    }

    const running = new Map<string, number>()
    for (const a of accounts) running.set(a.code, 0)

    for (const e of allEntries) {
      const ed = e.entry_date || ''
      if (ed >= `${minYear}-01-01`) break
      if (running.has(e.account_code)) {
        const cur = running.get(e.account_code) || 0
        const acct = accounts.find((a: any) => a.code === e.account_code)
        const nb = acct?.normal_balance || 'D'
        running.set(e.account_code, cur + (nb === 'D' ? e.debit - e.credit : e.credit - e.debit))
      }
    }

    await pool.query('BEGIN')
    try {
      let totalSaved = 0
      for (let y = minYear; y <= maxYear; y++) {
        for (let m = 1; m <= 12; m++) {
          const ym = `${y}-${String(m).padStart(2, '0')}`
          const bucket = entriesByYM.get(ym) || []
          for (const e of bucket) {
            if (running.has(e.account_code)) {
              const cur = running.get(e.account_code) || 0
              const acct = accounts.find((a: any) => a.code === e.account_code)
              const nb = acct?.normal_balance || 'D'
              running.set(e.account_code, cur + (nb === 'D' ? e.debit - e.credit : e.credit - e.debit))
            }
          }
          for (const a of accounts) {
            const saldo = running.get(a.code) || 0
            await pool.query(
              `INSERT INTO akun_saldo_bulanan (account_code, year, month, saldo_akhir, updated_at)
               VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
               ON CONFLICT (account_code, year, month) DO UPDATE SET
                 saldo_akhir = $4,
                 updated_at = CURRENT_TIMESTAMP`,
              [a.code, y, m, saldo]
            )
          }
          totalSaved += accounts.length
        }
      }
      await pool.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Saldo ${accounts.length} akun untuk ${minYear}-${maxYear} berhasil dihitung (${totalSaved} record).`,
      })
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (e: any) {
    console.error('POST /api/reports/trial-balance/calculate-balance error:', e)
    return NextResponse.json({ error: e?.message || 'Gagal menghitung saldo' }, { status: 500 })
  }
}
