"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSort } from "@/lib/useSort"
import { formatCurrency } from "@/lib/regionalNumber"
import ActionIcons from "@/components/ActionIcons"
import SortIcon from "@/components/ui/SortIcon"
import Input from "@/components/ui/Input"
import SearchableSelect from "@/components/ui/SearchableSelect"
import ImportModal from "@/components/ImportModal"
import { ensurePeriodForDateOrToast } from "@/lib/periodGuard"
import { printCashMutationById } from "@/lib/printCashMutation"

type Row = {
  id: number
  mutation_number: string
  mutation_date: string
  cash_account_code: string
  cash_account_name?: string
  mutation_type: 'MASUK'|'KELUAR'
  status: string
  total_amount: number
  created_at?: string
}

export default function MutasiKasBankPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showImport, setShowImport] = useState(false)

  const handleImport = async (data: any[]) => {
    const res = await fetch('/api/cash-mutations/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
    const result = await res.json()
    if (!res.ok) return { success: false, message: result.error || 'Gagal import' }
    await load()
    return { success: true, message: `Berhasil import ${result.imported} dari ${result.total} mutasi. ${result.failed} gagal.` }
  }

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/cash-mutations', { cache: 'no-store' })
      const data = await res.json().catch(()=>[])
      const list = Array.isArray(data) ? data : []
      setRows(list as any)
    } catch { setRows([]) } finally { setLoading(false) }
  }

  useEffect(()=> { load() }, [])

  const filtered = useMemo(() => {
    return rows.filter(row => {
      const matchesSearch = (row.mutation_number||'').toLowerCase().includes(searchTerm.toLowerCase()) || (row.cash_account_code||'').toLowerCase().includes(searchTerm.toLowerCase()) || (row.cash_account_name||'').toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || (row.status||'active') === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [rows, searchTerm, statusFilter])

  const { sorted, sortKey, sortOrder, toggleSort } = useSort<Row>(filtered, 'mutation_date', 'desc')
  const indicator = (key: any) => sortKey === key ? sortOrder : undefined

  const totalItems = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paged = sorted.slice(startIndex, endIndex)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-teal-bg text-teal-dark">Aktif</span>
      case 'void':
        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800">Void</span>
      default:
        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-800">{status}</span>
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const [voidingId, setVoidingId] = useState<number|null>(null)
  const handleVoid = async (id: number) => {
    if (!confirm('Void mutasi ini?')) return
    setVoidingId(id)
    try {
      const periodOk = await ensurePeriodForDateOrToast(rows.find(r=>r.id===id)?.mutation_date || '')
      if (!periodOk) { setVoidingId(null); return }
      const res = await fetch(`/api/cash-mutations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'void' }) })
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

  const isVoid = (row: Row) => String(row.status || '').toLowerCase() === 'void'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Mutasi Kas &amp; Bank</h1>
          <p className="text-xs md:text-sm text-slate-600 mt-1">Kelola mutasi kas dan bank</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={()=> setShowImport(true)}
            className="px-3 md:px-4 py-2 bg-teal-bg text-teal-primary rounded-pill hover:bg-teal-bg transition-colors text-xs md:text-sm"
          >Import Excel</button>
          <button
            onClick={async () => {
              const today = new Date().toISOString().slice(0, 10)
              const ok = await ensurePeriodForDateOrToast(today)
              if (!ok) return
              router.push(`/keuangan/mutasi-kas-bank/new?return=${encodeURIComponent(currentQuery)}`)
            }}
            className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm"
          >Tambah</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Mutasi</div>
          <div className="text-lg font-bold text-slate-800">{filtered.length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Nominal</div>
          <div className="text-sm font-bold text-teal-primary">{formatCurrency(filtered.reduce((sum, r) => sum + Number(r.total_amount||0), 0))}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Aktif</div>
          <div className="text-lg font-bold text-teal-primary">{filtered.filter(r=> (r.status||'active')==='active').length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Void</div>
          <div className="text-lg font-bold text-slate-800">{filtered.filter(r=> (r.status||'active')==='void').length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Cari</label>
            <Input className="text-xs h-8" placeholder="Cari kode nota/akun..." value={searchTerm} onChange={(e: any) => { setSearchTerm(e.target.value); setPage(1) }} />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Status</label>
            <SearchableSelect
              options={[
                { value: 'all', label: 'Semua Status' },
                { value: 'active', label: 'Aktif' },
                { value: 'void', label: 'Void' },
              ]}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v !== null ? String(v) : 'all'); setPage(1) }}
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
                options={[10, 25, 50, 100].map((n) => ({ value: n, label: String(n) }))}
                value={pageSize}
                onChange={(v) => { if (v === null) return; setPageSize(Number(v)); setPage(1) }}
                showSearch={false}
                allowClear={false}
                className="!w-20"
                inputClassName="text-xs h-8"
              />
              <span className="text-slate-600 whitespace-nowrap">per halaman</span>
            </div>
          </div>
          <div className="flex items-end">
            <button onClick={load} className="w-full px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50 text-xs font-medium">Refresh</button>
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
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('mutation_number')}>
                    Kode Nota <SortIcon active={sortKey === 'mutation_number'} order={indicator('mutation_number') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('mutation_date')}>
                    Tanggal <SortIcon active={sortKey === 'mutation_date'} order={indicator('mutation_date') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Kas/Bank</th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Jenis</th>
                <th className="px-2 py-1 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('total_amount')}>
                    Nominal <SortIcon active={sortKey === 'total_amount'} order={indicator('total_amount') as any} />
                  </button>
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Status</th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-slate-500">Memuat data...</td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-slate-500">Belum ada data</td>
                </tr>
              ) : (
                paged.map((row) => {
                  const voided = isVoid(row)
                  return (
                    <tr key={row.id} className={`border-b border-slate-200 hover:bg-slate-50 ${voided ? 'bg-pink-50' : ''}`}>
                      <td className="px-2 py-1 text-xs font-medium text-slate-900 whitespace-nowrap">
                        {row.mutation_number}
                        {voided && (
                          <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800 align-middle">Void</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-xs text-slate-600 whitespace-nowrap">{formatDate(row.mutation_date)}</td>
                      <td className="px-2 py-1 text-xs text-slate-600 whitespace-nowrap">{[row.cash_account_code, row.cash_account_name].filter(Boolean).join(' - ')}</td>
                      <td className="px-2 py-1 text-xs whitespace-nowrap">
                        <span className={`font-medium ${row.mutation_type === 'MASUK' ? 'text-teal-primary' : 'text-pink-600'}`}>
                          {row.mutation_type === 'MASUK' ? 'Masuk' : 'Keluar'}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-xs text-slate-600 whitespace-nowrap">{formatCurrency(row.total_amount)}</td>
                      <td className="px-2 py-1 text-xs whitespace-nowrap">{getStatusBadge(row.status)}</td>
                      <td className="px-2 py-1 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <ActionIcons
                            viewHref={`/keuangan/mutasi-kas-bank/${row.id}`}
                            editHref={!voided ? `/keuangan/mutasi-kas-bank/${row.id}/edit` : undefined}
                            showEdit={!voided}
                            onVoid={!voided ? () => handleVoid(row.id) : undefined}
                            disabledVoid={voided || voidingId === row.id}
                            onPrint={() => printCashMutationById(row.id)}
                            showPrint={true}
                            titleView="Lihat Detail"
                            titleEdit="Edit"
                            titleVoid="Void"
                            titlePrint="Cetak Mutasi"
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
            {totalItems === 0
              ? 'Menampilkan 0 data'
              : `Menampilkan ${Math.min(totalItems, (currentPage - 1) * pageSize + 1)}–${Math.min(totalItems, currentPage * pageSize)} dari ${totalItems}`}
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

      {showImport && (
        <ImportModal
          open={showImport}
          onClose={()=> setShowImport(false)}
          onImport={handleImport}
          title="Import Mutasi Kas/Bank"
          sampleColumns={['mutation_date', 'cash_account_code', 'mutation_type', 'account_code', 'amount', 'notes']}
        />
      )}
    </div>
  )
}
