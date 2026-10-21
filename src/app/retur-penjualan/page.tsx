"use client"
import { useState, useEffect } from 'react'
import { useSort } from '@/lib/useSort'
import { formatCurrency } from '@/lib/regionalNumber'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ActionIcons from '@/components/ActionIcons'
import SortIcon from '@/components/ui/SortIcon'
import { printReturnById } from '@/lib/printReturn'
import { useAksesOverride, type OverrideAction } from '@/hooks/useAksesOverride'
import ModalAksesOverride from '@/components/ModalAksesOverride'

type ReturnTx = {
  id: number
  transaction_number: string
  ref_transaction_number?: string
  customer_name?: string
  customer_code?: string
  subtotal: number
  discount_percent: number
  discount_amount: number
  ppn_percent: number
  ppn_amount: number
  total: number
  payment_method: string | null
  status: string
  due_date?: string
  payment_terms?: string
  notes?: string
  created_at: string
  tgl_nota?: string
  is_return?: number
}

export default function ReturPenjualanPage() {
  const router = useRouter()
  const { override, setOverride, loading: aksesLoading, error: aksesError, close: closeAkses, confirm: confirmAkses } = useAksesOverride()
  const [rows, setRows] = useState<ReturnTx[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [perm, setPerm] = useState({ canCreate: false, canEdit: false, canDelete: false, canPrint: false })

  const ALL_COLUMNS = [
    { key: 'transaction_number', label: 'No. Retur' },
    { key: 'created_at', label: 'Tanggal' },
    { key: 'ref_transaction_number', label: 'Nota Jual' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'due_date', label: 'Jatuh Tempo' },
    { key: 'total', label: 'Total' },
    { key: 'status', label: 'Status' },
  ] as const
  const DEFAULT_VISIBLE = ALL_COLUMNS.map(c => c.key)
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE)
  const [showColPicker, setShowColPicker] = useState(false)

  useEffect(() => { loadData() }, [])

  // Permission: gunakan menu invoice (sama level)
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        const perms = Array.isArray(data?.user?.permissions) ? (data.user.permissions as any[]) : []
        const row = perms.find(p => String(p.menu_code || '').toLowerCase().trim() === 'invoice') as any | undefined
        if (row) {
          setPerm({
            canCreate: Number(row.can_create) === 1,
            canEdit: Number(row.can_edit) === 1,
            canDelete: Number(row.can_delete) === 1,
            // Konsisten dengan invoice: canPrint mengikuti minimal can_edit
            canPrint: Number(row.can_edit) === 1,
          })
        } else {
          setPerm({ canCreate: false, canEdit: false, canDelete: false, canPrint: false })
        }
      } catch {
        setPerm({ canCreate: false, canEdit: false, canDelete: false, canPrint: false })
      }
    })()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/transactions')
      if (response.ok) {
        const data = await response.json()
        const filtered = data.filter((t: any) => Number(t?.is_return) === 1)
        setRows(filtered)
      }
    } catch (e) {
      console.error('load retur error:', e)
    } finally {
      setLoading(false)
    }
  }

  const filteredRows = rows.filter(tx => {
    const matchesSearch =
      tx.transaction_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.customer_code?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const { sorted: sortedRows, sortKey, sortOrder, toggleSort } = useSort<ReturnTx>(filteredRows, 'created_at', 'desc')
  const indicator = (key: any) => sortKey === key ? sortOrder : undefined

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('sales_return_list.columns.visible')
        if (saved) {
          const arr = JSON.parse(saved)
          if (Array.isArray(arr) && arr.length) {
            const allowed = DEFAULT_VISIBLE
            const filtered = arr.filter((k: string) => allowed.includes(k))
            if (filtered.length) setVisibleCols(filtered)
          }
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('sales_return_list.columns.visible', JSON.stringify(visibleCols))
      }
    } catch {}
  }, [visibleCols])

  const isVisible = (k: string) => visibleCols.includes(k)
  const toggleVisible = (k: string) => setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const visibleCount = visibleCols.length

  const getStatusBadge = (status: string, isPaid: number, total: number) => {
    if (status === 'void') {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-bold rounded-full bg-pink-100 text-pink-800 border border-pink-300">
          Void
        </span>
      )
    }
    if (isPaid == null || Number(isPaid) === 0) {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-bold rounded-full bg-cream text-[#E6B800] border border-[#FFD23F]">
          Belum Dibayar
        </span>
      )
    }
    if (Number(isPaid) < Number(total)) {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700 border border-orange-300">
          Belum Lunas
        </span>
      )
    }
    return (
      <span className="inline-flex px-2 py-1 text-xs font-bold rounded-full bg-teal-bg text-teal-primary border border-teal-primary">
        Lunas
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const uiTotal = (n: number) => `${formatCurrency(n)}`

  return (
    <div className="space-y-4">
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">List Retur Penjualan</h1>
          <p className="text-xs md:text-sm text-slate-600 mt-1">Riwayat retur (mengurangi piutang, menambah stok)</p>
        </div>
        <div className="flex gap-2 relative">
          {perm.canCreate && (
            <Link href="/retur-penjualan/new" className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm">
              + Tambah Retur
            </Link>
          )}
          <button onClick={() => setShowColPicker(v => !v)} className="px-3 md:px-4 py-2 border border-teal-primary text-teal-dark rounded-pill hover:bg-teal-bg transition-colors text-xs md:text-sm">
            Pilih Kolom
          </button>
          {showColPicker && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow p-2 z-10">
              <div className="text-[10px] font-bold text-slate-600 mb-2">Tampilkan Kolom</div>
              <div className="max-h-64 overflow-auto pr-1 space-y-1">
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" className="accent-[#2BA8A2]" checked={isVisible(col.key)} onChange={() => toggleVisible(col.key)} />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex justify-end">
                <button onClick={() => setShowColPicker(false)} className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50">Tutup</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Retur</div>
          <div className="text-lg font-bold text-slate-800">{filteredRows.length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Nilai</div>
          <div className="text-sm font-bold text-teal-primary">
            {uiTotal(filteredRows.reduce((sum, r) => sum + r.total, 0))}
          </div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Belum</div>
          <div className="text-sm font-bold text-yellow-600">
            {filteredRows.filter(r => r.status === 'pending').length}
          </div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Selesai</div>
          <div className="text-lg font-bold text-[#27AE60]">
            {filteredRows.filter(r => r.status === 'completed').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Cari</label>
            <input type="text" placeholder="No. Retur, Customer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary">
              <option value="all">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Selesai</option>
              <option value="void">Batal</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={loadData} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-4 rounded-pill text-xs h-8 font-medium transition-colors">Refresh</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full table-auto text-xs">
            <thead className="bg-gradient-to-r from-[#2BA8A2] to-[#3CC4BD] text-white">
              <tr>
                {isVisible('transaction_number') && (
                  <th className="px-2 py-1 text-xs font-semibold text-left whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('transaction_number')}>
                      No. Retur <SortIcon active={sortKey==='transaction_number'} order={indicator('transaction_number') as any} />
                    </button>
                  </th>
                )}
                {isVisible('created_at') && (
                  <th className="px-2 py-1 text-xs font-semibold text-left whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('created_at')}>
                      Tanggal <SortIcon active={sortKey==='created_at'} order={indicator('created_at') as any} />
                    </button>
                  </th>
                )}
                {isVisible('ref_transaction_number') && (
                  <th className="px-2 py-1 text-xs font-semibold text-left whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('ref_transaction_number' as any)}>
                      Nota Jual <SortIcon active={sortKey==='ref_transaction_number'} order={indicator('ref_transaction_number') as any} />
                    </button>
                  </th>
                )}
                {isVisible('customer_name') && (
                  <th className="px-2 py-1 text-xs font-semibold text-left whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('customer_name' as any)}>
                      Customer <SortIcon active={sortKey==='customer_name' as any} order={indicator('customer_name') as any} />
                    </button>
                  </th>
                )}
                {isVisible('due_date') && (
                  <th className="px-2 py-1 text-xs font-semibold text-left whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('due_date')}>
                      Jatuh Tempo <SortIcon active={sortKey==='due_date'} order={indicator('due_date') as any} />
                    </button>
                  </th>
                )}
                {isVisible('total') && (
                  <th className="px-2 py-1 text-xs font-semibold text-right whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('total')}>
                      Total <SortIcon active={sortKey==='total'} order={indicator('total') as any} />
                    </button>
                  </th>
                )}
                {isVisible('status') && (
                  <th className="px-2 py-1 text-xs font-semibold text-left whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('status')}>
                      Status <SortIcon active={sortKey==='status'} order={indicator('status') as any} />
                    </button>
                  </th>
                )}
                <th className="px-2 py-1 text-xs font-semibold text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-xs text-slate-500">Memuat data...</td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleCount + 1} className="px-2 py-6 text-center text-xs text-slate-500">Belum ada retur</td>
                </tr>
              ) : (
                sortedRows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-slate-50">
                    {isVisible('transaction_number') && (
                      <td className="px-2 py-1 text-xs font-semibold text-slate-800 whitespace-nowrap">{r.transaction_number}</td>
                    )}
                    {isVisible('created_at') && (
                      <td className="px-2 py-1 text-xs text-slate-600 whitespace-nowrap">{formatDate((r as any).tgl_nota || r.created_at)}</td>
                    )}
                    {isVisible('ref_transaction_number') && (
                      <td className="px-2 py-1 text-xs text-slate-600 whitespace-nowrap">{(r as any).ref_transaction_number || '-'}</td>
                    )}
                    {isVisible('customer_name') && (
                      <td className="px-2 py-1 text-xs whitespace-nowrap">
                        <div className="font-medium text-slate-800">{r.customer_name || 'N/A'}</div>
                      </td>
                    )}
                    {isVisible('due_date') && (
                      <td className="px-2 py-1 text-xs text-slate-600 whitespace-nowrap">{formatDate(r.due_date || '')}</td>
                    )}
                    {isVisible('total') && (
                      <td className="px-2 py-1 text-xs text-right font-bold text-teal-primary whitespace-nowrap">{uiTotal(r.total)}</td>
                    )}
                    {isVisible('status') && (
                      <td className="px-2 py-1 text-xs">{getStatusBadge(r.status, (r as any).is_paid, r.total)}</td>
                    )}
                    <td className="px-2 py-1 text-xs text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {(() => {
                          const st = String((r as any).status || '')
                          const isVoided = (r as any).void === 1
                          const payAmt = Number((r as any).is_paid || 0)
                          const editable = !isVoided && (st === 'pending' || st === 'unpaid' || payAmt === 0)
                          const doVoid = async () => {
                            if (!confirm('Yakin ingin membatalkan retur ini?')) return
                            try {
                              const res = await fetch(`/api/transactions/${r.id}/void`, { method: 'PUT' })
                              if (!res.ok) { const t = await res.text(); throw new Error(t) }
                              await loadData()
                            } catch (e:any) {
                              alert('Gagal void retur: ' + (e?.message||'Unknown error'))
                            }
                          }
                          const doEdit = () => router.push(`/retur-penjualan/${r.id}/edit`)
                          const doPrint = () => printReturnById(r.id)
                          return (
                        <ActionIcons
                          viewHref={`/retur-penjualan/${r.id}`}
                          editHref={editable ? `/retur-penjualan/${r.id}/edit` : undefined}
                          showEdit={editable}
                          onVoid={editable ? doVoid : undefined}
                          titleView="Lihat Detail"
                          titleEdit="Edit"
                          titleVoid="Void"
                          onPrint={doPrint}
                          titlePrint="Cetak Retur"
                          aksesOverride={{ menuCode: 'invoice', canEdit: perm.canEdit, canVoid: perm.canDelete, canPrint: perm.canPrint }}
                          onAksesOverride={(action) => {
                            const titles: Record<OverrideAction, string> = { edit: 'Edit', void: 'Void', print: 'Cetak' }
                            setOverride({ open: true, menuCode: 'invoice', action, title: titles[action], onConfirmed: () => {
                              if (action === 'edit') doEdit()
                              else if (action === 'void') doVoid()
                              else doPrint()
                            }})
                          }}
                        />
                          )
                        })()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredRows.length > 0 && (
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-slate-700">Total Retur: {filteredRows.length}</span>
              <span className="font-semibold text-teal-primary">Total Nilai: {uiTotal(filteredRows.reduce((sum, r) => sum + r.total, 0))}</span>
            </div>
          </div>
        )}
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
