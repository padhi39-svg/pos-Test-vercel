import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getJournalEntries } from '@/lib/journalHelpers'
import { hasPermission } from '@/lib/permissions'
import { recalcHPP } from '@/app/api/recalc/route'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

async function calculateNeraca(pool: any, periodId: number) {
  const period = await rawGet<any>('SELECT start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0', [periodId])
  if (!period) throw new Error('Periode tidak ditemukan')
  const asOf = period.end_date
  const periodStart = period.start_date

  const accounts = await rawAll<any>(`
    SELECT id, code, name, parent_id, level, is_header, normal_balance, golongan
    FROM accounts WHERE is_active = 1 ORDER BY code
  `)

  const labaMapping = (await rawAll<any>(
    "SELECT account_id, map_key FROM account_mappings WHERE map_group = 'laba'"
  )).map((r: any) => ({ id: Number(r.account_id), key: r.map_key }))
  const ditahanCode = labaMapping.find(r => r.key === 'laba_ditahan')?.id
    ? accounts.find((a: any) => Number(a.id) === labaMapping.find(r => r.key === 'laba_ditahan')?.id)?.code
    : null
  const berjalanCode = labaMapping.find(r => r.key === 'laba_berjalan')?.id
    ? accounts.find((a: any) => Number(a.id) === labaMapping.find(r => r.key === 'laba_berjalan')?.id)?.code
    : null
  const bulanIniCode = labaMapping.find(r => r.key === 'laba_bulan_ini')?.id
    ? accounts.find((a: any) => Number(a.id) === labaMapping.find(r => r.key === 'laba_bulan_ini')?.id)?.code
    : null
  // Try to load previous period's balances as saldo awal
  const prevDate = new Date(asOf)
  prevDate.setMonth(prevDate.getMonth() - 1)
  const prevKey = { year: prevDate.getFullYear(), month: prevDate.getMonth() + 1 }
  let prevSaldo: Map<string, number> | null = null
  const prevRows = await rawAll<any>(
    'SELECT account_code, saldo_akhir FROM akun_saldo_bulanan WHERE year = $1 AND month = $2',
    [prevKey.year, prevKey.month]
  )
  if (prevRows.length > 0) prevSaldo = new Map(prevRows.map((r: any) => [r.account_code, Number(r.saldo_akhir) || 0]))
  const pakaiPrev = !!prevSaldo

  const GOLONGAN_CAT: Record<string, 'aset' | 'kewajiban' | 'ekuitas' | null> = {
    aset: 'aset',
    aset_lancar_kas: 'aset',
    aset_lancar_piutang: 'aset',
    aset_lancar_persediaan: 'aset',
    aset_lancar_lainnya: 'aset',
    aset_lancar: 'aset',
    aset_tidak_lancar: 'aset',
    kewajiban: 'kewajiban',
    kewajiban_lancar: 'kewajiban',
    kewajiban_tidak_lancar: 'kewajiban',
    ekuitas: 'ekuitas',
  }

  const PL_GOLONGAN = new Set(['pendapatan', 'hpp', 'beban', 'pendapatan_lain', 'beban_lain'])

  const codeGolongan = new Map<string, string | null>()
  for (const a of accounts) {
    codeGolongan.set(a.code, a.golongan || null)
  }

  const entries = await getJournalEntries(pakaiPrev ? periodStart : '2000-01-01', asOf)

  const balances = new Map<string, number>()
  const periodDebit = new Map<string, number>()
  const periodCredit = new Map<string, number>()
  for (const a of accounts) {
    let init = prevSaldo?.get(a.code) ?? 0
    if (pakaiPrev) {
      if (a.code === ditahanCode) init = (prevSaldo!.get(ditahanCode) ?? 0) + (prevSaldo!.get(berjalanCode) ?? 0)
      if (a.code === berjalanCode || a.code === bulanIniCode) init = 0
    }
    balances.set(a.code, init)
    periodDebit.set(a.code, 0)
    periodCredit.set(a.code, 0)
  }
  for (const e of entries) {
    if (balances.has(e.account_code)) {
      const cur = balances.get(e.account_code) || 0
      const acct = accounts.find((a: any) => a.code === e.account_code)
      const nb = acct?.normal_balance || 'D'
      balances.set(e.account_code, cur + (nb === 'D' ? e.debit - e.credit : e.credit - e.debit))

      if (e.entry_date >= periodStart) {
        periodDebit.set(e.account_code, (periodDebit.get(e.account_code) || 0) + e.debit)
        periodCredit.set(e.account_code, (periodCredit.get(e.account_code) || 0) + e.credit)
      }
    }
  }

  const saldoAwal = new Map<string, number>()
  for (const a of accounts) {
    if (pakaiPrev) {
      let sa = prevSaldo!.get(a.code) ?? 0
      if (a.code === ditahanCode) sa = (prevSaldo!.get(ditahanCode) ?? 0) + (prevSaldo!.get(berjalanCode) ?? 0)
      if (a.code === berjalanCode || a.code === bulanIniCode) sa = 0
      saldoAwal.set(a.code, sa)
    } else {
      const totalBal = balances.get(a.code) || 0
      const pd = periodDebit.get(a.code) || 0
      const pc = periodCredit.get(a.code) || 0
      const nb = a.normal_balance || 'D'
      const periodMovement = nb === 'D' ? pd - pc : pc - pd
      saldoAwal.set(a.code, totalBal - periodMovement)
    }
  }

  const balanceById = new Map<number, number>()
  const saldoAwalById = new Map<number, number>()
  const periodDebitById = new Map<number, number>()
  const periodCreditById = new Map<number, number>()
  const childrenOf = new Map<number | null, any[]>()
  for (const a of accounts) {
    const id = Number(a.id)
    const p = a.parent_id !== null ? Number(a.parent_id) : null
    if (!childrenOf.has(p)) childrenOf.set(p, [])
    childrenOf.get(p)!.push(a)
    balanceById.set(id, balances.get(a.code) || 0)
    saldoAwalById.set(id, saldoAwal.get(a.code) || 0)
    periodDebitById.set(id, periodDebit.get(a.code) || 0)
    periodCreditById.set(id, periodCredit.get(a.code) || 0)
  }

  function sumDescendants(nodeId: number, map: Map<number, number>): number {
    let total = map.get(nodeId) || 0
    const kids = childrenOf.get(nodeId) || []
    for (const kid of kids) total += sumDescendants(Number(kid.id), map)
    return total
  }

  const category = (golongan: string | null): 'aset' | 'kewajiban' | 'ekuitas' | null => {
    if (!golongan) return null
    return GOLONGAN_CAT[golongan] || null
  }

  const aset: any[] = []
  const kewajiban: any[] = []
  const ekuitas: any[] = []

  for (const a of accounts) {
    const cat = category(a.golongan || null)
    const item = {
      id: a.id, code: a.code || '', name: a.name || '',
      parent_id: a.parent_id, level: a.level, is_header: a.is_header,
      normal_balance: a.normal_balance, balance: 0,
      saldo_awal: 0, debit: 0, kredit: 0,
    }
    const isParent = (childrenOf.get(Number(a.id))?.length ?? 0) > 0
    if (isParent) {
      item.balance = sumDescendants(Number(a.id), balanceById)
      item.saldo_awal = sumDescendants(Number(a.id), saldoAwalById)
      item.debit = sumDescendants(Number(a.id), periodDebitById)
      item.kredit = sumDescendants(Number(a.id), periodCreditById)
    } else {
      item.balance = Number(balances.get(a.code) || 0)
      item.saldo_awal = Number(saldoAwal.get(a.code) || 0)
      item.debit = Number(periodDebit.get(a.code) || 0)
      item.kredit = Number(periodCredit.get(a.code) || 0)
    }

    if (cat === 'aset') aset.push(item)
    else if (cat === 'kewajiban') kewajiban.push(item)
    else if (cat === 'ekuitas') ekuitas.push(item)
  }

  const getBal = (targetCat: 'aset' | 'kewajiban' | 'ekuitas'): number => {
    let total = 0
    for (const a of accounts) {
      if (category(a.golongan || null) === targetCat) total += Number(balances.get(a.code) || 0)
    }
    return total
  }
  const totalAset = getBal('aset')
  const totalKewajiban = getBal('kewajiban')
  const totalEkuitas = getBal('ekuitas')

  let labaKumulatif = 0
  let labaPeriode = 0
  for (const e of entries) {
    const g = codeGolongan.get(e.account_code) || null
    if (g && PL_GOLONGAN.has(g)) {
      labaKumulatif += Number(e.credit || 0) - Number(e.debit || 0)
      if (e.entry_date >= periodStart) labaPeriode += Number(e.credit || 0) - Number(e.debit || 0)
    }
  }

  const prevYrRows = await rawAll<any>(
    "SELECT account_code, saldo_akhir FROM akun_saldo_bulanan WHERE year = $1 AND month = 12",
    [new Date(asOf).getFullYear() - 1]
  )
  const prevPLBal = new Map(prevYrRows.map((r: any) => [r.account_code, Number(r.saldo_akhir) || 0]))
  let prevYearPL = 0
  for (const a of accounts) {
    const bal = prevPLBal.get(a.code) || 0
    const g = a.golongan || ''
    if (g === 'pendapatan' || g === 'pendapatan_lain') {
      prevYearPL += Number(a.normal_balance === 'C' ? bal : -bal)
    } else if (g === 'hpp' || g === 'beban' || g === 'beban_lain') {
      prevYearPL -= Number(a.normal_balance === 'D' ? bal : -bal)
    }
  }
  const ytdLaba = labaPeriode - prevYearPL

  // Compute laba ditahan from saved data or prior year
  let labaDitahanVal = 0
  if (pakaiPrev && ditahanCode && berjalanCode) {
    labaDitahanVal = (prevSaldo!.get(ditahanCode) ?? 0) + (prevSaldo!.get(berjalanCode) ?? 0)
  } else {
    const dm = labaMapping.find(r => r.key === 'laba_ditahan')
    if (dm) {
      const dc = ekuitas.find(a => Number(a.id) === dm.id)?.code
      if (dc) labaDitahanVal = prevPLBal.get(dc) || 0
    }
  }

  if (labaMapping.length > 0) {
    const prevDitahan = pakaiPrev && ditahanCode
      ? (prevSaldo!.get(ditahanCode) ?? 0)
      : (prevPLBal.get(ekuitas.find(a => Number(a.id) === labaMapping.find(r => r.key === 'laba_ditahan')?.id)?.code || '') ?? 0)
    const labaAdj = labaDitahanVal - prevDitahan
    for (const item of ekuitas) {
      const m = labaMapping.find(r => r.id === Number(item.id))
      if (m?.key === 'laba_bulan_ini' || m?.key === 'laba_berjalan') {
        item.balance = ytdLaba
        item.saldo_awal = 0
        if (ytdLaba >= 0) { item.kredit = ytdLaba; item.debit = 0 }
        else { item.debit = -ytdLaba; item.kredit = 0 }
      } else if (m?.key === 'laba_ditahan') {
        item.balance = labaDitahanVal
        item.saldo_awal = prevDitahan
        if (labaAdj >= 0) { item.kredit = labaAdj; item.debit = 0 }
        else { item.debit = -labaAdj; item.kredit = 0 }
      }
    }
    const parentId = await rawGet<any>("SELECT parent_id FROM accounts WHERE id = $1", [labaMapping[0].id])
    if (parentId?.parent_id) {
      const parent = ekuitas.find(a => Number(a.id) === parentId.parent_id)
      if (parent) {
        parent.balance = ytdLaba + labaDitahanVal
        parent.saldo_awal = prevDitahan
        const parentAdj = ytdLaba + labaAdj
        if (parentAdj >= 0) { parent.kredit = parentAdj; parent.debit = 0 }
        else { parent.debit = -parentAdj; parent.kredit = 0 }
      }
    }
  }

  if (Math.abs(ytdLaba) > 0.01) {
    const labaLaba: any = {
      id: 0, code: '', name: 'Laba Periode Berjalan', parent_id: null,
      level: 2, is_header: 0, normal_balance: 'C',
      balance: ytdLaba, saldo_awal: 0,
    }
    if (ytdLaba >= 0) { labaLaba.kredit = ytdLaba; labaLaba.debit = 0 }
    else { labaLaba.debit = -ytdLaba; labaLaba.kredit = 0 }
    ekuitas.push(labaLaba)
  }

  // Save balances to akun_saldo_bulanan for future periods
  const saveYear = new Date(asOf).getFullYear()
  const saveMonth = new Date(asOf).getMonth() + 1
  for (const a of accounts) {
    const bal = balances.get(a.code) ?? 0
    let finalBal = bal
    // Laba Tahun Berjalan & Bulan Ini: save as ytd (closed), Laba Ditahan: keep raw balance
    if (a.code === berjalanCode || a.code === bulanIniCode) finalBal = ytdLaba
    await rawRun(
      `INSERT INTO akun_saldo_bulanan (account_code, year, month, saldo_akhir)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (account_code, year, month) DO UPDATE SET saldo_akhir = $4`,
      [a.code, saveYear, saveMonth, finalBal]
    )
  }

  const labaUntukPersamaan = pakaiPrev ? labaPeriode : labaKumulatif
  return {
    aset: { total: totalAset, akun: aset },
    kewajiban: { total: totalKewajiban, akun: kewajiban },
    ekuitas: { total: totalEkuitas + labaUntukPersamaan, akun: ekuitas },
    total_aset: totalAset,
    total_kewajiban_ekuitas: totalKewajiban + totalEkuitas + labaUntukPersamaan,
    laba_periode_berjalan: ytdLaba,
    selisih: Math.round((totalAset - (totalKewajiban + totalEkuitas + labaUntukPersamaan)) * 100) / 100,
  }
}

async function calculateLabaRugi(pool: any, periodId: number) {
  const period = await rawGet<any>('SELECT start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0', [periodId])
  if (!period) throw new Error('Periode tidak ditemukan')

  const accounts = await rawAll<any>('SELECT code, name, normal_balance, golongan FROM accounts WHERE is_active = 1 ORDER BY code')
  const allEntries = await getJournalEntries(period.start_date, period.end_date)

  const balances = new Map<string, number>()
  for (const a of accounts) balances.set(a.code, 0)
  for (const e of allEntries) {
    if (balances.has(e.account_code)) {
      const cur = balances.get(e.account_code) || 0
      const acct = accounts.find((a: any) => a.code === e.account_code)
      const nb = acct?.normal_balance || 'D'
      balances.set(e.account_code, cur + (nb === 'D' ? e.debit - e.credit : e.credit - e.debit))
    }
  }

  const GOLONGAN_LR: Record<string, string> = {
    pendapatan: 'pendapatan',
    hpp: 'hpp',
    beban: 'beban',
    pendapatan_lain: 'pendapatan',
    beban_lain: 'beban_lain',
  }

  const cat = (golongan: string | null): string => {
    if (!golongan) return 'other'
    return GOLONGAN_LR[golongan] || 'other'
  }

  const pendapatan: any[] = []
  const hpp: any[] = []
  const beban: any[] = []
  const bebanLain: any[] = []

  for (const a of accounts) {
    const g = a.golongan || null
    if (!g || !GOLONGAN_LR[g]) continue
    const bal = balances.get(a.code) || 0
    const c = cat(g)
    const item = { code: a.code, name: a.name || '', balance: bal }
    if (c === 'pendapatan') pendapatan.push(item)
    else if (c === 'hpp') hpp.push(item)
    else if (c === 'beban') beban.push(item)
    else if (c === 'beban_lain') bebanLain.push(item)
  }

  const sumBal = (items: any[]) => items.reduce((s, i) => s + i.balance, 0)
  const totalPendapatan = sumBal(pendapatan)
  const totalHpp = sumBal(hpp)
  const totalBeban = sumBal(beban)
  const totalBebanLain = sumBal(bebanLain)
  const labaKotor = totalPendapatan - totalHpp
  const labaBersih = labaKotor - totalBeban - totalBebanLain

  const result: any = {
    pendapatan: { total: totalPendapatan, akun: pendapatan },
    harga_pokok_penjualan: { total: totalHpp, akun: hpp },
    beban: { total: totalBeban, akun: beban },
    beban_lain: { total: totalBebanLain, akun: bebanLain },
    laba_kotor: Math.round(labaKotor * 100) / 100,
    laba_bersih: Math.round(labaBersih * 100) / 100,
  }

  const curPeriod = await rawGet<any>('SELECT id, name, start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0', [periodId])
  if (curPeriod) {
    const prevPeriod = await rawGet<any>(
      `SELECT id, name, start_date, end_date FROM master_periode
       WHERE end_date < $1 AND isdelete = 0 ORDER BY end_date DESC LIMIT 1`,
      [curPeriod.start_date]
    )
    if (prevPeriod) {
      const prevEntries = await getJournalEntries(prevPeriod.start_date, prevPeriod.end_date)
      const prevBalances = new Map<string, number>()
      for (const a of accounts) prevBalances.set(a.code, 0)
      for (const e of prevEntries) {
        if (prevBalances.has(e.account_code)) {
          const cur = prevBalances.get(e.account_code) || 0
          const acct = accounts.find((a: any) => a.code === e.account_code)
          const nb = acct?.normal_balance || 'D'
          prevBalances.set(e.account_code, cur + (nb === 'D' ? e.debit - e.credit : e.credit - e.debit))
        }
      }
      const build = (items: any[]) => items.map((a: any) => {
        const code = String(a.code || '')
        const bal = prevBalances.get(code) || 0
        return { code, name: a.name || '', balance: bal }
      })
      const pPend = build(accounts.filter((a: any) => cat(a.golongan || null) === 'pendapatan'))
      const pHpp = build(accounts.filter((a: any) => cat(a.golongan || null) === 'hpp'))
      const pBeban = build(accounts.filter((a: any) => cat(a.golongan || null) === 'beban'))
      const pBebanLain = build(accounts.filter((a: any) => cat(a.golongan || null) === 'beban_lain'))
      const ptotalPend = sumBal(pPend)
      const ptotalHpp = sumBal(pHpp)
      const ptotalBeban = sumBal(pBeban)
      const ptotalBebanLain = sumBal(pBebanLain)
      const plabaKotor = ptotalPend - ptotalHpp
      const plabaBersih = plabaKotor - ptotalBeban - ptotalBebanLain

      result.previous = {
        pendapatan: { total: ptotalPend, akun: pPend },
        harga_pokok_penjualan: { total: ptotalHpp, akun: pHpp },
        beban: { total: ptotalBeban, akun: pBeban },
        beban_lain: { total: ptotalBebanLain, akun: pBebanLain },
        laba_kotor: Math.round(plabaKotor * 100) / 100,
        laba_bersih: Math.round(plabaBersih * 100) / 100,
      }
      result.prevPeriodName = prevPeriod.name
    }
  }

  return result
}

async function calculateTrialBalance(pool: any, year: number) {
  const allAccounts = await rawAll<any>(`
    SELECT id, code, name, parent_id, level, is_header, normal_balance, posting_allowed, golongan
    FROM accounts WHERE is_active = 1 ORDER BY code
  `)

  const postingAccounts = allAccounts.filter((a: any) => Number(a.is_header) === 0)

  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`
  const allEntries = await getJournalEntries('2000-01-01', endDate)

  const entriesByMonth: Map<string, any[]> = new Map()
  for (let m = 1; m <= 12; m++) entriesByMonth.set(String(m).padStart(2, '0'), [])
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
    for (const a of postingAccounts) snap[a.code] = running.get(a.code) || 0
    monthlyBalances[month] = snap
  }

  function getPostingBalance(code: string, monthIdx: number): number {
    return monthlyBalances[String(monthIdx + 1).padStart(2, '0')]?.[code] || 0
  }

  const childrenOf = new Map<number | null, any[]>()
  for (const a of allAccounts) {
    const p = a.parent_id !== null ? Number(a.parent_id) : null
    if (!childrenOf.has(p)) childrenOf.set(p, [])
    childrenOf.get(p)!.push(a)
  }

  const memo = new Map<number, number[]>()
  function sumDescendants(nodeId: number, monthsCount: number): number[] {
    if (memo.has(nodeId)) return memo.get(nodeId)!
    const node = allAccounts.find(a => Number(a.id) === nodeId)
    if (!node) return new Array(monthsCount).fill(0)

    const monthly = new Array(monthsCount).fill(0)
    if (Number(node.is_header) === 0) {
      for (let m = 0; m < monthsCount; m++) monthly[m] = getPostingBalance(node.code, m)
    } else {
      const kids = childrenOf.get(nodeId) || []
      for (const kid of kids) {
        const kidMonthly = sumDescendants(Number(kid.id), monthsCount)
        for (let m = 0; m < monthsCount; m++) monthly[m] += kidMonthly[m]
      }
    }
    memo.set(nodeId, monthly)
    return monthly
  }

  const filtered = allAccounts.filter((a: any) => String(a.code || '').length > 0 && a.level >= 1)
  const treeAccounts = filtered.map(a => {
    const monthly = sumDescendants(Number(a.id), 12)
    return {
      id: Number(a.id), code: a.code, name: a.name, parent_id: a.parent_id,
      level: a.level, is_header: a.is_header, normal_balance: a.normal_balance, golongan: a.golongan, monthly,
    }
  })

  const labaMappings = (await rawAll<any>(
    "SELECT account_id, map_key FROM account_mappings WHERE map_group = 'laba'"
  )).map((r: any) => ({ id: Number(r.account_id), key: r.map_key }))

  if (labaMappings.length > 0) {
    const labaIds = labaMappings.map(r => r.id)
    const totPL = Array.from({ length: 12 }, (_, m) => {
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
      else if (m?.key === 'laba_ditahan') a.monthly = Array.from({ length: 12 }, () => parseFloat(labaDitahanVal.toFixed(2)))
    }
    const parentId = labaMappings.length > 0 ? await rawGet<any>(
      "SELECT parent_id FROM accounts WHERE id = $1",
      [labaMappings[0].id]
    ) : null
    if (parentId?.parent_id) {
      const parent = treeAccounts.find(a => Number(a.id) === parentId.parent_id)
      if (parent) parent.monthly = ytdPL.map((v, m) => parseFloat((v + labaDitahanVal).toFixed(2)))
    }
  }

  const totals = Array.from({ length: 12 }, (_, m) =>
    treeAccounts.reduce((s, r) => s + (r.monthly[m] ?? 0), 0)
  )

  return { mode: 'annual', year, monthNames: MONTHS, accounts: treeAccounts, totals }
}

export async function GET(req: NextRequest) {
  try {
    const pool = (getDb() as any).$client
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'check'
    const type = url.searchParams.get('type')
    const periodId = url.searchParams.get('periodId')

    if (!type || !periodId) {
      return NextResponse.json({ error: 'Parameter type dan periodId diperlukan' }, { status: 400 })
    }

    const pId = Number(periodId)
    if (isNaN(pId)) {
      return NextResponse.json({ error: 'periodId tidak valid' }, { status: 400 })
    }

    if (action === 'check') {
      const row = await rawGet<any>(
        'SELECT created_at FROM report_snapshot_cache WHERE report_type = $1 AND period_id = $2',
        [type, pId]
      )
      return NextResponse.json({
        exists: !!row,
        created_at: row?.created_at || null,
      })
    }

    if (action === 'load') {
      const row = await rawGet<any>(
        'SELECT data FROM report_snapshot_cache WHERE report_type = $1 AND period_id = $2',
        [type, pId]
      )
      if (!row) {
        return NextResponse.json({ error: 'Snapshot tidak ditemukan. Hitung ulang terlebih dahulu.' }, { status: 404 })
      }
      return NextResponse.json(JSON.parse(row.data))
    }

    return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_neraca', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const pool = (getDb() as any).$client
    const url = new URL(req.url)
    const type = url.searchParams.get('type')
    const periodId = url.searchParams.get('periodId')

    if (!type || !periodId) {
      return NextResponse.json({ error: 'Parameter type dan periodId diperlukan' }, { status: 400 })
    }

    const pId = Number(periodId)
    if (isNaN(pId)) {
      return NextResponse.json({ error: 'periodId tidak valid' }, { status: 400 })
    }

    let data: any
    const db = getDb()
    if (type === 'neraca') {
      await recalcHPP(db, pId)
      data = await calculateNeraca(pool, pId)
    } else if (type === 'laba_rugi') {
      data = await calculateLabaRugi(pool, pId)
    } else if (type === 'trial_balance') {
      data = await calculateTrialBalance(pool, pId)
    } else if (type === 'neraca_labarugi') {
      await recalcHPP(db, pId)
      const neraca = await calculateNeraca(pool, pId)
      const labaRugi = await calculateLabaRugi(pool, pId)
      data = { neraca, laba_rugi: labaRugi }
    } else {
      return NextResponse.json({ error: 'Tipe laporan tidak dikenal' }, { status: 400 })
    }

    const jsonStr = JSON.stringify(data)

    await rawRun(
      `INSERT INTO report_snapshot_cache (report_type, period_id, data, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (report_type, period_id) DO UPDATE SET data = EXCLUDED.data, created_at = NOW()`,
      [type, pId, jsonStr]
    )

    return NextResponse.json({
      success: true,
      message: 'Data berhasil dihitung dan disimpan',
      type,
      periodId: pId,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
