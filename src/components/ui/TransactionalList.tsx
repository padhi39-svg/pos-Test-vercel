"use client"
import { useMemo, useState, useEffect, ReactNode } from 'react'
import Input from '@/components/ui/Input'
import SearchableSelect from '@/components/ui/SearchableSelect'
import SummaryCard from '@/components/ui/SummaryCard'

export type SummaryCardDef = {
  label: string
  value: string | number
  valueColor?: string
  size?: 'sm' | 'lg'
}

export type TransactionalColumnDef<T> = {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  render: (row: T) => ReactNode
  className?: string
  thClassName?: string
}

export type StatusFilterDef = {
  key: string
  label: string
  options: { value: string; label: string }[]
}

type Props<T> = {
  title: string
  subtitle?: string
  items: T[]
  columns: TransactionalColumnDef<T>[]
  summaryCards: SummaryCardDef[]
  statusFilter: StatusFilterDef
  searchPlaceholder?: string
  defaultSortBy: string
  defaultSortDir?: 'asc' | 'desc'
  headerActions?: ReactNode
  onRefresh?: () => void
  keyExtractor: (row: T) => string | number
  isVoid?: (row: T) => boolean
}

export default function TransactionalList<T extends Record<string, any>>({
  title,
  subtitle,
  items,
  columns,
  summaryCards,
  statusFilter,
  searchPlaceholder = 'Cari...',
  defaultSortBy,
  defaultSortDir = 'desc',
  headerActions,
  keyExtractor,
  isVoid,
}: Props<T>) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState(defaultSortBy)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir)
  const [current, setCurrent] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [mounted, setMounted] = useState(false)
  const [statusValue, setStatusValue] = useState<string>('all')

  useEffect(() => { setMounted(true) }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(x => {
      if (q) {
        const match = columns.some(col => {
          const val = x[col.key]
          if (val == null) return false
          return String(val).toLowerCase().includes(q)
        })
        if (!match) return false
      }
      if (statusValue !== 'all' && x[statusFilter.key] !== statusValue) return false
      return true
    })
  }, [items, query, statusValue, columns, statusFilter.key])

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
  const totalPages = Math.ceil(total / pageSize) || 1
  const start = (current - 1) * pageSize
  const pageRows = sorted.slice(start, start + pageSize)

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(defaultSortDir)
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">{title}</h1>
          {subtitle && <p className="text-xs md:text-sm text-slate-600 mt-1">{subtitle}</p>}
        </div>
        {headerActions && (
          <div className="flex gap-2 md:ml-auto">{headerActions}</div>
        )}
      </div>

      {/* Summary Cards */}
      {summaryCards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {summaryCards.map((card, idx) => (
            <SummaryCard key={idx} {...card} />
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Cari</label>
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-xs h-8"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Status</label>
            <SearchableSelect
              options={statusFilter.options}
              value={statusValue}
              onChange={(v) => {
                setStatusValue(v === null ? 'all' : String(v))
                setCurrent(1)
              }}
              placeholder="Pilih status"
              showSearch={false}
              allowClear={false}
              className="w-full"
              inputClassName="text-xs h-8"
            />
          </div>
          <div className="md:col-span-1 flex flex-col md:items-end md:justify-self-end">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold text-right">Tampil</label>
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <SearchableSelect
                options={[10, 25, 50, 100].map((n) => ({ value: n, label: String(n) }))}
                value={pageSize}
                onChange={(v) => {
                  if (v === null) return
                  setPageSize(Number(v))
                  setCurrent(1)
                }}
                showSearch={false}
                allowClear={false}
                className="!w-20"
                inputClassName="text-xs h-8"
              />
              <span className="text-slate-600 whitespace-nowrap">per halaman</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table + Pagination */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-teal-primary text-white">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-2 py-1 text-xs font-semibold ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'} ${col.sortable ? 'cursor-pointer hover:bg-white/10' : ''} ${col.thClassName || ''}`}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  >
                    {col.sortable ? (
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                      </span>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-2 py-6 text-center text-slate-500">
                    Tidak ada data
                  </td>
                </tr>
              ) : pageRows.map((row) => {
                const voided = isVoid?.(row) ?? false
                return (
                  <tr
                    key={keyExtractor(row)}
                    className={`border-b border-slate-200 hover:bg-slate-50 ${voided ? 'bg-pink-50' : ''}`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-2 py-1 text-xs ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''} ${voided ? 'text-slate-500' : 'text-slate-600'}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col md:flex-row items-center justify-between p-2 md:p-3 text-xs md:text-sm gap-2 border-t border-slate-200">
          <div className="text-[10px] md:text-sm text-slate-600">
            {total === 0
              ? 'Menampilkan 0 data'
              : `Menampilkan ${Math.min(total, start + 1)}–${Math.min(total, start + pageSize)} dari ${total}`}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button
              disabled={current === 1}
              onClick={() => setCurrent(1)}
              className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs"
            >«</button>
            <button
              disabled={current === 1}
              onClick={() => setCurrent((c) => Math.max(1, c - 1))}
              className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs"
            >‹</button>
            <span className="px-2 text-xs">
              {current} / {totalPages || 1}
            </span>
            <button
              disabled={current === totalPages || totalPages === 0}
              onClick={() => setCurrent((c) => Math.min(totalPages, c + 1))}
              className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs"
            >›</button>
            <button
              disabled={current === totalPages || totalPages === 0}
              onClick={() => setCurrent(totalPages || 1)}
              className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs"
            >»</button>
          </div>
        </div>
      </div>
    </div>
  )
}