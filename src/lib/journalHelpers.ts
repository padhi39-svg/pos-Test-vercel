import { rawAll, rawGet, rawRun } from '@/db/raw'
import { loadAllEntries, JournalEntry } from './accountingEntries'

export async function hasJournalEntries(startDate: string, endDate: string): Promise<boolean> {
  try {
    const row = await rawGet<any>('SELECT MIN(entry_date)::text as min_d, MAX(entry_date)::text as max_d FROM journal_entries')
    return !!row && !!row.min_d && row.min_d <= startDate && row.max_d >= endDate
  } catch { return false }
}

export async function getJournalEntriesFromTable(startDate: string, endDate: string): Promise<JournalEntry[]> {
  try {
    return await rawAll<any[]>(`
      SELECT TO_CHAR(entry_date, 'YYYY-MM-DD') as entry_date, source_type, source_number, account_code, account_name, debit, credit, description,
             TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
      FROM journal_entries
      WHERE entry_date >= ? AND entry_date <= ?
      ORDER BY entry_date, id
    `, [startDate, endDate])
  } catch { return [] }
}

export async function getJournalBalanceBefore(date: string): Promise<number> {
  try {
    const row = await rawGet<any>('SELECT COALESCE(SUM(debit - credit), 0) as balance FROM journal_entries WHERE entry_date < ?', [date])
    return Number(row?.balance || 0)
  } catch { return 0 }
}

export async function getJournalEntries(startDate: string, endDate: string): Promise<JournalEntry[]> {
  const entries = await loadAllEntries(startDate, endDate)
  const tableEntries = await getJournalEntriesFromTable(startDate, endDate)
  const seen = new Set<string>()
  for (const e of entries) {
    seen.add(`${e.source_type}|${e.source_number}|${e.account_code}|${e.debit}|${e.credit}`)
  }
  for (const e of tableEntries) {
    const key = `${e.source_type}|${e.source_number}|${e.account_code}|${e.debit}|${e.credit}`
    if (!seen.has(key)) {
      seen.add(key)
      entries.push(e)
    }
  }
  const toStr = (v: any): string => {
    if (!v) return ''
    if (typeof v === 'string') return v
    if (v instanceof Date) return v.toISOString()
    return String(v)
  }
  return entries.sort((a, b) => {
    const da = typeof a.entry_date === 'string' ? a.entry_date : String(a.entry_date).slice(0, 10)
    const db = typeof b.entry_date === 'string' ? b.entry_date : String(b.entry_date).slice(0, 10)
    const dateCmp = da.localeCompare(db)
    if (dateCmp !== 0) return dateCmp
    return toStr(a.created_at).localeCompare(toStr(b.created_at))
  })
}

export async function saveJournalEntriesForSource(
  sourceType: string,
  sourceId: number,
  sourceNumber: string,
  entryDate: string,
  entries: { account_code: string; account_name?: string; debit: number; credit: number; description?: string }[],
) {
  const filtered = entries.filter(e => e.debit !== 0 || e.credit !== 0)
  if (filtered.length === 0) return
  await rawRun('DELETE FROM journal_entries WHERE source_type = ? AND source_id = ?', [sourceType, sourceId])
  const placeholders = filtered.map((_, i) => {
    const base = i * 9
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`
  }).join(',')
  const values: any[] = []
  for (const e of filtered) {
    values.push(entryDate, sourceType, sourceId, sourceNumber, e.account_code, e.account_name || '', e.debit, e.credit, e.description || '')
  }
  await rawRun(
    `INSERT INTO journal_entries (entry_date, source_type, source_id, source_number, account_code, account_name, debit, credit, description) VALUES ${placeholders}`,
    values
  )
}

export async function deleteJournalEntriesForSource(sourceType: string, sourceId: number) {
  await rawRun('DELETE FROM journal_entries WHERE source_type = ? AND source_id = ?', [sourceType, sourceId])
}

export async function getAllJournalEntries(): Promise<JournalEntry[]> {
  try {
    return await rawAll<any[]>(`
      SELECT TO_CHAR(entry_date, 'YYYY-MM-DD') as entry_date, source_type, source_number, account_code, account_name, debit, credit, description,
             TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
      FROM journal_entries
      ORDER BY entry_date, id
    `)
  } catch { return [] }
}

export async function generateEntriesForSingleSource(
  sourceType: string,
  sourceNumber: string,
  entryDate: string,
): Promise<JournalEntry[]> {
  const all = await loadAllEntries(entryDate, entryDate)
  return all.filter(e => e.source_type === sourceType && e.source_number === sourceNumber)
}

export async function generateSaleEntries(
  params: {
    transactionId: number
    transactionNumber: string
    entryDate: string
    total: number
    subtotal: number
    discountAmount: number
    ppnAmount: number
    serviceChargeAmount: number
    customerId?: number | null
  }
): Promise<JournalEntry[]> {
  const entries: JournalEntry[] = []

  // Load account mappings
  const mappingRows = await rawAll<any[]>('SELECT map_group, map_key, account_id FROM account_mappings')
  const m: Record<string, Record<string, number>> = {}
  for (const r of mappingRows) {
    m[r.map_group] = m[r.map_group] || {}
    m[r.map_group][r.map_key] = Number(r.account_id)
  }
  const accountOf = (group: string, key: string): number | null => m[group]?.[key] ?? null

  const map = {
    piutang_dagang: accountOf('pelanggan', 'piutang_dagang'),
    penjualan_barang: accountOf('pelanggan', 'penjualan_barang'),
    hpp: accountOf('pelanggan', 'hpp'),
    persediaan_barang: accountOf('barang', 'persediaan_barang'),
    potongan_penjualan: accountOf('pelanggan', 'potongan_penjualan'),
    ppn_keluaran: accountOf('pelanggan', 'ppn_keluaran'),
    service_charge: accountOf('pelanggan', 'service_charge'),
  }

  // Determine AR account (customer-specific or default)
  let arId = map.piutang_dagang
  if (params.customerId) {
    const custAcc = await rawGet<any>('SELECT account_id FROM master_customer WHERE id = ? AND account_id IS NOT NULL', [params.customerId])
    if (custAcc?.account_id) arId = Number(custAcc.account_id)
  }

  // Batch load all needed account codes in one query
  const accountIds = [arId, map.penjualan_barang, map.potongan_penjualan, map.ppn_keluaran, map.service_charge, map.hpp, map.persediaan_barang].filter(Boolean) as number[]
  const uniqueIds = [...new Set(accountIds)]
  const accRows = uniqueIds.length > 0
    ? await rawAll<any[]>(`SELECT id, code, name FROM accounts WHERE id IN (${uniqueIds.map(() => '?').join(',')})`, uniqueIds)
    : []
  const accMap = new Map<number, { code: string; name: string }>()
  for (const r of accRows) {
    accMap.set(Number(r.id), { code: r.code || '', name: r.name || '' })
  }
  const accCode = (id: number | null): { code: string; name: string } => {
    if (!id) return { code: '', name: '' }
    return accMap.get(id) || { code: '', name: '' }
  }

  const arAcc = accCode(arId)
  const revAcc = accCode(map.penjualan_barang)
  const discAcc = accCode(map.potongan_penjualan)
  const ppnKelAcc = accCode(map.ppn_keluaran)
  const svcAcc = accCode(map.service_charge)

  const total = params.total
  const subtotal = params.subtotal
  const discAmt = params.discountAmount
  const ppnAmt = params.ppnAmount
  const svcAmt = params.serviceChargeAmount

  if (arAcc.code) {
    entries.push({
      entry_date: params.entryDate,
      source_type: 'Penjualan',
      source_number: params.transactionNumber,
      description: 'penjualan',
      account_code: arAcc.code,
      account_name: arAcc.name,
      debit: total,
      credit: 0,
      created_at: '',
    })
  }
  if (revAcc.code) {
    entries.push({
      entry_date: params.entryDate,
      source_type: 'Penjualan',
      source_number: params.transactionNumber,
      description: 'penjualan',
      account_code: revAcc.code,
      account_name: revAcc.name,
      debit: 0,
      credit: subtotal,
      created_at: '',
    })
  }
  if (discAcc.code && discAmt > 0) {
    entries.push({
      entry_date: params.entryDate,
      source_type: 'Penjualan',
      source_number: params.transactionNumber,
      description: 'penjualan',
      account_code: discAcc.code,
      account_name: discAcc.name,
      debit: discAmt,
      credit: 0,
      created_at: '',
    })
  }
  if (ppnKelAcc.code && ppnAmt > 0) {
    entries.push({
      entry_date: params.entryDate,
      source_type: 'Penjualan',
      source_number: params.transactionNumber,
      description: 'penjualan',
      account_code: ppnKelAcc.code,
      account_name: ppnKelAcc.name,
      debit: 0,
      credit: ppnAmt,
      created_at: '',
    })
  }
  if (svcAcc.code && svcAmt > 0) {
    entries.push({
      entry_date: params.entryDate,
      source_type: 'Penjualan',
      source_number: params.transactionNumber,
      description: 'penjualan',
      account_code: svcAcc.code,
      account_name: svcAcc.name,
      debit: 0,
      credit: svcAmt,
      created_at: '',
    })
  }

  // HPP
  if (map.hpp && map.persediaan_barang) {
    try {
      const cogsRow = await rawGet<any>(
        'SELECT COALESCE(SUM(cogs_total), 0) as total FROM transaction_items WHERE transaction_id = ? AND COALESCE(cogs_total, 0) > 0',
        [params.transactionId]
      )
      const cogsTotal = Number(cogsRow?.total || 0)
      if (cogsTotal > 0) {
        const hppAcc = accCode(map.hpp)
        const persAcc = accCode(map.persediaan_barang)
        if (hppAcc.code && persAcc.code) {
          entries.push({
            entry_date: params.entryDate,
            source_type: 'Penjualan',
            source_number: params.transactionNumber,
            description: 'penjualan',
            account_code: hppAcc.code,
            account_name: hppAcc.name,
            debit: cogsTotal,
            credit: 0,
            created_at: '',
          })
          entries.push({
            entry_date: params.entryDate,
            source_type: 'Penjualan',
            source_number: params.transactionNumber,
            description: 'penjualan',
            account_code: persAcc.code,
            account_name: persAcc.name,
            debit: 0,
            credit: cogsTotal,
            created_at: '',
          })
        }
      }
    } catch {}
  }

  return entries
}
