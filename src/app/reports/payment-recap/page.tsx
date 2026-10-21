"use client"
import { useEffect, useMemo, useState } from "react"
import { useSort } from "@/lib/useSort"
import SortIcon from "@/components/ui/SortIcon"
import { sanitizeDateInput } from "@/lib/sanitizeDateInput"

interface Row {
  id: number
  payment_number: string
  payment_date: string
  supplier_name: string
  total: number
  status: string
  notes: string
}

type RowSortKey = keyof Row

export default function PaymentRecapReportPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [supplier, setSupplier] = useState<string>("")
  const [status, setStatus] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  // Column picker (Header)
  const ALL_COLUMNS = [
    { key: 'payment_number', label: 'No. Pembayaran' },
    { key: 'payment_date', label: 'Tanggal' },
    { key: 'supplier_name', label: 'Nama Supplier' },
    { key: 'total', label: 'Total' },
    { key: 'status', label: 'Status' },
    { key: 'notes', label: 'Catatan' },
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
        const saved = window.localStorage.getItem('report_payment_recap.columns.visible')
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
    try { if (typeof window !== 'undefined') window.localStorage.setItem('report_payment_recap.columns.visible', JSON.stringify(visibleCols)) } catch {}
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
      if (supplier) params.set("supplier", supplier)
      if (status) params.set("status", status)
      const res = await fetch(`/api/payment-recap-report?${params.toString()}`)
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

  const loadReport = () => {
    if (!from || !to) {
      alert("Pilih tanggal awal dan akhir terlebih dahulu")
      return
    }
    loadReportWithDates(from, to)
  }

  // Sorting
  const { sorted: sortedRows, sortKey, sortOrder, toggleSort } = useSort<Row>(rows, 'payment_date', 'desc')
  const indicator = (key: any) => sortKey === key ? sortOrder : undefined

  // Summary calculations
  const summary = useMemo(() => {
    const active = sortedRows.filter(r => r.status === 'active')
    const voided = sortedRows.filter(r => r.status === 'void')
    return {
      total: sortedRows.reduce((sum, r) => sum + r.total, 0),
      activeCount: active.length,
      activeTotal: active.reduce((sum, r) => sum + r.total, 0),
      voidCount: voided.length,
      voidTotal: voided.reduce((sum, r) => sum + r.total, 0),
    }
  }, [sortedRows])

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Aktif</span>
      case 'void':
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Batal</span>
      default:
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">{status}</span>
    }
  }

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Rekap Pembayaran Hutang</h1>
        <p className="report-subtitle">Laporan rekapitulasi pembayaran hutang supplier</p>
      </div>

      <div className="report-card report-card-pad">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Dari Tanggal</label>
            <input 
              type="date" 
              value={from} 
              onChange={(e)=>setFrom(sanitizeDateInput(e.target.value))} 
              className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" 
            />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Sampai Tanggal</label>
            <input 
              type="date" 
              value={to} 
              onChange={(e)=>setTo(sanitizeDateInput(e.target.value))} 
              className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" 
            />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Supplier</label>
            <input
              type="text"
              placeholder="Nama supplier..."
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm w-48"
            />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm w-32"
            >
              <option value="">Semua</option>
              <option value="active">Aktif</option>
              <option value="void">Batal</option>
            </select>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={loadReport}
              disabled={loading}
              className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-pill hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-sm font-medium shadow-lg"
            >
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
          </div>
          <div className="flex-shrink-0 ml-auto">
            <button
              onClick={() => setShowColPicker(!showColPicker)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-pill text-sm font-medium border border-slate-300"
            >
              Kolom ({visibleCount}/{ALL_COLUMNS.length})
            </button>
          </div>
        </div>

        {showColPicker && (
          <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-xs font-medium text-slate-700 mb-2">Pilih Kolom yang Ditampilkan:</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {ALL_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={isVisible(col.key)}
                    onChange={() => toggleVisible(col.key)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="report-card">
          <div className="text-xs text-slate-600 mb-1 font-semibold">Total Transaksi</div>
          <div className="text-lg font-bold text-slate-800">{sortedRows.length}</div>
        </div>
        <div className="report-card">
          <div className="text-xs text-slate-600 mb-1 font-semibold">Total Nilai</div>
          <div className="text-lg font-bold text-emerald-600">{formatCurrency(summary.total)}</div>
        </div>
        <div className="report-card">
          <div className="text-xs text-slate-600 mb-1 font-semibold">Aktif</div>
          <div className="text-lg font-bold text-green-600">{summary.activeCount}</div>
          <div className="text-xs text-green-600">{formatCurrency(summary.activeTotal)}</div>
        </div>
        <div className="report-card">
          <div className="text-xs text-slate-600 mb-1 font-semibold">Batal</div>
          <div className="text-lg font-bold text-red-600">{summary.voidCount}</div>
          <div className="text-xs text-red-600">{formatCurrency(summary.voidTotal)}</div>
        </div>
        <div className="report-card">
          <div className="text-xs text-slate-600 mb-1 font-semibold">Netto</div>
          <div className="text-lg font-bold text-blue-600">{formatCurrency(summary.activeTotal)}</div>
        </div>
      </div>

      {/* Data Table */}
      <div className="report-card">
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <tr>
                {ALL_COLUMNS.filter(col => isVisible(col.key)).map(col => (
                  <th key={col.key} className="px-3 py-2 text-left text-xs font-semibold">
                    {col.key === 'payment_number' && (
                      <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('payment_number')}>
                        {col.label} <SortIcon active={sortKey==='payment_number'} order={indicator('payment_number') as any} />
                      </button>
                    )}
                    {col.key === 'payment_date' && (
                      <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('payment_date')}>
                        {col.label} <SortIcon active={sortKey==='payment_date'} order={indicator('payment_date') as any} />
                      </button>
                    )}
                    {col.key === 'supplier_name' && (
                      <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('supplier_name')}>
                        {col.label} <SortIcon active={sortKey==='supplier_name'} order={indicator('supplier_name') as any} />
                      </button>
                    )}
                    {col.key === 'total' && (
                      <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('total')}>
                        {col.label} <SortIcon active={sortKey==='total'} order={indicator('total') as any} />
                      </button>
                    )}
                    {col.key === 'status' && col.label}
                    {col.key === 'notes' && col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleCols.length} className="px-4 py-8 text-center text-slate-500 text-sm">Memuat data...</td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length} className="px-4 py-8 text-center text-slate-500 text-sm">Tidak ada data</td>
                </tr>
              ) : (
                sortedRows.map((row, idx) => (
                  <tr key={row.id} className="border-t hover:bg-slate-50">
                    {isVisible('payment_number') && (
                      <td className="px-3 py-2 text-xs text-slate-800 font-medium">{row.payment_number}</td>
                    )}
                    {isVisible('payment_date') && (
                      <td className="px-3 py-2 text-xs text-slate-600">{formatDate(row.payment_date)}</td>
                    )}
                    {isVisible('supplier_name') && (
                      <td className="px-3 py-2 text-xs text-slate-700">{row.supplier_name || '-'}</td>
                    )}
                    {isVisible('total') && (
                      <td className="px-3 py-2 text-xs text-right font-semibold text-emerald-600">{formatCurrency(row.total)}</td>
                    )}
                    {isVisible('status') && (
                      <td className="px-3 py-2 text-xs">{getStatusBadge(row.status)}</td>
                    )}
                    {isVisible('notes') && (
                      <td className="px-3 py-2 text-xs text-slate-600">{row.notes || '-'}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {!loading && sortedRows.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={visibleCols.indexOf('total') >= 0 ? visibleCols.indexOf('total') : visibleCols.length - 1} className="px-3 py-2 text-xs font-bold text-slate-700 text-right">
                    TOTAL
                  </td>
                  {isVisible('total') && (
                    <td className="px-3 py-2 text-xs font-bold text-emerald-700 text-right">{formatCurrency(summary.total)}</td>
                  )}
                  {visibleCols.indexOf('total') < 0 && (
                    <td className="px-3 py-2 text-xs font-bold text-emerald-700 text-right">{formatCurrency(summary.total)}</td>
                  )}
                  {visibleCols.filter(col => col.key !== 'total').slice(visibleCols.indexOf('total') + 1).map(() => (
                    <td key={Math.random()} className="px-3 py-2"></td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
