"use client"
import { useEffect, useMemo, useState } from 'react'
import SortIcon from '@/components/ui/SortIcon'
import { useSort } from '@/lib/useSort'
import Link from 'next/link'

type BarangRef = { id: number; code: string; name: string }
type WarehouseRef = { id: number; code: string; name: string }

type Row = {
  id: number
  nomor: string
  tanggal: string
  barang_id: number
  barang_code: string
  barang_name: string
  quantity: number
  status: string
  notes: string | null
  warehouse_id: number
  gudang_code: string | null
  gudang_name: string | null
  hpp_sebelum: number
  hpp_sesudah: number
  total_biaya_bahan: number
  total_biaya_lain: number
  total_biaya: number
  user_create: number | null
  user_name: string | null
  created_at: string
  approved_at: string | null
  jumlah_komponen: number
}

const STATUS_OPTIONS = [
  { value: '', label: '-- Semua --' },
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
]

const ALL_COLUMNS = [
  { key: 'tanggal', label: 'Tanggal' },
  { key: 'nomor', label: 'No. Manufaktur' },
  { key: 'barang_code', label: 'Kode Hasil' },
  { key: 'barang_name', label: 'Nama Hasil' },
  { key: 'quantity', label: 'Qty Hasil' },
  { key: 'gudang_name', label: 'Gudang' },
  { key: 'jumlah_komponen', label: 'Jml Komponen' },
  { key: 'total_biaya_bahan', label: 'Biaya Bahan' },
  { key: 'total_biaya_lain', label: 'Biaya Lain' },
  { key: 'total_biaya', label: 'Total Biaya' },
  { key: 'hpp_sebelum', label: 'HPP Sebelum' },
  { key: 'hpp_sesudah', label: 'HPP Sesudah' },
  { key: 'status', label: 'Status' },
  { key: 'user_name', label: 'User' },
] as const
const DEFAULT_VISIBLE: string[] = ALL_COLUMNS.map(c => c.key as string)
const STORAGE_KEY = 'report_konversi_stok.columns.visible'

const statusBadge = (s: string) => {
  if (s === 'approved') return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-bg text-teal-primary">Approved</span>
  return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">Draft</span>
}

export default function KonversiStokPage() {
  const [showColPicker, setShowColPicker] = useState(false)
  const [metaLoading, setMetaLoading] = useState(true)
  const [barangHasil, setBarangHasil] = useState<BarangRef[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseRef[]>([])

  const today = () => new Date().toISOString().slice(0, 10)
  const firstOfMonth = () => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0, 10)
  }

  const [tanggalAwal, setTanggalAwal] = useState(firstOfMonth)
  const [tanggalAkhir, setTanggalAkhir] = useState(today)
  const [barangId, setBarangId] = useState<number | ''>('')
  const [gudangId, setGudangId] = useState<number | ''>('')
  const [status, setStatus] = useState('')

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE)
  const isVisible = (k: string) => visibleCols.includes(k)
  const toggleVisible = (k: string) =>
    setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])

  useEffect(() => {
    ;(async () => {
      try {
        setMetaLoading(true)
        const res = await fetch('/api/reports/konversi-stok?mode=meta', { cache: 'no-store' })
        const d = await res.json().catch(() => ({}))
        setBarangHasil(Array.isArray(d.barangHasil) ? d.barangHasil : [])
        setWarehouses(Array.isArray(d.warehouses) ? d.warehouses : [])
      } catch {}
      finally { setMetaLoading(false) }
    })()
  }, [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
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
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleCols)) } catch {}
  }, [visibleCols])

  const loadReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (tanggalAwal) params.set('tanggalAwal', tanggalAwal)
      if (tanggalAkhir) params.set('tanggalAkhir', tanggalAkhir)
      if (barangId) params.set('barangId', String(barangId))
      if (gudangId) params.set('gudangId', String(gudangId))
      if (status) params.set('status', status)
      const res = await fetch(`/api/reports/konversi-stok?${params.toString()}`)
      const d = await res.json()
      if (res.ok) setRows(Array.isArray(d.rows) ? d.rows : [])
      else {
        console.error(d?.error || 'Gagal memuat laporan')
        setRows([])
      }
      setShowColPicker(false)
    } catch (e) {
      console.error(e)
      setRows([])
    } finally { setLoading(false) }
  }

  const totals = useMemo(() => {
    const sum = (key: keyof Row) => rows.reduce((s, r) => s + Number((r as any)[key] || 0), 0)
    return {
      qty: sum('quantity'),
      komponen: sum('jumlah_komponen'),
      biayaBahan: sum('total_biaya_bahan'),
      biayaLain: sum('total_biaya_lain'),
      totalBiaya: sum('total_biaya'),
    }
  }, [rows])

  const { sorted: sortedRows, sortKey, sortOrder, toggleSort } = useSort<Row>(rows, 'tanggal', 'desc')

  const number = (n: number) => new Intl.NumberFormat('id-ID').format(Number(n || 0))

  const totalLabelColSpan = useMemo(() => {
    const NUMERIC_KEYS = ['quantity', 'jumlah_komponen', 'total_biaya_bahan', 'total_biaya_lain', 'total_biaya', 'hpp_sebelum', 'hpp_sesudah']
    const firstVisible = NUMERIC_KEYS.find(k => isVisible(k))
    if (!firstVisible) return ALL_COLUMNS.reduce((a, c) => a + (isVisible(String(c.key)) ? 1 : 0), 0)
    let span = 0
    for (const c of ALL_COLUMNS) {
      if (c.key === firstVisible) break
      if (isVisible(String(c.key))) span++
    }
    return span
  }, [visibleCols])

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Laporan Konversi Stok</h1>
        <p className="report-subtitle">Riwayat produksi / manufaktur barang jadi &amp; barang setengah jadi</p>
      </div>

      <div className="report-card report-card-pad">
        <div className="flex items-end gap-1.5 flex-wrap">
          <div className="min-w-[10rem]">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Tanggal Awal</label>
            <input type="date" className="input-field" value={tanggalAwal}
              onChange={e => setTanggalAwal(e.target.value)} />
          </div>
          <div className="min-w-[10rem]">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Tanggal Akhir</label>
            <input type="date" className="input-field" value={tanggalAkhir}
              onChange={e => setTanggalAkhir(e.target.value)} />
          </div>
          <div className="min-w-[10rem]">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Barang Hasil</label>
            <select className="input-field" value={barangId} onChange={e => setBarangId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">-- Semua --</option>
              {barangHasil.map(b => (
                <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[10rem]">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Gudang</label>
            <select className="input-field" value={gudangId} onChange={e => setGudangId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">-- Semua --</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[8rem]">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Status</label>
            <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            <button onClick={loadReport} disabled={loading}
              className="btn btn-primary text-xs px-3 py-1.5">
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
            <div className="relative">
              <button onClick={() => setShowColPicker(!showColPicker)}
                className="btn btn-outline text-xs px-3 py-1.5">Pilih Kolom</button>
              {showColPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[12rem]">
                  <div className="text-[10px] font-semibold text-slate-600 mb-1 px-1">Pilih Kolom</div>
                  {ALL_COLUMNS.map(c => (
                    <label key={c.key} className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-slate-50 rounded cursor-pointer text-xs">
                      <input type="checkbox" checked={isVisible(String(c.key))}
                        onChange={() => toggleVisible(String(c.key))} />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="report-card">
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead className="bg-teal-primary text-white">
              <tr>
                {ALL_COLUMNS.map(c => isVisible(String(c.key)) && (
                  <th key={c.key} className="cursor-pointer select-none" onClick={() => toggleSort(c.key as keyof Row)}>
                    <div className="flex items-center gap-0.5">
                      {c.label}
                      {sortKey === c.key && <SortIcon order={sortOrder} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr><td colSpan={ALL_COLUMNS.length} className="text-center text-slate-400 py-6 text-xs">Tidak ada data</td></tr>
              ) : sortedRows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => window.open(`/persediaan/manufaktur/${r.id}`, '_blank')}>
                  {ALL_COLUMNS.map(c => isVisible(String(c.key)) && (
                    <td key={c.key}>
                      {c.key === 'tanggal' ? r.tanggal :
                       c.key === 'nomor' ? r.nomor :
                       c.key === 'barang_code' ? r.barang_code :
                       c.key === 'barang_name' ? r.barang_name :
                       c.key === 'gudang_name' ? (r.gudang_name || '-') :
                       c.key === 'status' ? statusBadge(r.status) :
                       c.key === 'user_name' ? (r.user_name || '-') :
                       c.key === 'jumlah_komponen' ? r.jumlah_komponen :
                       c.key === 'quantity' ? number(r.quantity) :
                       c.key === 'total_biaya_bahan' ? number(r.total_biaya_bahan) :
                       c.key === 'total_biaya_lain' ? number(r.total_biaya_lain) :
                       c.key === 'total_biaya' ? number(r.total_biaya) :
                       c.key === 'hpp_sebelum' ? number(r.hpp_sebelum) :
                       c.key === 'hpp_sesudah' ? (r.hpp_sesudah ? number(r.hpp_sesudah) : '-') :
                       '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-semibold text-slate-800">
                  {ALL_COLUMNS.map(c => {
                    if (!isVisible(String(c.key))) return null
                    if (c.key === 'tanggal' || c.key === 'nomor' || c.key === 'barang_code' || c.key === 'barang_name' || c.key === 'gudang_name' || c.key === 'status' || c.key === 'user_name') {
                      const span = c.key === 'tanggal' ? totalLabelColSpan : undefined
                      return <td key={c.key}>{c.key === 'tanggal' ? 'TOTAL' : ''}</td>
                    }
                    return (
                      <td key={c.key}>
                        {c.key === 'quantity' ? number(totals.qty) :
                         c.key === 'jumlah_komponen' ? number(totals.komponen) :
                         c.key === 'total_biaya_bahan' ? number(totals.biayaBahan) :
                         c.key === 'total_biaya_lain' ? number(totals.biayaLain) :
                         c.key === 'total_biaya' ? number(totals.totalBiaya) :
                         ''}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
