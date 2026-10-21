"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSort } from '@/lib/useSort'
import ActionIcons from '@/components/ActionIcons'
import SortIcon from '@/components/ui/SortIcon'
import Input from '@/components/ui/Input'
import ImportModal from '@/components/ImportModal'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'
import { printMemorialJournalById } from '@/lib/printMemorialJournal'

type Row = {
  id: number
  journal_number: string
  journal_date: string
  total_debit: number
  total_credit: number
  status: string
  created_at?: string
}

export default function JurnalMemorialPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showImport, setShowImport] = useState(false)

  const handleImport = async (data: any[]) => {
    const res = await fetch('/api/memorial-journals/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
    const result = await res.json()
    if (!res.ok) return { success: false, message: result.error || 'Gagal import' }
    await load()
    return { success: true, message: `Berhasil import ${result.imported} dari ${result.total} jurnal. ${result.failed} gagal.` }
  }

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/memorial-journals', { cache: 'no-store' })
      const data = await res.json().catch(()=>[])
      const list = Array.isArray(data) ? data : []
      setRows(list as any)
    } catch { setRows([]) } finally { setLoading(false) }
  }

  useEffect(()=> { load() }, [])

  const filtered = useMemo(() => {
    return rows.filter(row => {
      const matchesSearch = (row.journal_number||'').toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || (row.status||'active') === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [rows, searchTerm, statusFilter])

  const { sorted, sortKey, sortOrder, toggleSort } = useSort<Row>(filtered, 'journal_date', 'desc')
  const indicator = (key: any) => sortKey === key ? sortOrder : undefined

  const totalItems = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paged = sorted.slice(startIndex, endIndex)

  const formatID = (n:number)=> new Intl.NumberFormat('id-ID').format(n)

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

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const [voidingId, setVoidingId] = useState<number|null>(null)
  const handleVoid = async (id: number) => {
    if (!confirm('Void jurnal ini?')) return
    setVoidingId(id)
    try {
      const periodOk = await ensurePeriodForDateOrToast(rows.find(r=>r.id===id)?.journal_date || '')
      if (!periodOk) { setVoidingId(null); return }
      const res = await fetch(`/api/memorial-journals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'void' }) })
      if (!res.ok) { alert('Gagal void'); setVoidingId(null); return }
      await load()
    } catch { alert('Gagal void') } finally { setVoidingId(null) }
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
          <h1 className="text-xl font-semibold">Jurnal Memorial</h1>
          <p className="text-slate-500 text-xs mt-1">Kelola jurnal memorial</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.open('/api/memorial-journals/template', '_blank')} className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50 text-xs font-medium">Download Template</button>
          <button onClick={()=> setShowImport(true)} className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50 text-xs font-medium">Import Excel</button>
          <button
            onClick={async () => {
              const today = new Date().toISOString().slice(0, 10)
              const ok = await ensurePeriodForDateOrToast(today)
              if (!ok) return
              router.push(`/keuangan/jurnal-memorial/new?return=${encodeURIComponent(currentQuery)}`)
            }}
            className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white"
          >Tambah</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Total Jurnal</div>
          <div className="text-lg font-bold text-slate-800">{filtered.filter(r => r.status !== 'void').length}</div>
        </div>
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Total Debit</div>
          <div className="text-sm font-bold text-teal-dark">Rp {formatID(filtered.filter(r => r.status !== 'void').reduce((sum, r:any)=> sum + Number(r.total_debit||0), 0))}</div>
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
            <Input className="text-xs" placeholder="Cari no. jurnal..." value={searchTerm} onChange={(e: any) => { setSearchTerm(e.target.value); setPage(1) }} />
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
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('journal_number')}>
                    No. Jurnal <SortIcon active={sortKey === 'journal_number'} order={indicator('journal_number') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('journal_date')}>
                    Tanggal <SortIcon active={sortKey === 'journal_date'} order={indicator('journal_date') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('total_debit')}>
                    Debit <SortIcon active={sortKey === 'total_debit'} order={indicator('total_debit') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('total_credit')}>
                    Kredit <SortIcon active={sortKey === 'total_credit'} order={indicator('total_credit') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Status</th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-xs text-slate-500">Memuat data...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-xs text-slate-500">Belum ada data</td></tr>
              ) : (
                paged.map((row) => (
                  <tr key={row.id} className={`border-b border-slate-200 hover:bg-slate-50 ${row.status === 'void' ? 'bg-pink-50' : ''}`}>
                    <td className="px-2 py-1 text-xs font-medium text-slate-900">{row.journal_number}</td>
                    <td className="px-2 py-1 text-xs text-slate-600">{formatDate(row.journal_date)}</td>
                    <td className="px-2 py-1 text-xs text-slate-600 text-right">Rp {formatID(row.total_debit)}</td>
                    <td className="px-2 py-1 text-xs text-slate-600 text-right">Rp {formatID(row.total_credit)}</td>
                    <td className="px-2 py-1 text-xs text-center">{getStatusBadge(row.status)}</td>
                    <td className="px-2 py-1 text-xs text-center">
                      <div className="flex items-center justify-center gap-1">
                          <ActionIcons
                            viewHref={`/keuangan/jurnal-memorial/${row.id}`}
                            editHref={row.status !== 'void' ? `/keuangan/jurnal-memorial/${row.id}/edit` : undefined}
                            showEdit={row.status !== 'void'}
                            onVoid={row.status !== 'void' ? () => handleVoid(row.id) : undefined}
                            disabledVoid={row.status === 'void' || voidingId === row.id}
                            onPrint={() => printMemorialJournalById(row.id)}
                            showPrint
                            titleView="Lihat Detail"
                            titleEdit="Edit"
                            titleVoid="Void"
                            titlePrint="Cetak Jurnal"
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

      {showImport && (
        <ImportModal
          open={showImport}
          onClose={()=> setShowImport(false)}
          onImport={handleImport}
          title="Import Jurnal Memorial"
          sampleColumns={['journal_date', 'account_code', 'debit', 'credit', 'notes']}
        />
      )}
    </div>
  )
}
