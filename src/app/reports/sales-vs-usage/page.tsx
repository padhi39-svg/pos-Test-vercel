"use client"

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { sanitizeDateInput } from '@/lib/sanitizeDateInput'

export default function SalesVsUsageReportPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0,10))
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0,10))

  const load = async () => {
    try {
      setLoading(true)
      const url = new URL('/api/reports/sales-vs-usage', location.origin)
      if (startDate) url.searchParams.set('start', startDate)
      if (endDate) url.searchParams.set('end', endDate)
      url.searchParams.set('t', String(Date.now()))
      const res = await fetch(url.toString(), { cache: 'no-store' })
      const json = await res.json()
      const list = Array.isArray(json?.rows) ? json.rows : (Array.isArray(json) ? json : [])
      setRows(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    // First group by transaction_number, then by barang_id per nota
    const notaMap = new Map<string, Map<string, any[]>>()
    for (const r of rows) {
      const nota = r.transaction_number || '-'
      const barangKey = String(r.barang_id || r.barang || '')
      if (!notaMap.has(nota)) notaMap.set(nota, new Map<string, any[]>())
      const goodsMap = notaMap.get(nota)!
      if (!goodsMap.has(barangKey)) goodsMap.set(barangKey, [])
      goodsMap.get(barangKey)!.push(r)
    }
    return notaMap
  }, [rows])

  const formatNumber = (n: any) => {
    const v = Number(n || 0)
    return v.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const exportExcel = () => {
    // Build flat rows mirroring UI (merged appearance simulated by blanks)
    const rowsOut: any[] = []
    let grand = 0
    Array.from(grouped.entries()).forEach(([nota, goodsMap]) => {
      let notaRendered = false
      const goodsEntries = Array.from(goodsMap.entries())
      goodsEntries.forEach(([_, arr]) => {
        arr.forEach((r:any, idx:number) => {
          const firstOfGoods = idx === 0
          rowsOut.push({
            'Kodenota': !notaRendered ? nota : '',
            'Tanggal': firstOfGoods ? String(r.tdate||'').slice(0,10) : '',
            'Barang': firstOfGoods ? r.barang : '',
            'Qty': firstOfGoods ? Number(r.qty||0) : '',
            'HPP Barang Jadi': firstOfGoods ? Number(r.hpp_barang_jadi||0) : '',
            'Bahan Baku': r.bahan_baku ?? '-',
            'Qty Bahan': r.bahan_qty ?? '-',
            'Satuan': r.bahan_unit ?? '-',
            'HPP Bahan Baku': Number(r.hpp_bahan_baku||0),
          })
          if (!notaRendered) notaRendered = true
          grand += Number(r.hpp_bahan_baku||0)
        })
      })
    })
    rowsOut.push({ 'Kodenota': '', 'Tanggal': '', 'Barang': '', 'Qty': '', 'HPP Barang Jadi': '', 'Bahan Baku': 'Grand Total', 'Qty Bahan': '', 'Satuan': '', 'HPP Bahan Baku': grand })

    const headers = ['Kodenota','Tanggal','Barang','Qty','HPP Barang Jadi','Bahan Baku','Qty Bahan','Satuan','HPP Bahan Baku']
    const ws = XLSX.utils.json_to_sheet(rowsOut, { header: headers })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan')
    // Column widths
    ws['!cols'] = [
      { wch: 18 }, // Kodenota
      { wch: 12 }, // Tanggal
      { wch: 28 }, // Barang
      { wch: 10 }, // Qty
      { wch: 16 }, // HPP BJ
      { wch: 26 }, // Bahan Baku
      { wch: 12 }, // Qty Bahan
      { wch: 10 }, // Satuan
      { wch: 18 }, // HPP Bahan Baku
    ]
    // Number format to 2 decimals for numeric columns (Qty, HPP BJ, Qty Bahan, HPP Bahan)
    const range = XLSX.utils.decode_range(ws['!ref'] as string)
    for (let R = 1; R <= range.e.r; R++) { // start from row 1 (skip header at 0)
      ;['D','E','G','I'].forEach(C => {
        const addr = C + (R + 1) // rows are 1-based in A1 notation
        const cell = ws[addr]
        if (cell && typeof cell.v === 'number') {
          cell.z = '#,##0.00'
        }
      })
    }
    XLSX.writeFile(wb, `Laporan_Penjualan_vs_Pemakaian_${startDate}_${endDate}.xlsx`)
  }

  return (
    <div className="report-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="report-title">Laporan Penjualan VS Pemakaian</h1>
          <p className="report-subtitle">Perbandingan HPP Barang Jadi dan HPP Bahan Baku berdasarkan resep</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="report-card report-card-pad flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <label className="text-[11px] text-slate-600">Tanggal Awal</label>
            <input type="date" value={startDate} onChange={(e)=>setStartDate(sanitizeDateInput(e.target.value))} className="w-40 px-2.5 py-1 rounded-lg text-xs border border-slate-300" />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-[11px] text-slate-600">Tanggal Akhir</label>
            <input type="date" value={endDate} onChange={(e)=>setEndDate(sanitizeDateInput(e.target.value))} className="w-40 px-2.5 py-1 rounded-lg text-xs border border-slate-300" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-3 py-1.5 text-sm rounded-lg bg-teal-primary hover:bg-teal-dark text-white">Tampilkan</button>
          <button onClick={exportExcel} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white">Export Excel</button>
        </div>
      </div>

      {/* Table */}
      <div className="report-card">
        <div className="report-table-wrapper">
        <table className="report-table">
          <colgroup>
            <col style={{width:'16%'}} />
            <col style={{width:'10%'}} />
            <col style={{width:'22%'}} />
            <col style={{width:'8%'}} />
            <col style={{width:'12%'}} />
            <col style={{width:'16%'}} />
            <col style={{width:'8%'}} />
            <col style={{width:'8%'}} />
            <col style={{width:'12%'}} />
          </colgroup>
          <thead className="bg-teal-primary text-white">
            <tr>
              <th className="px-2 py-1 text-left">Kodenota</th>
              <th className="px-2 py-1 text-left">Tanggal</th>
              <th className="px-2 py-1 text-left">Barang</th>
              <th className="px-2 py-1 text-right">Qty</th>
              <th className="px-2 py-1 text-right">HPP Barang Jadi</th>
              <th className="px-2 py-1 text-left">Bahan Baku</th>
              <th className="px-2 py-1 text-right">Qty</th>
              <th className="px-2 py-1 text-left">Satuan</th>
              <th className="px-2 py-1 text-right">HPP Bahan Baku</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-2 py-3 text-center text-slate-500">Memuat...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-2 py-3 text-center text-slate-500">Tidak ada data</td></tr>
            )}
            {!loading && rows.length > 0 && (
              Array.from(grouped.entries()).map(([nota, goodsMap]) => {
                // total span = sum of spans of each goods subgroup (each at least 1 row)
                const goodsEntries = Array.from(goodsMap.entries())
                const spans = goodsEntries.map(([_, arr]) => Math.max(1, arr.length))
                const totalSpan = spans.reduce((a,b)=>a+b,0)
                let renderedNota = false
                return (
                  <>
                    {goodsEntries.map(([goodsKey, arr], gIdx) => {
                      const gSpan = Math.max(1, arr.length)
                      return arr.map((r: any, idx: number) => (
                        <tr key={`${nota}-${goodsKey}-${idx}`} className="border-t align-top">
                          {!renderedNota && (
                            <td className="px-2 py-1 whitespace-nowrap" rowSpan={totalSpan}>{nota}</td>
                          )}
                          {/* After rendering Kodenota once, mark as rendered */}
                          {(() => { if (!renderedNota) renderedNota = true; return null })()}

                          {idx === 0 && (
                            <td className="px-2 py-1 whitespace-nowrap" rowSpan={gSpan}>{String(r.tdate || '').slice(0,10)}</td>
                          )}
                          {idx === 0 && (
                            <td className="px-2 py-1 truncate" rowSpan={gSpan} title={r.barang}>{r.barang}</td>
                          )}
                          {idx === 0 && (
                            <td className="px-2 py-1 text-right" rowSpan={gSpan}>{formatNumber(r.qty)}</td>
                          )}
                          {idx === 0 && (
                            <td className="px-2 py-1 text-right" rowSpan={gSpan}>{formatNumber(r.hpp_barang_jadi)}</td>
                          )}

                          <td className="px-2 py-1 truncate" title={r.bahan_baku || '-' }>{r.bahan_baku != null && r.bahan_baku !== '' ? r.bahan_baku : '-'}</td>
                          <td className="px-2 py-1 text-right">{r.bahan_qty != null ? formatNumber(r.bahan_qty) : '-'}</td>
                          <td className="px-2 py-1">{r.bahan_unit ? r.bahan_unit : '-'}</td>
                          <td className="px-2 py-1 text-right">{r.hpp_bahan_baku != null ? formatNumber(r.hpp_bahan_baku) : '-'}</td>
                        </tr>
                      ))
                    })}
                  </>
                )
              })
            )}
            {/* Grand Total */}
            {!loading && rows.length > 0 && (
              <tr className="bg-teal-bg font-bold">
                <td className="px-2 py-1 text-right" colSpan={8}>Grand Total HPP Bahan</td>
                <td className="px-2 py-1 text-right">{
                  formatNumber(
                    Array.from(grouped.entries()).reduce((gt, [_, goodsMap]) => gt + Array.from(goodsMap.values()).reduce((ns, arr) => ns + arr.reduce((s, r:any)=> s + (Number(r.hpp_bahan_baku)||0), 0), 0), 0)
                  )
                }</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
