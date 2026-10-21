import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet } from '@/db/raw'
import { loadAllEntries } from '@/lib/accountingEntries'
import { hasPermission } from '@/lib/permissions'

async function computeLabaRugi(startDate: string, endDate: string) {
  const accounts = await rawAll<any>(`
    SELECT code, name, normal_balance, golongan FROM accounts WHERE is_active = 1 ORDER BY code
  `)

  const pool = (getDb() as any).$client
  const entries = loadAllEntries(pool, startDate, endDate)
  const balances = new Map<string, number>()
  for (const a of accounts) balances.set(a.code, 0)
  for (const e of entries) {
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

  let totalPendapatan = 0, totalHpp = 0, totalBeban = 0, totalBebanLain = 0
  for (const a of accounts) {
    const code = String(a.code || '')
    const g = a.golongan || null
    const c = cat(g)
    if (c === 'other') continue
    const bal = balances.get(code) || 0
    if (c === 'pendapatan') totalPendapatan += bal
    else if (c === 'hpp') totalHpp += bal
    else if (c === 'beban') totalBeban += bal
    else if (c === 'beban_lain') totalBebanLain += bal
  }
  const labaKotor = totalPendapatan - totalHpp
  const labaBersih = labaKotor - totalBeban - totalBebanLain
  return { laba_bersih: Math.round(labaBersih * 100) / 100, omzet: totalPendapatan, totalPendapatan, totalHpp, totalBeban, totalBebanLain }
}

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
      SELECT id, start_date, end_date FROM master_periode
      WHERE EXTRACT(YEAR FROM start_date::date) = ? AND isdelete = 0
      ORDER BY start_date LIMIT 1
    `, [year])

    if (!period) {
      return NextResponse.json({ error: 'Period not found for year ' + year }, { status: 404 })
    }

    const { laba_bersih, omzet } = await computeLabaRugi(period.start_date, period.end_date)

    const corrections = await rawAll<any>(`
      SELECT id, type, account_code, account_name, amount FROM fiscal_corrections WHERE year = ? ORDER BY type, account_name
    `, [year])

    const settings = await rawGet<any>(`SELECT omzet, pph25 FROM fiscal_settings WHERE year = ?`, [year])

    const positifTotal = corrections.filter((c: any) => c.type === 'positif').reduce((s: number, c: any) => s + c.amount, 0)
    const negatifTotal = corrections.filter((c: any) => c.type === 'negatif').reduce((s: number, c: any) => s + c.amount, 0)

    const labaFiskal = Math.round((laba_bersih + positifTotal - negatifTotal) * 100) / 100
    const labaFiskalPembulatan = Math.round(labaFiskal / 1000) * 1000

    const omzetYear = settings?.omzet || omzet
    const pph25 = settings?.pph25 || 0

    // Labae mendapatkan fasilitas (Pasal 31E)
    // Fasilitas: 4.8M / omzet * laba_fiskal
    let labaFasilitas = 0
    let labaNonFasilitas = 0
    let pphFasilitas = 0
    let pphNonFasilitas = 0
    let totalPajak = 0

    if (omzetYear > 0) {
      const fasilitasRatio = Math.min(1, 4800000000 / omzetYear)
      labaFasilitas = Math.round(labaFiskalPembulatan * fasilitasRatio * 100) / 100
      labaNonFasilitas = Math.round((labaFiskalPembulatan - labaFasilitas) * 100) / 100
      pphFasilitas = Math.round(labaFasilitas * 0.11 * 100) / 100
      pphNonFasilitas = Math.round(labaNonFasilitas * 0.22 * 100) / 100
    } else {
      pphNonFasilitas = Math.round(labaFiskalPembulatan * 0.22 * 100) / 100
      labaNonFasilitas = labaFiskalPembulatan
    }
    totalPajak = Math.round((pphFasilitas + pphNonFasilitas) * 100) / 100

    const kurangBayar = Math.round((totalPajak - pph25) * 100) / 100

    return NextResponse.json({
      tahun: year,
      laba_komersial: laba_bersih,
      omzet: omzetYear,
      corrections: {
        positif: corrections.filter((c: any) => c.type === 'positif'),
        negatif: corrections.filter((c: any) => c.type === 'negatif'),
        total_positif: positifTotal,
        total_negatif: negatifTotal,
      },
      laba_fiskal: labaFiskal,
      laba_fiskal_pembulatan: labaFiskalPembulatan,
      fasilitas: {
        ratio: omzetYear > 0 ? Math.min(1, 4800000000 / omzetYear) : 0,
        laba_fasilitas: labaFasilitas,
        laba_non_fasilitas: labaNonFasilitas,
      },
      pajak: {
        pph_fasilitas: pphFasilitas,
        pph_non_fasilitas: pphNonFasilitas,
        total_terutang: totalPajak,
        pph25,
        kurang_bayar: kurangBayar,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
