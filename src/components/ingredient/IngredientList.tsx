"use client"
import Link from 'next/link'
import { Ingredient } from '@/lib/ingredientStore'
import Input from '@/components/ui/Input'
import SearchableSelect from '@/components/ui/SearchableSelect'
import ImportIngredient from '@/components/ingredient/ImportIngredient'
import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function IngredientList({
  items,
  basePath,
  title,
  onDelete,
  onRefresh,
}: {
  items: any[]
  basePath: string
  title: string
  onDelete: (id: number) => void
  onRefresh?: () => void
}) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'barangJadiName' | 'portion' | 'itemCount' | 'totalHpp'>('barangJadiName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [current, setCurrent] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [mounted, setMounted] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''
  const currentQuery = returnQuery

  useEffect(() => { setMounted(true) }, [])

  const barangJadiOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const it of items) {
      if (it.barangJadiId) map.set(it.barangJadiId, it.barangJadiName || it.name || 'Barang Jadi')
    }
    return Array.from(map.entries()).map(([id, name]) => ({ value: String(id), label: name }))
  }, [items])

  const [barangJadiFilter, setBarangJadiFilter] = useState<string>('all')

  const itemsWithComputed = useMemo(() => {
    return items.map((item: any) => ({
      ...item,
      barangJadiName: item.barangJadiName || item.name || 'Unknown',
      itemCount: item.items?.length || 0,
      totalHpp: item.totalHpp ?? 0,
    }))
  }, [items])

  const filtered = useMemo(() => {
    return itemsWithComputed
      .filter((item) => {
        if (query) {
          const q = query.toLowerCase()
          if (!item.name.toLowerCase().includes(q) && 
              !item.barangJadiName.toLowerCase().includes(q) &&
              !(item.description || '').toLowerCase().includes(q)) {
            return false
          }
        }
        if (barangJadiFilter !== 'all') {
          if (item.barangJadiId !== Number(barangJadiFilter)) return false
        }
        return true
      })
  }, [itemsWithComputed, query, barangJadiFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: any = a[sortKey]
      let bVal: any = b[sortKey]
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  const total = sorted.length
  const start = (current - 1) * pageSize
  const pageRows = sorted.slice(start, start + pageSize)

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const totalPages = Math.ceil(total / pageSize)

  const SortIcon = ({ active, order }: { active: boolean; order: string }) => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {!active ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      ) : order === 'asc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      )}
    </svg>
  )

  if (!mounted) return <div className="animate-pulse bg-slate-200 h-96 rounded-card" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-slate-500 text-xs mt-1">Kelola resep ingredient untuk menu.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-1.5 rounded-pill border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg text-xs"
          >Import Excel</button>
          <Link
            href={`${basePath}/new?return=${encodeURIComponent(currentQuery)}`}
            className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white text-xs"
          >Tambah Resep</Link>
        </div>
      </div>

      <div className="container-card p-2">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="w-[260px]">
            <Input
              placeholder="Cari resep..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="px-2 py-1 text-sm"
            />
          </div>
          <div className="w-[200px]">
            <SearchableSelect
              options={[{ value: 'all', label: 'Semua Barang Jadi' }, ...barangJadiOptions]}
              value={barangJadiFilter}
              onChange={(v) => { setBarangJadiFilter(v !== null ? String(v) : 'all'); setCurrent(1) }}
              placeholder="Semua Barang Jadi"
              showSearch={false}
              allowClear={false}
            />
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-slate-600">Tampil</span>
            <div className="w-[68px]">
              <SearchableSelect
                options={[20, 50, 100, 200].map((n) => ({ value: n, label: String(n) }))}
                value={pageSize}
                onChange={(v) => { setCurrent(1); setPageSize(v !== null ? Number(v) : 20) }}
                showSearch={false}
                allowClear={false}
                inputClassName="text-xs !px-2 !py-1"
              />
            </div>
            <span className="text-slate-600">per halaman</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
                <th className="px-1 py-0.5 text-left cursor-pointer select-none hover:text-white/80 transition-colors"
                  style={{ height: 28, verticalAlign: 'middle' }}
                  onClick={() => toggleSort('barangJadiName')}>
                  <span className="inline-flex items-center gap-0.5">
                    Barang Jadi
                    <SortIcon active={sortKey === 'barangJadiName'} order={sortDir} />
                  </span>
                </th>
                <th className="px-1 py-0.5 text-center cursor-pointer select-none hover:text-white/80 transition-colors"
                  style={{ height: 28, verticalAlign: 'middle' }}
                  onClick={() => toggleSort('portion')}>
                  <span className="inline-flex items-center gap-0.5">
                    Porsi
                    <SortIcon active={sortKey === 'portion'} order={sortDir} />
                  </span>
                </th>
                <th className="px-1 py-0.5 text-center cursor-pointer select-none hover:text-white/80 transition-colors"
                  style={{ height: 28, verticalAlign: 'middle' }}
                  onClick={() => toggleSort('itemCount')}>
                  <span className="inline-flex items-center gap-0.5">
                    Jml Bahan
                    <SortIcon active={sortKey === 'itemCount'} order={sortDir} />
                  </span>
                </th>
                <th className="px-1 py-0.5 text-right cursor-pointer select-none hover:text-white/80 transition-colors"
                  style={{ height: 28, verticalAlign: 'middle' }}
                  onClick={() => toggleSort('totalHpp')}>
                  <span className="inline-flex items-center gap-0.5">
                    HPP
                    <SortIcon active={sortKey === 'totalHpp'} order={sortDir} />
                  </span>
                </th>
                <th className="px-1 py-0.5 text-right" style={{ height: 28, verticalAlign: 'middle' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-1 py-6 text-center text-slate-500" style={{ height: 28, verticalAlign: 'middle' }}>
                    Belum ada data resep
                  </td>
                </tr>
              ) : (
                pageRows.map((it, idx) => (
                  <tr key={it.id} className="border-t border-slate-200 hover:bg-teal-bg/50">
                    <td className="px-1 py-0.5" style={{ height: 28, verticalAlign: 'middle' }}>{it.barangJadiName}</td>
                    <td className="px-1 py-0.5 text-center" style={{ height: 28, verticalAlign: 'middle' }}>{it.portion}</td>
                    <td className="px-1 py-0.5 text-center" style={{ height: 28, verticalAlign: 'middle' }}>{it.itemCount}</td>
                    <td className="px-1 py-0.5 text-right font-mono" style={{ height: 28, verticalAlign: 'middle' }}>Rp {Number(it.totalHpp || 0).toLocaleString('id-ID')}</td>
                    <td className="px-1 py-0.5 text-right whitespace-nowrap" style={{ height: 28, verticalAlign: 'middle' }}>
                      <Link href={`${basePath}/${it.barangJadiId}?return=${encodeURIComponent(currentQuery)}`}
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-teal-primary hover:bg-teal-bg transition-colors"
                        title="Lihat Detail">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </Link>
                      <Link href={`${basePath}/${it.barangJadiId}/edit?return=${encodeURIComponent(currentQuery)}`}
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-amber-600 hover:bg-teal-bg transition-colors"
                        title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </Link>
                      <button onClick={() => onDelete(it.barangJadiId)}
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-red-500 hover:bg-teal-bg transition-colors"
                        title="Hapus">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {pageRows.length > 0 && pageRows.length < pageSize && Array.from({ length: pageSize - pageRows.length }).map((_, i) => (
                <tr key={`ph-${i}`} className="opacity-0" aria-hidden="true" style={{ height: 28, verticalAlign: 'middle' }}>
                  <td colSpan={5} className="px-1 py-0.5">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 p-1">
          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => setCurrent(1)} disabled={current === 1}
              className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">«</button>
            <button onClick={() => setCurrent(Math.max(1, current - 1))} disabled={current === 1}
              className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">‹</button>
            <span className="px-3 text-sm font-semibold text-slate-700">{current} / {totalPages}</span>
            <button onClick={() => setCurrent(Math.min(totalPages, current + 1))} disabled={current === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">›</button>
            <button onClick={() => setCurrent(totalPages)} disabled={current === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">»</button>
          </div>
        </div>
      </div>

      {showImport && (
        <ImportIngredient onDone={() => { setShowImport(false); onRefresh?.(); router.refresh() }} />
      )}
    </div>
  )
}
