"use client"
import { useEffect, useState, useMemo } from "react"
import { useSort } from "@/lib/useSort"
import SortIcon from "@/components/ui/SortIcon"
import { sanitizeDateInput } from "@/lib/sanitizeDateInput"

interface Row {
  payment_id: number
  payment_number: string
  payment_date: string
  customer_name: string
  status: string
  notes: string
  payment_amount: number
  sale_number: string
  invoice_number: string
  due_amount: number
  pay_amount: number
  account_name: string
  method_amount: number
  item_notes: string
}

export default function PaymentDetailApReportPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [paymentNumber, setPaymentNumber] = useState("")
  const [customer, setCustomer] = useState<string>("")
  const [status, setStatus] = useState<string>("active")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  const ALL_COLUMNS = [
    { key: 'payment_number', label: 'No. Pembayaran' },
    { key: 'payment_date', label: 'Tanggal' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'status', label: 'Status' },
    { key: 'sale_number', label: 'No. Penjualan' },
    { key: 'invoice_number', label: 'No. Invoice' },
    { key: 'due_amount', label: 'Jatuh Tempo' },
    { key: 'pay_amount', label: 'Dibayar' },
    { key: 'account_name', label: 'Akun' },
    { key: 'method_amount', label: 'Nilai' },
    { key: 'notes', label: 'Catatan' },
  ] as const
  type ColKey = (typeof ALL_COLUMNS)[number]['key']
  const DEFAULT_VISIBLE = ALL_COLUMNS.map(c => c.key)
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_VISIBLE)
  const [showColPicker, setShowColPicker] = useState(false)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('report_payment_detail_ap.columns.visible')
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
    try { if (typeof window !== 'undefined') window.localStorage.setItem('report_payment_detail_ap.columns.visible', JSON.stringify(visibleCols)) } catch {}
  }, [visibleCols])
  const isVisible = (k: ColKey) => visibleCols.includes(k)
  const toggleVisible = (k: ColKey) => setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const visibleCount = visibleCols.length

  const loadReport = async () => {
    if (!from || !to) {
      alert("Pilih tanggal awal dan akhir terlebih dahulu")
      return
    }
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (paymentNumber) params.set('payment_number', paymentNumber)
      if (customer) params.set('customer', customer)
      if (status) params.set('status', status)
      const res = await fetch(`/api/reports/payment-detail-ap-report?${params.toString()}`)
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

  const { sorted: sortedRows, sortKey, sortOrder, toggleSort } = useSort<Row>(rows, 'payment_date', 'desc')
  const indicator = (key: any) => sortKey === key ? sortOrder : undefined

  const groups = useMemo(() => {
    const byId = [...sortedRows].sort((a, b) => a.payment_id - b.payment_id)
    const result: { rows: Row[]; span: number }[] = []
    let i = 0
    while (i < byId.length) {
      const pid = byId[i].payment_id
      const g: Row[] = []
      while (i < byId.length && byId[i].payment_id === pid) {
        g.push(byId[i]); i++
      }
      result.push({ rows: g, span: g.length })
    }
    return result
  }, [sortedRows])

  const summary = useMemo(() => {
    const totalDue = sortedRows.reduce((s, r) => s + (r.due_amount || 0), 0)
    const totalPaid = sortedRows.reduce((s, r) => s + (r.pay_amount || 0), 0)
    const totalMethod = sortedRows.reduce((s, r) => s + (r.method_amount || 0), 0)
    return {
      totalRows: sortedRows.length,
      totalDue,
      totalPaid,
      totalMethod,
      uniquePayments: [...new Set(sortedRows.map(r => r.payment_id))].length,
    }
  }, [sortedRows])

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
  }

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'active': return <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-100 text-green-800">Aktif</span>
      case 'void': return <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-100 text-red-800">Batal</span>
      default: return <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-800">{st}</span>
    }
  }

  const handlePrint = () => { window.print() }

  const handleExportCSV = () => {
    if (!rows.length) { alert('Tidak ada data'); return }
    const headerRow = ['No. Pembayaran', 'Tanggal', 'Customer', 'Status', 'No. Penjualan', 'No. Invoice', 'Jatuh Tempo', 'Dibayar', 'Akun', 'Nilai', 'Catatan']
    const lines = sortedRows.map(r => [
      r.payment_number, r.payment_date, r.customer_name, r.status,
      r.sale_number || '', r.invoice_number || '', String(r.due_amount || 0),
      String(r.pay_amount || 0), r.account_name || '', String(r.method_amount || 0),
      r.notes || r.item_notes || ''
    ])
    const csv = [
      ['Laporan Detail Pembayaran Piutang'],
      [`Periode: ${from} s/d ${to}`],
      [],
      headerRow,
      ...lines,
    ].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Detail_Pembayaran_Piutang_${from}_${to}.csv`
    a.click()
  }

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Detail Pembayaran Piutang</h1>
        <p className="report-subtitle">Laporan detail pembayaran piutang customer per item</p>
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
            <label className="block text-xs font-medium text-slate-700 mb-1">No. Pembayaran</label>
            <input type="text" placeholder="No. pembayaran..." value={paymentNumber} onChange={(e) => setPaymentNumber(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm w-44" />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer</label>
            <input type="text" placeholder="Nama customer..." value={customer} onChange={(e) => setCustomer(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm w-44" />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-28">
              <option value="">Semua</option>
              <option value="active">Aktif</option>
              <option value="void">Batal</option>
            </select>
          </div>
          <div className="flex gap-2 relative">
            <button onClick={loadReport} disabled={loading} className="px-4 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary disabled:opacity-50 text-sm font-medium shadow-lg">{loading ? 'Memuat...' : 'Tampilkan'}</button>
            {rows.length > 0 && (
              <>
                <button onClick={handlePrint} className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary text-sm font-medium shadow">Print</button>
                <button onClick={handleExportCSV} className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary text-sm font-medium shadow">Excel</button>
              </>
            )}
            <button onClick={()=>setShowColPicker(v=>!v)} className="px-3 py-1.5 border border-teal-primary text-teal-primary rounded-pill hover:bg-teal-bg text-sm">Pilih Kolom</button>
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

      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="report-card">
            <div className="text-xs text-slate-600 mb-1 font-semibold">Total Baris</div>
            <div className="text-lg font-bold text-slate-800">{summary.totalRows}</div>
          </div>
          <div className="report-card">
            <div className="text-xs text-slate-600 mb-1 font-semibold">Jumlah Pembayaran</div>
            <div className="text-lg font-bold text-teal-primary">{summary.uniquePayments}</div>
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
            <div className="text-lg font-bold text-teal-primary">{formatCurrency(summary.totalMethod)}</div>
          </div>
        </div>
      )}

      <div className="report-card">
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead className="bg-gradient-to-r from-teal-primary to-teal-light text-white">
              <tr>
                {isVisible('payment_number') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('payment_number')}>
                      No. Pembayaran <SortIcon active={sortKey==='payment_number'} order={indicator('payment_number')} />
                    </button>
                  </th>
                )}
                {isVisible('payment_date') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('payment_date')}>
                      Tanggal <SortIcon active={sortKey==='payment_date'} order={indicator('payment_date')} />
                    </button>
                  </th>
                )}
                {isVisible('customer_name') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('customer_name')}>
                      Customer <SortIcon active={sortKey==='customer_name'} order={indicator('customer_name')} />
                    </button>
                  </th>
                )}
                {isVisible('status') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">Status</th>
                )}
                {isVisible('sale_number') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('sale_number')}>
                      No. Penjualan <SortIcon active={sortKey==='sale_number'} order={indicator('sale_number')} />
                    </button>
                  </th>
                )}
                {isVisible('invoice_number') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">No. Invoice</th>
                )}
                {isVisible('due_amount') && (
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('due_amount')}>
                      Jatuh Tempo <SortIcon active={sortKey==='due_amount'} order={indicator('due_amount')} />
                    </button>
                  </th>
                )}
                {isVisible('pay_amount') && (
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('pay_amount')}>
                      Dibayar <SortIcon active={sortKey==='pay_amount'} order={indicator('pay_amount')} />
                    </button>
                  </th>
                )}
                {isVisible('account_name') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">Akun</th>
                )}
                {isVisible('method_amount') && (
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('method_amount')}>
                      Nilai <SortIcon active={sortKey==='method_amount'} order={indicator('method_amount')} />
                    </button>
                  </th>
                )}
                {isVisible('notes') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">Catatan</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={visibleCount} className="px-4 py-8 text-center text-slate-500 text-sm">Memuat data...</td></tr>
              ) : sortedRows.length === 0 ? (
                <tr><td colSpan={visibleCount} className="px-4 py-8 text-center text-slate-500 text-sm">Tidak ada data</td></tr>
              ) : (
                groups.map(group =>
                  group.rows.map((row, idx) => (
                    <tr key={`${row.payment_id}-${idx}`} className={`${idx === 0 ? 'border-t-2 border-slate-300' : 'border-t'} hover:bg-slate-50`}>
                      {idx === 0 && isVisible('payment_number') && (<td className="px-2 py-1 text-xs font-medium text-slate-800 align-top" rowSpan={group.span}>{row.payment_number}</td>)}
                      {idx === 0 && isVisible('payment_date') && (<td className="px-2 py-1 text-xs text-slate-600 align-top" rowSpan={group.span}>{formatDate(row.payment_date)}</td>)}
                      {idx === 0 && isVisible('customer_name') && (<td className="px-2 py-1 text-xs text-slate-700 align-top" rowSpan={group.span}>{row.customer_name || '-'}</td>)}
                      {idx === 0 && isVisible('status') && (<td className="px-2 py-1 text-xs align-top" rowSpan={group.span}>{getStatusBadge(row.status)}</td>)}
                      {isVisible('sale_number') && (<td className="px-2 py-1 text-xs text-slate-700">{row.sale_number || '-'}</td>)}
                      {isVisible('invoice_number') && (<td className="px-2 py-1 text-xs text-slate-600">{row.invoice_number || '-'}</td>)}
                      {isVisible('due_amount') && (<td className="px-2 py-1 text-xs text-right text-orange-600">{row.due_amount ? formatCurrency(row.due_amount) : '-'}</td>)}
                      {isVisible('pay_amount') && (<td className="px-2 py-1 text-xs text-right text-green-600">{row.pay_amount ? formatCurrency(row.pay_amount) : '-'}</td>)}
                      {isVisible('account_name') && (<td className="px-2 py-1 text-xs text-slate-700">{row.account_name || '-'}</td>)}
                      {isVisible('method_amount') && (<td className="px-2 py-1 text-xs text-right font-semibold text-teal-primary">{row.method_amount ? formatCurrency(row.method_amount) : '-'}</td>)}
                      {isVisible('notes') && (<td className="px-2 py-1 text-xs text-slate-600">{row.item_notes || row.notes || '-'}</td>)}
                    </tr>
                  ))
                )
              )}
            </tbody>
            {!loading && sortedRows.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={visibleCols.indexOf('due_amount') >= 0 ? visibleCols.indexOf('due_amount') : Math.max(visibleCount - 4, 1)} className="px-2 py-1.5 text-xs font-bold text-slate-700 text-right">TOTAL</td>
                  {isVisible('due_amount') && (<td className="px-2 py-1.5 text-xs font-bold text-orange-700 text-right">{formatCurrency(summary.totalDue)}</td>)}
                  {isVisible('pay_amount') && (<td className="px-2 py-1.5 text-xs font-bold text-green-700 text-right">{formatCurrency(summary.totalPaid)}</td>)}
                  {isVisible('account_name') && (<td className="px-2 py-1.5"></td>)}
                  {isVisible('method_amount') && (<td className="px-2 py-1.5 text-xs font-bold text-teal-primary text-right">{formatCurrency(summary.totalMethod)}</td>)}
                  {isVisible('notes') && (<td className="px-2 py-1.5"></td>)}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
