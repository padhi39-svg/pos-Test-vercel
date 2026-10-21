"use client"
import Link from 'next/link'
import ActionIcons from '@/components/ActionIcons'
import Button from '@/components/ui/Button'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SortIcon from '@/components/ui/SortIcon'

export default function MasterList<T extends { id: number; [key: string]: any }>({
  title,
  basePath,
  items,
  onDelete,
  columns,
  showStatus,
  extraActions,
}: {
  title: string
  basePath: string
  items: T[]
  onDelete: (id: number) => void
  columns?: { key: string; label: string; className?: string }[]
  showStatus?: boolean
  extraActions?: React.ReactNode
}) {
  const [initialized, setInitialized] = useState(false)
  const prevFilterKey = useRef('')

  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<string>('code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Baca state dari URL saat mount
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    setQuery(sp.get('q') || '')
    setSortKey(sp.get('sort_by') || 'code')
    setSortDir((sp.get('sort_dir') as 'asc' | 'desc') || 'asc')
    setPage(parseInt(sp.get('page') || '1'))
    setPageSize(parseInt(sp.get('page_size') || '20'))
    setInitialized(true)
  }, [])

  // Sync URL setiap state berubah
  useEffect(() => {
    if (!initialized) return
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    params.set('sort_by', sortKey)
    params.set('sort_dir', sortDir)
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    window.history.replaceState(null, '', `${basePath}?${params.toString()}`)
  }, [initialized, basePath, query, sortKey, sortDir, page, pageSize])

  const currentQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    params.set('sort_by', sortKey)
    params.set('sort_dir', sortDir)
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    return params.toString()
  }, [query, sortKey, sortDir, page, pageSize])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = Array.isArray(items) ? items : []
    let rows = !q
      ? list
      : list.filter((x) => {
          try {
            return Object.values(x).some((v) => String(v ?? '').toLowerCase().includes(q))
          } catch {
            return false
          }
        })
    rows = [...rows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      let va: any = (a as any)[sortKey]
      let vb: any = (b as any)[sortKey]
      if (va === undefined || va === null) va = ''
      if (vb === undefined || vb === null) vb = ''
      if (typeof va === 'string' && typeof vb === 'string') {
        if (va < vb) return -1 * dir
        if (va > vb) return 1 * dir
      } else {
        va = String(va)
        vb = String(vb)
        if (va < vb) return -1 * dir
        if (va > vb) return 1 * dir
      }
      return 0
    })
    return rows
  }, [items, query, sortKey, sortDir])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * pageSize
  const pageRows = filtered.slice(start, start + pageSize)

  const defaultColumns = [
    { key: 'code', label: 'Kode', className: 'w-1/4' },
    { key: 'name', label: 'Nama', className: 'w-3/4' },
  ]

  const displayColumns = columns || defaultColumns

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setPage(1)
  }

  const handlePageSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value))
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-slate-500 text-xs mt-1">Kelola data master</p>
        </div>
        <div className="flex items-center gap-2">
          {extraActions}
          <Link href={`${basePath}/new?return=${encodeURIComponent(currentQuery)}`} className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white">
            Tambah
          </Link>
        </div>
      </div>

      <div className="container-card p-2">
        <div className="flex items-center gap-2 mb-2">
          <input
            value={query}
            onChange={handleSearch}
            placeholder="Cari kode/nama..."
            className="w-[300px] rounded-lg border border-slate-200 px-2 py-1 text-sm"
          />
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-slate-600">Tampil</span>
            <select
              value={pageSize}
              onChange={handlePageSize}
              className="px-2 py-1 border rounded text-xs"
            >
              {[20,50,100,200].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="text-slate-600">per halaman</span>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-600">
                {displayColumns.map((col: { key: string; label: string; className?: string }) => (
                  <th key={col.key} className={`px-1 py-0.5 ${col.className || ''}`}>
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort(col.key)}>
                      {col.label}
                      <SortIcon active={sortKey===col.key} order={sortKey===col.key?sortDir:undefined} />
                    </button>
                  </th>
                ))}
                {showStatus && <th className="px-1 py-0.5">Status</th>}
                <th className="px-1 py-0.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={displayColumns.length + (showStatus ? 2 : 1)} className="px-1 py-3 text-center text-slate-500">Belum ada data</td>
                </tr>
              ) : (
                pageRows.map((it: T) => (
                  <tr key={it.id} className="border-t">
                    {displayColumns.map((col: { key: string; label: string }) => (
                      <td key={col.key} className="px-1 py-0.5 text-xs">{it[col.key] ?? '-'}</td>
                    ))}
                    {showStatus && (
                      <td className="px-1 py-0.5">
                        {(() => {
                          const v = (it as any).is_active
                          const legacy = (it as any).aktif
                          const isActive = Number(v ?? legacy ?? 0) === 1
                          return (
                            <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full ${
                              isActive
                                ? 'bg-teal-bg text-teal-primary'
                                : 'bg-coral-bg text-coral-dark'
                            }`}>
                              {isActive ? 'Aktif' : 'Nonaktif'}
                            </span>
                          )
                        })()}
                      </td>
                    )}
                    <td className="px-1 py-0.5 text-right whitespace-nowrap">
                      <ActionIcons
                        viewHref={`${basePath}/${it.id}`}
                        editHref={`${basePath}/${it.id}/edit?return=${encodeURIComponent(currentQuery)}`}
                        showEdit={true}
                        titleView="Lihat Detail"
                        titleEdit="Edit"
                        showPrint={false}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end p-1">
          <div className="flex items-center gap-2 text-xs">
            <button disabled={current===1} onClick={() => setPage(1)}
              className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">«</button>
            <button disabled={current===1} onClick={() => setPage((p)=>Math.max(1,p-1))}
              className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">‹</button>
            <span className="px-3 text-sm font-semibold text-slate-700">{current} / {totalPages}</span>
            <button disabled={current===totalPages} onClick={() => setPage((p)=>Math.min(totalPages,p+1))}
              className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">›</button>
            <button disabled={current===totalPages} onClick={() => setPage(totalPages)}
              className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">»</button>
          </div>
        </div>
      </div>
    </div>
  )
}
