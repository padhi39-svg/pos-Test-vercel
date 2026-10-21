"use client"
import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { formatCurrency } from '@/lib/regionalNumber'
import { useSort } from '@/lib/useSort'
import { sanitizeDateInput } from '@/lib/sanitizeDateInput'
import SortIcon from '@/components/ui/SortIcon'

type UsageSummary = {
  ingredient_id: number
  ingredient_code: string
  ingredient_name: string
  base_unit: string
  ingredient_hpp: number
  total_used: number
  total_hpp_used: number
  unit_conversions?: Array<{ unit_name: string; quantity: number }>
}

type UsageReport = {
  period: {
    from: string | null
    to: string | null
  }
  summary: UsageSummary[]
  details: any[] | null
}

export default function UsageReportPage() {
  const [report, setReport] = useState<UsageReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    // Set default dates (current month)
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    setFrom(sanitizeDateInput(firstDay.toISOString().split('T')[0]))
    setTo(sanitizeDateInput(lastDay.toISOString().split('T')[0]))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadReport()
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    if (!report || report.summary.length === 0) {
      alert('Tidak ada data untuk di-export')
      return
    }
    const headers = ['Kode', 'Nama Bahan', 'Qty 1', 'Satuan 1', 'Qty 2', 'Satuan 2', 'Qty 3', 'Satuan 3', 'HPP Pemakaian']
    const data: any[][] = []
    // Title and period rows
    data.push(['Laporan Pemakaian Bahan Baku'])
    data.push([`Periode: ${from} s/d ${to}`])
    data.push([])
    data.push(headers)
    // Body
    const totalHpp = report.summary.reduce((sum, item) => sum + Number(item.total_hpp_used || 0), 0)
    for (const item of report.summary) {
      const conv = item.unit_conversions || []
      data.push([
        item.ingredient_code,
        item.ingredient_name,
        conv[0] ? Number(conv[0].quantity || 0) : '',
        conv[0] ? conv[0].unit_name : '',
        conv[1] ? Number(conv[1].quantity || 0) : '',
        conv[1] ? conv[1].unit_name : '',
        conv[2] ? Number(conv[2].quantity || 0) : '',
        conv[2] ? conv[2].unit_name : '',
        Number(item.total_hpp_used || 0),
      ])
    }
    // Total row
    data.push(['', '', '', '', '', '', '', 'TOTAL:', Number(totalHpp)])

    // Create worksheet/workbook
    const ws = XLSX.utils.aoa_to_sheet(data)
    // Column widths
    ws['!cols'] = [
      { wch: 12 }, // Kode
      { wch: 30 }, // Nama Bahan
      { wch: 12 }, // Qty1
      { wch: 12 }, // Sat1
      { wch: 12 }, // Qty2
      { wch: 12 }, // Sat2
      { wch: 12 }, // Qty3
      { wch: 12 }, // Sat3
      { wch: 16 }, // HPP
    ]
    // Apply 2-decimal number format for numeric cells (Qty and HPP)
    const range = XLSX.utils.decode_range(ws['!ref'] as string)
    // Start formatting after header row (data starts at row index 4 in 1-based terms)
    for (let R = 5; R <= range.e.r + 1; R++) {
      ;['C','E','G','I'].forEach(C => {
        const addr = `${C}${R}`
        const cell = ws[addr]
        if (cell && typeof cell.v === 'number') cell.z = '#,##0.00'
      })
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan')
    XLSX.writeFile(wb, `Laporan_Pemakaian_Bahan_${from}_${to}.xlsx`)
  }

  const loadReport = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/usage-report?from=${from}&to=${to}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data)
      } else {
        console.error('Failed to load usage report')
      }
    } catch (e) {
      console.error('Error loading usage report:', e)
    } finally {
      setLoading(false)
    }
  }

  // Sorting for table rows
  const rows = (report?.summary ?? []) as UsageSummary[]
  const { sorted, sortKey, sortOrder, toggleSort } = useSort<UsageSummary>(rows, 'ingredient_code', 'asc')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan Pemakaian Bahan</h1>
          <p className="text-sm text-slate-600 mt-1">Berbasis resep dan transaksi penjualan (Hanya POS Resto)</p>
        </div>
      </div>

      {/* Filter Periode */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-end gap-3">
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(sanitizeDateInput(e.target.value))}
              className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm"
            />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(sanitizeDateInput(e.target.value))}
              className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-1.5 bg-gradient-to-r from-[#2BA8A2] to-[#3CC4BD] text-white rounded-lg hover:from-[#1E8C86] hover:to-[#2BA8A2] disabled:opacity-50 text-sm font-medium shadow-lg"
          >
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>
          {report && report.summary.length > 0 && (
            <>
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-lg hover:from-teal-dark hover:to-teal-primary text-sm font-medium shadow flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 bg-gradient-to-r from-[#2BA8A2] to-[#3CC4BD] text-white rounded-lg hover:from-[#1E8C86] hover:to-[#2BA8A2] text-sm font-medium shadow flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Report Table */}
      {report && (
        <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[#2BA8A2] to-[#3CC4BD] text-white">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('ingredient_code')}>
                      Kode <SortIcon active={sortKey==='ingredient_code'} order={sortKey==='ingredient_code'?sortOrder:undefined} />
                    </button>
                  </th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('ingredient_name')}>
                      Nama Bahan <SortIcon active={sortKey==='ingredient_name'} order={sortKey==='ingredient_name'?sortOrder:undefined} />
                    </button>
                  </th>
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r)=> r.unit_conversions?.[0]?.quantity ?? 0)}>
                      Qty 1 <SortIcon active={typeof sortKey==='function'} order={typeof sortKey==='function'?sortOrder:undefined} />
                    </button>
                  </th>
                  <th className="px-1 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r)=> r.unit_conversions?.[0]?.unit_name ?? '')}>
                      Satuan 1 <SortIcon active={typeof sortKey==='function'} order={typeof sortKey==='function'?sortOrder:undefined} />
                    </button>
                  </th>
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r)=> r.unit_conversions?.[1]?.quantity ?? 0)}>
                      Qty 2 <SortIcon active={typeof sortKey==='function'} order={typeof sortKey==='function'?sortOrder:undefined} />
                    </button>
                  </th>
                  <th className="px-1 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r)=> r.unit_conversions?.[1]?.unit_name ?? '')}>
                      Satuan 2 <SortIcon active={typeof sortKey==='function'} order={typeof sortKey==='function'?sortOrder:undefined} />
                    </button>
                  </th>
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r)=> r.unit_conversions?.[2]?.quantity ?? 0)}>
                      Qty 3 <SortIcon active={typeof sortKey==='function'} order={typeof sortKey==='function'?sortOrder:undefined} />
                    </button>
                  </th>
                  <th className="px-1 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r)=> r.unit_conversions?.[2]?.unit_name ?? '')}>
                      Satuan 3 <SortIcon active={typeof sortKey==='function'} order={typeof sortKey==='function'?sortOrder:undefined} />
                    </button>
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('total_hpp_used' as any)}>
                      HPP Pemakaian <SortIcon active={sortKey==='total_hpp_used'} order={sortKey==='total_hpp_used'?sortOrder:undefined} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-sm">
                      Tidak ada pemakaian bahan dalam periode ini
                    </td>
                  </tr>
                ) : (
                  sorted.map((item) => {
                    const conv = item.unit_conversions || []
                    return (
                      <tr key={item.ingredient_id} className="border-t hover:bg-slate-50">
                        <td className="px-2 py-1 text-xs font-semibold text-slate-800">
                          {item.ingredient_code}
                        </td>
                        <td className="px-2 py-1 text-xs text-slate-700">
                          {item.ingredient_name}
                        </td>
                        {/* Qty 1 */}
                        <td className="px-1 py-1 text-xs text-right font-semibold text-slate-800">
                          {conv[0] ? conv[0].quantity.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '-'}
                        </td>
                        {/* Satuan 1 */}
                        <td className="px-1 py-1 text-xs text-left text-slate-600">
                          {conv[0] ? conv[0].unit_name : '-'}
                        </td>
                        {/* Qty 2 */}
                        <td className="px-1 py-1 text-xs text-right font-semibold text-slate-800">
                          {conv[1] ? conv[1].quantity.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '-'}
                        </td>
                        {/* Satuan 2 */}
                        <td className="px-1 py-1 text-xs text-left text-slate-600">
                          {conv[1] ? conv[1].unit_name : '-'}
                        </td>
                        {/* Qty 3 */}
                        <td className="px-1 py-1 text-xs text-right font-semibold text-slate-800">
                          {conv[2] ? conv[2].quantity.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '-'}
                        </td>
                        {/* Satuan 3 */}
                        <td className="px-1 py-1 text-xs text-left text-slate-600">
                          {conv[2] ? conv[2].unit_name : '-'}
                        </td>
                        {/* HPP */}
                        <td className="px-2 py-1 text-xs text-right font-bold text-teal-primary font-mono">
                          Rp {Number(item.total_hpp_used || 0).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {report.summary.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={8} className="px-2 py-1.5 text-xs font-bold text-slate-800 text-right">
                      Total ({report.summary.length} bahan):
                    </td>
                    <td className="px-2 py-1.5 text-xs font-bold text-[#B33A1A] text-right font-mono">
                      Rp {report.summary.reduce((sum, item) => sum + Number(item.total_hpp_used || 0), 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-500">
          Pilih periode dan klik &ldquo;Tampilkan Laporan&rdquo; untuk melihat data
        </div>
      )}
    </div>
  )
}
