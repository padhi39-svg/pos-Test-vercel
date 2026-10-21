"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ActionIcons from '@/components/ActionIcons'
import PrintIcon from '@/components/icons/PrintIcon'
import { printUsageSlipById } from '@/lib/printStockSlip'
import { useRouter } from 'next/navigation'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'

type Row = {
  id: number
  number: string
  tdate: string
  warehouse?: string
  warehouse_id?: number
  notes?: string
  void?: number
}

export default function StockUsageListPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [working, setWorking] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<'number'|'tdate'|'warehouse'|'notes'>('tdate')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [current, setCurrent] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [canCreate, setCanCreate] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [canDelete, setCanDelete] = useState(false)
  const [canPrint, setCanPrint] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalRow, setModalRow] = useState<Row | null>(null)
  const [modalAction, setModalAction] = useState<'approve'|'unapprove'>('approve')
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const url = new URL('/api/stock-usage', location.origin)
        if (q) url.searchParams.set('q', q)
        if (startDate) url.searchParams.set('start', startDate)
        if (endDate) url.searchParams.set('end', endDate)
        url.searchParams.set('t', String(Date.now()))
        const res = await fetch(url.toString(), { cache: 'no-store' })
        const json = await res.json()
        const list = Array.isArray(json?.rows) ? json.rows : (Array.isArray(json) ? json : [])
        setRows(list)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [q, startDate, endDate])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = await res.json().catch(()=>({}))
        const perms = Array.isArray(data?.user?.permissions) ? data.user.permissions as any[] : []
        const p = perms.find((x:any)=> String(x.menu_code || '').toLowerCase().trim() === 'stock_usage') as any | undefined
        setCanCreate(Number(p?.can_create) === 1)
        setCanEdit(Number(p?.can_edit) === 1)
        setCanDelete(Number(p?.can_delete) === 1)
        // Belum ada kolom can_print, sementara map ke can_edit
        setCanPrint(Number(p?.can_edit) === 1)
      } catch {}
    })()
  }, [])

  const sortedRows = useMemo(() => {
    const arr = [...rows]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a:any, b:any) => {
      const ak = (a?.[sortKey] ?? '')
      const bk = (b?.[sortKey] ?? '')
      if (sortKey === 'tdate') {
        const ad = new Date(String(ak)).getTime() || 0
        const bd = new Date(String(bk)).getTime() || 0
        return ad === bd ? 0 : ad < bd ? -dir : dir
      }
      const sa = String(ak).toLowerCase()
      const sb = String(bk).toLowerCase()
      if (sa === sb) return 0
      return sa < sb ? -dir : dir
    })
    return arr
  }, [rows, sortKey, sortDir])

  const total = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (current - 1) * pageSize
  const pageRows = useMemo(() => sortedRows.slice(start, start + pageSize), [sortedRows, start, pageSize])

  useEffect(() => {
    setCurrent(1)
  }, [q, startDate, endDate, sortKey, sortDir, pageSize])

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Pemakaian Stok</h1>
          <p className="text-xs md:text-sm text-slate-600 mt-1">Riwayat pemakaian stok dari gudang</p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <button
              onClick={async () => {
                const today = new Date().toLocaleDateString('en-CA')
                const ok = await ensurePeriodForDateOrToast(today)
                if (!ok) return
                router.push('/stock/usage/new')
              }}
              className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm"
            >
              + Pemakaian Baru
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Pemakaian</div>
          <div className="text-lg font-bold text-slate-800">{rows.length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Draft</div>
          <div className="text-sm font-bold text-yellow-600">{rows.filter((r:any) => r.status === 'draft' && Number(r.void||0) !== 1).length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Approved</div>
          <div className="text-sm font-bold text-green-600">{rows.filter((r:any) => r.status === 'approved' && Number(r.void||0) !== 1).length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Void</div>
          <div className="text-lg font-bold text-red-600">{rows.filter((r:any) => Number(r.void||0) === 1).length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Cari</label>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari nomor/gudang/keterangan..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Tanggal Awal</label>
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Tanggal Akhir</label>
            <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Tampil</label>
            <select value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setCurrent(1) }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setQ(''); setStartDate(''); setEndDate(''); setCurrent(1) }} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-4 rounded-pill text-xs h-8 font-medium transition-colors">Reset</button>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-teal-primary text-white">
            <tr>
              <th className="px-2 py-1 text-left text-xs font-semibold">
                <button onClick={()=>toggleSort('number')} className="inline-flex items-center gap-1">
                  <span>Kode Nota</span>
                  <span className="text-[10px]">{sortKey==='number' ? (sortDir==='asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th className="px-2 py-1 text-left text-xs font-semibold">
                <button onClick={()=>toggleSort('tdate')} className="inline-flex items-center gap-1">
                  <span>Tanggal</span>
                  <span className="text-[10px]">{sortKey==='tdate' ? (sortDir==='asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th className="px-2 py-1 text-left text-xs font-semibold">
                <button onClick={()=>toggleSort('warehouse')} className="inline-flex items-center gap-1">
                  <span>Gudang</span>
                  <span className="text-[10px]">{sortKey==='warehouse' ? (sortDir==='asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th className="px-2 py-1 text-left text-xs font-semibold">
                <button onClick={()=>toggleSort('notes')} className="inline-flex items-center gap-1">
                  <span>Keterangan</span>
                  <span className="text-[10px]">{sortKey==='notes' ? (sortDir==='asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th className="px-2 py-1 text-center text-xs font-semibold">Status</th>
              <th className="px-2 py-1 text-right text-xs font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-2 py-3 text-center text-slate-500 text-xs">Memuat...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-3 text-center text-slate-500 text-xs">Belum ada data</td></tr>
            )}
            {!loading && pageRows.map((r)=> (
              <tr key={r.id} className={`border-t hover:bg-slate-50 ${Number((r as any).void || 0) === 1 ? 'bg-pink-50' : ''}`}>
                <td className="px-2 py-1 text-xs text-teal-primary font-semibold">{r.number}</td>
                <td className="px-2 py-1 text-xs">{String(r.tdate).slice(0,10)}</td>
                <td className="px-2 py-1 text-xs">{r.warehouse || '-'}</td>
                <td className="px-2 py-1 text-xs">{r.notes || '-'}</td>
                <td className="px-2 py-1 text-xs text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${Number((r as any).void || 0) === 1 ? 'bg-red-100 text-red-700' : ((r as any).status==='approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}`}>
                    {Number((r as any).void || 0) === 1 ? 'Void' : ((r as any).status==='approved' ? 'Approved' : 'Draft')}
                  </span>
                </td>
                <td className="px-2 py-1 text-xs text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      title={(r as any).status==='approved' ? 'Unapprove' : 'Approve'}
                      onClick={()=>{
                        if (Number((r as any).void || 0) === 1) return
                        setModalRow(r)
                        setModalAction((r as any).status==='approved' ? 'unapprove' : 'approve')
                        setModalOpen(true)
                      }}
                      className={`h-6 w-6 grid place-items-center rounded border ${((r as any).status==='approved') ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-slate-300 text-slate-600'} hover:bg-slate-100`}
                    >
                      {((r as any).status==='approved') ? '✓' : ''}
                    </button>
                    <ActionIcons
                      viewHref={`/stock/usage/${r.id}`}
                      editHref={canEdit ? `/stock/usage/${r.id}/edit` : undefined}
                      showEdit={canEdit && Number((r as any).void || 0) !== 1}
                      disabledVoid={!canDelete || Number((r as any).void || 0) === 1 || working===r.id}
                      onVoid={canDelete ? async()=>{
                        if(!confirm('Void dokumen ini? Operasi ini tidak dapat dibatalkan.')) return
                        try{
                          setWorking(r.id)
                          const res = await fetch(`/api/stock-usage/${r.id}/void`, { method: 'POST' })
                          const data = await res.json().catch(()=>({}))
                          if(!res.ok){ alert(data?.error||'Gagal void'); return }
                          location.reload()
                        }finally{ setWorking(null) }
                      } : undefined}
                    />
                    {canPrint && (
                      <button
                        type="button"
                        onClick={() => printUsageSlipById(r.id)}
                        className="p-1.5 rounded-pill border border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        title="Cetak slip pemakaian stok"
                      >
                        <PrintIcon />
                      </button>
                    )}
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
        {!loading && pageRows.map((r)=> (
          <div key={r.id} className={`bg-white rounded-xl border border-slate-200 p-3 ${Number((r as any).void || 0) === 1 ? 'bg-pink-50' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-teal-primary">{r.number}</div>
                <div className="text-[11px] text-slate-600">{String(r.tdate).slice(0,10)} • {r.warehouse || '-'}</div>
              </div>
              <span className={`h-6 px-2 rounded text-[11px] font-medium inline-flex items-center ${Number((r as any).void || 0) === 1 ? 'bg-red-100 text-red-700' : ((r as any).status==='approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}`}>
                {Number((r as any).void || 0) === 1 ? 'Void' : ((r as any).status==='approved' ? 'Approved' : 'Draft')}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-700">{r.notes || '-'}</div>
            <div className="mt-3 flex items-center justify-end gap-1.5">
              <button
                type="button"
                title={(r as any).status==='approved' ? 'Unapprove' : 'Approve'}
                onClick={()=>{
                  if (Number((r as any).void || 0) === 1) return
                  setModalRow(r)
                  setModalAction((r as any).status==='approved' ? 'unapprove' : 'approve')
                  setModalOpen(true)
                }}
                className={`h-7 w-7 grid place-items-center rounded border ${((r as any).status==='approved') ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-slate-300 text-slate-600'} hover:bg-slate-100`}
              >
                {((r as any).status==='approved') ? '✓' : ''}
              </button>
              <Link href={`/stock/usage/${r.id}`} className="px-2 py-1 rounded border text-[11px]">Lihat</Link>
              {canEdit && Number((r as any).void || 0) !== 1 && (
                <Link href={`/stock/usage/${r.id}/edit`} className="px-2 py-1 rounded border text-[11px]">Edit</Link>
              )}
              {canDelete && Number((r as any).void || 0) !== 1 && (
                <button
                  className="px-2 py-1 rounded border text-[11px]"
                  onClick={async()=>{
                    if(!confirm('Void dokumen ini? Operasi ini tidak dapat dibatalkan.')) return
                    try{
                      setWorking(r.id)
                      const res = await fetch(`/api/stock-usage/${r.id}/void`, { method: 'POST' })
                      const data = await res.json().catch(()=>({}))
                      if(!res.ok){ alert(data?.error||'Gagal void'); return }
                      location.reload()
                    }finally{ setWorking(null) }
                  }}
                >Void</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Konfirmasi Approve/Unapprove */}
      {modalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => !modalLoading && setModalOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <div className="w-full max-w-sm bg-white rounded-lg shadow-xl border border-slate-200">
              <div className="px-4 py-3 border-b border-slate-200">
                <div className="text-sm font-semibold text-slate-800">Konfirmasi</div>
              </div>
              <div className="px-4 py-3 text-sm text-slate-700">
                {modalAction==='approve' ? 'Pemakaian stok akan di-approve dan stok akan dipotong. Lanjutkan?' : 'Pemakaian stok akan di-unapprove dan stok dikembalikan. Lanjutkan?'}
              </div>
              <div className="px-4 py-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button disabled={modalLoading} onClick={()=> setModalOpen(false)} className="px-3 py-2 rounded-pill border text-sm disabled:opacity-50">Batal</button>
                <button
                  disabled={modalLoading}
                  onClick={async()=>{
                    if (!modalRow) return
                    try{
                      setModalLoading(true)
                      const nextStatus = modalAction==='approve' ? 'approved' : 'draft'
                      const res = await fetch(`/api/stock-usage/${modalRow.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: nextStatus }) })
                      const data = await res.json().catch(()=>({}))
                      if (!res.ok) throw new Error(data?.error || 'Gagal mengubah status')
                      setModalOpen(false)
                      // refresh list
                      const url = new URL('/api/stock-usage', location.origin)
                      if (q) url.searchParams.set('q', q)
                      if (startDate) url.searchParams.set('start', startDate)
                      if (endDate) url.searchParams.set('end', endDate)
                      url.searchParams.set('t', String(Date.now()))
                      const r = await fetch(url.toString(), { cache: 'no-store' })
                      const json = await r.json()
                      const list = Array.isArray(json?.rows) ? json.rows : (Array.isArray(json) ? json : [])
                      setRows(list)
                    }catch(e:any){
                      alert(e?.message || 'Gagal mengubah status')
                    } finally {
                      setModalLoading(false)
                    }
                  }}
                  className={`px-3 py-2 rounded text-sm text-white ${modalAction==='approve' ? 'bg-teal-primary hover:bg-teal-dark' : 'bg-gold-primary hover:bg-gold-dark'} disabled:opacity-50`}
                >
                  {modalAction==='approve' ? 'Ya, Approve' : 'Ya, Unapprove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
