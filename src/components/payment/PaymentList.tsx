"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import { useSort } from '@/lib/useSort'
import ActionIcons from '@/components/ActionIcons'
import SortIcon from '@/components/ui/SortIcon'
import { formatNumberID } from '@/lib/formatNumber'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'
import { printArPayment } from '@/lib/printArPayment'

export type PaymentType = 'ar' | 'ap'

type Config = {
  type: PaymentType
  title: string
  basePath: string
  endpoint: string
  voidEndpoint: (id: number) => string
  permissionKey: string
  partyLabel: string
}

const CONFIG: Record<PaymentType, Config> = {
  ar: {
    type: 'ar',
    title: 'List Pembayaran Piutang',
    basePath: '/keuangan/pembayaran-piutang',
    endpoint: '/api/ar-payments',
    voidEndpoint: (id) => `/api/ar-payments/${id}?void=1`,
    permissionKey: 'keu_pembayaran_piutang',
    partyLabel: 'Customer',
  },
  ap: {
    type: 'ap',
    title: 'List Pembayaran Hutang',
    basePath: '/keuangan/pembayaran-hutang',
    endpoint: '/api/ap-payments',
    voidEndpoint: (id) => `/api/ap-payments/${id}?void=1`,
    permissionKey: 'keu_pembayaran_hutang',
    partyLabel: 'Supplier',
  },
}

type Payment = {
  id: number
  payment_number: string
  payment_date: string
  customer_id?: number
  customer_name?: string
  supplier_id?: number
  supplier_name?: string
  total: number
  status: string
  void: number
  auto_created: number
  created_at: string
}

const PARTY_FIELD: Record<PaymentType, 'customer_name' | 'supplier_name'> = {
  ar: 'customer_name',
  ap: 'supplier_name',
}

export default function PaymentList({ type }: { type: PaymentType }) {
  const cfg = CONFIG[type]
  const router = useRouter()
  const partyField = PARTY_FIELD[type]
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [perm, setPerm] = useState({ canCreate: false, canEdit: false, canDelete: false })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [voidingId, setVoidingId] = useState<number | null>(null)

  const loadPayments = async () => {
    try {
      setLoading(true)
      const res = await fetch(cfg.endpoint, { cache: 'no-store' })
      const data = await res.json()
      setPayments(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load payments:', err)
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPayments() }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        const perms = Array.isArray(data?.user?.permissions) ? (data.user.permissions as any[]) : []
        const row = perms.find((p: any) => String(p.menu_code || '').toLowerCase().trim() === cfg.permissionKey) as any | undefined
        if (row) {
          setPerm({
            canCreate: Number(row.can_create) === 1,
            canEdit: Number(row.can_edit) === 1,
            canDelete: Number(row.can_delete) === 1,
          })
        } else {
          setPerm({ canCreate: false, canEdit: false, canDelete: false })
        }
      } catch {
        setPerm({ canCreate: false, canEdit: false, canDelete: false })
      }
    })()
  }, [cfg.permissionKey])

  const handleVoid = async (id: number) => {
    if (!confirm('Yakin ingin membatalkan (void) pembayaran ini?')) return
    try {
      setVoidingId(id)
      const res = await fetch(cfg.voidEndpoint(id), { method: 'PUT' })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || 'Gagal void pembayaran')
      }
      alert('Pembayaran berhasil di-void')
      await loadPayments()
    } catch (e: any) {
      alert('Error: ' + (e?.message || 'Gagal void pembayaran'))
    } finally {
      setVoidingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch { return dateStr }
  }

  const filteredPayments = payments.filter((payment) => {
    const q = searchTerm.toLowerCase()
    const partyName = String((payment as any)[partyField] || '').toLowerCase()
    const matchesSearch = !q || payment.payment_number.toLowerCase().includes(q) || partyName.includes(q)
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const { sorted: sortedPayments, sortKey, sortOrder, toggleSort } = useSort<Payment>(filteredPayments, 'created_at', 'desc')
  const indicator = (key: any) => (sortKey === key ? sortOrder : undefined)

  const totalItems = sortedPayments.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const pagedPayments = sortedPayments.slice(startIndex, endIndex)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-teal-bg text-teal-dark">Aktif</span>
      case 'void': return <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-coral-bg text-coral-dark">Batal</span>
      default: return <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-700">{status}</span>
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{cfg.title}</h1>
          <p className="text-slate-500 text-xs mt-1">Riwayat pembayaran {type === 'ar' ? 'piutang customer' : 'hutang supplier'}</p>
        </div>
        <div className="flex gap-2">
          {perm.canCreate && (
            <button
              onClick={async () => {
                const today = new Date().toISOString().slice(0, 10)
                const ok = await ensurePeriodForDateOrToast(today)
                if (!ok) return
                router.push(`${cfg.basePath}/new`)
              }}
              className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white"
            >
              + Tambah Pembayaran
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Total Pembayaran</div>
          <div className="text-lg font-bold text-slate-800">{filteredPayments.length}</div>
        </div>
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Total Nilai</div>
          <div className="text-sm font-bold text-teal-dark">Rp {formatNumberID(filteredPayments.reduce((sum, pay) => sum + Number(pay.total || 0), 0))}</div>
        </div>
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Aktif</div>
          <div className="text-lg font-bold text-teal-dark">{filteredPayments.filter((p) => p.status === 'active').length}</div>
        </div>
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Batal</div>
          <div className="text-lg font-bold text-coral-dark">{filteredPayments.filter((p) => p.status === 'void').length}</div>
        </div>
      </div>

      <div className="container-card p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Cari</label>
            <Input className="text-xs" placeholder={`No. Pembayaran, ${cfg.partyLabel}...`} value={searchTerm} onChange={(e: any) => setSearchTerm(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Status</label>
            <select className="input text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="void">Batal</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Tampil</label>
            <select className="input text-xs" value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value) || 10) }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={loadPayments} className="w-full px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50 text-xs font-medium">Refresh</button>
          </div>
        </div>
      </div>

      <div className="container-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
              <tr>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('payment_number')}>
                    No. Pembayaran <SortIcon active={sortKey === 'payment_number'} order={indicator('payment_number') as any} />
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('payment_date')}>
                    Tanggal <SortIcon active={sortKey === 'payment_date'} order={indicator('payment_date') as any} />
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort(partyField)}>
                    {cfg.partyLabel} <SortIcon active={sortKey === partyField} order={indicator(partyField) as any} />
                  </button>
                </th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('total')}>
                    Total <SortIcon active={sortKey === 'total'} order={indicator('total') as any} />
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('status')}>
                    Status <SortIcon active={sortKey === 'status'} order={indicator('status') as any} />
                  </button>
                </th>
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Memuat data...</td></tr>
              ) : pagedPayments.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Belum ada pembayaran</td></tr>
              ) : (
                pagedPayments.map((payment) => (
                  <tr key={payment.id} className={`border-t hover:bg-teal-bg/50 ${payment.void === 1 ? 'bg-coral-bg/50' : ''}`}>
                    <td className="px-3 py-1.5 font-semibold text-slate-800 whitespace-nowrap">{payment.payment_number}</td>
                    <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{formatDate(payment.payment_date)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{(payment as any)[partyField] || 'N/A'}</div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-slate-800 whitespace-nowrap">Rp {formatNumberID(payment.total)}</td>
                    <td className="px-3 py-1.5">{getStatusBadge(payment.status)}</td>
                    <td className="px-3 py-1.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <ActionIcons
                          viewHref={`${cfg.basePath}/${payment.id}`}
                          editHref={`${cfg.basePath}/${payment.id}/edit`}
                          showEdit={perm.canEdit && payment.void !== 1 && payment.auto_created !== 1}
                          onVoid={payment.auto_created !== 1 && payment.void !== 1 ? () => handleVoid(payment.id) : undefined}
                          disabledVoid={payment.void === 1 || voidingId === payment.id}
                          titleView="Lihat Detail"
                          titleEdit="Edit"
                          titleVoid="Void"
                          onPrint={type === 'ar' ? () => printArPayment(payment.id) : undefined}
                          titlePrint="Cetak Pembayaran"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 border-t border-slate-200">
          <div className="flex items-center gap-1 text-xs">
            <div className="flex items-center gap-1 mr-2">
              <span className="text-slate-600">Tampil</span>
              <div className="w-[68px]">
                <select className="input text-xs" value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value) || 10) }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
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
  )
}
