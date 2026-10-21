"use client"
import { useEffect, useMemo, useState } from 'react'
import SortIcon from '@/components/ui/SortIcon'
import { useSort } from '@/lib/useSort'

type MetaPeriod = { id: number; code: string; name: string; start_date: string; end_date: string; status_buku: string; is_active: number }
type SimpleRef = { id: number; name: string }

type Row = {
  barang_id: number
  code: string
  name: string
  kategori: string
  spesifikasi: string
  merk: string
  gudang: string
  unit_kecil: string
  qty_kecil: number
  unit_besar: string
  qty_besar: number
  hpp: number
  nilai_persediaan: number
  saldo_awal_qty: number
  saldo_awal_nilai: number
  pembelian: number
  retur_jual: number
  transfer_masuk: number
  lain_lain_masuk: number
  penjualan: number
  retur_beli: number
  transfer_keluar: number
  lain_lain_keluar: number
  pemakaian_bahan: number
  stok_akhir_qty: number
  stok_akhir_nilai: number
}

export default function StockRecapPeriodPage() {
  const [showColPicker, setShowColPicker] = useState(false)
  const [metaLoading, setMetaLoading] = useState(true)
  const [periods, setPeriods] = useState<MetaPeriod[]>([])
  const [kategori, setKategori] = useState<SimpleRef[]>([])
  const [spesifikasi, setSpesifikasi] = useState<SimpleRef[]>([])
  const [merk, setMerk] = useState<SimpleRef[]>([])
  const [warehouses, setWarehouses] = useState<Array<{id:number; code:string; name:string}>>([])

  const [periodId, setPeriodId] = useState<number | ''>('')
  const [kategoriId, setKategoriId] = useState<number | ''>('')
  const [spesifikasiId, setSpesifikasiId] = useState<number | ''>('')
  const [merkId, setMerkId] = useState<number | ''>('')
  const [warehouseId, setWarehouseId] = useState<number | ''>('')
  const [showFilter, setShowFilter] = useState(false)

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  const ALL_COLUMNS = [
    { key: 'code', label: 'Kode' },
    { key: 'name', label: 'Nama Barang' },
    { key: 'kategori', label: 'Kategori' },
    { key: 'spesifikasi', label: 'Spesifikasi' },
    { key: 'merk', label: 'Merk' },
    { key: 'gudang', label: 'Gudang' },
    { key: 'unit_kecil', label: 'Satuan Kecil' },
    { key: 'qty_kecil', label: 'Qty Kecil' },
    { key: 'unit_besar', label: 'Satuan Besar' },
    { key: 'qty_besar', label: 'Qty Besar' },
    { key: 'saldo_awal_qty', label: 'Saldo Awal' },
    { key: 'saldo_awal_nilai', label: 'Saldo Awal Nilai' },
    { key: 'pembelian', label: 'Pembelian' },
    { key: 'retur_jual', label: 'Retur Jual' },
    { key: 'transfer_masuk', label: 'Transfer Masuk' },
    { key: 'lain_lain_masuk', label: 'Lain-lain Masuk' },
    { key: 'penjualan', label: 'Penjualan' },
    { key: 'retur_beli', label: 'Retur Beli' },
    { key: 'transfer_keluar', label: 'Transfer Keluar' },
    { key: 'lain_lain_keluar', label: 'Lain-lain Keluar' },
    { key: 'pemakaian_bahan', label: 'Pemakaian Bahan' },
    { key: 'stok_akhir_qty', label: 'Stok Akhir' },
    { key: 'stok_akhir_nilai', label: 'Stok Akhir Nilai' },
    { key: 'hpp', label: 'HPP (unit kecil)' },
    { key: 'nilai_persediaan', label: 'Nilai Persediaan' },
  ] as const
  const DEFAULT_VISIBLE: string[] = ALL_COLUMNS.map(c => c.key as string)
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE)
  const isVisible = (k: string) => visibleCols.includes(k)
  const toggleVisible = (k: string) => setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])

  useEffect(() => {
    ;(async () => {
      try {
        setMetaLoading(true)
        const res = await fetch('/api/stock-recap-period?mode=meta', { cache: 'no-store' })
        const d = await res.json().catch(() => ({}))
        setPeriods(Array.isArray(d.periods) ? d.periods : [])
        setKategori(Array.isArray(d.kategori) ? d.kategori : [])
        setSpesifikasi(Array.isArray(d.spesifikasi) ? d.spesifikasi : [])
        setMerk(Array.isArray(d.merk) ? d.merk : [])
        setWarehouses(Array.isArray(d.warehouses) ? d.warehouses : [])
      } catch {}
      finally { setMetaLoading(false) }
    })()
  }, [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('report_stock_recap_period.columns.visible')
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
    try { window.localStorage.setItem('report_stock_recap_period.columns.visible', JSON.stringify(visibleCols)) } catch {}
  }, [visibleCols])

  const loadReport = async () => {
    if (!periodId) { alert('Pilih periode terlebih dahulu'); return }
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('periodId', String(periodId))
      if (kategoriId) params.set('kategoriId', String(kategoriId))
      if (spesifikasiId) params.set('spesifikasiId', String(spesifikasiId))
      if (merkId) params.set('merkId', String(merkId))
      if (warehouseId) params.set('warehouseId', String(warehouseId))
      const res = await fetch(`/api/stock-recap-period?${params.toString()}`)
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
      totalQtyKecil: sum('qty_kecil'),
      totalSaldoAwalQty: sum('saldo_awal_qty'),
      totalSaldoAwalNilai: sum('saldo_awal_nilai'),
      totalPembelian: sum('pembelian'),
      totalReturJual: sum('retur_jual'),
      totalTransferMasuk: sum('transfer_masuk'),
      totalLainMasuk: sum('lain_lain_masuk'),
      totalPenjualan: sum('penjualan'),
      totalReturBeli: sum('retur_beli'),
      totalTransferKeluar: sum('transfer_keluar'),
      totalLainKeluar: sum('lain_lain_keluar'),
      totalPemakaian: sum('pemakaian_bahan'),
      totalStokAkhirQty: sum('stok_akhir_qty'),
      totalStokAkhirNilai: sum('stok_akhir_nilai'),
      totalNilai: sum('nilai_persediaan'),
    }
  }, [rows])

  const { sorted: sortedRows, sortKey, sortOrder, toggleSort } = useSort<Row>(rows, 'name', 'asc')

  const number = (n: number) => new Intl.NumberFormat('id-ID').format(Number(n || 0))

  // Compute dynamic colSpan for the "Total" cell so it aligns with the first visible numeric column
  const totalLabelColSpan = useMemo(() => {
    const NUMERIC_KEYS: string[] = [
      'qty_kecil','qty_besar','saldo_awal_qty','saldo_awal_nilai','pembelian','retur_jual','transfer_masuk','lain_lain_masuk','penjualan','retur_beli','transfer_keluar','lain_lain_keluar','pemakaian_bahan','stok_akhir_qty','stok_akhir_nilai','hpp','nilai_persediaan'
    ]
    const firstVisibleNumeric = NUMERIC_KEYS.find((k) => isVisible(k))
    if (!firstVisibleNumeric) {
      // fallback: span over all currently visible columns
      return ALL_COLUMNS.reduce((acc, c) => acc + (isVisible(String(c.key)) ? 1 : 0), 0)
    }
    let span = 0
    for (const c of ALL_COLUMNS) {
      if (c.key === firstVisibleNumeric) break
      if (isVisible(String(c.key))) span++
    }
    return span
  }, [visibleCols])

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Laporan Rekap Stok per Periode</h1>
        <p className="report-subtitle">Rekap saldo stok pada akhir periode</p>
      </div>

      {/* Panel Filter ala sales recap */}
      <div className="report-card report-card-pad">
        <div className="flex items-end gap-1.5 flex-wrap">
          <div className="flex-shrink-0 min-w-[14rem]">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Periode (wajib)</label>
            <select className="px-2 py-1 border border-slate-300 rounded-lg text-xs w-full" value={periodId}
              onChange={(e)=> setPeriodId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">-- Pilih Periode --</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name} ({p.start_date} s/d {p.end_date})</option>
              ))}
            </select>
          </div>
          <div className="flex-shrink-0 min-w-[10rem]">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Kategori</label>
            <select className="px-2 py-1 border border-slate-300 rounded-lg text-xs w-full"
              value={kategoriId}
              onChange={(e)=> setKategoriId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Semua</option>
              {kategori.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <div className="flex-shrink-0 min-w-[10rem]">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Spesifikasi</label>
            <select className="px-2 py-1 border border-slate-300 rounded-lg text-xs w-full"
              value={spesifikasiId}
              onChange={(e)=> setSpesifikasiId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Semua</option>
              {spesifikasi.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex-shrink-0 min-w-[10rem]">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Merk</label>
            <select className="px-2 py-1 border border-slate-300 rounded-lg text-xs w-full"
              value={merkId}
              onChange={(e)=> setMerkId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Semua</option>
              {merk.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="flex-shrink-0 min-w-[12rem]">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Gudang</label>
            <select className="px-2 py-1 border border-slate-300 rounded-lg text-xs w-full"
              value={warehouseId}
              onChange={(e)=> setWarehouseId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Semua Gudang</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 relative">
            <button onClick={loadReport} disabled={loading} className="px-3 py-1 bg-teal-primary text-white rounded-md hover:bg-teal-dark disabled:opacity-50 text-xs font-medium shadow">{loading? 'Memuat...' : 'Tampilkan'}</button>
            <button onClick={()=>setShowColPicker(v=>!v)} className="px-2.5 py-1 border border-teal-primary text-teal-primary rounded-md hover:bg-teal-bg text-xs">Pilih Kolom</button>
            {showColPicker && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow p-2 z-10">
                <div className="text-[10px] font-bold text-slate-600 mb-1">Tampilkan Kolom</div>
                <div className="max-h-64 overflow-auto pr-1 space-y-1">
                  {ALL_COLUMNS.map(col => (
                    <label key={String(col.key)} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" className="accent-teal-primary" checked={isVisible(String(col.key))} onChange={() => toggleVisible(String(col.key))} />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-1 flex justify-end">
                  <button onClick={()=>setShowColPicker(false)} className="text-[11px] px-2 py-0.5 rounded border border-slate-300 hover:bg-slate-50">Tutup</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="report-card">
        <div className="report-table-wrapper">
          <table className="report-table">
          <thead className="bg-teal-primary text-white">
            <tr>
              {isVisible('code') && (
                <th className="px-2 py-1 text-left text-[10px] font-semibold whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('code')}>
                    Kode <SortIcon active={sortKey==='code'} order={sortKey==='code'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('name') && (
                <th className="px-2 py-1 text-left text-[10px] font-semibold whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('name')}>
                    Nama Barang <SortIcon active={sortKey==='name'} order={sortKey==='name'?sortOrder:undefined} />
                  </button>
                </th>
              )}
              {isVisible('kategori') && <th className="px-2 py-1 text-left text-[10px] whitespace-nowrap">Kategori</th>}
              {isVisible('spesifikasi') && <th className="px-2 py-1 text-left text-[10px] whitespace-nowrap">Spesifikasi</th>}
              {isVisible('merk') && <th className="px-2 py-1 text-left text-[10px] whitespace-nowrap">Merk</th>}
              {isVisible('gudang') && <th className="px-2 py-1 text-left text-[10px] whitespace-nowrap">Gudang</th>}
              {isVisible('unit_kecil') && <th className="px-2 py-1 text-left text-[10px] whitespace-nowrap">Satuan Kecil</th>}
              {isVisible('qty_kecil') && (
                <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r: Row) => r.qty_kecil)}>
                    Qty Kecil <SortIcon active={String(sortKey)==='function'} order={sortOrder} />
                  </button>
                </th>
              )}
              {isVisible('unit_besar') && <th className="px-2 py-1 text-left text-[10px] whitespace-nowrap">Satuan Besar</th>}
              {isVisible('qty_besar') && (
                <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r: Row) => r.qty_besar)}>
                    Qty Besar <SortIcon active={String(sortKey)==='function'} order={sortOrder} />
                  </button>
                </th>
              )}
              {isVisible('saldo_awal_qty') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Saldo Awal</th>}
              {isVisible('saldo_awal_nilai') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Saldo Awal Nilai</th>}
              {isVisible('pembelian') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Pembelian</th>}
              {isVisible('retur_jual') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Retur Jual</th>}
              {isVisible('transfer_masuk') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Transfer Masuk</th>}
              {isVisible('lain_lain_masuk') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Lain-lain Masuk</th>}
              {isVisible('penjualan') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Penjualan</th>}
              {isVisible('retur_beli') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Retur Beli</th>}
              {isVisible('transfer_keluar') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Transfer Keluar</th>}
              {isVisible('lain_lain_keluar') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Lain-lain Keluar</th>}
              {isVisible('pemakaian_bahan') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Pemakaian Bahan</th>}
              {isVisible('stok_akhir_qty') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Stok Akhir</th>}
              {isVisible('stok_akhir_nilai') && <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">Stok Akhir Nilai</th>}
              {isVisible('hpp') && (
                <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r: Row) => r.hpp)}>
                    HPP <SortIcon active={String(sortKey)==='function'} order={sortOrder} />
                  </button>
                </th>
              )}
              {isVisible('nilai_persediaan') && (
                <th className="px-2 py-1 text-right text-[10px] font-semibold whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort((r: Row) => r.nilai_persediaan)}>
                    Nilai Persediaan <SortIcon active={String(sortKey)==='function'} order={sortOrder} />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-2 py-2" colSpan={12}>Memuat...</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td className="px-2 py-2" colSpan={12}>Tidak ada data</td></tr>
            ) : (
              sortedRows.map((r, idx) => (
                <tr key={idx} className="border-t whitespace-nowrap">
                  {isVisible('code') && <td className="px-2 py-1">{r.code}</td>}
                  {isVisible('name') && <td className="px-2 py-1">{r.name}</td>}
                  {isVisible('kategori') && <td className="px-2 py-1">{r.kategori}</td>}
                  {isVisible('spesifikasi') && <td className="px-2 py-1">{r.spesifikasi}</td>}
                  {isVisible('merk') && <td className="px-2 py-1">{r.merk}</td>}
                  {isVisible('gudang') && <td className="px-2 py-1">{r.gudang}</td>}
                  {isVisible('unit_kecil') && <td className="px-2 py-0.5">{r.unit_kecil}</td>}
                  {isVisible('qty_kecil') && <td className="px-2 py-0.5 text-right">{number(r.qty_kecil)}</td>}
                  {isVisible('unit_besar') && <td className="px-2 py-1">{r.unit_besar}</td>}
                  {isVisible('qty_besar') && <td className="px-2 py-0.5 text-right">{number(r.qty_besar)}</td>}
                  {isVisible('saldo_awal_qty') && <td className="px-2 py-0.5 text-right">{number(r.saldo_awal_qty)}</td>}
                  {isVisible('saldo_awal_nilai') && <td className="px-2 py-0.5 text-right">{number(r.saldo_awal_nilai)}</td>}
                  {isVisible('pembelian') && <td className="px-2 py-1 text-right">{number(r.pembelian)}</td>}
                  {isVisible('retur_jual') && <td className="px-2 py-1 text-right">{number(r.retur_jual)}</td>}
                  {isVisible('transfer_masuk') && <td className="px-2 py-1 text-right">{number(r.transfer_masuk)}</td>}
                  {isVisible('lain_lain_masuk') && <td className="px-2 py-1 text-right">{number(r.lain_lain_masuk)}</td>}
                  {isVisible('penjualan') && <td className="px-2 py-1 text-right">{number(r.penjualan)}</td>}
                  {isVisible('retur_beli') && <td className="px-2 py-1 text-right">{number(r.retur_beli)}</td>}
                  {isVisible('transfer_keluar') && <td className="px-2 py-1 text-right">{number(r.transfer_keluar)}</td>}
                  {isVisible('lain_lain_keluar') && <td className="px-2 py-1 text-right">{number(r.lain_lain_keluar)}</td>}
                  {isVisible('pemakaian_bahan') && <td className="px-2 py-1 text-right">{number(r.pemakaian_bahan)}</td>}
                  {isVisible('stok_akhir_qty') && <td className="px-2 py-0.5 text-right">{number(r.stok_akhir_qty)}</td>}
                  {isVisible('stok_akhir_nilai') && <td className="px-2 py-0.5 text-right">{number(r.stok_akhir_nilai)}</td>}
                  {isVisible('hpp') && <td className="px-2 py-0.5 text-right">{number(r.hpp)}</td>}
                  {isVisible('nilai_persediaan') && <td className="px-2 py-0.5 text-right">{number(r.nilai_persediaan)}</td>}
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-300">
            <tr>
              <td className="px-2 py-1" colSpan={totalLabelColSpan}>
                Total
              </td>
              {isVisible('qty_kecil') && <td className="px-2 py-0.5 text-right">{number(totals.totalQtyKecil)}</td>}
              {isVisible('unit_besar') && <td className="px-2 py-1"></td>}
              {isVisible('qty_besar') && <td className="px-2 py-0.5"></td>}
              {isVisible('saldo_awal_qty') && <td className="px-2 py-0.5 text-right">{number(totals.totalSaldoAwalQty)}</td>}
              {isVisible('saldo_awal_nilai') && <td className="px-2 py-0.5 text-right">{number(totals.totalSaldoAwalNilai)}</td>}
              {isVisible('pembelian') && <td className="px-2 py-0.5 text-right">{number(totals.totalPembelian)}</td>}
              {isVisible('retur_jual') && <td className="px-2 py-0.5 text-right">{number(totals.totalReturJual)}</td>}
              {isVisible('transfer_masuk') && <td className="px-2 py-0.5 text-right">{number(totals.totalTransferMasuk)}</td>}
              {isVisible('lain_lain_masuk') && <td className="px-2 py-0.5 text-right">{number(totals.totalLainMasuk)}</td>}
              {isVisible('penjualan') && <td className="px-2 py-0.5 text-right">{number(totals.totalPenjualan)}</td>}
              {isVisible('retur_beli') && <td className="px-2 py-0.5 text-right">{number(totals.totalReturBeli)}</td>}
              {isVisible('transfer_keluar') && <td className="px-2 py-0.5 text-right">{number(totals.totalTransferKeluar)}</td>}
              {isVisible('lain_lain_keluar') && <td className="px-2 py-0.5 text-right">{number(totals.totalLainKeluar)}</td>}
              {isVisible('pemakaian_bahan') && <td className="px-2 py-0.5 text-right">{number(totals.totalPemakaian)}</td>}
              {isVisible('stok_akhir_qty') && <td className="px-2 py-0.5 text-right">{number(totals.totalStokAkhirQty)}</td>}
              {isVisible('stok_akhir_nilai') && <td className="px-2 py-0.5 text-right">{number(totals.totalStokAkhirNilai)}</td>}
              {isVisible('hpp') && <td className="px-2 py-1"></td>}
              {isVisible('nilai_persediaan') && <td className="px-2 py-0.5 text-right font-bold text-teal-primary">{number(totals.totalNilai)}</td>}
            </tr>
          </tfoot>
          </table>
        </div>
      </div>

      {showFilter && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <div className="bg-white rounded shadow-lg p-4 w-full max-w-xl">
            <div className="text-base font-semibold mb-3">Filter Laporan</div>
            {metaLoading ? (
              <div className="text-sm">Memuat data...</div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1">Periode (wajib)</label>
                  <select className="border rounded px-2 py-1 w-full"
                    value={periodId}
                    onChange={(e)=> setPeriodId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">-- Pilih Periode --</option>
                    {periods.map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name} ({p.start_date} s/d {p.end_date})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1">Kategori</label>
                    <select className="border rounded px-2 py-1 w-full"
                      value={kategoriId}
                      onChange={(e)=> setKategoriId(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Semua</option>
                      {kategori.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Spesifikasi</label>
                    <select className="border rounded px-2 py-1 w-full"
                      value={spesifikasiId}
                      onChange={(e)=> setSpesifikasiId(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Semua</option>
                      {spesifikasi.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Merk</label>
                    <select className="border rounded px-2 py-1 w-full"
                      value={merkId}
                      onChange={(e)=> setMerkId(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Semua</option>
                      {merk.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 text-sm border rounded" onClick={() => setShowFilter(false)}>Tutup</button>
              <button className="px-3 py-1 text-sm border rounded bg-teal-primary text-white" onClick={loadReport} disabled={!periodId || loading}>Terapkan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
