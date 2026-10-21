import { getDb } from '@/db'
import { rawAll, rawGet } from '@/db/raw'
import { getJournalEntriesFromTable, getJournalBalanceBefore } from '@/lib/journalHelpers'

export interface AccountNode {
  id: number
  code: string
  name: string
  parent_id: number | null
  level: number
  is_header: number
  normal_balance: string
  golongan: string | null
}

export async function getActiveAccounts() {
  return rawAll<any>('SELECT id, code, name, parent_id, level, is_header, normal_balance, golongan, posting_allowed FROM accounts WHERE is_active = 1 ORDER BY code')
}

export async function getPostingAccounts() {
  return rawAll<any>('SELECT id, code, name, parent_id, level, is_header, normal_balance, golongan, posting_allowed FROM accounts WHERE is_active = 1 AND is_header = 0 ORDER BY code')
}

export async function getPeriod(id: number) {
  return rawGet<any>('SELECT start_date, end_date, name FROM master_periode WHERE id = $1 AND isdelete = 0', [id])
}

export async function getLabaMappings() {
  const rows = await rawAll<any>("SELECT account_id, map_key FROM account_mappings WHERE map_group = 'laba'")
  return rows.map((r: any) => ({ id: Number(r.account_id), key: r.map_key }))
}

export async function getPrevYearBalances(year: number) {
  const rows = await rawAll<any>("SELECT account_code, saldo_akhir FROM akun_saldo_bulanan WHERE year = $1 AND month = 12", [year])
  return new Map(rows.map((r: any) => [r.account_code, Number(r.saldo_akhir) || 0]))
}

export async function getAccountMappingParent(labaMappingId: number) {
  return rawGet<any>("SELECT parent_id FROM accounts WHERE id = $1", [labaMappingId])
}

// ---- Neraca ----
export async function getNeraca(asOf?: string, periodId?: string) {
  if (!asOf) asOf = new Date().toISOString().slice(0, 10)
  let periodStart = '2000-01-01'
  let prevPeriodKey: { year: number; month: number } | null = null
  if (periodId) {
    const period = await getPeriod(Number(periodId))
    if (period) { asOf = period.end_date; periodStart = period.start_date }
    // Determine previous period's year/month for saldo_awal lookup
    const d = new Date(asOf)
    d.setMonth(d.getMonth() - 1)
    prevPeriodKey = { year: d.getFullYear(), month: d.getMonth() + 1 }
  }

  const accounts = await getActiveAccounts()
  const labaMapping = await getLabaMappings()
  const ditahanCode = labaMapping.find((r: any) => r.key === 'laba_ditahan')?.id
    ? accounts.find((a: any) => Number(a.id) === labaMapping.find((r: any) => r.key === 'laba_ditahan')?.id)?.code
    : null
  const berjalanCode = labaMapping.find((r: any) => r.key === 'laba_berjalan')?.id
    ? accounts.find((a: any) => Number(a.id) === labaMapping.find((r: any) => r.key === 'laba_berjalan')?.id)?.code
    : null
  const bulanIniCode = labaMapping.find((r: any) => r.key === 'laba_bulan_ini')?.id
    ? accounts.find((a: any) => Number(a.id) === labaMapping.find((r: any) => r.key === 'laba_bulan_ini')?.id)?.code
    : null

  // Try to load previous period's balances as saldo awal
  let prevSaldo: Map<string, number> | null = null
  if (prevPeriodKey) {
    const rows = await rawAll<any>(
      'SELECT account_code, saldo_akhir FROM akun_saldo_bulanan WHERE year = $1 AND month = $2',
      [prevPeriodKey.year, prevPeriodKey.month]
    )
    if (rows.length > 0) prevSaldo = new Map(rows.map((r: any) => [r.account_code, Number(r.saldo_akhir) || 0]))
  }
  const pakaiPrev = !!prevSaldo

  const entries = await getJournalEntriesFromTable(pakaiPrev ? periodStart : '2000-01-01', asOf!)

  const GOLONGAN_CAT: Record<string, string | null> = {
    aset: 'aset', aset_lancar_kas: 'aset', aset_lancar_piutang: 'aset', aset_lancar_persediaan: 'aset',
    aset_lancar_lainnya: 'aset', aset_lancar: 'aset', aset_tidak_lancar: 'aset',
    kewajiban: 'kewajiban', kewajiban_lancar: 'kewajiban', kewajiban_tidak_lancar: 'kewajiban',
    ekuitas: 'ekuitas',
  }
  const PL_GOLONGAN = new Set(['pendapatan', 'hpp', 'beban', 'pendapatan_lain', 'beban_lain'])
  const codeGolongan = new Map(accounts.map((a: any) => [a.code, a.golongan || null]))

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
      saldoAwal.set(a.code, totalBal - (nb === 'D' ? pd - pc : pc - pd))
    }
  }

  const balanceById = new Map<number, number>()
  const saldoAwalById = new Map<number, number>()
  const periodDebitById = new Map<number, number>()
  const periodCreditById = new Map<number, number>()
  const childrenOf = new Map<number | null, any[]>()
  for (const a of accounts) {
    const id = Number(a.id); const p = a.parent_id !== null ? Number(a.parent_id) : null
    if (!childrenOf.has(p)) childrenOf.set(p, [])
    childrenOf.get(p)!.push(a)
    balanceById.set(id, balances.get(a.code) || 0)
    saldoAwalById.set(id, saldoAwal.get(a.code) || 0)
    periodDebitById.set(id, periodDebit.get(a.code) || 0)
    periodCreditById.set(id, periodCredit.get(a.code) || 0)
  }
  function sumDescendants(nodeId: number, map: Map<number, number>): number {
    let total = map.get(nodeId) || 0
    for (const kid of childrenOf.get(nodeId) || []) total += sumDescendants(Number(kid.id), map)
    return total
  }
  const category = (golongan: string | null) => (golongan ? GOLONGAN_CAT[golongan] || null : null)
  // Resolve section (aset/kewajiban/ekuitas/null) per account, inferring from children for headers
  const sectionCache = new Map<number, string | null>()
  function resolveSection(a: any): string | null {
    const id = Number(a.id)
    if (sectionCache.has(id)) return sectionCache.get(id)!
    if (a.golongan) {
      const s = category(a.golongan)
      sectionCache.set(id, s)
      return s
    }
    if (a.is_header === 1) {
      const kids = accounts.filter((c: any) => Number(c.parent_id) === id)
      for (const kid of kids) {
        const s = resolveSection(kid)
        if (s) { sectionCache.set(id, s); return s }
      }
    }
    sectionCache.set(id, null)
    return null
  }
  const aset: any[] = []; const kewajiban: any[] = []; const ekuitas: any[] = []
  for (const a of accounts) {
    const cat = resolveSection(a)
    const isParent = (childrenOf.get(Number(a.id))?.length ?? 0) > 0
    const item: any = { id: a.id, code: a.code || '', name: a.name || '', parent_id: a.parent_id, level: a.level, is_header: a.is_header, normal_balance: a.normal_balance, balance: 0, saldo_awal: 0, debit: 0, kredit: 0 }
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
  const getBal = (targetCat: string) => accounts.reduce((s: number, a: any) => s + (category(a.golongan || null) === targetCat ? Number(balances.get(a.code) || 0) : 0), 0)
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

  const prevPLBal = await getPrevYearBalances(new Date(asOf!).getFullYear() - 1)
  let prevYearPL = 0
  for (const a of accounts) {
    const bal = prevPLBal.get(a.code) || 0; const g = a.golongan || ''
    if (g === 'pendapatan' || g === 'pendapatan_lain') prevYearPL += Number(a.normal_balance === 'C' ? bal : -bal)
    else if (g === 'hpp' || g === 'beban' || g === 'beban_lain') prevYearPL -= Number(a.normal_balance === 'D' ? bal : -bal)
  }
  const ytdLaba = labaPeriode - prevYearPL

  // Compute laba ditahan from saved data or prior year
  let labaDitahanVal = 0
  if (pakaiPrev && ditahanCode && berjalanCode) {
    labaDitahanVal = (prevSaldo!.get(ditahanCode) ?? 0) + (prevSaldo!.get(berjalanCode) ?? 0)
  } else {
    const dm = labaMapping.find((r: any) => r.key === 'laba_ditahan')
    if (dm) { const dc = ekuitas.find((a: any) => Number(a.id) === dm.id)?.code; if (dc) labaDitahanVal = prevPLBal.get(dc) || 0 }
  }

  if (labaMapping.length > 0) {
    // Previous Laba Ditahan balance before this period's closing adjustment
    const prevDitahan = pakaiPrev && ditahanCode
      ? (prevSaldo!.get(ditahanCode) ?? 0)
      : (labaMapping.find((r: any) => r.key === 'laba_ditahan') 
        ? (prevPLBal.get(ekuitas.find((a: any) => Number(a.id) === labaMapping.find((r: any) => r.key === 'laba_ditahan')?.id)?.code || '') ?? 0)
        : 0)
    const labaAdj = labaDitahanVal - prevDitahan
    for (const item of ekuitas) {
      const m = labaMapping.find((r: any) => r.id === Number(item.id))
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
    const parentId = await getAccountMappingParent(labaMapping[0].id)
    if (parentId?.parent_id) {
      const parent = ekuitas.find((a: any) => Number(a.id) === parentId.parent_id)
      if (parent) {
        parent.balance = ytdLaba + labaDitahanVal
        parent.saldo_awal = prevDitahan
        const parentAdj = (ytdLaba + labaAdj)
        if (parentAdj >= 0) { parent.kredit = parentAdj; parent.debit = 0 }
        else { parent.debit = -parentAdj; parent.kredit = 0 }
      }
    }
  }
  if (Math.abs(ytdLaba) > 0.01) {
    const labaLaba: any = { id: 0, code: '', name: 'Laba Periode Berjalan', parent_id: null, level: 2, is_header: 0, normal_balance: 'C', balance: ytdLaba, saldo_awal: 0 }
    if (ytdLaba >= 0) { labaLaba.kredit = ytdLaba; labaLaba.debit = 0 }
    else { labaLaba.debit = -ytdLaba; labaLaba.kredit = 0 }
    ekuitas.push(labaLaba)
  }

  // Save balances to akun_saldo_bulanan for future periods
  if (periodId) {
    const saveYear = new Date(asOf!).getFullYear()
    const saveMonth = new Date(asOf!).getMonth() + 1
    for (const a of accounts) {
      const bal = balances.get(a.code) ?? 0
      let finalBal = bal
      // Laba Tahun Berjalan & Laba Bulan Ini: save as ytd (closed value for next period)
      if (a.code === berjalanCode || a.code === bulanIniCode) finalBal = ytdLaba
      await rawRun(
        `INSERT INTO akun_saldo_bulanan (account_code, year, month, saldo_akhir)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (account_code, year, month) DO UPDATE SET saldo_akhir = $4`,
        [a.code, saveYear, saveMonth, finalBal]
      )
    }
  }

  const labaUntukPersamaan = pakaiPrev ? labaPeriode : labaKumulatif
  return { aset: { total: totalAset, akun: aset }, kewajiban: { total: totalKewajiban, akun: kewajiban }, ekuitas: { total: totalEkuitas, akun: ekuitas }, total_aset: totalAset, total_kewajiban_ekuitas: totalKewajiban + totalEkuitas + labaUntukPersamaan, laba_periode_berjalan: ytdLaba, selisih: Math.round((totalAset - (totalKewajiban + totalEkuitas + labaUntukPersamaan)) * 100) / 100 }
}

// ---- Laba Rugi ----
export async function getLabaRugi(startDate: string, endDate: string) {
  const accounts = await rawAll<any>('SELECT code, name, normal_balance, golongan FROM accounts WHERE is_active = 1 ORDER BY code')
  const entries = await getJournalEntriesFromTable(startDate, endDate)

  const balances = new Map<string, number>()
  for (const a of accounts) balances.set(a.code, 0)
  for (const e of entries) {
    if (balances.has(e.account_code)) {
      const cur = balances.get(e.account_code) || 0
      const acct = accounts.find((a: any) => a.code === e.account_code)
      balances.set(e.account_code, cur + ((acct?.normal_balance || 'D') === 'D' ? e.debit - e.credit : e.credit - e.debit))
    }
  }

  const GOLONGAN_LR: Record<string, string> = { pendapatan: 'pendapatan', hpp: 'hpp', beban: 'beban', pendapatan_lain: 'pendapatan', beban_lain: 'beban_lain' }
  const cat = (golongan: string | null) => (golongan ? GOLONGAN_LR[golongan] || 'other' : 'other')
  const pendapatan: any[] = []; const hpp: any[] = []; const beban: any[] = []; const bebanLain: any[] = []
  for (const a of accounts) {
    const code = String(a.code || ''); const g = a.golongan || null; const c = cat(g)
    if (c === 'other') continue
    const bal = balances.get(code) || 0
    const item = { code, name: a.name || '', balance: bal }
    if (c === 'pendapatan') pendapatan.push(item); else if (c === 'hpp') hpp.push(item); else if (c === 'beban') beban.push(item); else if (c === 'beban_lain') bebanLain.push(item)
  }
  const sumBal = (items: any[]) => items.reduce((s, i) => s + i.balance, 0)
  const totP = sumBal(pendapatan); const totH = sumBal(hpp); const totB = sumBal(beban); const totBL = sumBal(bebanLain)
  const lk = totP - totH; const lb = lk - totB - totBL
  return { pendapatan: { total: totP, akun: pendapatan }, harga_pokok_penjualan: { total: totH, akun: hpp }, beban: { total: totB, akun: beban }, beban_lain: { total: totBL, akun: bebanLain }, laba_kotor: Math.round(lk * 100) / 100, laba_bersih: Math.round(lb * 100) / 100 }
}

// ---- Neraca Laba Rugi ----
export async function getNeracaLabaRugi(periodId: number) {
  const period = await getPeriod(periodId)
  if (!period) throw new Error('Periode not found')
  const accounts = await getActiveAccounts()
  const entries = await getJournalEntriesFromTable(period.start_date, period.end_date)

  const GOLONGAN_CAT: Record<string, string | null> = {
    aset: 'aset', aset_lancar_kas: 'aset', aset_lancar_piutang: 'aset', aset_lancar_persediaan: 'aset',
    aset_lancar_lainnya: 'aset', aset_lancar: 'aset', aset_tidak_lancar: 'aset',
    kewajiban: 'kewajiban', kewajiban_lancar: 'kewajiban', kewajiban_tidak_lancar: 'kewajiban',
    ekuitas: 'ekuitas_nr',
  }
  const GOLONGAN_LR: Record<string, string | null> = {
    pendapatan: 'pendapatan', hpp: 'hpp', beban: 'beban', pendapatan_lain: 'pendapatan', beban_lain: 'beban_lain',
  }
  const balances = new Map<string, number>()
  for (const a of accounts) balances.set(a.code, 0)
  for (const e of entries) {
    if (balances.has(e.account_code)) {
      const cur = balances.get(e.account_code) || 0
      const acct = accounts.find((a: any) => a.code === e.account_code)
      balances.set(e.account_code, cur + ((acct?.normal_balance || 'D') === 'D' ? e.debit - e.credit : e.credit - e.debit))
    }
  }
  const balanceById = new Map<number, number>()
  const childrenOf = new Map<number | null, any[]>()
  for (const a of accounts) {
    const id = Number(a.id); const p = a.parent_id !== null ? Number(a.parent_id) : null
    if (!childrenOf.has(p)) childrenOf.set(p, [])
    childrenOf.get(p)!.push(a)
    balanceById.set(id, balances.get(a.code) || 0)
  }
  function sumDescendants(nodeId: number): number {
    let total = balanceById.get(nodeId) || 0
    for (const kid of childrenOf.get(nodeId) || []) total += sumDescendants(Number(kid.id))
    return total
  }
  const neracaCat = (g: string | null) => (g ? GOLONGAN_CAT[g] || null : null)
  const aset: any[] = []; const kewajiban: any[] = []; const ekuitas: any[] = []
  for (const a of accounts) {
    const cat = neracaCat(a.golongan || null)
    if (!cat) continue
    const item: any = { id: a.id, code: a.code, name: a.name || '', parent_id: a.parent_id, level: a.level, is_header: a.is_header, normal_balance: a.normal_balance, balance: 0 }
    const isParent = (childrenOf.get(Number(a.id))?.length ?? 0) > 0
    if (isParent) item.balance = sumDescendants(Number(a.id))
    else if (a.is_header === 0) item.balance = Number(balances.get(a.code) || 0)
    else continue
    if (cat === 'aset') aset.push(item); else if (cat === 'kewajiban') kewajiban.push(item); else ekuitas.push(item)
  }
  const sumBal = (items: any[]) => items.reduce((s, i) => s + i.balance, 0)
  const totalAset = sumBal(aset); const totalKewajiban = sumBal(kewajiban); const totalEkuitas = sumBal(ekuitas)
  const getBal = (target: string) => accounts.reduce((s: number, a: any) => s + ((GOLONGAN_LR[a.golongan || ''] === target) ? (balances.get(a.code) || 0) : 0), 0)
  const totP = getBal('pendapatan'); const totH = getBal('hpp'); const totB = getBal('beban'); const totBL = getBal('beban_lain')
  const lk = totP - totH; const lb = lk - totB - totBL
  const labaRugiCat = (g: string | null) => (g ? GOLONGAN_LR[g] || null : null)
  const pLR: any[] = []; const hLR: any[] = []; const bLR: any[] = []; const blLR: any[] = []
  for (const a of accounts) {
    const c = labaRugiCat(a.golongan || null)
    if (!c) continue
    const bal = balances.get(a.code) || 0
    if (bal === 0) continue
    const item = { code: a.code, name: a.name || '', balance: bal }
    if (c === 'pendapatan') pLR.push(item); else if (c === 'hpp') hLR.push(item); else if (c === 'beban') bLR.push(item); else if (c === 'beban_lain') blLR.push(item)
  }
  const lrSum = (items: any[]) => items.reduce((s, i) => s + i.balance, 0)
  const lrP = lrSum(pLR); const lrH = lrSum(hLR); const lrB = lrSum(bLR); const lrBL = lrSum(blLR)
  const lrLK = lrP - lrH; const lrLB = lrLK - lrB - lrBL
  return { neraca: { aset: { total: totalAset, akun: aset }, kewajiban: { total: totalKewajiban, akun: kewajiban }, ekuitas: { total: totalEkuitas, akun: ekuitas }, total_aset: totalAset, total_kewajiban_ekuitas: totalKewajiban + totalEkuitas, laba_periode_berjalan: lb, selisih: Math.round((totalAset - (totalKewajiban + totalEkuitas + lb)) * 100) / 100 }, laba_rugi: { pendapatan: { total: lrP, akun: pLR }, harga_pokok_penjualan: { total: lrH, akun: hLR }, beban: { total: lrB, akun: bLR }, beban_lain: { total: lrBL, akun: blLR }, laba_kotor: lrLK, laba_bersih: lrLB } }
}

// ---- Jurnal Harian ----
export async function getJurnalHarian(startDate?: string, endDate?: string, journalNumber?: string) {
  const openingBalance = startDate ? await getJournalBalanceBefore(startDate) : 0
  let entries = await getJournalEntriesFromTable(startDate || '', endDate || '')
  if (journalNumber) {
    const q = journalNumber.toLowerCase()
    entries = entries.filter(e => e.source_number.toLowerCase().includes(q))
  }
  const rows: any[] = []; let runningBalance = openingBalance; let lineId = 0
  for (const e of entries) {
    const debit = Number(e.debit || 0); const credit = Number(e.credit || 0)
    runningBalance += debit - credit
    rows.push({ id: ++lineId, entry_date: e.entry_date, source_number: e.source_number, source_type: e.source_type, account_code: e.account_code, account_name: e.account_name, description: e.description || '', debit, credit, balance: Math.round(runningBalance * 100) / 100 })
  }
  return { rows, openingBalance, totalDebit: rows.reduce((s, r) => s + r.debit, 0), totalCredit: rows.reduce((s, r) => s + r.credit, 0) }
}

// ---- Buku Besar ----
export async function getBukuBesar(accountCode?: string, startDate?: string, endDate?: string) {
  const start = startDate && !isNaN(new Date(startDate).getTime()) ? startDate : '2000-01-01'
  const end = endDate && !isNaN(new Date(endDate).getTime()) ? endDate : new Date().toISOString().slice(0, 10)
  const d = new Date(start); d.setDate(d.getDate() - 1)
  const beforeStart = start === '2000-01-01' ? '2000-01-01' : d.toISOString().slice(0, 10)
  const allBefore = await getJournalEntriesFromTable('2000-01-01', beforeStart)
  const entries = await getJournalEntriesFromTable(start, end)
  function pushRows(rows: any[], e: any, balBefore: number, nb: string, isSaldoAwal: boolean): number {
    const newBalance = isSaldoAwal ? balBefore : (balBefore + (nb === 'D' ? e.debit - e.credit : e.credit - e.debit))
    rows.push({ entry_date: isSaldoAwal ? start : e.entry_date, source_number: e.source_number || '', description: isSaldoAwal ? 'Saldo Awal' : (e.description || ''), debit: e.debit || 0, credit: e.credit || 0, balance: Math.round(newBalance * 100) / 100, is_balance: isSaldoAwal })
    return newBalance
  }
  if (!accountCode) {
    const accounts = await rawAll<any>('SELECT code, name, normal_balance FROM accounts WHERE posting_allowed = 1 ORDER BY code')
    const result: any[] = []
    for (const acct of accounts) {
      const nb = acct.normal_balance || 'D'
      let runningBalance = 0
      for (const e of allBefore) { if (e.account_code === acct.code) runningBalance += nb === 'D' ? e.debit - e.credit : e.credit - e.debit }
      const filtered = entries.filter(e => e.account_code === acct.code)
      if (!filtered.length && runningBalance === 0) continue
      const rows: any[] = []
      runningBalance = pushRows(rows, { account_code: acct.code, account_name: acct.name, entry_date: start, source_number: '', description: 'Saldo Awal', debit: 0, credit: 0 }, runningBalance, nb, true)
      for (const e of filtered) runningBalance = pushRows(rows, e, runningBalance, nb, false)
      result.push({ account_code: acct.code, account_name: acct.name, rows })
    }
    return { mode: 'all', accounts: result }
  }
  const acct = await rawGet<any>('SELECT code, name, normal_balance FROM accounts WHERE code = ?', [accountCode])
  if (!acct) throw new Error('Account not found')
  const nb = acct.normal_balance || 'D'
  let runningBalance = 0
  for (const e of allBefore) { if (e.account_code === accountCode) runningBalance += nb === 'D' ? e.debit - e.credit : e.credit - e.debit }
  const filtered = entries.filter(e => e.account_code === accountCode)
  const rows: any[] = []
  runningBalance = pushRows(rows, { account_code: acct.code, account_name: acct.name, entry_date: start, source_number: '', description: 'Saldo Awal', debit: 0, credit: 0 }, runningBalance, nb, true)
  for (const e of filtered) runningBalance = pushRows(rows, e, runningBalance, nb, false)
  return { mode: 'single', account_code: accountCode, account_name: acct.name, rows }
}

// ---- Coretax ----
export async function getCoretax(startDate: string, endDate: string) {
  const accounts = await rawAll<any>('SELECT code, name, normal_balance, golongan FROM accounts WHERE is_active = 1 ORDER BY code')
  const entries = await getJournalEntriesFromTable(startDate, endDate)
  const balances = new Map<string, number>()
  for (const a of accounts) balances.set(a.code, 0)
  for (const e of entries) {
    if (balances.has(e.account_code)) {
      const cur = balances.get(e.account_code) || 0
      const acct = accounts.find((a: any) => a.code === e.account_code)
      balances.set(e.account_code, cur + ((acct?.normal_balance || 'D') === 'D' ? e.debit - e.credit : e.credit - e.debit))
    }
  }
  const year = startDate.slice(0, 4)
  const corrections = await rawAll<any>('SELECT account_code, type, amount FROM fiscal_corrections WHERE year = $1', [Number(year)])
  const posMap = new Map<string, number>(); const negMap = new Map<string, number>()
  for (const c of corrections) {
    const code = c.account_code || ''
    if (c.type === 'positif') posMap.set(code, (posMap.get(code) || 0) + c.amount)
    else if (c.type === 'negatif') negMap.set(code, (negMap.get(code) || 0) + c.amount)
  }
  const GOLONGAN_LR: Record<string, string> = { pendapatan: 'pendapatan', hpp: 'hpp', beban: 'beban', pendapatan_lain: 'pendapatan', beban_lain: 'beban_lain' }
  const cat = (golongan: string | null) => (golongan ? GOLONGAN_LR[golongan] || 'other' : 'other')
  const rp = (n: number) => Math.round(n * 100) / 100
  const pendapatan: any[] = []; const hpp: any[] = []; const beban: any[] = []; const bebanLain: any[] = []
  for (const a of accounts) {
    const code = String(a.code || ''); const g = a.golongan || null; const c = cat(g)
    if (c === 'other') continue
    const komersial = rp(balances.get(code) || 0); const pos = rp(posMap.get(code) || 0); const neg = rp(negMap.get(code) || 0)
    const isExpense = c !== 'pendapatan'
    const fiskal = rp(isExpense ? komersial - pos + neg : komersial + pos - neg)
    const row: any = { code, name: a.name || '', nilaiKomersial: komersial, tidakTermasukObjekPajak: 0, dikenakanPPhFinal: 0, objekPajakTidakFinal: komersial, penyesuaianPositif: pos, penyesuaianNegatif: neg, nilaiFiskal: fiskal }
    if (c === 'pendapatan') pendapatan.push(row); else if (c === 'hpp') hpp.push(row); else if (c === 'beban') beban.push(row); else if (c === 'beban_lain') bebanLain.push(row)
  }
  const sum = (rows: any[], fn: (r: any) => number) => rp(rows.reduce((s, r) => s + fn(r), 0))
  const build = (rows: any[]) => ({ rows, totalKomersial: sum(rows, r => r.nilaiKomersial), totalTidakObjek: sum(rows, r => r.tidakTermasukObjekPajak), totalFinal: sum(rows, r => r.dikenakanPPhFinal), totalTidakFinal: sum(rows, r => r.objekPajakTidakFinal), totalPos: sum(rows, r => r.penyesuaianPositif), totalNeg: sum(rows, r => r.penyesuaianNegatif), totalFiskal: sum(rows, r => r.nilaiFiskal) })
  const p = build(pendapatan); const h = build(hpp); const b = build(beban); const bl = build(bebanLain)
  const sub = (a: number, b: number) => rp(a - b)
  const lk = { komersial: sub(p.totalKomersial, h.totalKomersial), tidakObjek: sub(p.totalTidakObjek, h.totalTidakObjek), final: sub(p.totalFinal, h.totalFinal), tidakFinal: sub(p.totalTidakFinal, h.totalTidakFinal), pos: sub(p.totalPos, h.totalPos), neg: sub(p.totalNeg, h.totalNeg), fiskal: sub(p.totalFiskal, h.totalFiskal) }
  const lu = { komersial: sub(lk.komersial, b.totalKomersial), tidakObjek: sub(lk.tidakObjek, b.totalTidakObjek), final: sub(lk.final, b.totalFinal), tidakFinal: sub(lk.tidakFinal, b.totalTidakFinal), pos: sub(lk.pos, b.totalPos), neg: sub(lk.neg, b.totalNeg), fiskal: sub(lk.fiskal, b.totalFiskal) }
  const lb = { komersial: sub(lu.komersial, bl.totalKomersial), tidakObjek: sub(lu.tidakObjek, bl.totalTidakObjek), final: sub(lu.final, bl.totalFinal), tidakFinal: sub(lu.tidakFinal, bl.totalTidakFinal), pos: sub(lu.pos, bl.totalPos), neg: sub(lu.neg, bl.totalNeg), fiskal: sub(lu.fiskal, bl.totalFiskal) }
  return { periodName: `${startDate} s.d ${endDate}`, pendapatan: p, hpp: h, beban: b, bebanLain: bl, labaKotor: lk, labaUsaha: lu, labaBersih: lb }
}
