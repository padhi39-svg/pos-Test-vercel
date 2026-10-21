"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ActionIcons from '@/components/ActionIcons'
import Input from '@/components/ui/Input'
import { formatCurrency } from '@/lib/regionalNumber'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'

export default function ArOpeningListPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const totalNilai = useMemo(() => rows.reduce((s: any, r: any) => s + Number(r.nominal || 0), 0), [rows])
  const aktifCount = useMemo(() => rows.filter((r: any) => r.void !== 1).length, [rows])
  const voidCount = useMemo(() => rows.filter((r: any) => r.void === 1).length, [rows])

  const load = async (p = page) => {
    setLoading(true)
    try {
      const usp = new URLSearchParams()
      usp.set('page', String(p))
      usp.set('pageSize', String(pageSize))
      if (q) usp.set('q', q)
      if (startDate) usp.set('startDate', startDate)
      if (endDate) usp.set('endDate', endDate)
      const res = await fetch(`/api/ar-opening-balances?${usp.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const _ = await res.text().catch(() => '')
        setRows([]); setTotal(0); setPage(1); setPageSize(pageSize)
      } else {
        const data = await res.json().catch(() => ({}))
        setRows((data as any).data || [])
        setTotal((data as any).total || 0)
        setPage((data as any).page || 1)
        setPageSize((data as any).pageSize || 10)
      }
    } catch {
      setRows([]); setTotal(0); setPage(1); setPageSize(pageSize)
    } finally { setLoading(false) }
  }
  useEffect(() => { load(1) }, [])

  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))

  const handleVoid = async (id: number) => {
    if (!confirm('Yakin void dokumen ini?')) return
    try {
      const res = await fetch(`/api/ar-opening-balances/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'void' }) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e?.error || 'Gagal void'); return }
      await load(page)
    } catch (e: any) { alert('Gagal void: ' + (e?.message || 'Unknown error')) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Saldo Awal Piutang</h1>
          <p className="text-slate-500 text-xs mt-1">Daftar saldo awal piutang customer</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const today = new Date().toISOString().slice(0, 10)
              const ok = await ensurePeriodForDateOrToast(today)
              if (!ok) return
              router.push('/keuangan/saldo-awal-piutang/new')
            }}
            className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white"
          >
            Tambah
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Total Saldo Awal</div>
          <div className="text-lg font-bold text-slate-800">{rows.length}</div>
        </div>
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Total Nilai</div>
          <div className="text-sm font-bold text-teal-dark">{formatCurrency(totalNilai)}</div>
        </div>
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Aktif</div>
          <div className="text-lg font-bold text-slate-800">{aktifCount}</div>
        </div>
        <div className="container-card p-2 text-xs">
          <div className="text-slate-500 mb-1 font-bold">Batal</div>
          <div className="text-lg font-bold text-coral-dark">{voidCount}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="container-card p-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Cari</label>
            <Input className="text-xs" placeholder="Cari kode/customer..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Tanggal Awal</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input text-xs" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Tanggal Akhir</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input text-xs" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Tampil</label>
            <select className="input text-xs" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value) || 10); setPage(1); load(1) }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <button onClick={() => load(1)} className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white">Filter</button>
            <button onClick={() => { setQ(''); setStartDate(''); setEndDate(''); load(1) }} className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50 text-xs font-medium">Reset</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="container-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-teal-primary text-white">
              <tr>
                <th className="px-2 py-1 text-left text-xs font-semibold">Kode Nota</th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Tanggal</th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Customer</th>
                <th className="px-2 py-1 text-right text-xs font-semibold">Nominal</th>
                <th className="px-2 py-1 text-center text-xs font-semibold">Status</th>
                <th className="px-2 py-1 text-center text-xs font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-xs text-slate-500">Memuat data...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-xs text-slate-500">Belum ada data</td></tr>
              ) : (
                rows.map((r) => {
                  const isVoided = r.void === 1
                  return (
                    <tr key={r.id} className={`border-b border-slate-200 hover:bg-slate-50 ${isVoided ? 'bg-pink-50' : ''}`}>
                      <td className={`px-2 py-1 text-xs font-medium ${isVoided ? 'text-slate-500' : 'text-slate-900'}`}>{r.kode_nota}</td>
                      <td className={`px-2 py-1 text-xs ${isVoided ? 'text-slate-500' : 'text-slate-600'}`}>{formatDate(r.tanggal)}</td>
                      <td className={`px-2 py-1 text-xs ${isVoided ? 'text-slate-500' : 'text-slate-600'}`}>{r.customer_name || '-'}</td>
                      <td className={`px-2 py-1 text-xs text-right font-bold ${isVoided ? 'text-slate-500' : 'text-teal-dark'}`}>{formatCurrency(r.nominal || 0)}</td>
                      <td className={`px-2 py-1 text-xs text-center`}>
                        {isVoided ? (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800">VOID</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-teal-100 text-teal-800">Aktif</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-xs text-center">
                        <div className="flex items-center justify-center gap-1">
                          <ActionIcons
                            viewHref={`/keuangan/saldo-awal-piutang/${r.id}`}
                            editHref={!isVoided ? `/keuangan/saldo-awal-piutang/${r.id}/edit` : undefined}
                            showEdit={!isVoided && Number((r as any).is_paid || 0) !== 1}
                            onVoid={!isVoided ? () => handleVoid(r.id) : undefined}
                            disabledVoid={isVoided}
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
        <div className="flex items-center justify-end gap-2 p-2 border-t border-slate-200">
          <div className="flex items-center gap-1 text-xs">
            <div className="flex items-center gap-1 mr-2">
              <span className="text-slate-600">Tampil</span>
              <div className="w-[68px]">
                <select className="input text-xs" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value) || 10); setPage(1); load(1) }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <span className="text-slate-600">per halaman</span>
            </div>
            <button className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium" onClick={() => load(1)} disabled={page <= 1}>«</button>
            <button className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium" onClick={() => load(Math.max(1, page - 1))} disabled={page <= 1}>‹</button>
            <span className="px-3 text-sm font-semibold text-slate-700">{page} / {pages}</span>
            <button className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium" onClick={() => load(Math.min(pages, page + 1))} disabled={page >= pages}>›</button>
            <button className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium" onClick={() => load(pages)} disabled={page >= pages}>»</button>
          </div>
        </div>
      </div>
    </div>
  )
}
