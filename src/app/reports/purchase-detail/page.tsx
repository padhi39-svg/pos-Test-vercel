"use client"
import { useEffect, useState, useMemo } from "react"
import SortIcon from "@/components/ui/SortIcon"
import { sanitizeDateInput } from "@/lib/sanitizeDateInput"

interface Row {
  purchase_id: number
  purchase_number: string
  purchase_date: string
  supplier_name: string
  purchase_type: string
  item_name: string
  quantity: number
  unit: string
  unit_price: number
  discount_percent: number
  discount_total: number
  subtotal: number
}

type TxSortKey = 'purchase_number' | 'purchase_date' | 'supplier_name' | 'purchase_type'

type ItemSortKey = 'item_name' | 'quantity' | 'unit' | 'unit_price' | 'discount_percent' | 'discount_total' | 'subtotal'

export default function PurchaseDetailReportPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [purchaseNumber, setPurchaseNumber] = useState("")
  const [type, setType] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  const ALL_COLUMNS = [
    { key: 'purchase_number', label: 'Kode Nota' },
    { key: 'purchase_date', label: 'Tanggal' },
    { key: 'supplier_name', label: 'Nama Supplier' },
    { key: 'purchase_type', label: 'Jenis Pembelian' },
    { key: 'item_name', label: 'Nama Barang' },
    { key: 'quantity', label: 'QTY' },
    { key: 'unit', label: 'Satuan' },
    { key: 'unit_price', label: 'Harga' },
    { key: 'discount_percent', label: 'Disc %' },
    { key: 'discount_total', label: 'Disc Total' },
    { key: 'subtotal', label: 'Subtotal' },
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

  const loadReportWithParams = async (fromDate: string, toDate: string, prNumber: string, prType: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (prNumber) params.set('purchase_number', prNumber)
      if (prType) params.set('type', prType)
      const res = await fetch(`/api/purchase-detail-report?${params.toString()}`)
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
    loadReportWithParams(from, to, purchaseNumber, type)
  }

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('report_purchase_detail.columns.visible')
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
    try { if (typeof window !== 'undefined') window.localStorage.setItem('report_purchase_detail.columns.visible', JSON.stringify(visibleCols)) } catch {}
  }, [visibleCols])

  const isVisible = (k: ColKey) => visibleCols.includes(k)
  const toggleVisible = (k: ColKey) => setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const visibleCount = visibleCols.length

  const groupedData = useMemo(() => {
    const groups: { [key: string]: Row[] } = {}
    rows.forEach(row => {
      const key = String(row.purchase_number || '')
      if (!groups[key]) groups[key] = []
      groups[key].push(row)
    })
    return groups
  }, [rows])

  const [sortKey, setSortKey] = useState<TxSortKey | ItemSortKey>('purchase_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const toggleSort = (key: TxSortKey | ItemSortKey) => {
    if (sortKey === key) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  const sortedEntries = useMemo(() => {
    const entries = Object.entries(groupedData) as [string, Row[]][]
    const dir = sortOrder === 'asc' ? 1 : -1
    const isTxKey = (k: string): k is TxSortKey => (
      k === 'purchase_number' || k === 'purchase_date' || k === 'supplier_name' || k === 'purchase_type'
    )
    if (isTxKey(sortKey)) {
      return [...entries].sort(([, aRows], [, bRows]) => {
        const aVal: any = aRows[0]?.[sortKey] ?? ''
        const bVal: any = bRows[0]?.[sortKey] ?? ''
        if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir
        const sa = String(aVal).toLowerCase()
        const sb = String(bVal).toLowerCase()
        if (sa < sb) return -1 * dir
        if (sa > sb) return 1 * dir
        return 0
      })
    }

    const baseGroupSorted = [...entries].sort(([, aRows], [, bRows]) => {
      const at = Date.parse(String(aRows[0]?.purchase_date || '')) || 0
      const bt = Date.parse(String(bRows[0]?.purchase_date || '')) || 0
      return at - bt
    })

    return baseGroupSorted.map(([tx, txRows]) => {
      const rowsSorted = [...txRows].sort((a, b) => {
        const av: any = (a as any)[sortKey]
        const bv: any = (b as any)[sortKey]
        if (typeof av === 'number' && typeof bv === 'number') return sortOrder === 'asc' ? av - bv : bv - av
        const sa = String(av ?? '').toLowerCase()
        const sb = String(bv ?? '').toLowerCase()
        if (sa < sb) return sortOrder === 'asc' ? -1 : 1
        if (sa > sb) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
      return [tx, rowsSorted] as [string, Row[]]
    })
  }, [groupedData, sortKey, sortOrder])

  const totalSubtotal = rows.reduce((s, r) => s + Number(r.subtotal || 0), 0)

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
      'Nama Barang',
      'QTY',
      'Satuan',
      'Harga',
      'Disc %',
      'Disc Total',
      'Subtotal'
    ]
    const lines = rows.map(r => [
      r.purchase_number,
      r.purchase_date,
      r.supplier_name,
      r.purchase_type,
      r.item_name,
      String(r.quantity),
      r.unit,
      String(r.unit_price),
      String(r.discount_percent),
      String(r.discount_total),
      String(r.subtotal)
    ])
    const csv = [
      ['Laporan Detail Pembelian'],
      [`Periode: ${from} s/d ${to}`],
      [],
      headers,
      ...lines,
      [],
      ['', '', '', '', '', '', '', '', '', 'TOTAL:', String(totalSubtotal)]
    ].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Laporan_Detail_Pembelian_${from}_${to}.csv`
    a.click()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Laporan Detail Pembelian</h1>
        <p className="text-sm text-slate-600 mt-1">Detail item per transaksi pembelian</p>
      </div>

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
            <input type="text" value={purchaseNumber} onChange={(e)=>setPurchaseNumber(e.target.value)} placeholder="PB/2026/000001" className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
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

      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-teal-primary to-teal-light text-white">
              <tr>
                {isVisible('purchase_number') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('purchase_number')}>
                      Kode Nota <SortIcon active={sortKey==='purchase_number'} order={sortKey==='purchase_number'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('purchase_date') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('purchase_date')}>
                      Tanggal <SortIcon active={sortKey==='purchase_date'} order={sortKey==='purchase_date'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('supplier_name') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('supplier_name')}>
                      Nama Supplier <SortIcon active={sortKey==='supplier_name'} order={sortKey==='supplier_name'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('purchase_type') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('purchase_type')}>
                      Jenis Pembelian <SortIcon active={sortKey==='purchase_type'} order={sortKey==='purchase_type'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('item_name') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('item_name')}>
                      Nama Barang <SortIcon active={sortKey==='item_name'} order={sortKey==='item_name'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('quantity') && (
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('quantity')}>
                      QTY <SortIcon active={sortKey==='quantity'} order={sortKey==='quantity'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('unit') && (
                  <th className="px-1 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('unit')}>
                      Satuan <SortIcon active={sortKey==='unit'} order={sortKey==='unit'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('unit_price') && (
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('unit_price')}>
                      Harga <SortIcon active={sortKey==='unit_price'} order={sortKey==='unit_price'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('discount_percent') && (
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('discount_percent')}>
                      Disc % <SortIcon active={sortKey==='discount_percent'} order={sortKey==='discount_percent'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('discount_total') && (
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('discount_total')}>
                      Disc Total <SortIcon active={sortKey==='discount_total'} order={sortKey==='discount_total'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
                {isVisible('subtotal') && (
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('subtotal')}>
                      Subtotal <SortIcon active={sortKey==='subtotal'} order={sortKey==='subtotal'?sortOrder:undefined} />
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={visibleCount} className="px-2 py-4 text-center text-slate-500 text-xs">Tidak ada data</td>
                </tr>
              ) : (
                sortedEntries.map(([, txRows]) => {
                  const rowCount = txRows.length
                  return txRows.map((r, idx) => (
                    <tr key={`${r.purchase_id}-${idx}`} className="border-t hover:bg-slate-50">
                      {idx === 0 && (
                        <>
                          {isVisible('purchase_number') && (<td rowSpan={rowCount} className="px-2 py-1 text-xs text-slate-700 border-r">{r.purchase_number}</td>)}
                          {isVisible('purchase_date') && (<td rowSpan={rowCount} className="px-2 py-1 text-xs text-slate-700 border-r">{r.purchase_date}</td>)}
                          {isVisible('supplier_name') && (<td rowSpan={rowCount} className="px-2 py-1 text-xs text-slate-700 border-r">{r.supplier_name}</td>)}
                          {isVisible('purchase_type') && (<td rowSpan={rowCount} className="px-2 py-1 text-xs text-slate-700 border-r">{r.purchase_type}</td>)}
                        </>
                      )}
                      {isVisible('item_name') && (<td className="px-2 py-1 text-xs text-slate-700">{r.item_name}</td>)}
                      {isVisible('quantity') && (<td className="px-1 py-1 text-xs text-right text-slate-800 font-semibold">{Number(r.quantity).toLocaleString('id-ID')}</td>)}
                      {isVisible('unit') && (<td className="px-1 py-1 text-xs text-left text-slate-700">{r.unit}</td>)}
                      {isVisible('unit_price') && (<td className="px-1 py-1 text-xs text-right text-slate-700">{Number(r.unit_price).toLocaleString('id-ID')}</td>)}
                      {isVisible('discount_percent') && (<td className="px-1 py-1 text-xs text-right text-slate-700">{Number(r.discount_percent).toLocaleString('id-ID')}</td>)}
                      {isVisible('discount_total') && (<td className="px-1 py-1 text-xs text-right text-slate-700">{Number(r.discount_total).toLocaleString('id-ID')}</td>)}
                      {isVisible('subtotal') && (<td className="px-2 py-1 text-xs text-right font-bold text-teal-primary">{Number(r.subtotal).toLocaleString('id-ID')}</td>)}
                    </tr>
                  ))
                })
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300">
              <tr>
                <td colSpan={Math.max(visibleCount - 1, 1)} className="px-2 py-1.5 text-xs font-bold text-slate-800 text-right">TOTAL:</td>
                {isVisible('subtotal') && (<td className="px-2 py-1.5 text-xs font-bold text-teal-dark text-right font-mono">{totalSubtotal.toLocaleString('id-ID')}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
