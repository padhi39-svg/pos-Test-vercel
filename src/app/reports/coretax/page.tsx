"use client"

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'

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

interface SectionData {
  rows: CoretaxRow[]
  totalKomersial: number
  totalTidakObjek: number
  totalFinal: number
  totalTidakFinal: number
  totalPos: number
  totalNeg: number
  totalFiskal: number
}

interface SummaryData {
  komersial: number
  tidakObjek: number
  final: number
  tidakFinal: number
  pos: number
  neg: number
  fiskal: number
}

interface CoretaxData {
  periodName: string
  pendapatan: SectionData
  hpp: SectionData
  beban: SectionData
  bebanLain: SectionData
  labaKotor: SummaryData
  labaUsaha: SummaryData
  labaBersih: SummaryData
}

interface Periode {
  id: number
  code: string
  name: string
  start_date: string
  end_date: string
}

export default function CoretaxPage() {
  const [periodId, setPeriodId] = useState<string>('')
  const [periods, setPeriods] = useState<Periode[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [data, setData] = useState<CoretaxData | null>(null)

  useEffect(() => {
    fetch('/api/periode')
      .then(r => r.json())
      .then(list => {
        if (Array.isArray(list)) {
          setPeriods(list)
          const aktif = list.find((p: any) => p.is_active)
          if (aktif) setPeriodId(String(aktif.id))
        }
      })
      .catch(() => {})
  }, [])

  const loadReport = useCallback(async (pid?: string) => {
    const id = pid || periodId
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/coretax?periodId=${id}`)
      if (!res.ok) throw new Error('Gagal memuat')
      const json = await res.json()
      setData(json || null)
    } catch { setData(null) } finally { setLoading(false) }
  }, [periodId])

  const handleExport = async () => {
    if (!periodId) return
    setExporting(true)
    try {
      const res = await fetch(`/api/reports/coretax/export?periodId=${periodId}`)
      if (!res.ok) throw new Error('Gagal export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Coretax-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { alert(e.message) } finally { setExporting(false) }
  }

  const renderTable = (label: string, sec: SectionData, isTotal = false) => (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className={`p-3 border-b border-slate-200 ${isTotal ? 'bg-slate-100' : 'bg-blue-50'}`}>
        <h2 className="font-bold text-sm">{label}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="px-2 py-1 text-left font-semibold w-[90px]">Kode Akun</th>
              <th className="px-2 py-1 text-left font-semibold">Nama Akun</th>
              <th className="px-2 py-1 text-right font-semibold">Nilai Komersial</th>
              <th className="px-2 py-1 text-right font-semibold">Tidak Termasuk Objek Pajak</th>
              <th className="px-2 py-1 text-right font-semibold">Dikenakan PPh Final</th>
              <th className="px-2 py-1 text-right font-semibold">Objek Pajak Tidak Final</th>
              <th className="px-2 py-1 text-right font-semibold">Penyesuaian Positif</th>
              <th className="px-2 py-1 text-right font-semibold">Penyesuaian Negatif</th>
              <th className="px-2 py-1 text-right font-semibold">Nilai Fiskal</th>
            </tr>
          </thead>
          <tbody>
            {sec.rows.length === 0 && (
              <tr><td colSpan={9} className="px-2 py-3 text-center text-slate-400">Tidak ada data</td></tr>
            )}
            {sec.rows.map(row => (
              <tr key={row.code} className="border-t hover:bg-slate-50">
                <td className="px-2 py-1 text-slate-500">{row.code}</td>
                <td className="px-2 py-1">{row.name}</td>
                <td className={`px-2 py-1 text-right ${row.nilaiKomersial < 0 ? 'text-red-600' : ''}`}>{formatCurrency(row.nilaiKomersial)}</td>
                <td className="px-2 py-1 text-right text-slate-400">{formatCurrency(row.tidakTermasukObjekPajak)}</td>
                <td className="px-2 py-1 text-right text-slate-400">{formatCurrency(row.dikenakanPPhFinal)}</td>
                <td className={`px-2 py-1 text-right ${row.objekPajakTidakFinal < 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatCurrency(row.objekPajakTidakFinal)}</td>
                <td className={`px-2 py-1 text-right ${row.penyesuaianPositif < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(row.penyesuaianPositif)}</td>
                <td className={`px-2 py-1 text-right ${row.penyesuaianNegatif < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(row.penyesuaianNegatif)}</td>
                <td className={`px-2 py-1 text-right font-medium ${row.nilaiFiskal < 0 ? 'text-red-600' : ''}`}>{formatCurrency(row.nilaiFiskal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-bold bg-slate-50">
              <td colSpan={2} className="px-2 py-2">Total {label}</td>
              <td className="px-2 py-2 text-right">{formatCurrency(sec.totalKomersial)}</td>
              <td className="px-2 py-2 text-right">{formatCurrency(sec.totalTidakObjek)}</td>
              <td className="px-2 py-2 text-right">{formatCurrency(sec.totalFinal)}</td>
              <td className="px-2 py-2 text-right">{formatCurrency(sec.totalTidakFinal)}</td>
              <td className="px-2 py-2 text-right">{formatCurrency(sec.totalPos)}</td>
              <td className="px-2 py-2 text-right">{formatCurrency(sec.totalNeg)}</td>
              <td className="px-2 py-2 text-right">{formatCurrency(sec.totalFiskal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )

  const renderSummary = (label: string, v: SummaryData, border = false) => (
    <div className={`bg-white rounded-lg shadow-sm p-3 flex items-center justify-between text-sm font-bold ${border ? 'border-2 border-slate-300' : 'border border-slate-200'}`}>
      <span>{label}</span>
      <div className="flex items-center gap-4 text-right text-xs">
        <div><span className="text-[9px] text-slate-400 font-normal block">Komersial</span><span className={v.komersial < 0 ? 'text-red-600' : ''}>{formatCurrency(v.komersial)}</span></div>
        <div><span className="text-[9px] text-slate-400 font-normal block">Tidak Objek</span><span>{formatCurrency(v.tidakObjek)}</span></div>
        <div><span className="text-[9px] text-slate-400 font-normal block">PPh Final</span><span>{formatCurrency(v.final)}</span></div>
        <div><span className="text-[9px] text-slate-400 font-normal block">Tidak Final</span><span className={v.tidakFinal < 0 ? 'text-red-600' : ''}>{formatCurrency(v.tidakFinal)}</span></div>
        <div><span className="text-[9px] text-slate-400 font-normal block">Positif</span><span className="text-emerald-600">{formatCurrency(v.pos)}</span></div>
        <div><span className="text-[9px] text-slate-400 font-normal block">Negatif</span><span className="text-emerald-600">{formatCurrency(v.neg)}</span></div>
        <div><span className="text-[9px] text-slate-400 font-normal block">Fiskal</span><span className={v.fiskal < 0 ? 'text-red-600' : ''}>{formatCurrency(v.fiskal)}</span></div>
      </div>
    </div>
  )

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Coretax</h1>
          <p className="text-xs text-slate-500">Laporan rekonsiliasi fiskal</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px]">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Periode</label>
            <select className="input text-xs h-8 w-full" value={periodId} onChange={e => { setPeriodId(e.target.value); setData(null) }}>
              <option value="">-- Pilih Periode --</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.startDate} s.d {p.endDate})</option>
              ))}
            </select>
          </div>
          <button onClick={() => loadReport()} className="px-3 py-1.5 text-xs rounded bg-[#3C3C3C] text-white h-8">Tampilkan</button>
          {data && (
            <button onClick={handleExport} disabled={exporting}
              className="px-3 py-1.5 text-xs rounded bg-[#FFA16C] text-white h-8 disabled:opacity-50">
              {exporting ? 'Mengexport...' : 'Export Excel'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-6">Memuat...</div>
      ) : !data ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center text-slate-500">Pilih periode dan klik Tampilkan</div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-slate-500 font-medium">Periode: {data.periodName}</div>
          {renderTable('PENDAPATAN', data.pendapatan)}
          {renderTable('HARGA POKOK PENJUALAN', data.hpp)}
          {renderSummary('LABA KOTOR', data.labaKotor)}
          {renderTable('BEBAN USAHA', data.beban)}
          {renderSummary('LABA (RUGI) USAHA', data.labaUsaha)}
          {renderTable('PENDAPATAN / BEBAN NON USAHA', data.bebanLain)}
          {renderSummary('LABA (RUGI) SEBELUM PAJAK', data.labaBersih, true)}
        </div>
      )}
    </div>
  )
}
