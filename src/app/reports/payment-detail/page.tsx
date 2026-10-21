"use client"
import { useEffect, useState, useMemo } from "react"
import { useSort } from "@/lib/useSort"
import SortIcon from "@/components/ui/SortIcon"
import { sanitizeDateInput } from "@/lib/sanitizeDateInput"

interface Row {
  payment_id: number
  payment_number: string
  payment_date: string
  supplier_name: string
  purchase_number: string
  invoice_number: string
  due_amount: number
  pay_amount: number
  account_name: string
  amount: number
  notes: string
}

type TxSortKey = 'payment_number' | 'payment_date' | 'supplier_name'
type ItemSortKey = 'purchase_number' | 'invoice_number' | 'due_amount' | 'pay_amount' | 'account_name' | 'amount'

export default function PaymentDetailReportPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [paymentNumber, setPaymentNumber] = useState("")
  const [supplier, setSupplier] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  const ALL_COLUMNS = [
    { key: 'payment_number', label: 'No. Pembayaran' },
    { key: 'payment_date', label: 'Tanggal' },
    { key: 'supplier_name', label: 'Nama Supplier' },
    { key: 'purchase_number', label: 'No. Pembelian' },
    { key: 'invoice_number', label: 'No. Invoice' },
    { key: 'due_amount', label: 'Jatuh Tempo' },
    { key: 'pay_amount', label: 'Dibayar' },
    { key: 'account_name', label: 'Akun' },
    { key: 'amount', label: 'Nilai' },
    { key: 'notes', label: 'Catatan' },
  ] as const
  type ColKey = (typeof ALL_COLUMNS)[number]['key']
  const DEFAULT_VISIBLE = ALL_COLUMNS.map(c => c.key)
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_VISIBLE)
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
      loadReportWithParams(fromDate, toDate, "", "")
    }
  }, [])

  const loadReportWithParams = async (fromDate: string, toDate: string, payNumber: string, suppName: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (payNumber) params.set('payment_number', payNumber)
      if (suppName) params.set('supplier', suppName)
      const res = await fetch(`/api/payment-detail-report?${params.toString()}`)
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
    loadReportWithParams(from, to, paymentNumber, supplier)
  }

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('report_payment_detail.columns.visible')
        if (saved) {
          const arr = JSON.parse(saved)
          if (Array.isArray(arr) && arr.length) {
            const allowed = DEFAULT_VISIBLE
            const filtered = arr.filter((k: any) => allowed.includes(k)) as ColKey[]
            if (filtered.length) setVisibleCols(filtered)
          }
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem('report_payment_detail.columns.visible', JSON.stringify(visibleCols)) } catch {}
  }, [visibleCols])

  const isVisible = (k: ColKey) => visibleCols.includes(k)
  const toggleVisible = (k: ColKey) => setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const visibleCount = visibleCols.length

  // Sorting
  const { sorted: sortedRows, sortKey, sortOrder, toggleSort } = useSort<Row>(rows, 'payment_date', 'desc')
  const indicator = (key: any) => sortKey === key ? sortOrder : undefined

  // Summary calculations
  const summary = useMemo(() => {
    const totalDue = sortedRows.reduce((sum, r) => sum + (r.due_amount || 0), 0)
    const totalPaid = sortedRows.reduce((sum, r) => sum + (r.pay_amount || 0), 0)
    const totalAmount = sortedRows.reduce((sum, r) => sum + (r.amount || 0), 0)
    return {
      totalRows: sortedRows.length,
      totalDue,
      totalPaid,
      totalAmount,
      uniquePayments: [...new Set(sortedRows.map(r => r.payment_id))].length,
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

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Detail Pembayaran Hutang</h1>
        <p className="report-subtitle">Laporan detail pembayaran hutang supplier per item</p>
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
            <label className="block text-xs font-medium text-slate-700 mb-1">No. Pembayaran</label>
            <input
              type="text"
              placeholder="No. pembayaran..."
              value={paymentNumber}
              onChange={(e) => setPaymentNumber(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm w-48"
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
            <button
              onClick={loadReport}
              disabled={loading}
              className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-sm font-medium shadow-lg"
            >
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
          </div>
          <div className="flex-shrink-0 ml-auto">
            <button
              onClick={() => setShowColPicker(!showColPicker)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium border border-slate-300"
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
          <div className="text-xs text-slate-600 mb-1 font-semibold">Total Baris</div>
          <div className="text-lg font-bold text-slate-800">{summary.totalRows}</div>
        </div>
        <div className="report-card">
          <div className="text-xs text-slate-600 mb-1 font-semibold">Jumlah Pembayaran</div>
          <div className="text-lg font-bold text-blue-600">{summary.uniquePayments}</div>
        </div>
        <div className="report-card">
          <div className="text-xs text-slate-600 mb-1 font-semibold">Total Jatuh Tempo</div>
          <div className="text-lg font-bold text-orange-600">{formatCurrency(summary.totalDue)}</div>
        </div>
        <div className="report-card">
          <div className="text-xs text-slate-600 mb-1 font-semibold">Total Dibayar</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(summary.totalPaid)}</div>
        </div>
        <div className="report-card">
          <div className="text-xs text-slate-600 mb-1 font-semibold">Total Nilai</div>
          <div className="text-lg font-bold text-emerald-600">{formatCurrency(summary.totalAmount)}</div>
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
                    {col.key === 'purchase_number' && (
                      <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('purchase_number')}>
                        {col.label} <SortIcon active={sortKey==='purchase_number'} order={indicator('purchase_number') as any} />
                      </button>
                    )}
                    {col.key === 'due_amount' && (
                      <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('due_amount')}>
                        {col.label} <SortIcon active={sortKey==='due_amount'} order={indicator('due_amount') as any} />
                      </button>
                    )}
                    {col.key === 'pay_amount' && (
                      <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('pay_amount')}>
                        {col.label} <SortIcon active={sortKey==='pay_amount'} order={indicator('pay_amount') as any} />
                      </button>
                    )}
                    {col.key === 'amount' && (
                      <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('amount')}>
                        {col.label} <SortIcon active={sortKey==='amount'} order={indicator('amount') as any} />
                      </button>
                    )}
                    {col.key === 'invoice_number' && col.label}
                    {col.key === 'account_name' && col.label}
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
                  <tr key={idx} className="border-t hover:bg-slate-50">
                    {isVisible('payment_number') && (
                      <td className="px-3 py-2 text-xs text-slate-800 font-medium">{row.payment_number}</td>
                    )}
                    {isVisible('payment_date') && (
                      <td className="px-3 py-2 text-xs text-slate-600">{formatDate(row.payment_date)}</td>
                    )}
                    {isVisible('supplier_name') && (
                      <td className="px-3 py-2 text-xs text-slate-700">{row.supplier_name || '-'}</td>
                    )}
                    {isVisible('purchase_number') && (
                      <td className="px-3 py-2 text-xs text-slate-700">{row.purchase_number || '-'}</td>
                    )}
                    {isVisible('invoice_number') && (
                      <td className="px-3 py-2 text-xs text-slate-600">{row.invoice_number || '-'}</td>
                    )}
                    {isVisible('due_amount') && (
                      <td className="px-3 py-2 text-xs text-right text-orange-600">{formatCurrency(row.due_amount || 0)}</td>
                    )}
                    {isVisible('pay_amount') && (
                      <td className="px-3 py-2 text-xs text-right text-green-600">{formatCurrency(row.pay_amount || 0)}</td>
                    )}
                    {isVisible('account_name') && (
                      <td className="px-3 py-2 text-xs text-slate-700">{row.account_name || '-'}</td>
                    )}
                    {isVisible('amount') && (
                      <td className="px-3 py-2 text-xs text-right font-semibold text-emerald-600">{formatCurrency(row.amount || 0)}</td>
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
                  <td colSpan={visibleCols.indexOf('due_amount') >= 0 ? visibleCols.indexOf('due_amount') : visibleCols.length - 1} className="px-3 py-2 text-xs font-bold text-slate-700 text-right">
                    TOTAL
                  </td>
                  {isVisible('due_amount') && (
                    <td className="px-3 py-2 text-xs font-bold text-orange-700 text-right">{formatCurrency(summary.totalDue)}</td>
                  )}
                  {isVisible('pay_amount') && (
                    <td className="px-3 py-2 text-xs font-bold text-green-700 text-right">{formatCurrency(summary.totalPaid)}</td>
                  )}
                  {isVisible('amount') && (
                    <td className="px-3 py-2 text-xs font-bold text-emerald-700 text-right">{formatCurrency(summary.totalAmount)}</td>
                  )}
                  {[...visibleCols].filter(col => !['due_amount', 'pay_amount', 'amount'].includes(col)).slice(Math.max(visibleCols.indexOf('amount'), visibleCols.indexOf('pay_amount'), visibleCols.indexOf('due_amount')) + 1).map(() => (
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
