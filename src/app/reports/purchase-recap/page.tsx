"use client"
import { useEffect, useMemo, useState } from "react"
import { useSort } from "@/lib/useSort"
import SortIcon from "@/components/ui/SortIcon"
import { sanitizeDateInput } from "@/lib/sanitizeDateInput"

interface Row {
  id: number
  transaction_number: string
  transaction_date: string
  supplier_name: string
  purchase_type: string
  subtotal: number
  discount_percent: number
  discount_amount: number
  ppn_amount: number
  total: number
}

type RowSortKey = keyof Row

export default function PurchaseRecapReportPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [type, setType] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  // Column picker (Header)
  const ALL_COLUMNS = [
    { key: 'transaction_number', label: 'Kode Nota' },
    { key: 'transaction_date', label: 'Tanggal' },
    { key: 'supplier_name', label: 'Nama Supplier' },
    { key: 'purchase_type', label: 'Jenis Pembelian' },
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'discount_percent', label: 'Diskon %' },
    { key: 'discount_amount', label: 'Diskon Rp' },
    { key: 'ppn_amount', label: 'PPN' },
    { key: 'total', label: 'Total' },
  ] as const
  const DEFAULT_VISIBLE = ALL_COLUMNS.map(c => c.key)
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE)
  const [showColPicker, setShowColPicker] = useState(false)

  useEffect(() => {
    if (false) {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const fromDate = firstDay.toISOString().split("T")[0]
      const toDate = lastDay.toISOString().split("T")[0]
      setFrom(fromDate)
      setTo(toDate)
      loadReportWithDates(fromDate, toDate)
    }
  }, [])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('report_purchase_recap.columns.visible')
        if (saved) {
          const arr = JSON.parse(saved)
          if (Array.isArray(arr) && arr.length) {
            const allowed = DEFAULT_VISIBLE
            const filtered = arr.filter((k: string) => allowed.includes(k))
            if (filtered.length) setVisibleCols(filtered)
          }
        }
      }
    } catch {}
  }, [])
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem('report_purchase_recap.columns.visible', JSON.stringify(visibleCols)) } catch {}
  }, [visibleCols])

  const isVisible = (k: string) => visibleCols.includes(k)
  const toggleVisible = (k: string) => setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const visibleCount = visibleCols.length

  const loadReportWithDates = async (fromDate: string, toDate: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (fromDate) params.set("from", fromDate)
      if (toDate) params.set("to", toDate)
      if (type) params.set("type", type)
      const res = await fetch(`/api/purchase-recap-report?${params.toString()}`)
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        setRows(Array.isArray(data?.rows) ? data.rows : [])
      } else {
        setRows([])
      }
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const loadReport = async () => {
    await loadReportWithDates(from, to)
  }

  const totalSubtotal = rows.reduce((s, r) => s + Number(r.subtotal || 0), 0)
  const totalDiscount = rows.reduce((s, r) => s + Number(r.discount_amount || 0), 0)
  const totalPPN = rows.reduce((s, r) => s + Number(r.ppn_amount || 0), 0)
  const totalGrandTotal = rows.reduce((s, r) => s + Number(r.total || 0), 0)

  const { sorted: sortedRows, sortKey, sortOrder, toggleSort } = useSort<Row>(rows, 'transaction_date', 'asc')

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (!rows || rows.length === 0) {
      alert('Tidak ada data untuk di-export')
      return
    }
    const headers = [
      'Kode Nota',
      'Tanggal',
      'Nama Supplier',
      'Jenis Pembelian',
      'Subtotal',
      'Diskon %',
      'Diskon Rp',
      'PPN',
      'Total'
    ]
    const lines = rows.map(r => [
      r.transaction_number,
      r.transaction_date,
      r.supplier_name,
      r.purchase_type,
      String(r.subtotal),
      String(r.discount_percent),
      String(r.discount_amount),
      String(r.ppn_amount),
      String(r.total)
    ])
    const csv = [
      ['Laporan Rekap Pembelian'],
      [`Periode: ${from} s/d ${to}`],
      [],
      headers,
      ...lines,
      [],
      ['', '', '', 'TOTAL:', String(totalSubtotal), '', String(totalDiscount), String(totalPPN), String(totalGrandTotal)]
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Laporan_Rekap_Pembelian_${from}_${to}.csv`
    a.click()
  }

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Laporan Rekap Pembelian</h1>
        <p className="report-subtitle">Rekap transaksi pembelian per periode</p>
      </div>

      <div className="report-card report-card-pad">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Dari Tanggal</label>
            <input type="date" value={from} onChange={(e)=>setFrom(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Sampai Tanggal</label>
            <input type="date" value={to} onChange={(e)=>setTo(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Jenis Pembelian</label>
            <select value={type} onChange={(e)=>setType(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
              <option value="">Semua</option>
              <option value="0">Pembelian</option>
              <option value="1">Retur Pembelian</option>
            </select>
          </div>

          <div className="flex gap-2 relative">
            <button onClick={loadReport} disabled={loading} className="px-4 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary disabled:opacity-50 text-sm font-medium shadow-lg">{loading? 'Memuat...' : 'Tampilkan'}</button>
            {rows.length > 0 && (
              <>
                <button onClick={handlePrint} className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary text-sm font-medium shadow flex items-center gap-1.5">Print</button>
                <button onClick={handleExportCSV} className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary text-sm font-medium shadow flex items-center gap-1.5">Excel</button>
              </>
            )}
            <button onClick={()=>setShowColPicker(v=>!v)} className="px-3 py-1.5 border border-teal-primary text-teal-dark rounded-pill hover:bg-teal-bg text-sm">Pilih Kolom</button>
            {showColPicker && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow p-2 z-10">
                <div className="text-[10px] font-bold text-slate-600 mb-2">Tampilkan Kolom</div>
                <div className="max-h-64 overflow-auto pr-1 space-y-1">
                  {ALL_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" className="accent-teal-primary" checked={isVisible(col.key)} onChange={() => toggleVisible(col.key)} />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex justify-end">
                  <button onClick={()=>setShowColPicker(false)} className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50">Tutup</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="report-card">
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead className="bg-gradient-to-r from-teal-primary to-teal-light text-white">
              <tr>
                {isVisible('transaction_number') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('transaction_number' as RowSortKey)}>
                      Kode Nota <SortIcon active={sortKey==='transaction_number'} order={sortKey==='transaction_number'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('transaction_date') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('transaction_date' as RowSortKey)}>
                      Tanggal <SortIcon active={sortKey==='transaction_date'} order={sortKey==='transaction_date'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('supplier_name') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('supplier_name' as RowSortKey)}>
                      Nama Supplier <SortIcon active={sortKey==='supplier_name'} order={sortKey==='supplier_name'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('purchase_type') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('purchase_type' as RowSortKey)}>
                      Jenis Pembelian <SortIcon active={sortKey==='purchase_type'} order={sortKey==='purchase_type'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('subtotal') && (
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('subtotal' as RowSortKey)}>
                      Subtotal <SortIcon active={sortKey==='subtotal'} order={sortKey==='subtotal'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('discount_percent') && (
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('discount_percent' as RowSortKey)}>
                      Diskon % <SortIcon active={sortKey==='discount_percent'} order={sortKey==='discount_percent'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('discount_amount') && (
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('discount_amount' as RowSortKey)}>
                      Diskon Rp. <SortIcon active={sortKey==='discount_amount'} order={sortKey==='discount_amount'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('ppn_amount') && (
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('ppn_amount' as RowSortKey)}>
                      PPN <SortIcon active={sortKey==='ppn_amount'} order={sortKey==='ppn_amount'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('total') && (
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('total' as RowSortKey)}>
                      Total <SortIcon active={sortKey==='total'} order={sortKey==='total'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleCount} className="px-2 py-4 text-center text-slate-500 text-xs">Tidak ada data</td>
                </tr>
              ) : (
                sortedRows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-slate-50">
                    {isVisible('transaction_number') && (<td className="px-2 py-1 text-xs text-slate-700">{r.transaction_number}</td>)}
                    {isVisible('transaction_date') && (<td className="px-2 py-1 text-xs text-slate-700">{r.transaction_date}</td>)}
                    {isVisible('supplier_name') && (<td className="px-2 py-1 text-xs text-slate-700">{r.supplier_name}</td>)}
                    {isVisible('purchase_type') && (<td className="px-2 py-1 text-xs text-slate-700">{r.purchase_type}</td>)}
                    {isVisible('subtotal') && (<td className="px-1 py-1 text-xs text-right text-slate-800 font-semibold">{Number(r.subtotal).toLocaleString('id-ID')}</td>)}
                    {isVisible('discount_percent') && (<td className="px-1 py-1 text-xs text-right text-slate-700">{Number(r.discount_percent).toLocaleString('id-ID')}</td>)}
                    {isVisible('discount_amount') && (<td className="px-1 py-1 text-xs text-right text-slate-700">{Number(r.discount_amount).toLocaleString('id-ID')}</td>)}
                    {isVisible('ppn_amount') && (<td className="px-1 py-1 text-xs text-right text-slate-700">{Number(r.ppn_amount).toLocaleString('id-ID')}</td>)}
                    {isVisible('total') && (<td className="px-2 py-1 text-xs text-right font-bold text-teal-primary">{Number(r.total).toLocaleString('id-ID')}</td>)}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300">
              <tr>
                <td colSpan={Math.max(visibleCount - 5, 1)}></td>
                {isVisible('subtotal') && (<td className="px-1 py-1.5 text-xs font-bold text-slate-800 text-right font-mono">{totalSubtotal.toLocaleString('id-ID')}</td>)}
                {isVisible('discount_percent') && (<td className="px-1 py-1.5 text-xs font-bold text-slate-800 text-right"></td>)}
                {isVisible('discount_amount') && (<td className="px-1 py-1.5 text-xs font-bold text-slate-800 text-right font-mono">{totalDiscount.toLocaleString('id-ID')}</td>)}
                {isVisible('ppn_amount') && (<td className="px-1 py-1.5 text-xs font-bold text-slate-800 text-right font-mono">{totalPPN.toLocaleString('id-ID')}</td>)}
                {isVisible('total') && (<td className="px-2 py-1.5 text-xs font-bold text-teal-dark text-right font-mono">{totalGrandTotal.toLocaleString('id-ID')}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
