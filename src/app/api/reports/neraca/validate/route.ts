import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet } from '@/db/raw'
import { getJournalEntriesFromTable } from '@/lib/journalHelpers'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_neraca', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const periodId = url.searchParams.get('periodId')
    if (!periodId) {
      return NextResponse.json({ error: 'periodId required' }, { status: 400 })
    }

    const period = await rawGet<any>('SELECT start_date, end_date FROM master_periode WHERE id = ? AND isdelete = 0', [Number(periodId)])
    if (!period) {
      return NextResponse.json({ error: 'Periode tidak ditemukan' }, { status: 404 })
    }

    const accounts = await rawAll<any[]>('SELECT code FROM accounts WHERE is_active = 1')
    const validCodes = new Set(accounts.map((a: any) => a.code))

    const entries = await getJournalEntriesFromTable(period.start_date, period.end_date)
    const groupMap = new Map<string, { source_type: string; source_number: string; entries: typeof entries; hasEmptyCode: boolean }>()

    for (const e of entries) {
      const key = e.source_type + '::' + e.source_number
      if (!groupMap.has(key)) {
        groupMap.set(key, { source_type: e.source_type, source_number: e.source_number, entries: [], hasEmptyCode: false })
      }
      const g = groupMap.get(key)!
      g.entries.push(e)
      if (!e.account_code || !validCodes.has(e.account_code)) {
        g.hasEmptyCode = true
      }
    }

    const problems: any[] = []
    for (const [key, g] of groupMap) {
      const totalDebit = g.entries.reduce((s, e) => s + Number(e.debit || 0), 0)
      const totalCredit = g.entries.reduce((s, e) => s + Number(e.credit || 0), 0)
      const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01
      if (!isBalanced || g.hasEmptyCode) {
        problems.push({
          source_type: g.source_type,
          source_number: g.source_number,
          total_debit: Math.round(totalDebit * 100) / 100,
          total_credit: Math.round(totalCredit * 100) / 100,
          is_balanced: isBalanced,
          has_missing_account: g.hasEmptyCode,
        })
      }
    }

    // Also check account_mappings completeness
    const mappings = await rawAll<any[]>('SELECT map_group, map_key, account_id FROM account_mappings')
    const mapGroups = new Set(mappings.map((m: any) => m.map_group))
    const requiredMaps = ['pelanggan', 'supplier', 'barang', 'laba']
    const missingMaps = requiredMaps.filter(g => !mapGroups.has(g))

    return NextResponse.json({
      total_entries: entries.length,
      total_notes: groupMap.size,
      problems,
      problem_count: problems.length,
      missing_map_groups: missingMaps,
      period: { start: period.start_date, end: period.end_date },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
