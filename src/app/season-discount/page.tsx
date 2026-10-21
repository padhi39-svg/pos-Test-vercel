"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ActionIcons from '@/components/ActionIcons'
import SortIcon from '@/components/ui/SortIcon'
import { showSuccess, showError } from '@/lib/notification'

export default function SeasonDiscountListPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const basePath = '/season-discount'

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/season-discount')
      const data = res.ok ? await res.json() : []
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(i =>
      !q || i.name?.toLowerCase().includes(q) || i.code?.toLowerCase().includes(q) || (i.jenis_customer_name || '').toLowerCase().includes(q)
    )
  }, [items, query])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const paged = filtered.slice(startIndex, startIndex + pageSize)
  useEffect(() => { setPage(1) }, [query, pageSize])

  const getDiscountTypeLabel = (item: any) => {
    const types = new Set<string>()
    if (Array.isArray(item.items)) {
      item.items.forEach((it: any) => {
        if (it.discount_type === 'disc_percent') types.add('Disc%')
        else if (it.discount_type === 'disc1') types.add('Disc1')
        else if (it.discount_type === 'disc2') types.add('Disc2')
        else if (it.discount_type === 'disc3') types.add('Disc3')
      })
    }
    return types.size > 0 ? Array.from(types).join(', ') : '-'
  }

  if (loading) {
    return (
      <div className="p-3">
        <div className="bg-white rounded-lg shadow-sm p-4 text-center text-sm text-slate-600">Memuat data season discount...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Master Season Discount</h1>
          <p className="text-slate-500 text-xs mt-1">Kelola diskon musiman berdasarkan jenis customer</p>
        </div>
        <Link href={`${basePath}/new`} className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white">Tambah</Link>
      </div>

      <div className="container-card p-2">
        <div className="flex items-center gap-2 mb-2">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Cari nama/kode/jenis customer..."
            className="w-[300px] rounded-lg border border-slate-200 px-2 py-1 text-sm"
          />
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-slate-600">Tampil</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="px-2 py-1 border rounded text-xs"
            >
              {[20, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-slate-600">per halaman</span>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="px-1 py-0.5">Kode</th>
                <th className="px-1 py-0.5">Nama Season</th>
                <th className="px-1 py-0.5">Jenis Customer</th>
                <th className="px-1 py-0.5">Periode</th>
                <th className="px-1 py-0.5">Tipe Diskon</th>
                <th className="px-1 py-0.5">Status</th>
                <th className="px-1 py-0.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-1 py-3 text-center text-slate-500">Belum ada data</td>
                </tr>
              ) : (
                paged.map((it: any) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-1 py-0.5 font-medium">{it.code}</td>
                    <td className="px-1 py-0.5">{it.name}</td>
                    <td className="px-1 py-0.5">{it.jenis_customer_name || '-'}</td>
                    <td className="px-1 py-0.5 text-nowrap">
                      {it.start_date} ~ {it.end_date}
                    </td>
                    <td className="px-1 py-0.5">{getDiscountTypeLabel(it)}</td>
                    <td className="px-1 py-0.5">
                      <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full ${
                        it.is_active ? 'bg-[#E8F8F0] text-[#1E7A4A]' : 'bg-red-100 text-red-800'
                      }`}>
                        {it.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-1 py-0.5 text-right whitespace-nowrap">
                      <ActionIcons
                        viewHref={`${basePath}/${it.id}`}
                        editHref={`${basePath}/${it.id}/edit`}
                        showEdit={true}
                        showPrint={false}
                      />
                      <button
                        onClick={async () => {
                          if (!confirm('Hapus season discount ini?')) return
                          const res = await fetch(`/api/season-discount/${it.id}`, { method: 'DELETE' })
                          if (!res.ok) { showError('Gagal menghapus') } else { showSuccess('Berhasil dihapus'); await load() }
                        }}
                        className="px-1 py-0.5 text-red-600 hover:text-red-800"
                        title="Hapus"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end p-1">
          <div className="flex items-center gap-2 text-xs">
            <button disabled={currentPage===1} onClick={() => setPage(1)} className="px-2 py-0.5 rounded-pill border disabled:opacity-50">«</button>
            <button disabled={currentPage===1} onClick={() => setPage(p=>Math.max(1,p-1))} className="px-2 py-0.5 rounded-pill border disabled:opacity-50">‹</button>
            <span className="px-2">{currentPage} / {totalPages}</span>
            <button disabled={currentPage===totalPages} onClick={() => setPage(p=>Math.min(totalPages,p+1))} className="px-2 py-0.5 rounded-pill border disabled:opacity-50">›</button>
            <button disabled={currentPage===totalPages} onClick={() => setPage(totalPages)} className="px-2 py-0.5 rounded-pill border disabled:opacity-50">»</button>
          </div>
        </div>
      </div>
    </div>
  )
}
