"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ActionIcons from '@/components/ActionIcons'
import { formatCurrency } from '@/lib/regionalNumber'
import { showSuccess, showError } from '@/lib/notification'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'
import { printManufakturById } from '@/lib/printManufaktur'

type ManufakturRow = {
  id: number
  nomor: string
  tanggal: string
  barang_id: number
  barang_code?: string
  barang_name?: string
  quantity: number
  status: string
  hpp_sebelum?: number
  hpp_sesudah?: number
  total_biaya?: number
  warehouse_id?: number
  gudang_name?: string
}

export default function ManufakturListPage() {
  const [rows, setRows] = useState<ManufakturRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [working, setWorking] = useState<number | null>(null)
  const [current, setCurrent] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [canCreate, setCanCreate] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [canDelete, setCanDelete] = useState(false)
  const [canApprove, setCanApprove] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalRow, setModalRow] = useState<ManufakturRow | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [approvedId, setApprovedId] = useState<number | null>(null)
  const [approvedNomor, setApprovedNomor] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      const url = new URL('/api/manufaktur', location.origin)
      if (query.trim()) url.searchParams.set('q', query.trim())
      if (statusFilter) url.searchParams.set('status', statusFilter)
      url.searchParams.set('limit', '100')
      url.searchParams.set('t', String(Date.now()))
      const res = await fetch(url.toString(), { cache: 'no-store' })
      const json = await res.json()
      setRows(Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [query, statusFilter])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        const perms = Array.isArray(data?.user?.permissions) ? data.user.permissions as any[] : []
        const p = perms.find((x: any) => String(x.menu_code || '').toLowerCase().trim() === 'manufaktur') as any | undefined
        setCanCreate(Number(p?.can_create) === 1)
        setCanEdit(Number(p?.can_edit) === 1)
        setCanDelete(Number(p?.can_delete) === 1)
        setCanApprove(Number(p?.can_approve) === 1 || Number(p?.can_create) === 1)
      } catch {}
    })()
  }, [])

  const stats = useMemo(() => {
    const draft = rows.filter(r => r.status === 'draft').length
    const approved = rows.filter(r => r.status === 'approved').length
    const voided = rows.filter(r => r.status === 'void').length
    return { draft, approved, void: voided }
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false
      return true
    })
  }, [rows, statusFilter])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (current - 1) * pageSize
  const pageRows = filtered.slice(start, start + pageSize)

  useEffect(() => { setCurrent(1) }, [query, statusFilter, pageSize])

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      void: 'bg-red-100 text-red-700',
    }
    const labelMap: Record<string, string> = {
      draft: 'Draft',
      approved: 'Approved',
      void: 'Void',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${map[status] || 'bg-slate-100 text-slate-600'}`}>
        {labelMap[status] || status}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Manufaktur</h1>
          <p className="text-xs md:text-sm text-slate-600 mt-1">Produksi barang jadi dari bahan baku</p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <button onClick={async () => {
              const today = new Date().toISOString().slice(0, 10)
              const ok = await ensurePeriodForDateOrToast(today)
              if (!ok) return
              window.location.href = '/persediaan/manufaktur/new'
            }} className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm">
              + Buat Baru
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Manufaktur</div>
          <div className="text-lg font-bold text-slate-800">{rows.length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Draft</div>
          <div className="text-lg font-bold text-yellow-600">{stats.draft}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Approved</div>
          <div className="text-lg font-bold text-green-600">{stats.approved}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Void</div>
          <div className="text-lg font-bold text-red-600">{stats.void}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Cari</label>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari nomor atau nama barang..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary">
              <option value="">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="void">Void</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Tampil</label>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrent(1) }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={loadData} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-4 rounded-pill text-xs h-8 font-medium transition-colors">Refresh</button>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-teal-primary text-white">
            <tr>
              <th className="px-2 py-1 text-left text-xs font-semibold">Nomor</th>
              <th className="px-2 py-1 text-left text-xs font-semibold">Tanggal</th>
              <th className="px-2 py-1 text-left text-xs font-semibold">Barang</th>
              <th className="px-2 py-1 text-right text-xs font-semibold">Qty</th>
              <th className="px-2 py-1 text-left text-xs font-semibold">Gudang</th>
              <th className="px-2 py-1 text-center text-xs font-semibold">Status</th>
              <th className="px-2 py-1 text-right text-xs font-semibold hidden lg:table-cell">HPP Sebelum</th>
              <th className="px-2 py-1 text-right text-xs font-semibold hidden lg:table-cell">HPP Sesudah</th>
              <th className="px-2 py-1 text-right text-xs font-semibold hidden lg:table-cell">Total Biaya</th>
              <th className="px-2 py-1 text-right text-xs font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} className="px-2 py-3 text-center text-slate-500 text-xs">Memuat...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={10} className="px-2 py-3 text-center text-slate-500 text-xs">Belum ada data</td></tr>
            )}
            {!loading && pageRows.map(r => (
              <tr key={r.id} className={`border-t hover:bg-slate-50 ${r.status === 'void' ? 'bg-pink-50' : ''}`}>
                <td className="px-2 py-1 text-xs font-semibold text-teal-primary">{r.nomor}</td>
                <td className="px-2 py-1 text-xs">{String(r.tanggal).slice(0, 10)}</td>
                <td className="px-2 py-1 text-xs">{r.barang_code ? `${r.barang_code} - ${r.barang_name}` : (r.barang_name || '-')}</td>
                <td className="px-2 py-1 text-xs text-right">{r.quantity}</td>
                <td className="px-2 py-1 text-xs">{r.gudang_name || '-'}</td>
                <td className="px-2 py-1 text-xs text-center">{statusBadge(r.status)}</td>
                <td className="px-2 py-1 text-xs text-right hidden lg:table-cell">{r.hpp_sebelum != null ? formatCurrency(r.hpp_sebelum) : '-'}</td>
                <td className="px-2 py-1 text-xs text-right hidden lg:table-cell">{r.hpp_sesudah != null ? formatCurrency(r.hpp_sesudah) : '-'}</td>
                <td className="px-2 py-1 text-xs text-right hidden lg:table-cell">{r.total_biaya != null ? formatCurrency(r.total_biaya) : '-'}</td>
                <td className="px-2 py-1 text-xs text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {canApprove && r.status === 'draft' && (
                      <button
                        type="button"
                        title="Approve"
                        onClick={() => { setModalRow(r); setModalOpen(true) }}
                        className="h-6 w-6 grid place-items-center rounded border bg-white border-slate-300 text-slate-600 hover:bg-slate-100"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                    <ActionIcons
                      viewHref={`/persediaan/manufaktur/${r.id}`}
                      editHref={canEdit && r.status === 'draft' ? `/persediaan/manufaktur/${r.id}/edit` : undefined}
                      showEdit={canEdit && r.status === 'draft'}
                      disabledVoid={!canDelete || r.status === 'void' || working === r.id}
                      onVoid={canDelete && (r.status === 'draft' || r.status === 'approved') ? async () => {
                        const msg = r.status === 'approved'
                          ? 'Void dokumen yang sudah di-approve akan membalikkan seluruh stok. Lanjutkan?'
                          : 'Void dokumen ini? Operasi ini tidak dapat dibatalkan.'
                        if (!confirm(msg)) return
                        try {
                          setWorking(r.id)
                          const res = await fetch(`/api/manufaktur/${r.id}`, { method: 'DELETE' })
                          const data = await res.json().catch(() => ({}))
                          if (!res.ok) { showError(data?.error || 'Gagal void'); return }
                          showSuccess('Dokumen berhasil di-void')
                          loadData()
                        } finally { setWorking(null) }
                      } : undefined}
                      onPrint={() => printManufakturById(r.id)}
                      titleView="Lihat Detail"
                      titleEdit="Edit"
                      titleVoid="Void"
                      titlePrint="Cetak Nota"
                    />
                  </div>
                </td>
              </tr>
            ))}
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
            <button disabled={current === 1} onClick={() => setCurrent(1)} className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs">«</button>
            <button disabled={current === 1} onClick={() => setCurrent(c => Math.max(1, c - 1))} className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs">‹</button>
            <span className="px-2 text-xs">{current} / {totalPages || 1}</span>
            <button disabled={current === totalPages || totalPages === 0} onClick={() => setCurrent(c => Math.min(totalPages, c + 1))} className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs">›</button>
            <button disabled={current === totalPages || totalPages === 0} onClick={() => setCurrent(totalPages || 1)} className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs">»</button>
          </div>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {loading && (
          <div className="px-2 py-3 text-center text-slate-500 text-xs bg-white rounded-xl border">Memuat...</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="px-2 py-3 text-center text-slate-500 text-xs bg-white rounded-xl border">Belum ada data</div>
        )}
        {!loading && pageRows.map(r => (
          <div key={r.id} className={`bg-white rounded-xl border border-slate-200 p-3 ${r.status === 'void' ? 'bg-pink-50' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-teal-primary">{r.nomor}</div>
                <div className="text-[11px] text-slate-600">{String(r.tanggal).slice(0, 10)}</div>
              </div>
              {statusBadge(r.status)}
            </div>
            <div className="mt-1 text-xs">{r.barang_name || '-'}</div>
            <div className="mt-1 text-[11px] text-slate-600">Qty: {r.quantity}</div>
            <div className="mt-2 flex items-center justify-end gap-1.5">
              <button onClick={() => printManufakturById(r.id)} className="px-2 py-1 rounded border text-[11px]">Cetak</button>
              <Link href={`/persediaan/manufaktur/${r.id}`} className="px-2 py-1 rounded border text-[11px]">Lihat</Link>
              {canApprove && r.status === 'draft' && (
                <button onClick={() => { setModalRow(r); setModalOpen(true) }} className="px-2 py-1 rounded border text-[11px] text-teal-primary">Approve</button>
              )}
              {canEdit && r.status === 'draft' && (
                <Link href={`/persediaan/manufaktur/${r.id}/edit`} className="px-2 py-1 rounded border text-[11px]">Edit</Link>
              )}
              {canDelete && (r.status === 'draft' || r.status === 'approved') && (
                <button
                  className="px-2 py-1 rounded border text-[11px] text-red-600"
                  onClick={async () => {
                    const msg = r.status === 'approved'
                      ? 'Void dokumen yang sudah di-approve akan membalikkan seluruh stok. Lanjutkan?'
                      : 'Void dokumen ini?'
                    if (!confirm(msg)) return
                    try {
                      setWorking(r.id)
                      const res = await fetch(`/api/manufaktur/${r.id}`, { method: 'DELETE' })
                      if (!res.ok) { showError('Gagal void'); return }
                      showSuccess('Dokumen berhasil di-void')
                      loadData()
                    } finally { setWorking(null) }
                  }}
                >Void</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Cetak setelah Approve */}
      {printModalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPrintModalOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <div className="w-full max-w-sm bg-white rounded-lg shadow-xl border border-slate-200">
              <div className="px-4 py-3 border-b border-slate-200">
                <div className="text-sm font-semibold text-slate-800">Data Sudah Diapprove</div>
              </div>
              <div className="px-4 py-6 text-center text-sm text-slate-700">
                <svg className="w-12 h-12 mx-auto mb-3 text-teal-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-semibold text-base">Manufaktur {approvedNomor}</p>
                <p className="mt-1">Berhasil di-approve. Cetak Nota A5?</p>
              </div>
              <div className="px-4 py-3 flex items-center justify-center gap-3 border-t border-slate-200">
                <button onClick={() => setPrintModalOpen(false)} className="px-4 py-2 rounded border text-sm">
                  Tidak
                </button>
                <button
                  onClick={async () => {
                    if (approvedId) {
                      const { printManufakturById } = await import('@/lib/printManufaktur')
                      await printManufakturById(approvedId)
                    }
                    setPrintModalOpen(false)
                  }}
                  className="px-4 py-2 rounded text-sm text-white bg-teal-primary hover:bg-teal-dark"
                >
                  Ya, Cetak A5
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Approve */}
      {modalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => !modalLoading && setModalOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <div className="w-full max-w-sm bg-white rounded-lg shadow-xl border border-slate-200">
              <div className="px-4 py-3 border-b border-slate-200">
                <div className="text-sm font-semibold text-slate-800">Konfirmasi Approve</div>
              </div>
              <div className="px-4 py-3 text-sm text-slate-700">
                Manufaktur <strong>{modalRow?.nomor}</strong> akan di-approve. Stok barang jadi akan bertambah dan stok bahan baku akan berkurang. Lanjutkan?
              </div>
              <div className="px-4 py-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button disabled={modalLoading} onClick={() => setModalOpen(false)} className="px-3 py-2 rounded-pill border text-sm disabled:opacity-50">Batal</button>
                <button
                  disabled={modalLoading}
                  onClick={async () => {
                    if (!modalRow) return
                    try {
                      setModalLoading(true)
                      const res = await fetch(`/api/manufaktur/${modalRow.id}/approve`, { method: 'POST' })
                      const data = await res.json().catch(() => ({}))
                      if (!res.ok) throw new Error(data?.error || 'Gagal approve')
                      setApprovedId(modalRow.id)
                      setApprovedNomor(modalRow.nomor)
                      setModalOpen(false)
                      setPrintModalOpen(true)
                      loadData()
                    } catch (e: any) {
                      showError(e?.message || 'Gagal approve')
                    } finally {
                      setModalLoading(false)
                    }
                  }}
                  className="px-3 py-2 rounded text-sm text-white bg-teal-primary hover:bg-teal-dark disabled:opacity-50"
                >
                  Ya, Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
