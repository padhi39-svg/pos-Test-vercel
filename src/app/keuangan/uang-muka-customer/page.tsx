"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/regionalNumber'
import { useSort } from '@/lib/useSort'
import ActionIcons from '@/components/ActionIcons'
import SortIcon from '@/components/ui/SortIcon'
import Input from '@/components/ui/Input'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'

type Row = { id:number; kode_nota:string; tanggal:string; customer_name?:string; total_amount?:number; total?:number; status:string; created_at?:string }

export default function UangMukaCustomerListPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const load = async ()=>{
    try{
      setLoading(true)
      const res = await fetch('/api/ar-advances', { cache: 'no-store' })
      const data = await res.json().catch(()=>[])
      setRows(Array.isArray(data)? data : [])
    } catch { setRows([]) } finally { setLoading(false) }
  }

  const handleVoid = async (id: number) => {
    if (!confirm('Void uang muka ini?')) return
    try {
      const res = await fetch(`/api/ar-advances/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'void' }) })
      if (!res.ok) { const t = await res.text(); throw new Error(t) }
      await load()
    } catch (e:any) { alert('Gagal void: ' + (e?.message || 'Unknown error')) }
  }
  useEffect(()=>{ load() }, [])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const s = searchTerm.toLowerCase()
      const matchSearch = (r.kode_nota||'').toLowerCase().includes(s) || (r.customer_name||'').toLowerCase().includes(s)
      const matchStatus = statusFilter==='all' || (r.status||'active')===statusFilter
      return matchSearch && matchStatus
    })
  }, [rows, searchTerm, statusFilter])

  const { sorted, sortKey, sortOrder, toggleSort } = useSort<Row>(filtered, 'tanggal', 'desc')
  const indicator = (key: any) => sortKey === key ? sortOrder : undefined

  const totalItems = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paged = sorted.slice((currentPage-1)*pageSize, (currentPage-1)*pageSize+pageSize)

  const formatID = (n:number)=> new Intl.NumberFormat('id-ID').format(n)
  const formatDate = (s:string)=> s? new Date(s).toLocaleDateString('id-ID', { day:'2-digit', month:'2-digit', year:'numeric' }) : '-'

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-teal-100 text-teal-800">Aktif</span>
      case 'void':
        return <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800">VOID</span>
      default:
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-600">{status}</span>
    }
  }

  const currentQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('q', searchTerm)
    params.set('page', String(currentPage))
    params.set('page_size', String(pageSize))
    return params.toString()
  }, [searchTerm, currentPage, pageSize])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">List Uang Muka Customer</h1>
          <p className="text-slate-500 text-xs mt-1">Daftar uang muka customer</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50 text-xs font-medium">Refresh</button>
          <button
            onClick={async () => {
              const today = new Date().toISOString().slice(0, 10)
              const ok = await ensurePeriodForDateOrToast(today)
              if (!ok) return
              router.push(`/keuangan/uang-muka-customer/new?return=${encodeURIComponent(currentQuery)}`)
            }}
            className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white"
          >Tambah</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Total Uang Muka</div>
          <div className="text-lg font-bold text-slate-800">{filtered.filter(r => r.status !== 'void').length}</div>
        </div>
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Total Nilai</div>
          <div className="text-sm font-bold text-teal-dark">{formatCurrency(filtered.filter(r => r.status !== 'void').reduce((s:any, r:any)=> s + Number(r.total_amount??r.total??0), 0))}</div>
        </div>
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Aktif</div>
          <div className="text-lg font-bold text-teal-dark">{filtered.filter(r=> (r.status||'active')==='active').length}</div>
        </div>
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Batal</div>
          <div className="text-lg font-bold text-coral-dark">{filtered.filter(r=> (r.status||'active')==='void').length}</div>
        </div>
      </div>

      <div className="container-card p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Cari</label>
            <Input className="text-xs" placeholder="Cari no. nota / customer..." value={searchTerm} onChange={(e: any) => { setSearchTerm(e.target.value); setPage(1) }} />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Status</label>
            <select className="input text-xs" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
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
            <button onClick={load} className="w-full px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50 text-xs font-medium">Refresh</button>
          </div>
        </div>
      </div>

      <div className="container-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-teal-primary text-white">
              <tr>
                <th className="px-2 py-1 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('kode_nota')}>
                    Kode Nota <SortIcon active={sortKey === 'kode_nota'} order={indicator('kode_nota') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('tanggal')}>
                    Tanggal <SortIcon active={sortKey === 'tanggal'} order={indicator('tanggal') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Customer</th>
                <th className="px-2 py-1 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('total_amount')}>
                    Total <SortIcon active={sortKey === 'total_amount'} order={indicator('total_amount') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Status</th>
                <th className="px-2 py-1 text-center text-xs font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-xs text-slate-500">Memuat data...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-xs text-slate-500">Belum ada data</td></tr>
              ) : (
                paged.map(r => (
                  <tr key={r.id} className={`border-b border-slate-200 hover:bg-slate-50 ${r.status === 'void' ? 'bg-pink-50' : ''}`}>
                    <td className="px-2 py-1 text-xs font-medium text-slate-900">{r.kode_nota}</td>
                    <td className="px-2 py-1 text-xs text-slate-600">{formatDate(r.tanggal)}</td>
                    <td className="px-2 py-1 text-xs text-slate-600">{r.customer_name||'-'}</td>
                    <td className="px-2 py-1 text-xs text-right font-bold text-teal-dark">{formatCurrency(Number(r.total_amount??r.total??0))}</td>
                    <td className="px-2 py-1 text-xs">{getStatusBadge(r.status)}</td>
                    <td className="px-2 py-1 text-xs text-center">
                      <div className="flex items-center justify-center gap-1">
                        <ActionIcons
                          viewHref={`/keuangan/uang-muka-customer/${r.id}`}
                          editHref={r.status !== 'void' ? `/keuangan/uang-muka-customer/${r.id}/edit` : undefined}
                          showEdit={r.status !== 'void'}
                          onVoid={r.status !== 'void' ? () => handleVoid(r.id) : undefined}
                          disabledVoid={r.status === 'void'}
                          titleView="Lihat Detail"
                          titleEdit="Edit"
                          titleVoid="Void"
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
            <button className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium" onClick={()=> setPage(1)} disabled={currentPage===1}>«</button>
            <button className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium" onClick={()=> setPage(Math.max(1, currentPage-1))} disabled={currentPage===1}>‹</button>
            <span className="px-3 text-sm font-semibold text-slate-700">{currentPage} / {totalPages}</span>
            <button className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium" onClick={()=> setPage(Math.min(totalPages, currentPage+1))} disabled={currentPage===totalPages}>›</button>
            <button className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium" onClick={()=> setPage(totalPages)} disabled={currentPage===totalPages}>»</button>
          </div>
        </div>
      </div>
    </div>
  )
}
