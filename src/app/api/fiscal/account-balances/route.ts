import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet } from '@/db/raw'
import { getDb } from '@/db'
import { loadAllEntries } from '@/lib/accountingEntries'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_rekonsiliasi_fiskal', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const year = parseInt(url.searchParams.get('year') || '')

    if (!year) {
      return NextResponse.json({ error: 'year required' }, { status: 400 })
    }

    const period = await rawGet<any>(`
      SELECT start_date, end_date FROM master_periode
      WHERE EXTRACT(YEAR FROM start_date::date) = ? AND isdelete = 0
      ORDER BY start_date LIMIT 1
    `, [String(year)])

    if (!period) {
      // Return accounts with zero balances if no period exists
      const accounts = await rawAll<any>(`
        SELECT code, name FROM accounts WHERE is_active = 1 AND is_header = 0 AND posting_allowed = 1 ORDER BY code
      `)
      return NextResponse.json({ accounts: accounts.map((a: any) => ({ ...a, balance: 0 })) })
    }

    const db = getDb()
    const pool = (db as any).$client
    const entries = loadAllEntries(pool, period.start_date, period.end_date)

    const accounts = await rawAll<any>(`
      SELECT code, name, normal_balance FROM accounts WHERE is_active = 1 AND is_header = 0 AND posting_allowed = 1 ORDER BY code
    `)

    const balanceMap = new Map<string, number>()
    for (const a of accounts) balanceMap.set(a.code, 0)

    for (const e of entries) {
      if (!balanceMap.has(e.account_code)) continue
      const cur = balanceMap.get(e.account_code) || 0
      const acct = accounts.find((a: any) => a.code === e.account_code)
      const nb = acct?.normal_balance || 'D'
      balanceMap.set(e.account_code, cur + (nb === 'D' ? e.debit - e.credit : e.credit - e.debit))
    }

    const result = accounts.map((a: any) => ({
      code: a.code,
      name: a.name,
      balance: Math.round((balanceMap.get(a.code) || 0) * 100) / 100,
    }))

    return NextResponse.json({ accounts: result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
