"use client"
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatCurrency } from '@/lib/regionalNumber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePageLoading } from '@/lib/usePageLoading'
import PageLoading from '@/components/ui/PageLoading'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import ImportBarang from '@/components/barang/ImportBarang'
import SearchableSelect from '@/components/ui/SearchableSelect'
import ActionIcons from '@/components/ActionIcons'

const ALL_COLUMNS = [
  { key: 'code', label: 'Kode' },
  { key: 'name', label: 'Nama' },
  { key: 'kategoriName', label: 'Kategori' },
  { key: 'merkName', label: 'Merk' },
  { key: 'jenis', label: 'Jenis' },
  { key: 'hpp', label: 'HPP' },
  { key: 'price', label: 'Harga Jual' },
  { key: 'account', label: 'Perkiraan' },
  { key: 'aktif', label: 'Aktif' },
  { key: 'createdAt', label: 'Tgl Create' },
  { key: 'updatedAt', label: 'Tgl Update' },
] as const

type ColKey = (typeof ALL_COLUMNS)[number]['key']
const DEFAULT_VISIBLE: ColKey[] = ['code', 'name', 'kategoriName', 'jenis', 'hpp', 'price', 'aktif']
const STORAGE_KEY = 'barang_list.columns.visible'

const SERVER_SORT: Record<string, string> = {
  code: 'code',
  name: 'name',
  hpp: 'hpp',
  jenis: 'jenis',
  aktif: 'aktif',
  created_at: 'created_at',
  updated_at: 'updated_at',
}

export default function BarangList({
  basePath,
  title,
}: {
  basePath: string
  title: string
}) {
  const ROW_H = 28
  const [items, setItems] = useState<any[]>([])
  const { loading, refreshing, run } = usePageLoading()
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortDir, setSortDir] = useState('asc')
  const [initialized, setInitialized] = useState(false)
  const prevFilterKey = useRef('')
  const isFirstFetch = useRef(true)
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_VISIBLE)
  const [showColPicker, setShowColPicker] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [jenisFilter, setJenisFilter] = useState<string>('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 500)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const arr = JSON.parse(saved)
          if (Array.isArray(arr) && arr.length) {
            setVisibleCols(arr.filter((k: string) => ALL_COLUMNS.some(c => c.key === k)))
          }
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleCols))
      }
    } catch {}
  }, [visibleCols])

  const syncUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    if (jenisFilter) params.set('jenis', jenisFilter)
    params.set('sort_by', sortBy)
    params.set('sort_dir', sortDir)
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    window.history.replaceState(null, '', `${basePath}?${params.toString()}`)
  }, [debouncedQ, jenisFilter, page, pageSize, sortBy, sortDir, basePath])

  const fetchData = async (pageNum: number) => {
    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    if (jenisFilter) params.set('jenis', jenisFilter)
    if (sortBy && SERVER_SORT[sortBy]) {
      params.set('sort_by', SERVER_SORT[sortBy])
    }
    params.set('sort_dir', sortDir)
    params.set('page', String(pageNum))
    params.set('limit', String(pageSize))

    const res = await fetch(`/api/barang?${params.toString()}`)
    const data = res.ok ? await res.json() : { rows: [], total: 0 }
    setItems(data.rows || [])
    setTotal(data.total || 0)
  }

  const load = (pageNum?: number, isRefresh?: boolean) =>
    run(() => fetchData(pageNum ?? page), isRefresh ? 'refresh' : undefined)

  const currentQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    if (jenisFilter) params.set('jenis', jenisFilter)
    params.set('sort_by', sortBy)
    params.set('sort_dir', sortDir)
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    return params.toString()
  }, [debouncedQ, jenisFilter, page, pageSize, sortBy, sortDir])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    setQ(sp.get('q') || '')
    setDebouncedQ(sp.get('q') || '')
    setJenisFilter(sp.get('jenis') || '')
    setPage(Math.max(1, parseInt(sp.get('page') || '1')))
    setPageSize(parseInt(sp.get('page_size') || '20'))
    const sb = sp.get('sort_by') || 'name'
    setSortBy(sb)
    setSortDir(sp.get('sort_dir') || 'asc')
    setInitialized(true)
  }, [])

  useEffect(() => {
    if (!initialized) return
    syncUrl()
  }, [initialized, syncUrl])

  useEffect(() => {
    if (!initialized) return

    const filterKey = JSON.stringify({ debouncedQ, jenisFilter, pageSize, sortBy, sortDir })
    const isFilterChange = prevFilterKey.current !== '' && prevFilterKey.current !== filterKey
    prevFilterKey.current = filterKey

    if (isFilterChange) {
      if (page !== 1) {
        setPage(1)
        return
      }
    }

    load(page, !isFirstFetch.current)
    isFirstFetch.current = false
  }, [initialized, debouncedQ, jenisFilter, page, pageSize, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)

  const isVisible = useCallback((k: ColKey) => visibleCols.includes(k), [visibleCols])
  const toggleVisible = useCallback((k: ColKey) => {
    setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  }, [])

  const onDelete = async (id: number) => {
    if (!confirm('Hapus data ini? (Soft delete)')) return
    try {
      const res = await fetch(`/api/barang/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete barang')
      load(currentPage, true)
    } catch (e) {
      console.error('Delete barang error:', e)
      alert('Gagal menghapus barang')
    }
  }

  const visibleCount = visibleCols.filter(isVisible).length + 1

  if (loading) return <PageLoading />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>Import Excel</Button>
          <Link
            href={`${basePath}/new?return=${encodeURIComponent(currentQuery)}`}
            className="inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-sm bg-teal-primary hover:bg-teal-dark text-white shadow-[0_4px_20px rgba(43,168,162,0.3)] transition-all active:scale-95"
          >
            Tambah
          </Link>
        </div>
      </div>

      <div className="container-card p-2 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-[250px]">
            <Input placeholder="Cari kode/nama..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <select
            value={jenisFilter}
            onChange={(e) => setJenisFilter(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded-pill text-sm outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
          >
            <option value="">Semua Jenis</option>
            <option value="1">Barang Jadi</option>
            <option value="2">Bahan Baku</option>
            <option value="3">Barang Setengah Jadi</option>
          </select>

          <div className="relative">
            <button
              onClick={() => setShowColPicker(v => !v)}
              className="px-2 py-1 border border-slate-300 rounded-pill text-sm text-slate-600 hover:bg-teal-bg"
            >
              Pilih Kolom
            </button>
            {showColPicker && (
              <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow p-2 z-10">
                <div className="text-[10px] font-bold text-slate-600 mb-2">Tampilkan Kolom</div>
                <div className="max-h-64 overflow-auto pr-1 space-y-1">
                  {ALL_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-teal-bg rounded px-1 py-0.5">
                      <input type="checkbox" className="accent-teal-primary" checked={isVisible(col.key)} onChange={() => toggleVisible(col.key)} />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex justify-end">
                  <button onClick={() => setShowColPicker(false)} className="text-xs px-2 py-1 rounded border text-slate-600 hover:bg-teal-bg">Tutup</button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => load(currentPage, true)}
            disabled={refreshing}
            className="ml-auto p-1.5 rounded-lg bg-teal-bg text-teal-primary hover:bg-teal-primary hover:text-white disabled:opacity-60"
            title="Refresh"
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-600">
                {ALL_COLUMNS.filter(c => isVisible(c.key)).map(({ key, label }) => {
                  const serverKey = SERVER_SORT[key]
                  const thContent = (
                    <span className="inline-flex items-center gap-0.5">
                      {label}
                      {sortBy === key && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {sortDir === 'asc' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          )}
                        </svg>
                      )}
                      {sortBy !== key && (
                        <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10l5-5 5 5M7 14l5 5 5-5" />
                        </svg>
                      )}
                    </span>
                  )

                  if (serverKey) {
                    return (
                      <th
                        key={key}
                        className={`px-1 cursor-pointer select-none hover:text-teal-primary transition-colors ${key === 'hpp' || key === 'price' ? 'text-right' : ''}`}
                        style={{ height: ROW_H, verticalAlign: 'middle' }}
                        onClick={() => {
                          if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                          else { setSortBy(key); setSortDir('asc') }
                        }}
                      >
                        {thContent}
                      </th>
                    )
                  }
                  return (
                    <th key={key} className={`px-1 ${key === 'hpp' || key === 'price' ? 'text-right' : ''}`} style={{ height: ROW_H, verticalAlign: 'middle' }}>
                      {thContent}
                    </th>
                  )
                })}
                <th className="px-1 text-right" style={{ height: ROW_H, verticalAlign: 'middle' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {refreshing ? (
                <>
                  <tr className="border-t border-transparent">
                    <td colSpan={visibleCount} className="text-center px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>
                      <span className="inline-flex items-center justify-center gap-2 text-slate-400">
                        <span className="w-4 h-4 border-2 border-teal-primary rounded-full border-t-transparent animate-spin inline-block" />
                        <span>Memuat...</span>
                      </span>
                    </td>
                  </tr>
                  {Array.from({ length: pageSize - 1 }).map((_, i) => (
                    <tr key={`ph-load-${i}`} className="border-t border-transparent opacity-0" aria-hidden="true">
                      {Array.from({ length: visibleCount }).map((__, j) => (
                        <td key={j} className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </>
              ) : items.length === 0 ? (
                <>
                  <tr className="border-t border-transparent">
                    <td colSpan={visibleCount} className="px-1 text-center text-slate-500" style={{ height: ROW_H, verticalAlign: 'middle' }}>Belum ada data</td>
                  </tr>
                  {Array.from({ length: pageSize - 1 }).map((_, i) => (
                    <tr key={`ph-empty-${i}`} className="border-t border-transparent opacity-0" aria-hidden="true">
                      {Array.from({ length: visibleCount }).map((__, j) => (
                        <td key={j} className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="border-t hover:bg-teal-bg/50">
                    {isVisible('code') && <td className="px-1 font-medium" style={{ height: ROW_H, verticalAlign: 'middle' }}>{it.code}</td>}
                    {isVisible('name') && <td className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>{it.name}</td>}
                    {isVisible('kategoriName') && <td className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>{it.kategoriName || '-'}</td>}
                    {isVisible('merkName') && <td className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>{it.merkName || '-'}</td>}
                    {isVisible('jenis') && <td className="px-1 whitespace-nowrap" style={{ height: ROW_H, verticalAlign: 'middle' }}>{it.jenis === 1 ? 'Barang Jadi' : it.jenis === 2 ? 'Bahan Baku' : 'Setengah Jadi'}</td>}
                    {isVisible('hpp') && <td className="px-1 text-right font-mono" style={{ height: ROW_H, verticalAlign: 'middle' }}>{formatCurrency(it.hpp ?? 0)}</td>}
                    {isVisible('price') && <td className="px-1 text-right font-mono" style={{ height: ROW_H, verticalAlign: 'middle' }}>{formatCurrency(it.prices?.[0]?.price ?? 0)}</td>}
                    {isVisible('account') && <td className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>{it.accountCode ? `${it.accountCode} - ${it.accountName}` : '-'}</td>}
                    {isVisible('aktif') && (
                      <td className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>
                        <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full ${it.aktif ? 'bg-teal-bg text-teal-primary' : 'bg-coral-bg text-coral-dark'}`}>
                          {it.aktif ? 'Ya' : 'Tidak'}
                        </span>
                      </td>
                    )}
                    {isVisible('createdAt') && <td className="px-1 whitespace-nowrap" style={{ height: ROW_H, verticalAlign: 'middle' }}>{it.createdAt || '-'}</td>}
                    {isVisible('updatedAt') && <td className="px-1 whitespace-nowrap" style={{ height: ROW_H, verticalAlign: 'middle' }}>{it.updatedAt || '-'}</td>}
                    <td className="px-1 text-right whitespace-nowrap" style={{ height: ROW_H, verticalAlign: 'middle' }}>
                      <ActionIcons
                        viewHref={`${basePath}/${it.id}`}
                        editHref={`${basePath}/${it.id}/edit?return=${encodeURIComponent(currentQuery)}`}
                        showPrint={false}
                      />
                    </td>
                  </tr>
                ))
              )}
              {!refreshing && items.length > 0 && items.length < pageSize && (
                Array.from({ length: pageSize - items.length }).map((_, i) => (
                  <tr key={`ph-${i}`} className="border-t border-transparent opacity-0" aria-hidden="true">
                    {Array.from({ length: visibleCount }).map((__, j) => (
                      <td key={j} className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>&nbsp;</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-end gap-2 p-1">
            <div className="flex items-center gap-1 text-xs">
              <div className="flex items-center gap-1 mr-2">
                <span className="text-slate-600">Tampil</span>
                <div className="w-[68px]">
                  <SearchableSelect
                    options={[20, 50, 100, 200].map((n) => ({ value: n, label: String(n) }))}
                    value={pageSize}
                    onChange={(v) => { setPage(1); setPageSize(v !== null ? Number(v) : 20) }}
                    showSearch={false}
                    allowClear={false}
                    inputClassName="text-xs !px-2 !py-1"
                  />
                </div>
                <span className="text-slate-600">per halaman</span>
              </div>
              <button className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium" onClick={() => setPage(1)} disabled={currentPage === 1}>«</button>
              <button className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>‹</button>
              <span className="px-3 text-sm font-semibold text-slate-700">{currentPage} / {totalPages}</span>
              <button className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>›</button>
              <button className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>»</button>
            </div>
          </div>
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl w-full max-w-xl max-h-[90vh] overflow-auto m-4">
            <div className="flex items-center justify-between p-3 border-b border-teal-bg">
              <div className="font-medium text-sm">Import Excel Barang</div>
              <button onClick={() => setShowImport(false)} className="text-sm text-slate-500 hover:text-slate-700">Tutup</button>
            </div>
            <div className="p-4">
              <ImportBarang onDone={() => { setShowImport(false); load(currentPage, true) }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
