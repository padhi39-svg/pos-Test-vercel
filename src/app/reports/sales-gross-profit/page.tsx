"use client"
import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'
import SortIcon from '@/components/ui/SortIcon'
import { sanitizeDateInput } from '@/lib/sanitizeDateInput'
import { useSort } from '@/lib/useSort'

type SimpleRef = { id: number; name: string }

type Row = {
  kodenota: string
  nama_barang: string
  qty: number
  harga: number
  subtotal: number
  hpp: number
  total_hpp: number
  laba_rugi: number
}

export default function SalesGrossProfitPage() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [metaLoading, setMetaLoading] = useState(true)
  const [barangList, setBarangList] = useState<SimpleRef[]>([])
  const [customerList, setCustomerList] = useState<SimpleRef[]>([])

  const [from, setFrom] = useState<string>("")
  const [to, setTo] = useState<string>("")
  const [barangId, setBarangId] = useState<number | ''>('')
  const [customerId, setCustomerId] = useState<number | ''>('')

  const ALL_COLUMNS = [
    { key: 'kodenota', label: 'Kodenota' },
    { key: 'nama_barang', label: 'Nama barang' },
    { key: 'qty', label: 'QTY' },
    { key: 'harga', label: 'Harga' },
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'hpp', label: 'Hpp' },
    { key: 'total_hpp', label: 'Total Hpp' },
    { key: 'laba_rugi', label: 'Laba/Rugi' },
  ] as const
  const DEFAULT_VISIBLE: string[] = ALL_COLUMNS.map(c => c.key as string)
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE)
  const isVisible = (k: string) => visibleCols.includes(k)
  const toggleVisible = (k: string) => setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])

  useEffect(() => {
    ;(async () => {
      try {
        setMetaLoading(true)
        const res = await fetch('/api/reports/sales-gross-profit?mode=meta', { cache: 'no-store' })
        const d = await res.json().catch(() => ({}))
        setBarangList(Array.isArray(d.barang) ? d.barang : [])
        setCustomerList(Array.isArray(d.customer) ? d.customer : [])
      } catch {}
      finally { setMetaLoading(false) }
    })()
  }, [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('report_sales_gross_profit.columns.visible')
      if (saved) {
        const arr = JSON.parse(saved)
        if (Array.isArray(arr) && arr.length) {
          const allowed = DEFAULT_VISIBLE
          const filtered = arr.filter((k: string) => allowed.includes(k))
          if (filtered.length) setVisibleCols(filtered)
        }
      }
    } catch {}
  }, [])
  useEffect(() => {
    try { window.localStorage.setItem('report_sales_gross_profit.columns.visible', JSON.stringify(visibleCols)) } catch {}
  }, [visibleCols])

  const loadReport = async () => {
    if (!from || !to) { alert('Isi tanggal awal dan tanggal akhir'); return }
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('from', from)
      params.set('to', to)
      if (barangId) params.set('barangId', String(barangId))
      if (customerId) params.set('customerId', String(customerId))
      const res = await fetch(`/api/reports/sales-gross-profit?${params.toString()}`)
      const d = await res.json()
      if (res.ok) setRows(Array.isArray(d.rows) ? d.rows : [])
      else {
        console.error(d?.error || 'Gagal memuat laporan')
        setRows([])
      }
    } catch (e) {
      console.error(e)
      setRows([])
    } finally { setLoading(false) }
  }

  const totals = useMemo(() => {
    const subtotal = rows.reduce((s, r) => s + Number(r.subtotal || 0), 0)
    const totalHpp = rows.reduce((s, r) => s + Number(r.total_hpp || 0), 0)
    const labaRugi = subtotal - totalHpp
    return { subtotal, totalHpp, labaRugi }
  }, [rows])

  const { sorted: sortedRows, sortKey, sortOrder, toggleSort } = useSort<Row>(rows, 'kodenota', 'asc')

  const number = (n: number) => new Intl.NumberFormat('id-ID').format(Number(n || 0))

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Laporan Penjualan Laba/Rugi Kotor</h1>
        <p className="report-subtitle">Ringkasan laba kotor per baris penjualan</p>
      </div>

      <div className="report-card report-card-pad">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Awal</label>
            <input type="date" value={from} onChange={(e)=>setFrom(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Akhir</label>
            <input type="date" value={to} onChange={(e)=>setTo(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="flex-shrink-0 min-w-[14rem]">
            <label className="block text-xs font-medium text-slate-700 mb-1">Barang</label>
            <select className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-full" value={barangId}
              onChange={(e)=> setBarangId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Semua</option>
              {barangList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex-shrink-0 min-w-[14rem]">
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer</label>
            <select className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-full" value={customerId}
              onChange={(e)=> setCustomerId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Semua</option>
              {customerList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={loadReport} disabled={loading} className="px-4 py-1.5 bg-gradient-to-r from-[#2BA8A2] to-[#3CC4BD] text-white rounded-lg hover:from-[#1E8C86] hover:to-[#2BA8A2] disabled:opacity-50 text-sm font-medium shadow-lg">{loading? 'Memuat...' : 'Tampilkan'}</button>
          </div>
        </div>
      </div>

      <div className="report-card">
        <div className="report-table-wrapper">
        <table className="report-table">
          <thead className="bg-gradient-to-r from-[#2BA8A2] to-[#3CC4BD] text-white">
            <tr>
              {isVisible('kodenota') && (
                <th className="px-2 py-1.5 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('kodenota')}>
                    Kodenota <SortIcon active={sortKey==='kodenota'} order={sortKey==='kodenota'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('nama_barang') && (
                <th className="px-2 py-1.5 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('nama_barang')}>
                    Nama barang <SortIcon active={sortKey==='nama_barang'} order={sortKey==='nama_barang'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('qty') && (
                <th className="px-2 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r: Row) => r.qty)}>
                    QTY <SortIcon active={String(sortKey)==='function'} order={sortOrder} />
                  </button>
                </th>
              )}
              {isVisible('harga') && (
                <th className="px-2 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r: Row) => r.harga)}>
                    Harga <SortIcon active={String(sortKey)==='function'} order={sortOrder} />
                  </button>
                </th>
              )}
              {isVisible('subtotal') && (
                <th className="px-2 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r: Row) => r.subtotal)}>
                    Subtotal <SortIcon active={String(sortKey)==='function'} order={sortOrder} />
                  </button>
                </th>
              )}
              {isVisible('hpp') && (
                <th className="px-2 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r: Row) => r.hpp)}>
                    Hpp <SortIcon active={String(sortKey)==='function'} order={sortOrder} />
                  </button>
                </th>
              )}
              {isVisible('total_hpp') && (
                <th className="px-2 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r: Row) => r.total_hpp)}>
                    Total Hpp <SortIcon active={String(sortKey)==='function'} order={sortOrder} />
                  </button>
                </th>
              )}
              {isVisible('laba_rugi') && (
                <th className="px-2 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r: Row) => r.laba_rugi)}>
                    Laba/Rugi <SortIcon active={String(sortKey)==='function'} order={sortOrder} />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-2 py-2" colSpan={8}>Memuat...</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td className="px-2 py-2" colSpan={8}>Tidak ada data</td></tr>
            ) : (
              sortedRows.map((r, idx) => (
                <tr key={idx} className="border-t">
                  {isVisible('kodenota') && <td className="px-2 py-1">{r.kodenota}</td>}
                  {isVisible('nama_barang') && <td className="px-2 py-1">{r.nama_barang}</td>}
                  {isVisible('qty') && <td className="px-2 py-1 text-right">{number(r.qty)}</td>}
                  {isVisible('harga') && <td className="px-2 py-1 text-right">{number(r.harga)}</td>}
                  {isVisible('subtotal') && <td className="px-2 py-1 text-right">{number(r.subtotal)}</td>}
                  {isVisible('hpp') && <td className="px-2 py-1 text-right">{number(r.hpp)}</td>}
                  {isVisible('total_hpp') && <td className="px-2 py-1 text-right">{number(r.total_hpp)}</td>}
                  {isVisible('laba_rugi') && <td className="px-2 py-1 text-right">{number(r.laba_rugi)}</td>}
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-300">
            <tr>
              <td className="px-2 py-1" colSpan={ALL_COLUMNS.findIndex(c=>c.key==='qty')}>
                Total
              </td>
              {isVisible('qty') && <td className="px-2 py-1"></td>}
              {isVisible('harga') && <td className="px-2 py-1"></td>}
              {isVisible('subtotal') && <td className="px-2 py-1 text-right font-bold text-teal-dark">{number(totals.subtotal)}</td>}
              {isVisible('hpp') && <td className="px-2 py-1"></td>}
              {isVisible('total_hpp') && <td className="px-2 py-1 text-right font-bold text-teal-dark">{number(totals.totalHpp)}</td>}
              {isVisible('laba_rugi') && <td className="px-2 py-1 text-right font-bold text-teal-dark">{number(totals.labaRugi)}</td>}
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </div>
  )
}
