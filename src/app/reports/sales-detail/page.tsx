"use client"
import { useEffect, useState } from "react"
import SortIcon from "@/components/ui/SortIcon"
import { sanitizeDateInput } from "@/lib/sanitizeDateInput"
import { useGroupBy } from "@/components/reports/useGroupBy"
import GroupByDropZone from "@/components/reports/GroupByDropZone"
import NestedGroupBody from "@/components/reports/NestedGroupBody"

interface Row {
  transaction_id: number
  transaction_number: string
  transaction_date: string
  customer_name: string
  sales_type: string
  item_name: string
  quantity: number
  unit: string
  unit_price: number
  discount_percent: number
  discount_total: number
  ppn_amount: number
  subtotal: number
}

export default function SalesDetailReportPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [transactionNumber, setTransactionNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  // Column picker
  const ALL_COLUMNS = [
    { key: 'transaction_number', label: 'Kode Nota' },
    { key: 'transaction_date', label: 'Tanggal' },
    { key: 'customer_name', label: 'Nama Customer' },
    { key: 'sales_type', label: 'Jenis Penjualan' },
    { key: 'item_name', label: 'Nama Barang' },
    { key: 'quantity', label: 'QTY' },
    { key: 'unit', label: 'Satuan' },
    { key: 'unit_price', label: 'Harga' },
    { key: 'discount_percent', label: 'Disc %' },
    { key: 'discount_total', label: 'Disc Total' },
    { key: 'ppn_amount', label: 'PPN' },
    { key: 'subtotal', label: 'Subtotal' },
  ] as const
  type ColKey = (typeof ALL_COLUMNS)[number]['key']
  const DEFAULT_VISIBLE = ALL_COLUMNS.map(c => c.key)
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_VISIBLE)
  const [showColPicker, setShowColPicker] = useState(false)

  const {
    groupBy,
    collapsedPaths,
    sortedTree,
    sortKey,
    sortOrder,
    sortedRows,
    removeGroupBy,
    toggleCollapse,
    collapseAll,
    expandAll,
    toggleSort,
    onHeaderDragStart,
    onDropZoneDropAt,
  } = useGroupBy(rows, ALL_COLUMNS)

  useEffect(() => {
    if (false) {
      // set default current month and auto-load
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const fromDate = firstDay.toISOString().split("T")[0]
      const toDate = lastDay.toISOString().split("T")[0]
      setFrom(fromDate)
      setTo(toDate)
      
      // Auto-load data on mount
      loadReportWithParams(fromDate, toDate, "")
    }
  }, [])

  const loadReportWithParams = async (fromDate: string, toDate: string, txNumber: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (fromDate) params.set("from", fromDate)
      if (toDate) params.set("to", toDate)
      if (txNumber) params.set("transaction_number", txNumber)
      const res = await fetch(`/api/sales-detail-report?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRows(data.rows || [])
      } else {
        setRows([])
      }
    } catch (e) {
      console.error(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const loadReport = () => {
    loadReportWithParams(from, to, transactionNumber)
  }

  // Load/persist column visibility
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('report_sales_detail.columns.visible')
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
    try { if (typeof window !== 'undefined') window.localStorage.setItem('report_sales_detail.columns.visible', JSON.stringify(visibleCols)) } catch {}
  }, [visibleCols])
  const isVisible = (k: ColKey) => visibleCols.includes(k)
  const toggleVisible = (k: ColKey) => setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])

  const numericCols = ['quantity','unit_price','discount_percent','discount_total','ppn_amount','subtotal']
  const totalSubtotal = rows.reduce((s, r) => s + Number(r.subtotal || 0), 0)

  const formatCell = (row: any, colKey: string) => {
    if (numericCols.includes(colKey)) {
      return Number(row[colKey] || 0).toLocaleString('id-ID')
    }
    return String(row[colKey] ?? '')
  }

  const cellClass = (row: any, colKey: string) => {
    const base = 'px-2 py-1 text-xs'
    const align = numericCols.includes(colKey) ? 'text-right' : ''
    const style = colKey === 'subtotal' ? 'font-bold text-teal-primary' : colKey === 'quantity' ? 'font-semibold text-[#3C3C3C]' : 'text-slate-600'
    return `${base} ${align} ${style}`
  }

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
      'Nama Customer',
      'Jenis Penjualan',
      'Nama Barang',
      'QTY',
      'Satuan',
      'Harga',
      'Disc %',
      'Disc Total',
      'PPN',
      'Subtotal'
    ]
    const lines = rows.map(r => [
      r.transaction_number,
      r.transaction_date,
      r.customer_name,
      r.sales_type,
      r.item_name,
      String(r.quantity),
      r.unit,
      String(r.unit_price),
      String(r.discount_percent),
      String(r.discount_total),
      String(r.ppn_amount),
      String(r.subtotal)
    ])
    const csv = [
      ['Laporan Detail Penjualan'],
      [`Periode: ${from} s/d ${to}`],
      [],
      headers,
      ...lines,
      [],
      ['', '', '', '', '', '', '', '', '', '', 'TOTAL:', String(totalSubtotal)]
    ].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Laporan_Detail_Penjualan_${from}_${to}.csv`
    a.click()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Laporan Detail Penjualan</h1>
        <p className="text-sm text-slate-600 mt-1">Detail item per transaksi penjualan</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
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
            <label className="block text-xs font-medium text-slate-700 mb-1">Kode Nota (Opsional)</label>
            <input type="text" value={transactionNumber} onChange={(e)=>setTransactionNumber(e.target.value)} placeholder="JL/2025/000001" className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div className="flex gap-2 relative">
            <button onClick={loadReport} disabled={loading} className="px-4 py-1.5 bg-teal-primary text-white rounded-pill hover:bg-teal-dark disabled:opacity-50 text-sm font-medium shadow-sm">{loading? 'Memuat...' : 'Tampilkan'}</button>
            {rows.length > 0 && (
              <>
                <button onClick={handlePrint} className="px-3 py-1.5 bg-[#3C3C3C] text-white rounded-pill hover:bg-[#2A2A2A] text-sm font-medium shadow-sm flex items-center gap-1.5">Print</button>
                <button onClick={handleExportCSV} className="px-3 py-1.5 bg-gradient-to-r from-[#2BA8A2] to-[#3CC4BD] text-white rounded-pill hover:from-[#1E8C86] hover:to-[#2BA8A2] text-sm font-medium shadow flex items-center gap-1.5">Excel</button>
              </>
            )}
            <button onClick={()=>setShowColPicker(v=>!v)} className="px-3 py-1.5 border border-teal-primary text-teal-dark rounded-pill hover:bg-teal-bg text-sm">Pilih Kolom</button>
            {showColPicker && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow p-2 z-10">
                <div className="text-[10px] font-bold text-slate-600 mb-2">Tampilkan Kolom</div>
                <div className="max-h-64 overflow-auto pr-1 space-y-1">
                  {ALL_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" className="accent-[#2BA8A2]" checked={isVisible(col.key)} onChange={() => toggleVisible(col.key)} />
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

      <GroupByDropZone
        groupBy={groupBy}
        allColumns={ALL_COLUMNS}
        onDropAt={onDropZoneDropAt}
        onRemove={removeGroupBy}
        onCollapseAll={collapseAll}
        onExpandAll={expandAll}
        hasGroups={rows.length > 0 && groupBy.length > 0}
      />

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#3C3C3C] text-white">
              <tr>
                {ALL_COLUMNS.map(col => isVisible(col.key) && (
                <th key={col.key}
                  draggable
                  onDragStart={e => onHeaderDragStart(e, col.key)}
                  className={`px-2 py-1.5 text-xs font-semibold cursor-grab active:cursor-grabbing ${
                    numericCols.includes(col.key) ? 'text-right' : 'text-left'
                  }`}
                >
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort(col.key)}>
                    <span className="text-slate-400 select-none text-[9px]">⠿</span>
                    {col.label} <SortIcon active={sortKey===col.key} order={sortKey===col.key?sortOrder:undefined} />
                  </button>
                </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length} className="px-2 py-4 text-center text-slate-500 text-xs">Tidak ada data</td>
                </tr>
              ) : groupBy.length === 0 ? (
                sortedRows.map((r, idx) => (
                  <tr key={`${r.transaction_id}-${idx}`} className="border-t hover:bg-slate-50">
                    {ALL_COLUMNS.filter(c => isVisible(c.key)).map(col => (
                      <td key={col.key} className={cellClass(r, col.key)}>
                        {formatCell(r, col.key)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <NestedGroupBody
                  nodes={sortedTree}
                  visibleCols={visibleCols as unknown as string[]}
                  collapsedPaths={collapsedPaths}
                  toggleCollapse={toggleCollapse}
                  formatCell={formatCell}
                  cellClass={cellClass}
                />
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={Math.max(visibleCols.length - 1, 1)} className="px-2 py-1.5 text-xs font-bold text-slate-800 text-right">TOTAL:</td>
                {isVisible('subtotal') && (<td className="px-2 py-1.5 text-xs font-bold text-teal-primary text-right font-mono">{totalSubtotal.toLocaleString('id-ID')}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
