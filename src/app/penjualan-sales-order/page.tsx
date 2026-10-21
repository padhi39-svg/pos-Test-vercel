"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import ActionIcons from "@/components/ActionIcons"
import Input from "@/components/ui/Input"
import Button from "@/components/ui/Button"
import SearchableSelect from "@/components/ui/SearchableSelect"
import SortIcon from "@/components/ui/SortIcon"
import PageLoading from "@/components/ui/PageLoading"
import { usePageLoading } from "@/lib/usePageLoading"
import { formatCurrency } from "@/lib/regionalNumber"
import { ArrowPathIcon } from "@heroicons/react/24/outline"
import { ensurePeriodForDateOrToast } from "@/lib/periodGuard"
import { printSalesOrderById } from "@/lib/printSalesOrder"
import { useAksesOverride } from "@/hooks/useAksesOverride"
import ModalAksesOverride from "@/components/ModalAksesOverride"

export default function SalesOrderListPage() {
  const { override, setOverride, loading: aksesLoading, error: aksesError, close: closeAkses, confirm: confirmAkses } = useAksesOverride()
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const { loading, refreshing, run } = usePageLoading()
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [soStatusFilter, setSoStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [canCreate, setCanCreate] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [canDelete, setCanDelete] = useState(false)
  const [sortBy, setSortBy] = useState('so_date')
  const [sortDir, setSortDir] = useState('desc')
  const [initialized, setInitialized] = useState(false)
  const prevFilterKey = useRef('')
  const isFirstFetch = useRef(true)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 500)
    return () => clearTimeout(t)
  }, [q])

  const syncUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (soStatusFilter) params.set('so_status', soStatusFilter)
    if (debouncedQ) params.set('q', debouncedQ)
    params.set('sort_by', sortBy)
    params.set('sort_dir', sortDir)
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    window.history.replaceState(null, '', `/penjualan-sales-order?${params.toString()}`)
  }, [soStatusFilter, debouncedQ, page, pageSize, sortBy, sortDir])

  const fetchData = async (pageNum: number, isRefresh?: boolean) => {
    const params = new URLSearchParams()
    if (soStatusFilter) params.set("so_status", soStatusFilter)
    if (debouncedQ) params.set("q", debouncedQ)
    if (sortBy) params.set("sort_by", sortBy)
    params.set("sort_dir", sortDir)
    params.set("page", String(pageNum))
    params.set("limit", String(pageSize))

    const [soRes, meRes] = await Promise.all([
      fetch(`/api/sales-orders?${params.toString()}`),
      fetch("/api/auth/me", { cache: "no-store" }),
    ])

    const data = soRes.ok ? await soRes.json() : { rows: [], total: 0 }
    setItems(data.rows || [])
    setTotal(data.total || 0)

    try {
      const meData = await meRes.json().catch(() => ({}))
      const perms = Array.isArray(meData?.user?.permissions) ? meData.user.permissions as any[] : []
      const p = perms.find((x: any) => String(x.menu_code).toLowerCase().trim() === "sales_order")
      setCanCreate(Boolean(p?.can_create))
      setCanEdit(Boolean(p?.can_edit))
      setCanDelete(Boolean(p?.can_delete))
    } catch {}
  }

  const load = (pageNum?: number, isRefresh?: boolean) =>
    run(() => fetchData(pageNum ?? page, isRefresh), isRefresh ? "refresh" : undefined)

  const currentQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (soStatusFilter) params.set('so_status', soStatusFilter)
    if (debouncedQ) params.set('q', debouncedQ)
    params.set('sort_by', sortBy)
    params.set('sort_dir', sortDir)
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    return params.toString()
  }, [soStatusFilter, debouncedQ, page, pageSize, sortBy, sortDir])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const qVal = sp.get('q') || ''
    const soStatusVal = sp.get('so_status') || ''
    const pageVal = Math.max(1, parseInt(sp.get('page') || '1'))
    const pageSizeVal = parseInt(sp.get('page_size') || '10')
    const sortByVal = sp.get('sort_by') || 'so_date'
    const sortDirVal = sp.get('sort_dir') || 'desc'

    setQ(qVal)
    setDebouncedQ(qVal)
    setSoStatusFilter(soStatusVal)
    setPage(pageVal)
    setPageSize(pageSizeVal)
    setSortBy(sortByVal)
    setSortDir(sortDirVal)
    setInitialized(true)
  }, [])

  useEffect(() => {
    if (!initialized) return
    syncUrl()
  }, [initialized, syncUrl])

  useEffect(() => {
    if (!initialized) return

    const filterKey = JSON.stringify({ soStatusFilter, debouncedQ, pageSize, sortBy, sortDir })
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
  }, [initialized, soStatusFilter, debouncedQ, page, pageSize, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)

  const formatDate = (val?: string) => {
    if (!val) return '-'
    return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const handleVoid = async (id: number) => {
    if (!confirm('Void Sales Order ini?')) return
    try {
      const res = await fetch(`/api/sales-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || 'Gagal void sales order')
        return
      }
      load(currentPage, true)
    } catch {
      alert('Gagal void sales order')
    }
  }

  const toggleSort = (key: string) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  const indicator = (key: string) => (sortBy === key ? sortDir : undefined)

  const summary = useMemo(() => {
    const active = items.filter(t => String(t.so_status || '').toLowerCase() !== 'void')
    return {
      totalSO: active.length,
      totalValue: active.reduce((sum: number, t: any) => sum + (Number(t.total) || 0), 0),
      outstanding: active.filter(t => String(t.so_status || '') === 'outstanding').length,
      realisasi: active.filter(t => String(t.so_status || '') === 'realisasi').length,
      voidCount: items.filter(t => String(t.so_status || '').toLowerCase() === 'void').length,
    }
  }, [items])

  if (loading) return <PageLoading />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Sales Order</h1>
          <p className="text-xs md:text-sm text-slate-600 mt-1">Daftar Sales Order</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Link
              href={`/penjualan-sales-order/new?return=${encodeURIComponent(currentQuery)}`}
              className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm"
            >
              + Sales Order Baru
            </Link>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Sales Order</div>
          <div className="text-lg font-bold text-slate-800">{summary.totalSO}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Nilai</div>
          <div className="text-sm font-bold text-teal-primary">{formatCurrency(summary.totalValue)}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Outstanding</div>
          <div className="text-sm font-bold text-amber-700">{summary.outstanding}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Realisasi</div>
          <div className="text-sm font-bold text-teal-primary">{summary.realisasi}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Void</div>
          <div className="text-lg font-bold text-slate-800">{summary.voidCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Cari</label>
            <Input
              type="text"
              placeholder="Cari No SO, Customer, Sales..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="text-xs h-8"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Status</label>
            <SearchableSelect
              options={[
                { value: "", label: "Semua Status" },
                { value: "outstanding", label: "Outstanding" },
                { value: "realisasi", label: "Realisasi" },
                { value: "void", label: "Void" },
              ]}
              value={soStatusFilter}
              onChange={(v) => setSoStatusFilter(v !== null ? String(v) : "")}
              placeholder="Semua Status"
              showSearch={false}
              allowClear={false}
              className="w-full"
              inputClassName="text-xs h-8"
            />
          </div>
          <div className="flex flex-col md:items-end md:justify-self-end">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold text-right">Tampil</label>
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <SearchableSelect
                options={[10, 25, 50, 100].map((n) => ({
                  value: n,
                  label: String(n),
                }))}
                value={pageSize}
                onChange={(v) => {
                  if (v === null) return
                  setPageSize(Number(v))
                  setPage(1)
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
                <th className="px-2 py-1 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('so_number')}>
                    No. SO <SortIcon active={sortBy==='so_number'} order={indicator('so_number') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('so_date')}>
                    Tanggal <SortIcon active={sortBy==='so_date'} order={indicator('so_date') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('customer_name')}>
                    Customer <SortIcon active={sortBy==='customer_name'} order={indicator('customer_name') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Sales</th>
                <th className="px-2 py-1 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('total')}>
                    Total <SortIcon active={sortBy==='total'} order={indicator('total') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Status</th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {refreshing ? (
                <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-slate-500">
                      <span className="inline-flex items-center justify-center gap-2 text-slate-400">
                        <span className="w-4 h-4 border-2 border-teal-primary rounded-full border-t-transparent animate-spin inline-block" />
                        <span>Memuat...</span>
                      </span>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-slate-500">Belum ada data</td>
                </tr>
              ) : (
                items.map((so: any) => {
                  const isVoid = String(so.so_status || '').toLowerCase() === 'void'
                  const isLocked = Boolean(so.has_realization) || String(so.so_status || '') === 'realisasi'
                  return (
                    <tr key={so.id} className={`border-b border-slate-200 hover:bg-slate-50 ${isVoid ? 'bg-pink-50' : ''}`}>
                      <td className="px-2 py-1 text-xs font-medium text-slate-900">
                        <span>{so.so_number}</span>
                        {isVoid && (
                          <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800 align-middle">Void</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-xs text-slate-600">{formatDate(so.so_date)}</td>
                      <td className="px-2 py-1 text-xs text-slate-600">{so.customer_name || '-'}</td>
                      <td className="px-2 py-1 text-xs text-slate-600">{so.sales_name || '-'}</td>
                      <td className="px-2 py-1 text-xs text-slate-600">{formatCurrency(so.total || 0)}</td>
                      <td className="px-2 py-1 text-xs">
                        {isVoid ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800">Void</span>
                        ) : so.so_status === 'realisasi' ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-teal-bg text-teal-dark">Realisasi</span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-700">Outstanding</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-xs">
                        <div className="flex items-center gap-1">
                          <ActionIcons
                            viewHref={`/penjualan-sales-order/${so.id}`}
                            editHref={!isVoid && !isLocked ? `/penjualan-sales-order/${so.id}/edit?return=${encodeURIComponent(currentQuery)}` : undefined}
                            showEdit={!isVoid && !isLocked}
                            onVoid={!isVoid && !isLocked ? () => handleVoid(so.id) : undefined}
                            onPrint={() => printSalesOrderById(so.id)}
                            titleView="Lihat Detail"
                            titleEdit="Edit"
                            titleVoid="Void"
                            titlePrint="Cetak SO"
                            aksesOverride={{ menuCode: 'sales_order', canEdit, canVoid: canDelete, canPrint: true }}
                            onAksesOverride={(action) => {
                              const titles = { edit: 'Edit', void: 'Void', print: 'Cetak' }
                              setOverride({ open: true, menuCode: 'sales_order', action, title: titles[action], onConfirmed: () => {
                                if (action === 'edit') router.push(`/penjualan-sales-order/${so.id}/edit?return=${encodeURIComponent(currentQuery)}`)
                                else if (action === 'void') handleVoid(so.id)
                                else printSalesOrderById(so.id)
                              }})
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col md:flex-row items-center justify-between p-2 md:p-3 text-xs md:text-sm gap-2 border-t border-slate-200">
          <div className="text-[10px] md:text-sm text-slate-600">
            {total === 0
              ? 'Menampilkan 0 data'
              : `Menampilkan ${Math.min(total, (currentPage - 1) * pageSize + 1)}–${Math.min(total, currentPage * pageSize)} dari ${total}`}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setPage(1)}
              className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs"
            >«</button>
            <button
              disabled={currentPage === 1}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs"
            >‹</button>
            <span className="px-2 text-xs">{currentPage} / {totalPages}</span>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs"
            >›</button>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setPage(totalPages)}
              className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs"
            >»</button>
          </div>
        </div>
      </div>

      <ModalAksesOverride
        open={override?.open ?? false}
        onClose={closeAkses}
        onConfirm={confirmAkses}
        title={override?.title || ''}
        loading={aksesLoading}
      />
    </div>
  )
}
