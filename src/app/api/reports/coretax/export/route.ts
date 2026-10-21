import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet } from '@/db/raw'
import { getJournalEntries } from '@/lib/journalHelpers'
import { hasPermission } from '@/lib/permissions'

const fmtNum = (n: number) => n
const rp = (n: number) => Math.round(n * 100) / 100

interface CoretaxRow {
  code: string
  name: string
  nilaiKomersial: number
  tidakTermasukObjekPajak: number
  dikenakanPPhFinal: number
  objekPajakTidakFinal: number
  penyesuaianPositif: number
  penyesuaianNegatif: number
  nilaiFiskal: number
}

async function computeData(pool: any, startDate: string, endDate: string, periodId: string | null) {
  if (periodId) {
    const period = await rawGet<any>('SELECT start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0', [Number(periodId)])
    if (period) { startDate = period.start_date; endDate = period.end_date }
  }

  const accounts = await rawAll<any>('SELECT code, name, normal_balance, golongan FROM accounts WHERE is_active = 1 ORDER BY code')
  const entries = await getJournalEntries(startDate, endDate)

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

  const posMap = new Map<string, number>()
  const negMap = new Map<string, number>()
  for (const c of corrections) {
    const code = c.account_code || ''
    if (c.type === 'positif') posMap.set(code, (posMap.get(code) || 0) + c.amount)
    else if (c.type === 'negatif') negMap.set(code, (negMap.get(code) || 0) + c.amount)
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

  const pendapatan: CoretaxRow[] = []
  const hpp: CoretaxRow[] = []
  const beban: CoretaxRow[] = []
  const bebanLain: CoretaxRow[] = []

  for (const a of accounts) {
    const code = String(a.code || '')
    const g = a.golongan || null
    const c = cat(g)
    if (c === 'other') continue
    const komersial = rp(balances.get(code) || 0)
    const pos = rp(posMap.get(code) || 0)
    const neg = rp(negMap.get(code) || 0)
    const isExpense = c !== 'pendapatan'
    const fiskal = rp(isExpense ? komersial - pos + neg : komersial + pos - neg)
    const row: CoretaxRow = {
      code, name: a.name || '', nilaiKomersial: komersial,
      tidakTermasukObjekPajak: 0, dikenakanPPhFinal: 0, objekPajakTidakFinal: komersial,
      penyesuaianPositif: pos, penyesuaianNegatif: neg, nilaiFiskal: fiskal,
    }
    if (c === 'pendapatan') pendapatan.push(row)
    else if (c === 'hpp') hpp.push(row)
    else if (c === 'beban') beban.push(row)
    else if (c === 'beban_lain') bebanLain.push(row)
  }

  const sum = (rows: CoretaxRow[], fn: (r: CoretaxRow) => number) => rp(rows.reduce((s, r) => s + fn(r), 0))

  const p = sum(pendapatan, r => r.nilaiKomersial)
  const hTot = sum(hpp, r => r.nilaiKomersial)
  const bTot = sum(beban, r => r.nilaiKomersial)
  const blTot = sum(bebanLain, r => r.nilaiKomersial)
  const sub = (a: number, b: number) => rp(a - b)
  const labaKotor = sub(p, hTot)
  const labaUsaha = sub(labaKotor, bTot)
  const labaBersih = sub(labaUsaha, blTot)

  const sections: { label: string; rows: CoretaxRow[] }[] = [
    { label: 'PENDAPATAN', rows: pendapatan },
    { label: 'HARGA POKOK PENJUALAN', rows: hpp },
    { label: 'LABA KOTOR', rows: [{ code: '', name: '', nilaiKomersial: labaKotor, tidakTermasukObjekPajak: 0, dikenakanPPhFinal: 0, objekPajakTidakFinal: labaKotor, penyesuaianPositif: 0, penyesuaianNegatif: 0, nilaiFiskal: labaKotor }] },
    { label: 'BEBAN USAHA', rows: beban },
    { label: 'LABA (RUGI) USAHA', rows: [{ code: '', name: '', nilaiKomersial: labaUsaha, tidakTermasukObjekPajak: 0, dikenakanPPhFinal: 0, objekPajakTidakFinal: labaUsaha, penyesuaianPositif: 0, penyesuaianNegatif: 0, nilaiFiskal: labaUsaha }] },
    { label: 'PENDAPATAN / BEBAN NON USAHA', rows: bebanLain },
    { label: 'LABA (RUGI) SEBELUM PAJAK', rows: [{ code: '', name: '', nilaiKomersial: labaBersih, tidakTermasukObjekPajak: 0, dikenakanPPhFinal: 0, objekPajakTidakFinal: labaBersih, penyesuaianPositif: 0, penyesuaianNegatif: 0, nilaiFiskal: labaBersih }] },
  ]

  const periodInfo = periodId
    ? await rawGet<any>("SELECT name FROM master_periode WHERE id = $1 AND isdelete = 0", [Number(periodId)])
    : null
  const periodLabel = periodInfo?.name || `${startDate} s.d ${endDate}`

  return { sections, periodLabel }
}

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_laba_rugi', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const pool = (getDb() as any).$client
    const url = new URL(req.url)
    let startDate = url.searchParams.get('startDate') || ''
    let endDate = url.searchParams.get('endDate') || ''
    const periodId = url.searchParams.get('periodId')

    if (periodId) {
      const period = await rawGet<any>('SELECT start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0', [Number(periodId)])
      if (period) { startDate = period.start_date; endDate = period.end_date }
    }

    const { sections, periodLabel } = await computeData(pool, startDate, endDate, periodId)

    const XLSX = await import('xlsx').then(m => m.default || m)
    const wb = XLSX.utils.book_new()
    const rows: any[][] = []

    rows.push(['CORE TAX', '', '', '', '', '', '', '', ''])
    rows.push([`Periode: ${periodLabel}`, '', '', '', '', '', '', '', ''])
    rows.push([])
    rows.push(['KODE AKUN', 'NAMA AKUN', 'NILAI KOMERSIAL', 'TIDAK TERMASUK OBJEK PAJAK', 'DIKENAKAN PPh BERSIFAT FINAL', 'OBJEK PAJAK TIDAK FINAL', 'PENYESUAIAN FISKAL POSITIF', 'PENYESUAIAN FISKAL NEGATIF', 'NILAI FISKAL'])

    for (const sec of sections) {
      rows.push([])
      if (sec.rows.length > 0) {
        for (const row of sec.rows) {
          rows.push([row.code, row.name, fmtNum(row.nilaiKomersial), fmtNum(row.tidakTermasukObjekPajak), fmtNum(row.dikenakanPPhFinal), fmtNum(row.objekPajakTidakFinal), fmtNum(row.penyesuaianPositif), fmtNum(row.penyesuaianNegatif), fmtNum(row.nilaiFiskal)])
        }
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 12 }, { wch: 48 }, { wch: 18 },
      { wch: 22 }, { wch: 22 }, { wch: 18 },
      { wch: 22 }, { wch: 22 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'CoreTax')

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
    const ts = new Date().toISOString().slice(0, 10)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Coretax-${ts}.xlsx"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
