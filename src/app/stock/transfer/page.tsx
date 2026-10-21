"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ActionIcons from '@/components/ActionIcons'
// action icons are centralized via ActionIcons component
import { printTransferSlipById } from '@/lib/printStockSlip'
import { useRouter } from 'next/navigation'
import { showError } from '@/lib/notification'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'

type Row = {
  id: number
  number: string
  tdate: string
  from_warehouse: string | null
  to_warehouse: string | null
  notes?: string
}

export default function StockTransferListPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [working, setWorking] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<'number'|'tdate'|'from_warehouse'|'to_warehouse'|'notes'>('tdate')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [current, setCurrent] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [canCreate, setCanCreate] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [canDelete, setCanDelete] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const url = new URL('/api/stock-transfers', location.origin)
        if (q) url.searchParams.set('q', q)
        if (startDate) url.searchParams.set('start', startDate)
        if (endDate) url.searchParams.set('end', endDate)
        url.searchParams.set('t', String(Date.now()))
        const res = await fetch(url.toString(), { cache: 'no-store' })
        if (!res.ok) {
          const err = await res.json().catch(()=>({}))
          showError(err?.error || 'Gagal memuat data transfer')
          setRows([]); return
        }
        const json = await res.json()
        const list = Array.isArray(json?.rows) ? json.rows : (Array.isArray(json) ? json : [])
        setRows(list)
      } catch (err) {
        showError('Gagal memuat data transfer: ' + String(err))
        setRows([])
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
        const p = perms.find((x:any)=> String(x.menu_code || '').toLowerCase().trim() === 'stock_transfer') as any | undefined
        setCanCreate(Number(p?.can_create) === 1)
        setCanEdit(Number(p?.can_edit) === 1)
        setCanDelete(Number(p?.can_delete) === 1)
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
    // Reset to page 1 when filters change
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
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Transfer Stok</h1>
          <p className="text-xs md:text-sm text-slate-600 mt-1">Riwayat transfer stok antar gudang</p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <button
              onClick={async () => {
                const today = new Date().toLocaleDateString('en-CA')
                const ok = await ensurePeriodForDateOrToast(today)
                if (!ok) return
                router.push('/stock/transfer/new')
              }}
              className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm"
            >
              + Transfer Baru
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Transfer</div>
          <div className="text-lg font-bold text-slate-800">{rows.length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Bulan Ini</div>
          <div className="text-sm font-bold text-teal-primary">{rows.filter(r => r.tdate?.startsWith(new Date().toLocaleDateString('en-CA').slice(0, 7))).length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Hari Ini</div>
          <div className="text-sm font-bold text-green-600">{rows.filter(r => r.tdate === new Date().toLocaleDateString('en-CA')).length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Void</div>
          <div className="text-lg font-bold text-red-600">{rows.filter(r => Number((r as any).void || 0) === 1).length}</div>
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
      {/* Table */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
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
                <button onClick={()=>toggleSort('from_warehouse')} className="inline-flex items-center gap-1">
                  <span>Gudang Asal</span>
                  <span className="text-[10px]">{sortKey==='from_warehouse' ? (sortDir==='asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th className="px-2 py-1 text-left text-xs font-semibold">
                <button onClick={()=>toggleSort('to_warehouse')} className="inline-flex items-center gap-1">
                  <span>Gudang Tujuan</span>
                  <span className="text-[10px]">{sortKey==='to_warehouse' ? (sortDir==='asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th className="px-2 py-1 text-left text-xs font-semibold">
                <button onClick={()=>toggleSort('notes')} className="inline-flex items-center gap-1">
                  <span>Keterangan</span>
                  <span className="text-[10px]">{sortKey==='notes' ? (sortDir==='asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
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
                <td className="px-2 py-1 text-xs text-teal-primary font-semibold">
                  <div className="flex items-center gap-2">
                    <span>{r.number}</span>
                    {Number((r as any).void || 0) === 1 && (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded bg-rose-100 text-rose-700 border border-rose-200">VOID</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-1 text-xs">{String(r.tdate).slice(0,10)}</td>
                <td className="px-2 py-1 text-xs">{r.from_warehouse || '-'}</td>
                <td className="px-2 py-1 text-xs">{r.to_warehouse || '-'}</td>
                <td className="px-2 py-1 text-xs">{r.notes || '-'}</td>
                <td className="px-2 py-1 text-xs text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <ActionIcons
                      viewHref={`/stock/transfer/${r.id}`}
                      editHref={canEdit ? `/stock/transfer/${r.id}/edit` : undefined}
                      showEdit={canEdit && Number((r as any).void || 0) !== 1}
                      disabledVoid={!canDelete || Number((r as any).void || 0) === 1 || working===r.id}
                      onVoid={canDelete ? async()=>{
                        if(!confirm('Void dokumen ini? Operasi ini tidak dapat dibatalkan.')) return
                        try{
                          setWorking(r.id)
                          const res = await fetch(`/api/stock-transfers/${r.id}/void`, { method: 'POST' })
                          const data = await res.json().catch(()=>({}))
                          if(!res.ok){ alert(data?.error||'Gagal void'); return }
                          location.reload()
                        }finally{ setWorking(null) }
                      } : undefined}
                      onPrint={() => printTransferSlipById(r.id)}
                      titlePrint="Cetak slip transfer stok"
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
    </div>
  )
}
