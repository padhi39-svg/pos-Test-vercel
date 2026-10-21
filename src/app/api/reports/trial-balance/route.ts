import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getJournalEntriesFromTable } from '@/lib/journalHelpers'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

async function getBalanceAt(code: string, year: number, month: number, cacheMap?: Map<string, number>): Promise<number> {
  if (cacheMap) {
    const key = `${code}_${year}_${String(month).padStart(2, '0')}`
    const v = cacheMap.get(key)
    if (v !== undefined) return v
  }
  const row = await rawGet<any>(
    `SELECT saldo_akhir FROM akun_saldo_bulanan WHERE account_code = $1 AND year = $2 AND month = $3`,
    [code, year, month]
  )
  return row ? Number(row.saldo_akhir) || 0 : 0
}

async function loadCache(year: number): Promise<Map<string, number>> {
  const cached = await rawAll<any>(
    `SELECT account_code, year, month, saldo_akhir FROM akun_saldo_bulanan
     WHERE year = $1 OR (year = $2 AND month = 12)
     ORDER BY year, month`,
    [year, year - 1]
  )
  const cacheMap = new Map<string, number>()
  for (const c of cached) {
    cacheMap.set(`${c.account_code}_${c.year}_${String(c.month).padStart(2, '0')}`, c.saldo_akhir)
  }
  return cacheMap
}

async function hasFullCache(year: number, postingCount: number): Promise<boolean> {
  const row = await rawGet<any>(
    `SELECT COUNT(DISTINCT account_code)::int AS cnt FROM akun_saldo_bulanan WHERE year = $1 AND month = 1`,
    [year]
  )
  return !!(row && Number(row.cnt) >= postingCount)
}

async function computePostingBalances(year: number, postingAccounts: any[]) {
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`
  const pool = (getDb() as any).$client
  const allEntries = await getJournalEntriesFromTable('2000-01-01', endDate)

  const entriesByMonth: Map<string, typeof allEntries> = new Map()
  for (let m = 1; m <= 12; m++) {
    entriesByMonth.set(String(m).padStart(2, '0'), [])
  }
  for (const e of allEntries) {
    const ed = e.entry_date || ''
    if (ed >= startDate && ed <= endDate) {
      const month = ed.slice(5, 7)
      const bucket = entriesByMonth.get(month)
      if (bucket) bucket.push(e)
    }
  }

  const monthlyBalances: Record<string, Record<string, number>> = {}
  const running = new Map<string, number>()
  for (const a of postingAccounts) running.set(a.code, 0)

  for (const e of allEntries) {
    const ed = e.entry_date || ''
    if (ed >= startDate) break
    if (running.has(e.account_code)) {
      const cur = running.get(e.account_code) || 0
      const acct = postingAccounts.find((a: any) => a.code === e.account_code)
      const nb = acct?.normal_balance || 'D'
      running.set(e.account_code, cur + (nb === 'D' ? e.debit - e.credit : e.credit - e.debit))
    }
  }

  for (let m = 1; m <= 12; m++) {
    const month = String(m).padStart(2, '0')
    const bucket = entriesByMonth.get(month) || []
    for (const e of bucket) {
      if (running.has(e.account_code)) {
        const cur = running.get(e.account_code) || 0
        const acct = postingAccounts.find((a: any) => a.code === e.account_code)
        const nb = acct?.normal_balance || 'D'
        running.set(e.account_code, cur + (nb === 'D' ? e.debit - e.credit : e.credit - e.debit))
      }
    }
    const snap: Record<string, number> = {}
    for (const a of postingAccounts) {
      snap[a.code] = running.get(a.code) || 0
    }
    monthlyBalances[month] = snap
  }
  return monthlyBalances
}

function buildTreeAccounts(
  allAccounts: any[],
  getPostingBalance: (code: string, monthIdx: number) => number,
  monthsCount: number,
) {
  const childrenOf = new Map<number | null, any[]>()
  for (const a of allAccounts) {
    const p = a.parent_id !== null ? Number(a.parent_id) : null
    if (!childrenOf.has(p)) childrenOf.set(p, [])
    childrenOf.get(p)!.push(a)
  }

  const memo = new Map<number, number[]>()

  function sumDescendants(nodeId: number): number[] {
    if (memo.has(nodeId)) return memo.get(nodeId)!
    const node = allAccounts.find(a => Number(a.id) === nodeId)
    if (!node) return new Array(monthsCount).fill(0)

    const monthly = new Array(monthsCount).fill(0)

    if (Number(node.is_header) === 0) {
      for (let m = 0; m < monthsCount; m++) {
        monthly[m] = getPostingBalance(node.code, m)
      }
    } else {
      const kids = childrenOf.get(nodeId) || []
      for (const kid of kids) {
        const kidMonthly = sumDescendants(Number(kid.id))
        for (let m = 0; m < monthsCount; m++) {
          monthly[m] += kidMonthly[m]
        }
      }
    }

    memo.set(nodeId, monthly)
    return monthly
  }

  const filtered = allAccounts.filter((a: any) => String(a.code || '').length > 0 && a.level >= 1)

  return filtered.map(a => {
    const monthly = sumDescendants(Number(a.id))
    return {
      id: Number(a.id),
      code: a.code,
      name: a.name,
      parent_id: a.parent_id,
      level: a.level,
      is_header: a.is_header,
      normal_balance: a.normal_balance,
      golongan: a.golongan,
      monthly,
    }
  })
}

function getPostingFromCache(cacheMap: Map<string, number>, year: number, monthIdx: number, code: string): number {
  return getBalanceAt(code, year, monthIdx + 1, cacheMap) as any
}

function getPostingFromOnTheFly(monthlyBalances: Record<string, Record<string, number>>, monthIdx: number, code: string): number {
  return monthlyBalances[String(monthIdx + 1).padStart(2, '0')]?.[code] || 0
}

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_trial_balance', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const pool = (getDb() as any).$client
    try {
      await rawGet('SELECT COUNT(*) FROM akun_saldo_bulanan LIMIT 1')
    } catch {
      await rawRun(`
        CREATE TABLE IF NOT EXISTS akun_saldo_bulanan (
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
    const url = new URL(req.url)
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10)
    if (isNaN(year) || year < 2000) {
      return NextResponse.json({ error: 'Tahun tidak valid' }, { status: 400 })
    }
    const monthParam = url.searchParams.get('month')

    const allAccounts = await rawAll<any>(`
      SELECT id, code, name, parent_id, level, is_header, normal_balance, posting_allowed, golongan
      FROM accounts WHERE is_active = 1 ORDER BY code
    `)

    const postingAccounts = allAccounts.filter((a: any) => Number(a.is_header) === 0)

    if (monthParam) {
      const month = parseInt(monthParam, 10)
      if (isNaN(month) || month < 1 || month > 12) {
        return NextResponse.json({ error: 'Bulan tidak valid (1-12)' }, { status: 400 })
      }
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year

      let curCache: Map<string, number> | undefined
      let prevCache: Map<string, number> | undefined
      let curMonthly: Record<string, Record<string, number>> | undefined
      let prevMonthly: Record<string, Record<string, number>> | undefined

      if (await hasFullCache(year, postingAccounts.length)) {
        curCache = await loadCache(year)
      } else {
        curMonthly = await computePostingBalances(year, postingAccounts)
      }

      if (await hasFullCache(prevYear, postingAccounts.length)) {
        prevCache = await loadCache(prevYear)
        if (!curCache) curCache = new Map()
        for (const [k, v] of prevCache) curCache.set(k, v)
      } else {
        prevMonthly = await computePostingBalances(prevYear, postingAccounts)
      }

      function getCurrentBalance(code: string): number {
        if (curCache) {
          return getBalanceAt(code, year, month, curCache) as any
        }
        if (curMonthly) {
          const m = String(month).padStart(2, '0')
          return curMonthly[m]?.[code] || 0
        }
        return 0
      }
      function getPrevBalance(code: string): number {
        if (curCache) {
          const key = `${code}_${prevYear}_${String(prevMonth).padStart(2, '0')}`
          const v = curCache.get(key)
          if (v !== undefined) return v
        }
        if (prevMonthly) {
          const m = String(prevMonth).padStart(2, '0')
          return prevMonthly[m]?.[code] || 0
        }
        return getBalanceAt(code, prevYear, prevMonth) as any
      }

      const treeResult = buildTreeAccounts(allAccounts, (code) => getCurrentBalance(code), 1)
      const treePrev = buildTreeAccounts(allAccounts, (code) => getPrevBalance(code), 1)

      const result = treeResult.map((r, i) => {
        const prevVal = treePrev[i]?.monthly?.[0] || 0
        const curVal = r.monthly[0] || 0
        const diff = curVal - prevVal
        const diffPct = prevVal !== 0 ? Math.round((diff / prevVal) * 10000) / 100 : 0
        return {
          id: Number(r.id),
          code: r.code,
          name: r.name,
          parent_id: r.parent_id,
          level: r.level,
          is_header: r.is_header,
          normal_balance: r.normal_balance,
          current: curVal,
          previous: prevVal,
          difference: diff,
          differencePercent: diffPct,
        }
      })

      const labaMappings = (await rawAll<any>(
        "SELECT account_id, map_key FROM account_mappings WHERE map_group = 'laba'"
      )).map((r: any) => ({ id: Number(r.account_id), key: r.map_key }))
      if (labaMappings.length > 0) {
        const labaIds = labaMappings.map(r => r.id)
        const codeGolonganMap = new Map<string, string>()
        for (const a of postingAccounts) {
          codeGolonganMap.set(a.code, a.golongan || '')
        }
        const plGolongans = new Set(['pendapatan', 'hpp', 'beban', 'pendapatan_lain', 'beban_lain'])
        const pnlCodes = postingAccounts.filter(a => a.golongan && plGolongans.has(a.golongan)).map(a => a.code)
        const getPL = (y: number, m: number) => {
          let t = 0
          for (const code of pnlCodes) {
            let bal = 0
            if (curCache) {
              bal = getBalanceAt(code, y, m, curCache) as any
            } else if (y === year && curMonthly) {
              bal = curMonthly[String(m).padStart(2, '0')]?.[code] ?? 0
            } else if (y === prevYear && prevMonthly) {
              bal = prevMonthly[String(m).padStart(2, '0')]?.[code] ?? 0
            } else {
              bal = getBalanceAt(code, y, m) as any
            }
            const g = codeGolonganMap.get(code) || ''
            if (g === 'pendapatan' || g === 'pendapatan_lain') t += bal; else t -= bal
          }
          return t
        }
        const totCur = getPL(year, month)
        const totPrev = getPL(prevYear, prevMonth)
        const prevYearPL = getPL(year - 1, 12)
        let totPrevPrev = 0
        if (month > 2) totPrevPrev = getPL(year, month - 2)
        else if (month === 2) totPrevPrev = prevYearPL
        else totPrevPrev = getPL(year - 1, 11)
        const labaBlnIniCur = parseFloat((totCur - totPrev).toFixed(2))
        const labaBlnIniPrev = parseFloat((totPrev - totPrevPrev).toFixed(2))
        const ytdCur = parseFloat((totCur - prevYearPL).toFixed(2))
        const ytdPrev = parseFloat((totPrev - prevYearPL).toFixed(2))
        let labaDitahanVal = 0
        const ditahanMap = labaMappings.find(r => r.key === 'laba_ditahan')
        if (ditahanMap) {
          const dc = result.find(a => Number(a.id) === ditahanMap.id)?.code
          if (dc) labaDitahanVal = await getBalanceAt(dc, year - 1, 12, curCache)
        }
        for (const a of result) {
          if (!labaIds.includes(Number(a.id))) continue
          const m = labaMappings.find(r => r.id === Number(a.id))
          if (m?.key === 'laba_bulan_ini') {
            a.current = labaBlnIniCur; a.previous = labaBlnIniPrev
          } else if (m?.key === 'laba_berjalan') {
            a.current = ytdCur; a.previous = ytdPrev
          } else if (m?.key === 'laba_ditahan') {
            a.current = labaDitahanVal; a.previous = labaDitahanVal
          }
          a.difference = parseFloat((a.current - a.previous).toFixed(2))
          a.differencePercent = a.previous !== 0 ? parseFloat((((a.current - a.previous) / a.previous) * 100).toFixed(2)) : 0
        }
        const parentId = await rawGet<any>("SELECT parent_id FROM accounts WHERE id = $1", [labaMappings[0].id])
        if (parentId?.parent_id) {
          const parent = result.find(a => Number(a.id) === parentId.parent_id)
          if (parent) {
            parent.current = parseFloat((ytdCur + labaDitahanVal).toFixed(2))
            parent.previous = parseFloat((ytdPrev + labaDitahanVal).toFixed(2))
            parent.difference = parseFloat((parent.current - parent.previous).toFixed(2))
            parent.differencePercent = parent.previous !== 0 ? parseFloat((((parent.current - parent.previous) / parent.previous) * 100).toFixed(2)) : 0
          }
        }
      }

      const currentTotal = result.reduce((s, r) => s + r.current, 0)
      const previousTotal = result.reduce((s, r) => s + r.previous, 0)

      return NextResponse.json({
        mode: 'comparison',
        year, month, monthName: MONTHS[month - 1],
        prevYear, prevMonth, prevMonthName: MONTHS[prevMonth - 1],
        accounts: result,
        totals: { current: currentTotal, previous: previousTotal, difference: currentTotal - previousTotal },
      })
    }

    const monthsCount = 12
    let treeAccounts: any[]

    if (await hasFullCache(year, postingAccounts.length)) {
      const cacheMap = await loadCache(year)
      treeAccounts = buildTreeAccounts(
        allAccounts,
        (code, m) => getPostingFromCache(cacheMap, year, m, code),
        monthsCount,
      )
    } else {
      const monthlyBalances = await computePostingBalances(year, postingAccounts)
      treeAccounts = buildTreeAccounts(
        allAccounts,
        (code, m) => getPostingFromOnTheFly(monthlyBalances, m, code),
        monthsCount,
      )
    }

    const labaMappings = (await rawAll<any>(
      "SELECT account_id, map_key FROM account_mappings WHERE map_group = 'laba'"
    )).map((r: any) => ({ id: Number(r.account_id), key: r.map_key }))
    if (labaMappings.length > 0) {
      const labaIds = labaMappings.map(r => r.id)
      const totPL = Array.from({ length: monthsCount }, (_, m) => {
        const p = treeAccounts.filter(a => a.golongan === 'pendapatan' || a.golongan === 'pendapatan_lain').reduce((s, a) => s + (a.monthly[m] || 0), 0)
        const h = treeAccounts.filter(a => a.golongan === 'hpp').reduce((s, a) => s + (a.monthly[m] || 0), 0)
        const b = treeAccounts.filter(a => a.golongan === 'beban' || a.golongan === 'beban_lain').reduce((s, a) => s + (a.monthly[m] || 0), 0)
        return p - h - b
      })
      const prevRows = await rawAll<any>(
        "SELECT account_code, saldo_akhir FROM akun_saldo_bulanan WHERE year = $1 AND month = 12",
        [year - 1]
      )
      const prevBal = new Map(prevRows.map((r: any) => [r.account_code, Number(r.saldo_akhir) || 0]))
      const prevYearPL = treeAccounts.filter(a => a.golongan === 'pendapatan' || a.golongan === 'pendapatan_lain')
        .reduce((s, a) => s + (prevBal.get(a.code) || 0), 0) -
        treeAccounts.filter(a => a.golongan === 'hpp').reduce((s, a) => s + (prevBal.get(a.code) || 0), 0) -
        treeAccounts.filter(a => a.golongan === 'beban' || a.golongan === 'beban_lain').reduce((s, a) => s + (prevBal.get(a.code) || 0), 0)
      const perBulan = totPL.map((v, m) => m === 0 ? v - prevYearPL : v - totPL[m - 1])
      const ytdPL = totPL.map(v => v - prevYearPL)
      let labaDitahanVal = 0
      const ditahanMap = labaMappings.find(r => r.key === 'laba_ditahan')
      if (ditahanMap) {
        const dc = treeAccounts.find(a => Number(a.id) === ditahanMap.id)?.code
        if (dc) labaDitahanVal = prevBal.get(dc) || 0
      }
      for (const a of treeAccounts) {
        if (!labaIds.includes(Number(a.id))) continue
        const m = labaMappings.find(r => r.id === Number(a.id))
        if (m?.key === 'laba_bulan_ini') a.monthly = perBulan.map(v => parseFloat(v.toFixed(2)))
        else if (m?.key === 'laba_berjalan') a.monthly = ytdPL.map(v => parseFloat(v.toFixed(2)))
        else if (m?.key === 'laba_ditahan') a.monthly = Array.from({ length: monthsCount }, () => parseFloat(labaDitahanVal.toFixed(2)))
      }
      const parentId = labaMappings.length > 0 ? await rawGet<any>(
        "SELECT parent_id FROM accounts WHERE id = $1",
        [labaMappings[0].id]
      ) : null
      if (parentId?.parent_id) {
        const parent = treeAccounts.find(a => Number(a.id) === parentId.parent_id)
        if (parent) {
          parent.monthly = ytdPL.map((v, m) => parseFloat((v + (labaDitahanVal)).toFixed(2)))
        }
      }
    }

    const totals: number[] = Array.from({ length: monthsCount }, (_, m) =>
      treeAccounts.reduce((s, r) => s + (r.monthly[m] ?? 0), 0)
    )

    return NextResponse.json({ mode: 'annual', year, monthNames: MONTHS, accounts: treeAccounts, totals })
  } catch (e: any) {
    console.error('GET /api/reports/trial-balance error:', e)
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
