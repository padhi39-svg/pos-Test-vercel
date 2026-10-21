"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import ActionIcons from '@/components/ActionIcons'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import PageLoading from '@/components/ui/PageLoading'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { usePageLoading } from '@/lib/usePageLoading'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

const ROW_H = 28

export interface ColumnDef<T> {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
}

export interface FilterDef {
  type: 'text' | 'select' | 'searchable-select'
  key: string
  placeholder?: string
  options?: { value: string; label: string; description?: string }[]
  className?: string
  inputClassName?: string
}

export interface HeaderActionDef {
  label: string
  variant: 'filled' | 'outline'
  href?: string
  onClick?: () => void
  show?: boolean
  disabled?: boolean
}

export interface ImportConfigDef {
  title: string
  component?: React.ComponentType<{ onDone: () => void }>
}

export interface ColumnVisibilityDef {
  allColumns: { key: string; label: string }[]
  defaultVisible: string[]
  storageKey?: string
}

export interface MasterDataListProps<T extends { id: number }> {
  title: string
  subtitle?: string
  basePath: string
  endpoint: string

  columns: ColumnDef<T>[]
  defaultSortBy?: string
  defaultSortDir?: 'asc' | 'desc'
  serverSortMap?: Record<string, string>

  searchPlaceholder?: string

  filters?: FilterDef[]

  staticParams?: Record<string, string>

  permissionCode?: string

  showStatusColumn?: boolean
  statusField?: string
  statusActiveValue?: number | string
  statusLabels?: { active: string; inactive: string }

  headerActions?: HeaderActionDef[]

  onDelete?: (id: number) => Promise<void>
  deleteConfirmMessage?: string

  importConfig?: ImportConfigDef

  columnVisibility?: ColumnVisibilityDef

  mobileCard?: (row: T) => ReactNode
  sessionStorageKey?: string

  getViewHref?: (row: T) => string
  getEditHref?: (row: T) => string
  disabledEdit?: (row: T) => boolean
}

export default function MasterDataList<T extends { id: number }>({
  title,
  subtitle,
  basePath,
  endpoint,

  columns,
  defaultSortBy = 'name',
  defaultSortDir = 'asc',
  serverSortMap,

  searchPlaceholder = 'Cari...',

  filters,

  staticParams,

  permissionCode,

  showStatusColumn = false,
  statusField = 'aktif',
  statusActiveValue = 1,
  statusLabels = { active: 'Aktif', inactive: 'Nonaktif' },

  headerActions,

  onDelete,
  deleteConfirmMessage = 'Hapus data ini? (Soft delete)',

  importConfig,

  columnVisibility,

  mobileCard,
  sessionStorageKey,

  getViewHref: propsGetViewHref,
  getEditHref: propsGetEditHref,
  disabledEdit,
}: MasterDataListProps<T>) {
  const [items, setItems] = useState<T[]>([])
  const { loading, refreshing, run } = usePageLoading()
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [sortBy, setSortBy] = useState(defaultSortBy)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir)
  const [initialized, setInitialized] = useState(false)
  const prevFilterKey = useRef('')
  const isFirstFetch = useRef(true)

  const [extraFilters, setExtraFilters] = useState<Record<string, string>>({})

  const [canView, setCanView] = useState(true)
  const [canCreate, setCanCreate] = useState(true)
  const [canEdit, setCanEdit] = useState(true)

  const [showImport, setShowImport] = useState(false)

  const [visibleCols, setVisibleCols] = useState<string[] | null>(null)
  const [showColPicker, setShowColPicker] = useState(false)

  const filterKeys = useMemo(() => {
    const keys: string[] = []
    if (filters) {
      for (const f of filters) {
        if (f.type !== 'text') keys.push(f.key)
      }
    }
    return keys
  }, [filters])

  const debounceMs = 500

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), debounceMs)
    return () => clearTimeout(t)
  }, [q, debounceMs])

  const syncUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    for (const key of filterKeys) {
      const val = extraFilters[key]
      if (val) params.set(key, val)
    }
    params.set('sort_by', sortBy)
    params.set('sort_dir', sortDir)
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    window.history.replaceState(null, '', `${basePath}?${params.toString()}`)
  }, [debouncedQ, extraFilters, filterKeys, page, pageSize, sortBy, sortDir, basePath])

  const fetchData = async (pageNum: number, isRefresh?: boolean) => {
    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    for (const key of filterKeys) {
      const val = extraFilters[key]
      if (val) params.set(key, val)
    }
    if (staticParams) {
      for (const [k, v] of Object.entries(staticParams)) {
        params.set(k, v)
      }
    }

    const sortParam = serverSortMap?.[sortBy] || sortBy
    if (sortParam) params.set('sort_by', sortParam)
    params.set('sort_dir', sortDir)
    params.set('page', String(pageNum))
    params.set('limit', String(pageSize))

    if (permissionCode) {
      const [rm, meRes] = await Promise.all([
        fetch(`${endpoint}?${params.toString()}`),
        fetch('/api/auth/me', { cache: 'no-store' }),
      ])

      if (rm.status === 403) {
        setCanView(false)
        setItems([])
        return
      }

      const data = rm.ok ? await rm.json() : { rows: [], total: 0 }
      setItems(data.rows || [])
      setTotal(data.total || 0)

      try {
        const meData = await meRes.json().catch(() => ({}))
        const perms = Array.isArray(meData?.user?.permissions)
          ? (meData.user.permissions as any[])
          : []
        const p = perms.find(
          (x: any) => String(x.menu_code).toLowerCase().trim() === permissionCode,
        )
        setCanView(Boolean(p?.can_view ?? p?.canView ?? true))
        setCanCreate(Boolean(p?.can_create))
        setCanEdit(Boolean(p?.can_edit))
      } catch {}
    } else {
      const rm = await fetch(`${endpoint}?${params.toString()}`)
      const data = rm.ok ? await rm.json() : { rows: [], total: 0 }
      setItems(data.rows || [])
      setTotal(data.total || 0)
    }
  }

  const load = (pageNum?: number, isRefresh?: boolean) =>
    run(() => fetchData(pageNum ?? page, isRefresh), isRefresh ? 'refresh' : undefined)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const qVal = sp.get('q') || ''
    const pageVal = Math.max(1, parseInt(sp.get('page') || '1'))
    const pageSizeVal = parseInt(sp.get('page_size') || '20')
    const sortByVal = sp.get('sort_by') || defaultSortBy
    const sortDirVal = (sp.get('sort_dir') || defaultSortDir) as 'asc' | 'desc'

    const initialExtra: Record<string, string> = {}
    for (const key of filterKeys) {
      const v = sp.get(key)
      if (v) initialExtra[key] = v
    }

    if (initialExtra && Object.keys(initialExtra).length > 0) {
      setExtraFilters(initialExtra)
    }

    setQ(qVal)
    setDebouncedQ(qVal)
    setPage(pageVal)
    setPageSize(pageSizeVal)
    setSortBy(sortByVal)
    setSortDir(sortDirVal)
    setInitialized(true)
  }, [filterKeys, defaultSortBy, defaultSortDir])

  useEffect(() => {
    if (!initialized) return
    syncUrl()
    if (sessionStorageKey) {
      try {
        sessionStorage.setItem(sessionStorageKey, window.location.search)
      } catch {}
    }
  }, [initialized, syncUrl, sessionStorageKey])

  useEffect(() => {
    if (!initialized) return

    const filterVals: Record<string, any> = { debouncedQ, pageSize, sortBy, sortDir }
    for (const key of filterKeys) {
      filterVals[key] = extraFilters[key] || ''
    }
    const filterKey = JSON.stringify(filterVals)
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
  }, [initialized, debouncedQ, page, pageSize, sortBy, sortDir, extraFilters, filterKeys])

  useEffect(() => {
    if (!columnVisibility) return
    try {
      const saved = columnVisibility.storageKey
        ? window.localStorage.getItem(columnVisibility.storageKey)
        : null
      if (saved) {
        const arr = JSON.parse(saved)
        if (Array.isArray(arr) && arr.length) {
          setVisibleCols(arr.filter((k: string) => columnVisibility.allColumns.some(c => c.key === k)))
          return
        }
      }
    } catch {}
    setVisibleCols(columnVisibility.defaultVisible)
  }, [columnVisibility])

  useEffect(() => {
    if (!columnVisibility || !visibleCols || !columnVisibility.storageKey) return
    try {
      window.localStorage.setItem(columnVisibility.storageKey, JSON.stringify(visibleCols))
    } catch {}
  }, [columnVisibility, visibleCols])

  const currentQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    for (const key of filterKeys) {
      const val = extraFilters[key]
      if (val) params.set(key, val)
    }
    if (staticParams) {
      for (const [k, v] of Object.entries(staticParams)) {
        params.set(k, v)
      }
    }
    params.set('sort_by', sortBy)
    params.set('sort_dir', sortDir)
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    return params.toString()
  }, [debouncedQ, extraFilters, filterKeys, page, pageSize, sortBy, sortDir, staticParams])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)

  const getViewHref = useCallback(
    (row: T) => propsGetViewHref?.(row) ?? `${basePath}/${row.id}`,
    [basePath, propsGetViewHref],
  )

  const getEditHref = useCallback(
    (row: T) => {
      if (propsGetEditHref) return propsGetEditHref(row)
      return `${basePath}/${row.id}/edit?return=${encodeURIComponent(currentQuery)}`
    },
    [basePath, propsGetEditHref, currentQuery],
  )

  const totalCols = useMemo(() => {
    if (columnVisibility && visibleCols) {
      return visibleCols.length + (showStatusColumn ? 1 : 0) + 1
    }
    return columns.length + (showStatusColumn ? 1 : 0) + 1
  }, [columns.length, columnVisibility, visibleCols, showStatusColumn])

  const displayColumns = useMemo(() => {
    if (!columnVisibility || !visibleCols) return columns
    return columns.filter(c => visibleCols.includes(c.key))
  }, [columns, columnVisibility, visibleCols])

  const handleExtraFilterChange = useCallback((key: string, value: string) => {
    setExtraFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSort = useCallback((key: string) => {
    setSortBy(prev => {
      if (prev === key) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir(defaultSortDir)
      return key
    })
  }, [defaultSortDir])

  if (loading) return <PageLoading />

  const ImportComponent = importConfig?.component

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {headerActions?.map((action, i) => (
            action.show !== false && (
              action.href ? (
                <Link key={i} href={action.href}
                  className={`px-3 py-1.5 rounded-pill text-sm ${action.variant === 'filled'
                    ? 'bg-teal-primary hover:bg-teal-dark text-white'
                    : 'border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg'
                  }`}>
                  {action.label}
                </Link>
              ) : (
                <Button key={i} variant={action.variant} onClick={action.onClick} disabled={action.disabled}>
                  {action.label}
                </Button>
              )
            )
          ))}
          {importConfig && canCreate && (
            <Button variant="outline" onClick={() => setShowImport(true)}>
              Import Excel
            </Button>
          )}
          {canCreate && (
            <Link
              href={`${basePath}/new?return=${encodeURIComponent(currentQuery)}`}
              className="inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-sm bg-teal-primary hover:bg-teal-dark text-white shadow-[0_4px_20px rgba(43,168,162,0.3)] transition-all active:scale-95"
            >
              Tambah
            </Link>
          )}
        </div>
      </div>

      {showImport && importConfig && canCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl w-full max-w-xl max-h-[90vh] overflow-auto m-4">
            <div className="flex items-center justify-between p-3 border-b border-teal-bg">
              <div className="font-medium text-sm">{importConfig.title}</div>
              <button onClick={() => setShowImport(false)} className="text-sm text-slate-500 hover:text-slate-700">Tutup</button>
            </div>
            <div className="p-4">
              {ImportComponent && (
                <ImportComponent onDone={() => { setShowImport(false); load(currentPage, true) }} />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="container-card p-2 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:max-w-[320px]">
            <Input
              placeholder={searchPlaceholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {filters?.map((filter) => {
            if (filter.type === 'select') {
              return (
                <div key={filter.key} className={filter.className || 'w-[200px]'}>
                  <SearchableSelect
                    options={filter.options || []}
                    value={extraFilters[filter.key] || ''}
                    onChange={(v) => handleExtraFilterChange(filter.key, v !== null ? String(v) : '')}
                    placeholder={filter.placeholder}
                    showSearch={false}
                    allowClear
                    inputClassName={filter.inputClassName}
                  />
                </div>
              )
            }
            if (filter.type === 'searchable-select') {
              return (
                <div key={filter.key} className={filter.className || 'w-[200px]'}>
                  <SearchableSelect
                    options={filter.options || []}
                    value={extraFilters[filter.key] || ''}
                    onChange={(v) => handleExtraFilterChange(filter.key, v !== null ? String(v) : '')}
                    placeholder={filter.placeholder}
                    showSearch={false}
                    allowClear
                    inputClassName={filter.inputClassName}
                  />
                </div>
              )
            }
            return null
          })}

          <button
            onClick={() => load(currentPage, true)}
            disabled={refreshing}
            className="ml-auto p-1.5 rounded-lg bg-teal-bg text-teal-primary hover:bg-teal-primary hover:text-white disabled:opacity-60"
            title="Refresh"
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {!canView ? (
          <div className="text-red-600 text-sm">Anda tidak punya akses melihat {title}.</div>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-600">
                    {displayColumns.map((col) => {
                      const isSortable = col.sortable !== false
                      return (
                        <th
                          key={col.key}
                          className={`px-1 select-none ${isSortable ? 'cursor-pointer hover:text-teal-primary transition-colors' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                          style={{ height: ROW_H, verticalAlign: 'middle' }}
                          onClick={isSortable ? () => handleSort(col.key) : undefined}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            {col.label}
                            {sortBy === col.key && (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {sortDir === 'asc' ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                )}
                              </svg>
                            )}
                            {sortBy !== col.key && (
                              <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10l5-5 5 5M7 14l5 5 5-5" />
                              </svg>
                            )}
                          </span>
                        </th>
                      )
                    })}
                    {showStatusColumn && (
                      <th className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>Status</th>
                    )}
                    <th className="px-1 text-right" style={{ height: ROW_H, verticalAlign: 'middle' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {refreshing ? (
                    <>
                      <tr className="border-t border-transparent">
                        <td colSpan={totalCols} className="text-center px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>
                          <span className="inline-flex items-center justify-center gap-2 text-slate-400">
                            <span className="w-4 h-4 border-2 border-teal-primary rounded-full border-t-transparent animate-spin inline-block" />
                            <span>Memuat...</span>
                          </span>
                        </td>
                      </tr>
                      {Array.from({ length: pageSize - 1 }).map((_, i) => (
                        <tr key={`ph-load-${i}`} className="border-t border-transparent opacity-0" aria-hidden="true">
                          {Array.from({ length: totalCols }).map((__, j) => (
                            <td key={j} className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>&nbsp;</td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ) : items.length === 0 ? (
                    <>
                      <tr className="border-t border-transparent">
                        <td colSpan={totalCols} className="px-1 text-center text-slate-500" style={{ height: ROW_H, verticalAlign: 'middle' }}>Belum ada data</td>
                      </tr>
                      {Array.from({ length: pageSize - 1 }).map((_, i) => (
                        <tr key={`ph-empty-${i}`} className="border-t border-transparent opacity-0" aria-hidden="true">
                          {Array.from({ length: totalCols }).map((__, j) => (
                            <td key={j} className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>&nbsp;</td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ) : (
                    items.map((row: any) => (
                      <tr key={row.id} className="border-t hover:bg-teal-bg/50">
                        {displayColumns.map((col) => (
                          <td
                            key={col.key}
                            className={`px-1 ${col.align === 'right' ? 'text-right' : ''}`}
                            style={{ height: ROW_H, verticalAlign: 'middle' }}
                          >
                            {col.render(row)}
                          </td>
                        ))}
                        {showStatusColumn && (
                          <td className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>
                            <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full ${Number(row[statusField] ?? 0) === Number(statusActiveValue) ? 'bg-teal-bg text-teal-primary' : 'bg-coral-bg text-coral-dark'}`}>
                              {Number(row[statusField] ?? 0) === Number(statusActiveValue) ? statusLabels.active : statusLabels.inactive}
                            </span>
                          </td>
                        )}
                        <td className="px-1 text-right whitespace-nowrap" style={{ height: ROW_H, verticalAlign: 'middle' }}>
                          <ActionIcons
                            viewHref={getViewHref(row)}
                            editHref={canEdit ? getEditHref(row) : undefined}
                            disabledEdit={!canEdit || disabledEdit?.(row)}
                            showPrint={false}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                  {!refreshing && items.length > 0 && items.length < pageSize && (
                    Array.from({ length: pageSize - items.length }).map((_, i) => (
                      <tr key={`ph-${i}`} className="border-t border-transparent opacity-0" aria-hidden="true">
                        {Array.from({ length: totalCols }).map((__, j) => (
                          <td key={j} className="px-1" style={{ height: ROW_H, verticalAlign: 'middle' }}>&nbsp;</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-2">
              {columnVisibility && (
                <div className="relative">
                  <button
                    onClick={() => setShowColPicker(v => !v)}
                    className="px-2 py-1 border border-slate-300 rounded-pill text-sm text-slate-600 hover:bg-teal-bg"
                  >
                    Pilih Kolom
                  </button>
                  {showColPicker && (
                    <div className="absolute left-0 bottom-full mb-2 w-56 bg-white border border-slate-200 rounded-lg shadow p-2 z-10">
                      <div className="text-[10px] font-bold text-slate-600 mb-2">Tampilkan Kolom</div>
                      <div className="max-h-64 overflow-auto pr-1 space-y-1">
                        {columnVisibility.allColumns.map(col => (
                          <label key={col.key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-teal-bg rounded px-1 py-0.5">
                            <input type="checkbox" className="accent-teal-primary"
                              checked={visibleCols?.includes(col.key) ?? false}
                              onChange={() => {
                                setVisibleCols(prev => {
                                  if (!prev) return [col.key]
                                  return prev.includes(col.key)
                                    ? prev.filter(x => x !== col.key)
                                    : [...prev, col.key]
                                })
                              }}
                            />
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
              )}

              <div className="flex items-center gap-1 text-xs ml-auto">
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
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                  onClick={() => setPage(1)}
                  disabled={currentPage === 1}
                >«</button>
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >‹</button>
                <span className="px-3 text-sm font-semibold text-slate-700">{currentPage} / {totalPages}</span>
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >›</button>
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage === totalPages}
                >»</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
