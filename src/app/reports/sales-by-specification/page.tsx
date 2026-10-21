"use client"

import { useEffect, useMemo, useState } from "react"
import { formatCurrency } from "@/lib/regionalNumber"
import { sanitizeDateInput } from '@/lib/sanitizeDateInput'

interface Row {
  item_name: string
  quantity: number
  unit_price: number
  subtotal: number
  spesifikasi_name?: string
}

export default function SalesBySpecificationReportPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  // Picker kolom (level item)
  const ALL_COLUMNS = [
    { key: 'item_name', label: 'Nama Barang' },
    { key: 'qty', label: 'Qty' },
    { key: 'price', label: 'Harga' },
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
      loadReportWithParams(fromDate, toDate)
    }
  }, [])

  // Muat/simpan preferensi kolom
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('report_sales_by_spec.columns.visible')
        if (saved) {
          const arr = JSON.parse(saved)
          if (Array.isArray(arr)) {
            const allowed = DEFAULT_VISIBLE
            const filtered = arr.filter((k: any) => allowed.includes(k)) as ColKey[]
            if (filtered.length) setVisibleCols(filtered)
          }
        }
      }
    } catch {}
  }, [])
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem('report_sales_by_spec.columns.visible', JSON.stringify(visibleCols)) } catch {}
  }, [visibleCols])
  const isVisible = (k: ColKey) => visibleCols.includes(k)
  const toggleVisible = (k: ColKey) => setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])

  const loadReportWithParams = async (fromDate: string, toDate: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (fromDate) params.set("from", fromDate)
      if (toDate) params.set("to", toDate)
      const res = await fetch(`/api/sales-detail-report?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRows(Array.isArray(data.rows) ? data.rows : [])
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

  const loadReport = () => loadReportWithParams(from, to)

  // Group by spesifikasi
  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const r of rows) {
      const key = (r as any).spesifikasi_name || "-"
      const arr = map.get(key) || []
      arr.push(r)
      map.set(key, arr)
    }
    return map
  }, [rows])

  const specs = useMemo(() => Array.from(grouped.keys()).sort(), [grouped])
  const grandTotal = useMemo(() => rows.reduce((a, r) => a + (Number((r as any).subtotal) || 0), 0), [rows])

  // Sorting sederhana untuk baris item dalam tiap spesifikasi
  type ItemSortKey = 'name' | 'qty' | 'price' | 'subtotal'
  const [sortKey, setSortKey] = useState<ItemSortKey>('name')
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('asc')
  const toggleSort = (k: ItemSortKey) => {
    if (sortKey === k) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortOrder('asc') }
  }

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Lap Penjualan Per Spesifikasi</h1>
        <p className="report-subtitle">Desain mirip per kategori, tetapi dikelompokkan per spesifikasi</p>
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
          <div className="flex gap-2 relative">
            <button onClick={loadReport} className="px-4 py-1.5 bg-gradient-to-r from-[#2BA8A2] to-[#3CC4BD] text-white rounded-pill hover:from-[#1E8C86] hover:to-[#2BA8A2] disabled:opacity-50 text-sm font-medium shadow-lg" disabled={loading}>{loading ? 'Memuat...' : 'Tampilkan'}</button>
            <button onClick={()=>setShowColPicker(v=>!v)} className="px-3 py-1.5 text-sm rounded-pill border border-teal-primary text-teal-dark hover:bg-teal-bg">Pilih Kolom</button>
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
                <div className="mt-2 text-right">
                  <button onClick={()=>setShowColPicker(false)} className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50">Tutup</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: '180px' }} />
            <col />
            <col style={{ width: '90px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '140px' }} />
          </colgroup>
          <thead className="bg-teal-primary text-white">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold">Spesifikasi</th>
              {isVisible('item_name') && (<th className="px-2 py-2 text-left text-xs font-semibold cursor-pointer select-none" onClick={()=>toggleSort('name')}>Nama Barang</th>)}
              {isVisible('qty') && (<th className="px-2 py-2 text-right text-xs font-semibold cursor-pointer select-none" onClick={()=>toggleSort('qty')}>Qty</th>)}
              {isVisible('price') && (<th className="px-2 py-2 text-right text-xs font-semibold cursor-pointer select-none" onClick={()=>toggleSort('price')}>Harga</th>)}
              {isVisible('subtotal') && (<th className="px-2 py-2 text-right text-xs font-semibold cursor-pointer select-none" onClick={()=>toggleSort('subtotal')}>Subtotal</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-2 py-3 text-center text-slate-500 text-xs">Memuat...</td></tr>
            )}
            {!loading && specs.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-3 text-center text-slate-500 text-xs">Tidak ada data</td></tr>
            )}
            {!loading && specs.map((sp, spIndex) => {
              const items = grouped.get(sp) || []
              const specTotal = items.reduce((a, r) => a + (Number((r as any).subtotal) || 0), 0)
              // sum per menu
              const byItem = new Map<string, { qty: number; price: number; subtotal: number }>()
              for (const r of items) {
                const key = (r as any).item_name
                const cur = byItem.get(key) || { qty: 0, price: (r as any).unit_price, subtotal: 0 }
                cur.qty += Number((r as any).quantity) || 0
                cur.price = (r as any).unit_price
                cur.subtotal += Number((r as any).subtotal) || 0
                byItem.set(key, cur)
              }
              let itemRows = Array.from(byItem.entries()).map(([name, agg]) => ({ name, ...agg }))
              // Urutkan item sesuai sortKey
              itemRows.sort((a, b) => {
                const dir = sortOrder === 'asc' ? 1 : -1
                const av: any = (sortKey === 'name' ? a.name : (sortKey === 'qty' ? a.qty : (sortKey === 'price' ? a.price : a.subtotal)))
                const bv: any = (sortKey === 'name' ? b.name : (sortKey === 'qty' ? b.qty : (sortKey === 'price' ? b.price : b.subtotal)))
                if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
                const sa = String(av).toLowerCase(), sb = String(bv).toLowerCase()
                if (sa < sb) return -1 * dir
                if (sa > sb) return 1 * dir
                return 0
              })
              const rowSpan = itemRows.length + 1
              return (
                <>
                  {itemRows.map((it, idx) => (
                    <tr key={`row-${sp}-${it.name}`} className={idx === 0 ? (spIndex > 0 ? 'border-t-2 border-slate-300' : '') : 'border-t'}>
                      {idx === 0 && (
                        <td className="px-2 py-1.5 align-middle text-center text-xs font-medium text-slate-700 bg-slate-50" rowSpan={rowSpan}>{sp}</td>
                      )}
                      {isVisible('item_name') && (<td className="px-2 py-1.5 text-xs">{it.name}</td>)}
                      {isVisible('qty') && (<td className="px-2 py-1.5 text-xs text-right">{it.qty}</td>)}
                      {isVisible('price') && (<td className="px-2 py-1.5 text-xs text-right">{formatCurrency(it.price)}</td>)}
                      {isVisible('subtotal') && (<td className="px-2 py-1.5 text-xs text-right">{formatCurrency(it.subtotal)}</td>)}
                    </tr>
                  ))}
                  <tr className="border-t">
                    <td className="px-2 py-1.5 text-xs font-semibold text-right" colSpan={Math.max((isVisible('item_name')?1:0) + (isVisible('qty')?1:0) + (isVisible('price')?1:0), 1)}>Total</td>
                    {isVisible('subtotal') && (<td className="px-2 py-1.5 text-xs font-semibold text-right">{formatCurrency(specTotal)}</td>)}
                  </tr>
                </>
              )
            })}
          </tbody>
          {!loading && specs.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100">
                <td className="px-2 py-2 text-xs font-bold text-right" colSpan={Math.max((isVisible('item_name')?1:0) + (isVisible('qty')?1:0) + (isVisible('price')?1:0), 1)}>Grand Total</td>
                {isVisible('subtotal') && (<td className="px-2 py-2 text-xs font-bold text-right">{formatCurrency(grandTotal)}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
