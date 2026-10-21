import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet } from '@/db/raw'
import { getJournalEntries } from '@/lib/journalHelpers'
import { hasPermission } from '@/lib/permissions'

const rupiah = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_neraca', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const pool = (getDb() as any).$client
    const url = new URL(req.url)
    let asOf = url.searchParams.get('asOf') || new Date().toISOString().slice(0, 10)
    const periodId = url.searchParams.get('periodId')

    if (periodId) {
      const period = await rawGet<any>('SELECT start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0', [Number(periodId)])
      if (period) asOf = period.end_date
    }

    const accounts = await rawAll<any>(`
      SELECT id, code, name, parent_id, level, is_header, normal_balance, golongan
      FROM accounts WHERE is_active = 1 ORDER BY code
    `)

    const entries = await getJournalEntries('2000-01-01', asOf)

    const balances = new Map<string, number>()
    for (const a of accounts) balances.set(a.code, 0)
    for (const e of entries) {
      if (balances.has(e.account_code)) {
        const current = balances.get(e.account_code) || 0
        const acct = accounts.find((a: any) => a.code === e.account_code)
        const nb = acct?.normal_balance || 'D'
        if (nb === 'D') balances.set(e.account_code, current + e.debit - e.credit)
        else balances.set(e.account_code, current + e.credit - e.debit)
      }
    }

    const balanceById = new Map<number, number>()
    const childrenOf = new Map<number | null, any[]>()
    for (const a of accounts) {
      const id = Number(a.id)
      const p = a.parent_id !== null ? Number(a.parent_id) : null
      if (!childrenOf.has(p)) childrenOf.set(p, [])
      childrenOf.get(p)!.push(a)
      balanceById.set(id, balances.get(a.code) || 0)
    }

    function sumDescendants(nodeId: number): number {
      let total = balanceById.get(nodeId) || 0
      const kids = childrenOf.get(nodeId) || []
      for (const kid of kids) total += sumDescendants(Number(kid.id))
      return total
    }

    type Section = { label: string; items: { code: string; name: string; golongan: string | null; balance: number }[]; total: number }

    const sections: Section[] = [
      { label: 'ASET', items: [], total: 0 },
      { label: 'KEWAJIBAN', items: [], total: 0 },
      { label: 'EKUITAS', items: [], total: 0 },
    ]

    const GOLONGAN_CAT: Record<string, string> = {
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

    const catMap: Record<string, number> = { aset: 0, kewajiban: 1, ekuitas: 2 }
    const catCode = (golongan: string | null): string => {
      if (!golongan) return 'ekuitas'
      return GOLONGAN_CAT[golongan] || 'ekuitas'
    }

    for (const a of accounts) {
      const cat = catCode(a.golongan || null)
      const isParent = (childrenOf.get(Number(a.id))?.length ?? 0) > 0
      if (isParent) {
        const bal = sumDescendants(Number(a.id))
        sections[catMap[cat]].items.push({ code: a.code || '', name: a.name || '', golongan: a.golongan || null, balance: bal })
      }
    }

    for (const s of sections) {
      s.total = s.items.reduce((a, b) => a + (b.balance > 0 ? b.balance : 0), 0)
    }

    const grandTotalAset = sections[0].total
    const grandTotalKewajibanEkuitas = sections[1].total + sections[2].total
    const selisih = Math.round((grandTotalAset - grandTotalKewajibanEkuitas) * 100) / 100

    const periodInfo = periodId
      ? (await rawGet<any>("SELECT name, start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0", [Number(periodId)]))
      : null
    const periodLabel = periodInfo
      ? `${periodInfo.name} (${periodInfo.start_date} s.d ${periodInfo.end_date})`
      : `Sampai dengan ${asOf}`

    const XLSX = await import('xlsx').then(m => m.default || m)
    const wb = XLSX.utils.book_new()

    const rows: any[][] = []
    rows.push(['NERACA', '', '', ''])
    rows.push([`Periode: ${periodLabel}`, '', '', ''])
    rows.push([])
    rows.push(['KELOMPOK', 'KODE', 'AKUN', 'GOLONGAN', 'JUMLAH (Rp)'])

    for (const sec of sections) {
      rows.push([])
      rows.push([sec.label.toUpperCase(), '', '', '', rupiah(sec.total)])
      for (const item of sec.items) {
        if (item.balance === -1) {
          rows.push([item.name.trim(), '', '', ''])
        } else {
          rows.push(['', item.code, item.name.trim(), item.golongan || '', rupiah(item.balance)])
        }
      }
    }

    rows.push([])
    rows.push(['Total Aset', '', '', '', rupiah(grandTotalAset)])
    rows.push(['Total Kewajiban + Ekuitas', '', '', '', rupiah(grandTotalKewajibanEkuitas)])
    if (selisih !== 0) rows.push(['Selisih', '', '', '', rupiah(selisih)])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 50 }, { wch: 24 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Neraca')

    const GOLONGAN_LIST = [
      { value: 'aset',                     label: 'ASET',                             kategori: 'ASET' },
      { value: 'aset_lancar_kas',        label: 'Aset Lancar - Kas & Bank',       kategori: 'ASET' },
      { value: 'aset_lancar_piutang',    label: 'Aset Lancar - Piutang',          kategori: 'ASET' },
      { value: 'aset_lancar_persediaan',  label: 'Aset Lancar - Persediaan',       kategori: 'ASET' },
      { value: 'aset_lancar_lainnya',     label: 'Aset Lancar - Lainnya',          kategori: 'ASET' },
      { value: 'aset_tidak_lancar',       label: 'Aset Tidak Lancar',              kategori: 'ASET' },
      { value: 'kewajiban',               label: 'KEWAJIBAN',                       kategori: 'KEWAJIBAN' },
      { value: 'kewajiban_lancar',        label: 'Kewajiban Lancar',               kategori: 'KEWAJIBAN' },
      { value: 'kewajiban_tidak_lancar',  label: 'Kewajiban Tidak Lancar',         kategori: 'KEWAJIBAN' },
      { value: 'ekuitas',                 label: 'Ekuitas',                        kategori: 'EKUITAS' },
      { value: 'pendapatan',              label: 'Pendapatan',                     kategori: 'LABA RUGI' },
      { value: 'hpp',                     label: 'HPP',                            kategori: 'LABA RUGI' },
      { value: 'beban',                   label: 'Beban',                          kategori: 'LABA RUGI' },
      { value: 'pendapatan_lain',        label: 'Pendapatan Lain-lain',           kategori: 'LABA RUGI' },
      { value: 'beban_lain',              label: 'Beban Lain-lain',               kategori: 'LABA RUGI' },
    ]
    const refRows: any[][] = [
      ['REFERENSI GOLONGAN'],
      [],
      ['GOLONGAN', 'KETERANGAN', 'KATEGORI LAPORAN'],
      ...GOLONGAN_LIST.map(g => [g.value, g.label, g.kategori]),
    ]
    const wsRef = XLSX.utils.aoa_to_sheet(refRows)
    wsRef['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsRef, 'Referensi Golongan')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Neraca-${asOf}.xlsx"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
