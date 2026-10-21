"use client"

import { useEffect, useMemo, useState } from 'react'
import { showError } from '@/lib/notification'
import ActionIcons from '@/components/ActionIcons'
import { useRouter } from 'next/navigation'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'

// Tipe baris untuk SO (bukan draft)
type Row = {
  id: number
  number: string
  tdate: string
  warehouse_id: number
  notes?: string | null
  approved?: number | null // 0/1
  void?: number | null
}

type Warehouse = { id: number; name: string }

export default function StockOpnameListPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState('')
  const [wh, setWh] = useState('')
  const [approved, setApproved] = useState('') // '', '0', '1'
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  async function reloadList(){
    try {
      const url = new URL(location.origin + '/api/so')
      if (query.trim()) url.searchParams.set('q', query.trim())
      if (wh) url.searchParams.set('warehouse_id', wh)
      if (approved) url.searchParams.set('approved', approved)
      const [res, gw] = await Promise.all([
        fetch(url.toString()),
        fetch('/api/gudang'),
      ])
      const data = res.ok ? await res.json() : { rows: [] }
      const dw = gw.ok ? await gw.json() : []
      setRows(Array.isArray(data?.rows) ? data.rows : [])
      setWarehouses(Array.isArray(dw) ? dw.map((x:any)=>({ id:x.id, name: x.name||x.nama||x.code })) : [])
    } catch(e){
      console.error(e)
    }
  }

  function canEdit(r: Row): boolean {
    try {
      if ((r as any).void === 1) return false
      if (String(r.status) === 'approved' || String(r.status) === 'posted') return false
      // short-circuit when current user has edit permission at level (e.g., manager)
      if (canEditAll) return true
      if (userRole === 'manager') return true
      const ids = JSON.parse(String((r as any).assignees || '[]'))
      if (!Array.isArray(ids) || ids.length === 0) return false
      if (userId == null) return false
      return ids.map((x:any)=>Number(x)).includes(Number(userId))
    } catch { return false }
  }

  function canDelete(r: Row): boolean {
    // hanya manager, dan hanya jika belum approved/posted
    if (userRole !== 'manager') return false
    const st = String(r.status)
    return st==='draft' || st==='counting' || st==='submitted'
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await reloadList()
        // load users map for assignee names
        try {
          const ru = await fetch('/api/users?q=')
          if (ru.ok) {
            const du = await ru.json()
            if (Array.isArray(du)) {
              const m: Record<number,string> = {}
              du.forEach((u:any)=>{ if (u?.id) m[Number(u.id)] = u.name || u.fullName || u.code || `User #${u.id}` })
              setUserMap(m)
            }
          }
        } catch {}
        // load current user
        try {
          const mu = await fetch('/api/auth/me', { cache: 'no-store' })
          const du = mu.ok ? await mu.json() : null
          if (du?.user?.name) setUserName(String(du.user.name))
          if (du?.user?.id) setUserId(Number(du.user.id))
          if (du?.user?.role) setUserRole(String(du.user.role))
          // Derive edit capability from permissions if provided
          try {
            const perms = Array.isArray(du?.user?.permissions) ? du.user.permissions : []
            const hasEdit = perms.some((p:any)=> Number(p?.can_edit) === 1)
            if (hasEdit) setCanEditAll(true)
          } catch {}
        } catch {}
      } catch (e) {
        console.error(e)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter(r => {
      if (wh && Number(r.warehouse_id)!==Number(wh)) return false
      if (approved && Number(r.approved)!==Number(approved)) return false
      if (q && !(`${r.number||''} ${r.notes||''}`).toLowerCase().includes(q)) return false
      return true
    })
    // Reset page jika filter berubah agar tetap di halaman 1
    setPage(1)
    return list
  }, [rows, query, wh, approved])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const startIdx = (page - 1) * pageSize
  const endIdx = Math.min(total, startIdx + pageSize)
  const paged = filtered.slice(startIdx, endIdx)

  function canCount(r: Row): boolean {
    try {
      const st = String(r.status || '').toLowerCase()
      if ((r as any).void === 1) return false
      if (st === 'posted' || st === 'approved' || st === 'void') return false
      // parse assignees from row (stringified JSON or array)
      const raw = (r as any).assignees ?? '[]'
      const parsed = Array.isArray(raw) ? raw : JSON.parse(String(raw || '[]'))
      const ids = Array.isArray(parsed) ? parsed.map((x:any)=>Number(x)).filter((n:number)=>Number.isFinite(n)) : []
      if (!ids.length) return false
      if (userRole === 'manager') return true
      if (userId == null) return false
      return ids.includes(Number(userId))
    } catch { return false }
  }

  function quickCountMobile(opnameId: number) {
    window.location.href = `/m/opname/by-id/${opnameId}`
  }

  // Helper nama gudang
  function whNameById(id: number): string {
    const w = warehouses.find(x=> Number(x.id)===Number(id))
    return w?.name || `#${id}`
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Stok Opname</h1>
          <p className="text-xs md:text-sm text-slate-600 mt-1">Daftar dokumen stok opname.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const today = new Date().toLocaleDateString('en-CA')
              const ok = await ensurePeriodForDateOrToast(today)
              if (!ok) return
              router.push('/stock/opname/new')
            }}
            className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm"
          >
            + SO Baru
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Dokumen</div>
          <div className="text-lg font-bold text-slate-800">{rows.length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Approved</div>
          <div className="text-sm font-bold text-green-600">{rows.filter(r => Number(r.approved) === 1 && (r as any).void !== 1).length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Belum Approve</div>
          <div className="text-sm font-bold text-yellow-600">{rows.filter(r => Number(r.approved) !== 1 && (r as any).void !== 1).length}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Void</div>
          <div className="text-lg font-bold text-red-600">{rows.filter(r => (r as any).void === 1).length}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Cari</label>
            <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" placeholder="Cari no/notes..." value={query} onChange={e=>setQuery(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Gudang</label>
            <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" value={wh} onChange={e=>setWh(e.target.value)}>
              <option value="">Semua Gudang</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Approved</label>
            <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" value={approved} onChange={e=>setApproved(e.target.value)}>
              <option value="">Semua</option>
              <option value="0">Belum Approve</option>
              <option value="1">Sudah Approve</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Tampil</label>
            <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" value={pageSize} onChange={e=>{ setPage(1); setPageSize(Number(e.target.value)||10) }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={reloadList} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-4 rounded-pill text-xs h-8 font-medium transition-colors">Refresh</button>
          </div>
        </div>
      </div>

      {/* Mobile: daftar sebagai kartu, tanpa scroll horizontal */}
      <div className="md:hidden space-y-2">
        {loading && (<div className="text-center text-slate-500 text-xs py-6">Memuat...</div>)}
        {!loading && filtered.length===0 && (<div className="text-center text-slate-500 text-xs py-6">Tidak ada data</div>)}
        {paged.map(r => (
          <div key={r.id} className="bg-white border rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[12px] text-slate-500">No Dokumen</div>
                <div className="text-sm font-semibold text-slate-800">{r.number}</div>
              </div>
              {(r as any).void===1 && (
                <span className="inline-block ml-2 px-2 py-0.5 rounded text-[11px] bg-red-100 text-red-700" title="Dokumen sudah di-void">void</span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-slate-600">
              <div>Tanggal: <span className="text-slate-800 font-medium">{r.tdate}</span></div>
              <div>Gudang: <span className="text-slate-800 font-medium">{whNameById(r.warehouse_id)}</span></div>
              <div className="col-span-2 flex items-center gap-2">Approved: <input type="checkbox" disabled readOnly checked={Number(r.approved)===1} /></div>
              <div className="col-span-2">Catatan: <span className="text-slate-800">{r.notes||'-'}</span></div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <ActionIcons
                viewHref={`/stock/opname/${r.id}?mode=view`}
                showEdit={true}
                disabledEdit={false}
                editHref={`/stock/opname/${r.id}`}
                onVoid={async ()=>{}}
                forceShowVoid={true}
                disabledVoid={false}
                titleView="Lihat"
                titleEdit="Edit"
                titleVoid="Void Dokumen"
              />
            </div>
          </div>
        ))}
        {/* Pagination (mobile) */}
        <div className="flex items-center justify-between text-[12px] text-slate-600">
          <div>Menampilkan {total===0? 0 : (startIdx+1)}–{endIdx} dari {total}</div>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 rounded-pill border disabled:opacity-50" disabled={page<=1} onClick={()=>setPage(1)}>«</button>
            <button className="px-2 py-1 rounded-pill border disabled:opacity-50" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>‹</button>
            <span className="px-2">{page} / {totalPages}</span>
            <button className="px-2 py-1 rounded-pill border disabled:opacity-50" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>›</button>
            <button className="px-2 py-1 rounded-pill border disabled:opacity-50" disabled={page>=totalPages} onClick={()=>setPage(totalPages)}>»</button>
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-teal-primary text-white">
                <th className="px-2 py-2 text-left">No Dokumen</th>
                <th className="px-2 py-2 text-left">Tanggal</th>
                <th className="px-2 py-2 text-left">Gudang</th>
                <th className="px-2 py-2 text-left">Approved</th>
                <th className="px-2 py-2 text-left">Catatan</th>
                <th className="px-2 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-slate-500">Memuat...</td></tr>
              )}
              {!loading && total===0 && (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-slate-500">Tidak ada data</td></tr>
              )}
              {paged.map(r => (
                <tr key={r.id} className="border-t hover:bg-slate-50">
                  <td className="px-2 py-1 font-semibold text-slate-800">{r.number}</td>
                  <td className="px-2 py-1">{r.tdate}</td>
                  <td className="px-2 py-1">{whNameById(r.warehouse_id)}</td>
                  <td className="px-2 py-1"><input type="checkbox" disabled readOnly checked={Number(r.approved)===1} /></td>
                  <td className="px-2 py-1">{r.notes||'-'}</td>
                  <td className="px-2 py-1 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ActionIcons
                        viewHref={`/stock/opname/${r.id}?mode=view`}
                        showEdit={true}
                        disabledEdit={false}
                        editHref={`/stock/opname/${r.id}`}
                        onVoid={async ()=>{}}
                        forceShowVoid={true}
                        disabledVoid={(r as any).void===1}
                        titleView="Lihat"
                        titleEdit="Edit"
                        titleVoid={(r as any).void===1? 'Dokumen sudah void' : 'Void Dokumen'}
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
              : `Menampilkan ${Math.min(total, startIdx + 1)}–${Math.min(total, endIdx)} dari ${total}`}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button disabled={page <= 1} onClick={() => setPage(1)} className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs">«</button>
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs">‹</button>
            <span className="px-2 text-xs">{page} / {totalPages || 1}</span>
            <button disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs">›</button>
            <button disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(totalPages || 1)} className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs">»</button>
          </div>
        </div>
      </div>

      {/* Floating action button untuk mobile */}
      <button
        onClick={async () => {
          const today = new Date().toLocaleDateString('en-CA')
          const ok = await ensurePeriodForDateOrToast(today)
          if (!ok) return
          window.location.href = "/stock/draftopname/new"
        }}
        className="md:hidden fixed bottom-16 right-4 px-4 py-3 rounded-full shadow-lg bg-teal-primary hover:bg-teal-dark text-white text-sm"
      >
        + Draft Baru
      </button>
    </div>
  )
}
