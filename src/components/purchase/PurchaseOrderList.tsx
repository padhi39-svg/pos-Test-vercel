"use client"
import ActionIcons from '@/components/ActionIcons'
import { formatCurrency } from '@/lib/regionalNumber'
import Input from '@/components/ui/Input'
import SearchableSelect from '@/components/ui/SearchableSelect'
import SortIcon from '@/components/ui/SortIcon'
import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { printPurchaseOrderById } from '@/lib/printPurchaseOrder'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'
import { useAksesOverride, type OverrideAction } from '@/hooks/useAksesOverride'
import ModalAksesOverride from '@/components/ModalAksesOverride'

type PurchaseOrder = {
  id: number
  po_number: string
  supplier_id: number | null
  supplier_name: string | null
  order_date: string
  expected_date: string | null
  subtotal: number
  discount_percent: number
  discount_amount: number
  ppn_percent: number
  ppn_amount: number
  total: number
  po_status: string
  status: string
  void: number
  active_purchase_count?: number
  notes: string | null
  created_at: string
}

export default function PurchaseOrderList({
  items,
  onVoid,
  onRefresh,
}: {
  items: PurchaseOrder[]
  onVoid: (id: number) => void
  onRefresh?: () => void
}) {
  const router = useRouter()
  const { override, setOverride, loading: aksesLoading, error: aksesError, close: closeAkses, confirm: confirmAkses } = useAksesOverride()
  const [permEdit, setPermEdit] = useState(true)
  const [permVoid, setPermVoid] = useState(true)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'po_number' | 'supplier_name' | 'total' | 'created_at'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [current, setCurrent] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [mounted, setMounted] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        const perms = Array.isArray(data?.user?.permissions) ? (data.user.permissions as any[]) : []
        const p = perms.find((x: any) => String(x.menu_code).toLowerCase().trim() === 'po')
        if (p) {
          setPermEdit(Number(p.can_edit) === 1)
          setPermVoid(Number(p.can_delete) === 1)
        }
      } catch {}
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(x => {
      if (q && !x.po_number.toLowerCase().includes(q) && 
          !(x.supplier_name?.toLowerCase().includes(q))) return false
      if (statusFilter !== 'all' && x.po_status !== statusFilter) return false
      return true
    })
  }, [items, query, statusFilter])

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

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const summary = useMemo(() => {
    const active = items.filter(t => t.void !== 1)
    return {
      totalPO: active.length,
      totalValue: active.reduce((sum, t) => sum + t.total, 0),
      totalDiscount: active.reduce((sum, t) => sum + t.discount_amount, 0),
      voidCount: items.filter(t => t.void === 1).length,
    }
  }, [items])

  const placeholderRows = useMemo(() => {
    if (pageRows.length === 0) return []
    return Array.from({ length: Math.max(0, pageSize - pageRows.length) })
  }, [pageRows.length, pageSize])

  if (!mounted) return null

  const indicator = (key: any) => (sortKey === key ? sortDir : undefined)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Purchase Orders</h1>
          <p className="text-xs md:text-sm text-slate-600 mt-1">Daftar Purchase Order (PO)</p>
        </div>
        <div className="flex gap-2 md:ml-auto">
          <button
            onClick={async () => {
              const today = new Date().toISOString().slice(0, 10)
              const ok = await ensurePeriodForDateOrToast(today)
              if (!ok) return
              window.location.href = "/pembelian/po/new"
            }}
            className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm"
          >
            + PO Baru
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total PO</div>
          <div className="text-lg font-bold text-slate-800">{summary.totalPO}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Nilai</div>
          <div className="text-sm font-bold text-teal-primary">{formatCurrency(summary.totalValue)}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Diskon</div>
          <div className="text-sm font-bold text-red-600">{formatCurrency(summary.totalDiscount)}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">PO Void</div>
          <div className="text-lg font-bold text-slate-800">{summary.voidCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Cari</label>
            <Input
              type="text"
              placeholder="No. PO, Supplier..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-xs h-8"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Status</label>
            <SearchableSelect
              options={[
                { value: "all", label: "Semua" },
                { value: "outstanding", label: "Outstanding" },
                { value: "realisasi", label: "Realisasi" },
              ]}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v === null ? "all" : String(v))}
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
                options={[10, 25, 50, 100].map((n) => ({
                  value: n,
                  label: String(n),
                }))}
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
              <th className="px-2 py-1 text-left text-xs font-semibold">
                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('po_number')}>
                  No. PO <SortIcon active={sortKey==='po_number'} order={indicator('po_number') as any} />
                </button>
              </th>
              <th className="px-2 py-1 text-left text-xs font-semibold">
                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('supplier_name')}>
                  Supplier <SortIcon active={sortKey==='supplier_name'} order={indicator('supplier_name') as any} />
                </button>
              </th>
              <th className="px-2 py-1 text-left text-xs font-semibold">
                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('created_at')}>
                  Tanggal <SortIcon active={sortKey==='created_at'} order={indicator('created_at') as any} />
                </button>
              </th>
              <th className="px-2 py-1 text-left text-xs font-semibold">
                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('total')}>
                  Total <SortIcon active={sortKey==='total'} order={indicator('total') as any} />
                </button>
              </th>
              <th className="px-2 py-1 text-left text-xs font-semibold">Realisasi</th>
              <th className="px-2 py-1 text-left text-xs font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-center text-slate-500">Tidak ada data</td>
              </tr>
            ) : pageRows.map((po) => {
              const activePurchaseCount = Number((po as any).active_purchase_count || 0)
              const canVoid = po.void !== 1 && activePurchaseCount === 0
              const canEdit = po.void !== 1 && po.po_status !== 'realisasi'
              return (
                <tr key={po.id} className={`border-b border-slate-200 hover:bg-slate-50 ${po.void === 1 ? 'bg-pink-50' : ''}`}>
                  <td className="px-2 py-1 text-xs font-medium text-slate-900">
                    <span>{po.po_number}</span>
                    {po.void === 1 && (
                      <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800 align-middle">Void</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-xs text-slate-600">{po.supplier_name || '-'}</td>
                  <td className="px-2 py-1 text-xs text-slate-600">{po.order_date}</td>
                  <td className="px-2 py-1 text-xs text-slate-600">{formatCurrency(po.total || 0)}</td>
                  <td className="px-2 py-1 text-xs">
                    {po.void === 1 ? (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800">Void</span>
                    ) : (
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        po.po_status === 'realisasi' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {po.po_status === 'realisasi' ? 'Realisasi' : 'Outstanding'}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-xs">
                    <div className="flex items-center gap-1">
                      <ActionIcons
                        viewHref={`/pembelian/po/${po.id}`}
                        editHref={canEdit ? `/pembelian/po/${po.id}/edit` : undefined}
                        showEdit={canEdit}
                        onVoid={canVoid ? () => onVoid(po.id) : undefined}
                        titleView="Lihat Detail"
                        titleEdit="Edit"
                        titleVoid="Void"
                        onPrint={() => printPurchaseOrderById(po.id)}
                        titlePrint="Cetak PO"
                        aksesOverride={{ menuCode: 'po', canEdit: permEdit, canVoid: permVoid, canPrint: true }}
                        onAksesOverride={(action) => {
                          const titles: Record<OverrideAction, string> = { edit: 'Edit', void: 'Void', print: 'Cetak' }
                          setOverride({ open: true, menuCode: 'po', action, title: titles[action], onConfirmed: () => {
                            if (action === 'edit') router.push(`/pembelian/po/${po.id}/edit`)
                            else if (action === 'void') onVoid(po.id)
                            else printPurchaseOrderById(po.id)
                          }})
                        }}
                      />
                    </div>
                  </td>
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
            >
              «
            </button>
            <button
              disabled={current === 1}
              onClick={() => setCurrent((c) => Math.max(1, c - 1))}
              className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs"
            >
              ‹
            </button>
            <span className="px-2 text-xs">
              {current} / {totalPages || 1}
            </span>
            <button
              disabled={current === totalPages || totalPages === 0}
              onClick={() => setCurrent((c) => Math.min(totalPages, c + 1))}
              className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs"
            >
              ›
            </button>
            <button
              disabled={current === totalPages || totalPages === 0}
              onClick={() => setCurrent(totalPages || 1)}
              className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs"
            >
              »
            </button>
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
