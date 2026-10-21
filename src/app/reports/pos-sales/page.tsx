"use client"
import { useEffect, useState } from "react"
import { formatCurrency } from "@/lib/regionalNumber"
import { useSort } from "@/lib/useSort"
import SortIcon from "@/components/ui/SortIcon"
import { sanitizeDateInput } from "@/lib/sanitizeDateInput"

interface Row {
  id: number
  kode_nota: string
  tanggal: string
  customer: string
  subtotal: number
  disc: number
  disc_nominal: number
  ppn: number
  service_charge: number
  total_bayar: number
  bayar: number
  kembalian: number
  jenis_pembayaran: string
  bank: string
}

export default function PosSalesReportPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  const ALL_COLUMNS = [
    { key: 'kode_nota', label: 'Kode Nota' },
    { key: 'tanggal', label: 'Tanggal' },
    { key: 'customer', label: 'Customer' },
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'disc', label: 'Disc %' },
    { key: 'disc_nominal', label: 'Disc Rp' },
    { key: 'ppn', label: 'PPN' },
    { key: 'service_charge', label: 'Service Charge' },
    { key: 'total_bayar', label: 'Total Bayar' },
    { key: 'bayar', label: 'Bayar' },
    { key: 'kembalian', label: 'Kembalian' },
    { key: 'jenis_pembayaran', label: 'Jenis Pembayaran' },
    { key: 'bank', label: 'Bank' },
  ] as const
  type ColKey = (typeof ALL_COLUMNS)[number]['key']
  const DEFAULT_VISIBLE = ALL_COLUMNS.map(c => c.key)
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_VISIBLE)
  const [showColPicker, setShowColPicker] = useState(false)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('report_pos_sales.columns.visible')
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
    try { if (typeof window !== 'undefined') window.localStorage.setItem('report_pos_sales.columns.visible', JSON.stringify(visibleCols)) } catch {}
  }, [visibleCols])
  const isVisible = (k: ColKey) => visibleCols.includes(k)
  const toggleVisible = (k: ColKey) => setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const visibleCount = visibleCols.length

  const loadReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      const res = await fetch(`/api/reports/pos-sales?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRows(data.rows || [])
      } else {
        const d = await res.json().catch(()=>({}))
        console.error('Gagal memuat laporan:', d?.details || d?.error)
        setRows([])
      }
    } catch (e) {
      console.error(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const totalSubtotal = rows.reduce((s, r) => s + Number(r.subtotal || 0), 0)
  const totalDiscNominal = rows.reduce((s, r) => s + Number(r.disc_nominal || 0), 0)
  const totalPPN = rows.reduce((s, r) => s + Number(r.ppn || 0), 0)
  const totalServiceCharge = rows.reduce((s, r) => s + Number(r.service_charge || 0), 0)
  const totalBayar = rows.reduce((s, r) => s + Number(r.total_bayar || 0), 0)
  const totalBayarInput = rows.reduce((s, r) => s + Number(r.bayar || 0), 0)
  const totalKembalian = rows.reduce((s, r) => s + Number(r.kembalian || 0), 0)

  const { sorted: sortedRows, sortKey, sortOrder, toggleSort } = useSort<Row>(rows, 'tanggal', 'asc')

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (!rows || rows.length === 0) {
      alert('Tidak ada data untuk di-export')
      return
    }
    const headers = [
      'Kode Nota', 'Tanggal', 'Customer', 'Subtotal', 'Disc %',
      'Disc Rp', 'PPN', 'Service Charge', 'Total Bayar',
      'Bayar', 'Kembalian', 'Jenis Pembayaran', 'Bank'
    ]
    const lines = rows.map(r => [
      r.kode_nota, r.tanggal, r.customer, String(r.subtotal),
      String(r.disc), String(r.disc_nominal), String(r.ppn),
      String(r.service_charge), String(r.total_bayar),
      String(r.bayar), String(r.kembalian),
      r.jenis_pembayaran, r.bank
    ])
    const csv = [
      ['Laporan Penjualan POS'],
      [`Periode: ${from} s/d ${to}`],
      [],
      headers,
      ...lines,
    ].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Laporan_Penjualan_POS_${from}_${to}.csv`
    a.click()
  }

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Laporan Penjualan POS</h1>
        <p className="report-subtitle">Detail transaksi penjualan POS Resto & Retail per periode</p>
      </div>

      <div className="report-card report-card-pad">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Dari Tanggal</label>
            <input type="date" value={from} onChange={(e)=>setFrom(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Sampai Tanggal</label>
            <input type="date" value={to} onChange={(e)=>setTo(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" />
          </div>
          <div className="flex gap-2 relative">
            <button onClick={loadReport} disabled={loading} className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-pill hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-sm font-medium shadow-lg">{loading? 'Memuat...' : 'Tampilkan'}</button>
            {rows.length > 0 && (
              <>
                <button onClick={handlePrint} className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-pill hover:from-blue-700 hover:to-indigo-700 text-sm font-medium shadow flex items-center gap-1.5">Print</button>
                <button onClick={handleExportCSV} className="px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-pill hover:from-green-700 hover:to-emerald-700 text-sm font-medium shadow flex items-center gap-1.5">Excel</button>
              </>
            )}
            <button onClick={()=>setShowColPicker(v=>!v)} className="px-3 py-1.5 border border-emerald-600 text-emerald-700 rounded-pill hover:bg-emerald-50 text-sm">Pilih Kolom</button>
            {showColPicker && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow p-2 z-10">
                <div className="text-[10px] font-bold text-slate-600 mb-2">Tampilkan Kolom</div>
                <div className="max-h-64 overflow-auto pr-1 space-y-1">
                  {ALL_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" className="accent-emerald-600" checked={isVisible(col.key)} onChange={() => toggleVisible(col.key)} />
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
          <thead className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
            <tr>
              {isVisible('kode_nota') && (
                <th className="px-2 py-1.5 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('kode_nota')}>
                    Kode Nota <SortIcon active={sortKey==='kode_nota'} order={sortKey==='kode_nota'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('tanggal') && (
                <th className="px-2 py-1.5 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('tanggal')}>
                    Tanggal <SortIcon active={sortKey==='tanggal'} order={sortKey==='tanggal'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('customer') && (
                <th className="px-2 py-1.5 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('customer')}>
                    Customer <SortIcon active={sortKey==='customer'} order={sortKey==='customer'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('subtotal') && (
                <th className="px-1 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('subtotal')}>
                    Subtotal <SortIcon active={sortKey==='subtotal'} order={sortKey==='subtotal'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('disc') && (
                <th className="px-1 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('disc')}>
                    Disc % <SortIcon active={sortKey==='disc'} order={sortKey==='disc'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('disc_nominal') && (
                <th className="px-1 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('disc_nominal')}>
                    Disc Rp <SortIcon active={sortKey==='disc_nominal'} order={sortKey==='disc_nominal'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('ppn') && (
                <th className="px-1 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('ppn')}>
                    PPN <SortIcon active={sortKey==='ppn'} order={sortKey==='ppn'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('service_charge') && (
                <th className="px-1 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('service_charge')}>
                    Service Charge <SortIcon active={sortKey==='service_charge'} order={sortKey==='service_charge'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('total_bayar') && (
                <th className="px-2 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('total_bayar')}>
                    Total Bayar <SortIcon active={sortKey==='total_bayar'} order={sortKey==='total_bayar'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('bayar') && (
                <th className="px-2 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('bayar')}>
                    Bayar <SortIcon active={sortKey==='bayar'} order={sortKey==='bayar'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('kembalian') && (
                <th className="px-2 py-1.5 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('kembalian')}>
                    Kembalian <SortIcon active={sortKey==='kembalian'} order={sortKey==='kembalian'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('jenis_pembayaran') && (
                <th className="px-2 py-1.5 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('jenis_pembayaran')}>
                    Jenis Pembayaran <SortIcon active={sortKey==='jenis_pembayaran'} order={sortKey==='jenis_pembayaran'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('bank') && (
                <th className="px-2 py-1.5 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('bank')}>
                    Bank <SortIcon active={sortKey==='bank'} order={sortKey==='bank'?sortOrder:undefined} />
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
                  {isVisible('kode_nota') && (<td className="px-2 py-1 text-xs text-slate-700">{r.kode_nota}</td>)}
                  {isVisible('tanggal') && (<td className="px-2 py-1 text-xs text-slate-700">{r.tanggal}</td>)}
                  {isVisible('customer') && (<td className="px-2 py-1 text-xs text-slate-700">{r.customer}</td>)}
                  {isVisible('subtotal') && (<td className="px-1 py-1 text-xs text-right text-slate-800 font-semibold">{Number(r.subtotal).toLocaleString('id-ID')}</td>)}
                  {isVisible('disc') && (<td className="px-1 py-1 text-xs text-right text-slate-700">{Number(r.disc).toLocaleString('id-ID')}</td>)}
                  {isVisible('disc_nominal') && (<td className="px-1 py-1 text-xs text-right text-slate-700">{Number(r.disc_nominal).toLocaleString('id-ID')}</td>)}
                  {isVisible('ppn') && (<td className="px-1 py-1 text-xs text-right text-slate-700">{Number(r.ppn).toLocaleString('id-ID')}</td>)}
                  {isVisible('service_charge') && (<td className="px-1 py-1 text-xs text-right text-slate-700">{Number(r.service_charge).toLocaleString('id-ID')}</td>)}
                  {isVisible('total_bayar') && (<td className="px-2 py-1 text-xs text-right font-bold text-emerald-600">{Number(r.total_bayar).toLocaleString('id-ID')}</td>)}
                  {isVisible('bayar') && (<td className="px-2 py-1 text-xs text-right text-slate-800">{Number(r.bayar).toLocaleString('id-ID')}</td>)}
                  {isVisible('kembalian') && (<td className="px-2 py-1 text-xs text-right text-slate-700">{Number(r.kembalian).toLocaleString('id-ID')}</td>)}
                  {isVisible('jenis_pembayaran') && (<td className="px-2 py-1 text-xs text-slate-700 capitalize">{r.jenis_pembayaran}</td>)}
                  {isVisible('bank') && (<td className="px-2 py-1 text-xs text-slate-700">{r.bank}</td>)}
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-300">
            <tr>
              <td colSpan={Math.max(visibleCount - 10, 1)}></td>
              {isVisible('subtotal') && (<td className="px-1 py-1.5 text-xs font-bold text-slate-800 text-right font-mono">{totalSubtotal.toLocaleString('id-ID')}</td>)}
              {isVisible('disc') && (<td className="px-1 py-1.5 text-xs font-bold text-slate-800 text-right"></td>)}
              {isVisible('disc_nominal') && (<td className="px-1 py-1.5 text-xs font-bold text-slate-800 text-right font-mono">{totalDiscNominal.toLocaleString('id-ID')}</td>)}
              {isVisible('ppn') && (<td className="px-1 py-1.5 text-xs font-bold text-slate-800 text-right font-mono">{totalPPN.toLocaleString('id-ID')}</td>)}
              {isVisible('service_charge') && (<td className="px-1 py-1.5 text-xs font-bold text-slate-800 text-right font-mono">{totalServiceCharge.toLocaleString('id-ID')}</td>)}
              {isVisible('total_bayar') && (<td className="px-2 py-1.5 text-xs font-bold text-emerald-800 text-right font-mono">{totalBayar.toLocaleString('id-ID')}</td>)}
              {isVisible('bayar') && (<td className="px-2 py-1.5 text-xs font-bold text-slate-800 text-right font-mono">{totalBayarInput.toLocaleString('id-ID')}</td>)}
              {isVisible('kembalian') && (<td className="px-2 py-1.5 text-xs font-bold text-slate-800 text-right font-mono">{totalKembalian.toLocaleString('id-ID')}</td>)}
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </div>
  )
}
