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

export default function PembelianLaporanPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [type, setType] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

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

  const isVisible = (k: string) => visibleCols.includes(k)
  const toggleVisible = (k: string) => setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const visibleCount = visibleCols.length

  const loadReport = async (fromDate: string, toDate: string, reportType: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (reportType) params.set('type', reportType)
      const res = await fetch(`/api/purchases?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRows(Array.isArray(data) ? data : [])
      } else {
        setRows([])
      }
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadReport(from, to, type)
  }

  const { sorted, sortKey, sortOrder, toggleSort } = useSort(rows, 'transaction_date')

  const totals = useMemo(() => {
    if (!sorted.length) return { subtotal: 0, discount: 0, ppn: 0, total: 0 }
    return sorted.reduce(
      (acc, r) => ({
        subtotal: acc.subtotal + Number(r.subtotal || 0),
        discount: acc.discount + Number(r.discount_amount || 0),
        ppn: acc.ppn + Number(r.ppn_amount || 0),
        total: acc.total + Number(r.total || 0),
      }),
      { subtotal: 0, discount: 0, ppn: 0, total: 0 }
    )
  }, [sorted])

  const formatRp = (v: number | string) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(v || 0))

  useEffect(() => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setFrom(firstDay.toISOString().split("T")[0])
    setTo(lastDay.toISOString().split("T")[0])
  }, [])

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-lg font-bold mb-3">Laporan Pembelian</h1>

      {/* Filter */}
      <div className="flex flex-wrap items-end gap-2 mb-4 bg-white p-3 rounded-lg shadow-sm border">
        <div>
          <label className="text-xs font-medium text-slate-500 block">Dari Tanggal</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border rounded px-2 py-1 text-sm w-40" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block">Sampai Tanggal</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border rounded px-2 py-1 text-sm w-40" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block">Jenis</label>
          <select value={type} onChange={e => setType(e.target.value)}
            className="border rounded px-2 py-1 text-sm">
            <option value="">Semua</option>
            <option value="TUN">Tunai</option>
            <option value="KR">Kredit</option>
          </select>
        </div>
        <button onClick={handleSearch}
          className="bg-teal-primary text-white px-4 py-1.5 rounded text-sm hover:bg-teal-dark">
          Cari
        </button>
        <button onClick={() => setShowColPicker(!showColPicker)}
          className="border px-3 py-1.5 rounded text-sm hover:bg-slate-50 ml-auto">
          Kolom ({visibleCount})
        </button>
      </div>

      {/* Column picker */}
      {showColPicker && (
        <div className="mb-4 p-3 bg-white rounded-lg shadow-sm border flex flex-wrap gap-3">
          {ALL_COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={isVisible(col.key)} onChange={() => toggleVisible(col.key)} />
              {col.label}
            </label>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-primary mx-auto mb-3"></div>
          <p className="text-slate-600 text-sm">Memuat data...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
              <tr>
                {ALL_COLUMNS.filter(c => isVisible(c.key)).map(col => (
                  <th key={col.key} className="px-3 py-2 text-left cursor-pointer select-none" onClick={() => toggleSort(col.key as RowSortKey)}>
                    <span className="flex items-center gap-1">{col.label}<SortIcon sortKey={col.key as RowSortKey} currentSortKey={sortKey} currentSortDir={sortOrder} /></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={visibleCount} className="px-3 py-8 text-center text-slate-400">Tidak ada data</td></tr>
              ) : (
                sorted.map((row, idx) => (
                  <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    {ALL_COLUMNS.filter(c => isVisible(c.key)).map(col => (
                      <td key={col.key} className="px-3 py-1.5 border-t whitespace-nowrap">
                        {['subtotal', 'discount_amount', 'ppn_amount', 'total'].includes(col.key)
                          ? formatRp((row as any)[col.key])
                          : (row as any)[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {sorted.length > 0 && (
            <div className="px-3 py-2 border-t bg-slate-50 text-sm font-semibold flex gap-6">
              <span>Subtotal: {formatRp(totals.subtotal)}</span>
              <span>Diskon: {formatRp(totals.discount)}</span>
              <span>PPN: {formatRp(totals.ppn)}</span>
              <span>Total: {formatRp(totals.total)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
