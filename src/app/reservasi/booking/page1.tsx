"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import Input from '@/components/ui/Input'
import { useSort } from '@/lib/useSort'
import SortIcon from '@/components/ui/SortIcon'

export default function BookingListPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [appliedStart, setAppliedStart] = useState<string>('')
  const [appliedEnd, setAppliedEnd] = useState<string>('')
  const [layoutDate, setLayoutDate] = useState<string>(() => new Date().toISOString().slice(0,10))
  const [status, setStatus] = useState<string>('')
  const [q, setQ] = useState('')
  const [pageSize, setPageSize] = useState<number>(20)
  const [page, setPage] = useState<number>(1)
  const [view, setView] = useState<'list'|'cards'|'layout'>('layout')
  const [floors, setFloors] = useState<any[]>([])
  const [tables, setTables] = useState<any[]>([])
  const [canCreate, setCanCreate] = useState<boolean>(false)
  const [canEdit, setCanEdit] = useState<boolean>(false)
  const [canConfirmCancel, setCanConfirmCancel] = useState<boolean>(false)

  const load = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      const res = await fetch(`/api/reservations?${params.toString()}`)
      const data = res.ok ? await res.json() : { rows: [] }
      const all = Array.isArray(data?.rows) ? data.rows : []
      setRows(all)
    } catch (e) {
      console.error('Load reservations failed', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const parsePreorder = (notes?: string): Array<{id?:number; code?:string; name?:string}> => {
    if (!notes) return []
    const lines = String(notes).split(/\r?\n/)
    const line = lines.find(l => l.trim().toUpperCase().startsWith('PREORDER:'))
    if (!line) return []
    const jsonPart = line.substring(line.indexOf(':')+1).trim()
    try {
      const arr = JSON.parse(jsonPart)
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  }

  const handlePrint = async (row: any) => {
    // Buka jendela kosong SESUAI klik user terlebih dahulu untuk menghindari popup blocker
    const win = typeof window !== 'undefined' ? window.open('', '_blank', 'width=800,height=600') : null
    if (!win) {
      alert('Popup untuk cetak diblokir browser. Izinkan popup untuk melanjutkan.')
      return
    }

    try {
      const res = await fetch(`/api/reservations/${row.id}`)
      if (!res.ok) {
        const err = await res.json().catch(()=>({}))
        alert(err?.error || 'Gagal mengambil data reservasi')
        return
      }
      const detail = await res.json().catch(()=>null) as any
      if (!detail) return
      const tablesForPrint = Array.isArray(detail.tables)
        ? detail.tables.map((t:any)=> ({ code: String(t.code||''), name: String(t.name||'') }))
        : []
      const selectedMenus = parsePreorder(detail.notes)
      const html = printReservationA5({
        number: detail.number,
        date: detail.date,
        startTime: detail.start_time,
        endTime: detail.end_time,
        pax: Number(detail.pax||0),
        customerName: detail.customer_name || '',
        phone: detail.phone || '',
        dpAmount: detail.dp_amount != null ? String(detail.dp_amount) : '',
        dpPaid: !!detail.dp_paid,
        notes: detail.notes || '',
        tables: tablesForPrint,
        selectedMenus,
      })

      win.document.open()
      win.document.write(html)
      win.document.close()
    } catch (e) {
      alert('Gagal membuka nota reservasi untuk cetak')
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = await res.json().catch(()=>({}))
        const perms = Array.isArray(data?.user?.permissions) ? data.user.permissions as any[] : []
        const p = perms.find((x:any)=> String(x.menu_code || '').toLowerCase().trim() === 'reservasi_booking') as any | undefined
        setCanCreate(Number(p?.can_create) === 1)
        setCanEdit(Number(p?.can_edit) === 1)
        setCanConfirmCancel(Number(p?.can_delete) === 1)
      } catch {}
    })()
  }, [])
  useEffect(() => { load() }, [status])

  useEffect(() => {
    const loadMaster = async () => {
      try {
        const [rf, rt] = await Promise.all([
          fetch('/api/floors'),
          fetch('/api/meja?active=1'),
        ])
        const f = rf.ok ? await rf.json() : []
        const t = rt.ok ? await rt.json() : []
        setFloors(Array.isArray(f) ? f : [])
        setTables(Array.isArray(t) ? t : [])
      } catch {}
    }
    if (view === 'layout' && (floors.length === 0 || tables.length === 0)) loadMaster()
  }, [view])

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    const bySearch = rows.filter((r) => !s || `${r.number} ${r.customer_name||''} ${r.phone||''} ${r.table_codes||''}`.toLowerCase().includes(s))
    const today = new Date().toISOString().slice(0,10)
    const inRange = bySearch.filter((r:any) => {
      const d = String(r.date)
      if (!appliedStart && !appliedEnd) return d >= today
      const afterStart = appliedStart ? d >= appliedStart : true
      const beforeEnd = appliedEnd ? d <= appliedEnd : true
      return afterStart && beforeEnd
    })
    // tambahkan field bantu gabungan tanggal + jam mulai untuk sort default yang stabil
    return inRange.map((r:any) => ({
      ...r,
      date_start: `${String(r.date)} ${String(r.start_time || '')}`,
    }))
  }, [rows, q, appliedStart, appliedEnd])

  // default sort: tanggal lalu jam mulai (asc)
  const { sorted, sortKey, sortOrder, toggleSort } = useSort<any>(filtered, 'date_start', 'asc')
  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paged = sorted.slice(startIndex, endIndex)
  useEffect(() => { setPage(1) }, [q, pageSize, appliedStart, appliedEnd, status])

  const allowedActions = (st: string): Array<{key:string; label:string; color:string}> => {
    const actions: Array<{key:string; label:string; color:string}> = []
    if (st === 'pending') actions.push({ key:'confirm', label:'Confirm', color:'bg-blue-600 hover:bg-blue-700' })
    if (st === 'pending' || st === 'confirmed') actions.push({ key:'cancel', label:'Cancel', color:'bg-red-600 hover:bg-red-700' })
    return actions
  }

  const onAction = async (id: number, action: string) => {
    try {
      const ok = confirm(`Lanjutkan aksi "${action}" untuk booking ini?`)
      if (!ok) return
      const res = await fetch(`/api/reservations/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      if (!res.ok) {
        const err = await res.json().catch(()=>({}))
        alert(err?.error || 'Aksi gagal dijalankan')
        return
      }
      await res.json().catch(()=>null)
      load()
    } catch (e) {
      alert('Aksi gagal dijalankan')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900">Booking Meja</h1>
          <p className="text-slate-500 text-xs mt-1">Kelola reservasi meja per tanggal</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center rounded-full bg-slate-100 border border-slate-200 text-xs p-0.5 shadow-sm">
            <button
              className={`px-3 py-1.5 rounded-full transition-colors ${view==='list'?'bg-white text-slate-900 shadow-sm':'text-slate-600 hover:text-slate-900'}`}
              onClick={()=> setView('list')}
            >
              List
            </button>
            <button
              className={`px-3 py-1.5 rounded-full transition-colors ${view==='cards'?'bg-white text-slate-900 shadow-sm':'text-slate-600 hover:text-slate-900'}`}
              onClick={()=> setView('cards')}
            >
              Kartu
            </button>
            <button
              className={`px-3 py-1.5 rounded-full transition-colors ${view==='layout'?'bg-white text-slate-900 shadow-sm':'text-slate-600 hover:text-slate-900'}`}
              onClick={()=> setView('layout')}
            >
              Layout Meja
            </button>
          </div>
          {canCreate && (
            <Link
              href="/reservasi/booking/new"
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs shadow-sm"
            >
              Tambah
            </Link>
          )}
        </div>
      </div>

      <div className="container-card p-2 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {view !== 'layout' ? (
            <>
              <input type="date" className="border rounded px-2 py-1 text-xs" value={startDate} onChange={e=> setStartDate(e.target.value)} />
              <span className="text-slate-500 text-xs">s/d</span>
              <input type="date" className="border rounded px-2 py-1 text-xs" value={endDate} onChange={e=> setEndDate(e.target.value)} />
              <button
                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs"
                onClick={()=> { setAppliedStart(startDate); setAppliedEnd(endDate) }}
              >Terapkan</button>
              <button
                className="px-2 py-1 rounded border text-xs"
                onClick={()=> { setStartDate(''); setEndDate(''); setAppliedStart(''); setAppliedEnd('') }}
              >Bersihkan</button>
            </>
          ) : (
            <input type="date" className="border rounded px-2 py-1 text-xs" value={layoutDate} onChange={e=> setLayoutDate(e.target.value)} />
          )}
          <select className="border rounded px-2 py-1 text-xs" value={status} onChange={e=> setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            {['pending','confirmed','seated','completed','canceled','no_show'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="w-[280px]">
            <Input placeholder="Cari nomor/nama/telp/meja..." value={q} onChange={e=> setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-xs ml-auto">
            <span className="text-slate-600">Tampil</span>
            <select
              className="border border-slate-300 rounded px-2 py-1 text-xs"
              value={pageSize}
              onChange={(e)=> setPageSize(parseInt(e.target.value))}
            >
              {[20,50,100,200].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-slate-600">per halaman</span>
            <button onClick={load} className="px-3 py-1 rounded bg-slate-600 hover:bg-slate-700 text-white text-xs">Refresh</button>
          </div>
        </div>

        {loading ? (
          <div className="text-slate-500 text-sm">Memuat data...</div>
        ) : view==='list' ? (
          <ListView
            paged={paged}
            sorted={sorted}
            currentPage={currentPage}
            totalPages={totalPages}
            setPage={setPage}
            sortKey={sortKey}
            sortOrder={sortOrder}
            toggleSort={toggleSort}
            allowedActions={allowedActions}
            onAction={onAction}
            handlePrint={handlePrint}
            canEdit={canEdit}
            canConfirmCancel={canConfirmCancel}
          />
        ) : view==='cards' ? (
          <CardsView
            startDate={appliedStart}
            endDate={appliedEnd}
            reservations={sorted}
            onAction={onAction}
            allowedActions={allowedActions}
            handlePrint={handlePrint}
            canEdit={canEdit}
            canConfirmCancel={canConfirmCancel}
          />
        ) : (
          <LayoutMejaView date={layoutDate} reservations={rows} floors={floors} tables={tables} />
        )}
      </div>
    </div>
  )
}

function ListView({ paged, sorted, currentPage, totalPages, setPage, sortKey, sortOrder, toggleSort, allowedActions, onAction, handlePrint, canEdit, canConfirmCancel }: any) {
  return (
    <>
      {/* Mobile cards */}
      <div className="grid gap-2 sm:hidden">
        {sorted.length === 0 ? (
          <div className="text-slate-500">Belum ada data</div>
        ) : (
          paged.map((r: any) => (
            <div key={r.id} className="border rounded p-2">
              <div className="flex items-center justify-between">
                <Link href={`/reservasi/booking/${r.id}`} className="font-medium text-blue-600 hover:underline">{r.number}</Link>
                <span className="px-2 py-0.5 rounded text-white text-[11px]"
                  style={{backgroundColor: ({pending:'#64748b',confirmed:'#0284c7',seated:'#16a34a',completed:'#0ea5e9',canceled:'#ef4444',no_show:'#f97316'} as any)[r.status] || '#64748b'}}>
                  {r.status}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 mt-1">{r.date} • {r.start_time} - {r.end_time}</div>
              <div className="text-[11px] text-slate-600">Pax: {r.pax} • Meja: {r.table_codes || '-'}</div>
              <div className="text-[11px] text-slate-600">Cust: {r.customer_name || '-'} • Telp: {r.phone || '-'}</div>
              <div className="text-[11px] text-slate-600">DP: {r.dp_amount ? `Rp ${Number(r.dp_amount).toLocaleString('id-ID')}` : '-' }{r.dp_amount ? (r.dp_paid? ' (Terbayar)' : ' (Belum)') : ''}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {canEdit && !['confirmed','canceled'].includes(String(r.status)) && (
                  <Link href={`/reservasi/booking/${r.id}/edit`} className="text-[11px] px-2 py-1 rounded text-white bg-emerald-600 hover:bg-emerald-700">Edit</Link>
                )}
                {canConfirmCancel && allowedActions(String(r.status)).map((a: any) => (
                  <button key={a.key} onClick={()=> onAction(Number(r.id), a.key)} className={`text-[11px] px-2 py-1 rounded text-white ${a.color}`}>{a.label}</button>
                ))}
                <button
                  disabled={String(r.status)==='canceled'}
                  onClick={()=> handlePrint(r)}
                  className="text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-700 disabled:opacity-50"
                  title="Print"
                >
                  🖨️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="overflow-auto hidden sm:block">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="px-1 py-0.5">
                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('number')}>
                  Nomor <SortIcon active={sortKey === 'number'} order={sortKey === 'number' ? sortOrder : undefined} />
                </button>
              </th>
              <th className="px-1 py-0.5">
                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('date')}>
                  Tanggal <SortIcon active={sortKey === 'date'} order={sortKey === 'date' ? sortOrder : undefined} />
                </button>
              </th>
              <th className="px-1 py-0.5">
                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('start_time')}>
                  Waktu <SortIcon active={sortKey === 'start_time'} order={sortKey === 'start_time' ? sortOrder : undefined} />
                </button>
              </th>
              <th className="px-1 py-0.5">Customer</th>
              <th className="px-1 py-0.5">Telp</th>
              <th className="px-1 py-0.5">
                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('pax')}>
                  Pax <SortIcon active={sortKey === 'pax'} order={sortKey === 'pax' ? sortOrder : undefined} />
                </button>
              </th>
              <th className="px-1 py-0.5">Meja</th>
              <th className="px-1 py-0.5">DP</th>
              <th className="px-1 py-0.5">
                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('status')}>
                  Status <SortIcon active={sortKey === 'status'} order={sortKey === 'status' ? sortOrder : undefined} />
                </button>
              </th>
              <th className="px-1 py-0.5">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-1 py-3 text-center text-slate-500">Belum ada data</td>
              </tr>
            ) : (
              paged.map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="px-1 py-0.5 font-medium"><Link href={`/reservasi/booking/${r.id}`} className="text-blue-600 hover:underline">{r.number}</Link></td>
                  <td className="px-1 py-0.5">{r.date}</td>
                  <td className="px-1 py-0.5">{r.start_time} - {r.end_time}</td>
                  <td className="px-1 py-0.5">{r.customer_name || '-'}</td>
                  <td className="px-1 py-0.5">{r.phone || '-'}</td>
                  <td className="px-1 py-0.5">{r.pax}</td>
                  <td className="px-1 py-0.5">{r.table_codes || '-'}</td>
                  <td className="px-1 py-0.5">{r.dp_amount ? `Rp ${Number(r.dp_amount).toLocaleString('id-ID')}` : '-' }{r.dp_amount ? (r.dp_paid? ' (Terbayar)' : ' (Belum)') : ''}</td>
                  <td className="px-1 py-0.5">
                    <span className="px-2 py-0.5 rounded text-white text-[11px]"
                      style={{backgroundColor: ({pending:'#64748b',confirmed:'#0284c7',seated:'#16a34a',completed:'#0ea5e9',canceled:'#ef4444',no_show:'#f97316'} as any)[r.status] || '#64748b'}}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-1 py-0.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1 flex-nowrap">
                      {canEdit && !['confirmed','canceled'].includes(String(r.status)) && (
                        <Link href={`/reservasi/booking/${r.id}/edit`} className="text-[11px] px-2 py-1 rounded text-white bg-emerald-600 hover:bg-emerald-700">Edit</Link>
                      )}
                      {canConfirmCancel && allowedActions(String(r.status)).map((a: any) => (
                        <button key={a.key} onClick={()=> onAction(Number(r.id), a.key)} className={`text-[11px] px-2 py-1 rounded text-white ${a.color}`}>{a.label}</button>
                      ))}
                      <button
                        disabled={String(r.status)==='canceled'}
                        onClick={()=> handlePrint(r)}
                        className="text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-700 disabled:opacity-50"
                        title="Print"
                      >
                        🖨️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-end gap-2 p-1">
          <div className="flex items-center gap-1 text-xs">
            <button className="px-2 py-0.5 border rounded disabled:opacity-50" onClick={()=> setPage(1)} disabled={currentPage===1}>«</button>
            <button className="px-2 py-0.5 border rounded disabled:opacity-50" onClick={()=> setPage((p: number)=> Math.max(1, p-1))} disabled={currentPage===1}>‹</button>
            <span className="px-2">{currentPage} / {totalPages}</span>
            <button className="px-2 py-0.5 border rounded disabled:opacity-50" onClick={()=> setPage((p: number)=> Math.min(totalPages, p+1))} disabled={currentPage===totalPages}>›</button>
            <button className="px-2 py-0.5 border rounded disabled:opacity-50" onClick={()=> setPage(totalPages)} disabled={currentPage===totalPages}>»</button>
          </div>
        </div>
      </div>
    </>
  )
}

function CardsView({ startDate, endDate, reservations, onAction, allowedActions, handlePrint, canEdit, canConfirmCancel }: any) {
  const parsePreorder = (notes?: string): Array<{name?:string; code?:string}> => {
    if (!notes) return []
    const lines = String(notes).split(/\r?\n/)
    const line = lines.find(l => l.trim().toUpperCase().startsWith('PREORDER:'))
    if (!line) return []
    const jsonPart = line.substring(line.indexOf(':')+1).trim()
    try {
      const arr = JSON.parse(jsonPart)
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  }

  const headerColor = (s:string) => ({
    pending: 'bg-slate-600',
    confirmed: 'bg-emerald-600',
    seated: 'bg-teal-600',
    completed: 'bg-cyan-600',
    canceled: 'bg-red-600',
    no_show: 'bg-orange-600',
  } as any)[s] || 'bg-slate-600'

  const actionStyle = (key:string) => {
    if (key === 'check_in') return 'bg-rose-600 hover:bg-rose-700 text-white'
    if (key === 'confirm') return 'bg-blue-600 hover:bg-blue-700 text-white'
    if (key === 'complete') return 'bg-cyan-600 hover:bg-cyan-700 text-white'
    if (key === 'cancel') return 'border border-red-300 text-red-700 bg-white hover:bg-red-50'
    if (key === 'no_show') return 'border border-orange-300 text-orange-700 bg-white hover:bg-orange-50'
    return 'bg-slate-600 hover:bg-slate-700 text-white'
  }

  const sameDate = reservations.filter((r:any)=>{
    const d = String(r.date)
    const okStart = startDate ? d >= startDate : true
    const okEnd = endDate ? d <= endDate : true
    return okStart && okEnd
  })

  return (
    <div className="space-y-2">
      {sameDate.length === 0 ? (
        <div className="text-slate-500 text-sm">Belum ada reservasi untuk tanggal ini.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sameDate.map((r:any) => {
            const preorder = parsePreorder(r.notes)
            const menuLabel = preorder.length
              ? preorder.slice(0,3).map(m=> m.name || m.code || '').filter(Boolean).join(', ') + (preorder.length>3 ? ` +${preorder.length-3} lagi` : '')
              : null
            const color = headerColor(String(r.status))
            return (
              <div
                key={r.id}
                className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`${color} text-white px-3 py-2 text-xs`}> 
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{String(r.status).toUpperCase()}</div>
                    <div className="flex items-center gap-1">
                      <span className="bg-white/20 rounded-full px-2 py-0.5">{r.date}</span>
                      <span className="bg-white/20 rounded-full px-2 py-0.5">{r.start_time} - {r.end_time}</span>
                    </div>
                  </div>
                </div>
                <div className="p-3 text-xs flex-1">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">Nama Pemesan</div>
                      <div className="font-medium text-slate-800 truncate max-w-[60%] text-right">{r.customer_name || '-'}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">Nomor Pemesan</div>
                      <div className="font-medium text-slate-800 truncate max-w-[60%] text-right">{r.phone || '-'}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">ID Reservasi</div>
                      <div className="font-medium text-slate-800 truncate max-w-[60%] text-right">{r.number}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">Meja</div>
                      <div className="font-medium text-slate-800 truncate max-w-[60%] text-right">{r.table_codes || '-'}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">Jumlah Orang</div>
                      <div className="font-medium text-slate-800">{r.pax} Orang</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">DP</div>
                      <div className="font-medium text-slate-800">
                        {r.dp_amount ? `Rp ${Number(r.dp_amount).toLocaleString('id-ID')}` : '-'}{r.dp_amount ? (r.dp_paid ? ' (Terbayar)' : ' (Belum)') : ''}
                      </div>
                    </div>
                    {menuLabel && (
                      <div className="flex items-start justify-between">
                        <div className="text-slate-500">Pre-order</div>
                        <div className="font-medium text-slate-800 text-right max-w-[60%]">{menuLabel}</div>
                      </div>
                    )}
                    {r.notes && !menuLabel && (
                      <div className="flex items-start justify-between">
                        <div className="text-slate-500">Catatan</div>
                        <div className="text-slate-700 text-right max-w-[60%] line-clamp-2">{r.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-3 pb-3 pt-2 border-t bg-slate-50/60 space-y-2">
                  {canEdit && !['confirmed','canceled'].includes(String(r.status)) && (
                    <Link
                      href={`/reservasi/booking/${r.id}/edit`}
                      className="w-full inline-block text-center text-[12px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Edit
                    </Link>
                  )}
                  {canConfirmCancel && allowedActions(String(r.status)).map((a: any) => (
                    <button
                      key={a.key}
                      onClick={()=> onAction(Number(r.id), a.key)}
                      className={`w-full text-[12px] px-3 py-1.5 rounded-lg ${actionStyle(a.key)}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function printReservationA5(opts: {
  number: string
  date: string
  startTime: string
  endTime: string
  pax: number
  customerName: string
  phone: string
  dpAmount: string
  dpPaid: boolean
  notes: string
  tables: Array<{ code?: string; name?: string }>
  selectedMenus: Array<{ code?: string; name?: string }>
}) {
  const {
    number,
    date,
    startTime,
    endTime,
    pax,
    customerName,
    phone,
    dpAmount,
    dpPaid,
    notes,
    tables,
    selectedMenus,
  } = opts

  const tableLabel = tables && tables.length
    ? tables.map(t => t.code || t.name || '').filter(Boolean).join(', ')
    : '-'

  const preorderLabel = selectedMenus && selectedMenus.length
    ? selectedMenus.map(m => m.name || m.code || '').filter(Boolean).join(', ')
    : ''

  const safeNotes = String(notes || '')
  const cleanNotes = safeNotes.split(/\r?\n/)
    .filter(line => !line.trim().toUpperCase().startsWith('PREORDER:'))
    .join('\n')

  const dpDisplay = dpAmount ? 'Rp ' + Number(dpAmount).toLocaleString('id-ID') : '-'

  const html = '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<meta charset="utf-8" />' +
    '<title>Nota Reservasi ' + number + '</title>' +
    '<style>' +
    '@page { size: 21cm 15cm; margin: 3mm; }' +
    'body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 16px; color: #111827; }' +
    '.wrapper { width: 100%; }' +
    '.header { text-align: center; margin-bottom: 14px; }' +
    '.header h1 { font-size: 24px; margin: 0; }' +
    '.header small { color: #6b7280; font-size: 14px; }' +
    '.section { margin-bottom: 8px; }' +
    '.section-title { font-weight: 600; font-size: 16px; margin-bottom: 4px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; }' +
    'table.meta { width: 100%; border-collapse: collapse; }' +
    'table.meta td { padding: 3px 0; vertical-align: top; font-size: 16px; }' +
    'table.meta td.label { width: 32%; color: #4b5563; }' +
    '.meta-two-cols td.col { width: 50%; padding-right: 8px; }' +
    '.meta-two-cols td.col:last-child { padding-right: 0; padding-left: 8px; }' +
    '.preorder, .notes { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; min-height: 60px; }' +
    '.muted { color: #9ca3af; }' +
    '@media print { body { margin: 0; } }' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class="wrapper">' +
    '<div class="header">' +
    '<h1>Reservasi Meja</h1>' +
    '<small>No: ' + number + '</small>' +
    '</div>' +
    '<div class="section">' +
    '<div class="section-title">Detail Reservasi</div>' +
    '<table class="meta meta-two-cols">' +
    '<tr>' +
    '<td class="col">' +
    '<table class="meta">' +
    '<tr><td class="label">Tanggal</td><td>' + date + '</td></tr>' +
    '<tr><td class="label">Jam</td><td>' + startTime + ' - ' + endTime + '</td></tr>' +
    '<tr><td class="label">Jumlah Tamu</td><td>' + pax + ' Orang</td></tr>' +
    '</table>' +
    '</td>' +
    '<td class="col">' +
    '<table class="meta">' +
    '<tr><td class="label">DP Nominal</td><td>' + dpDisplay + '</td></tr>' +
    '<tr><td class="label">DP Status</td><td>' + (dpAmount ? (dpPaid ? 'Terbayar' : 'Belum Terbayar') : '-') + '</td></tr>' +
    '<tr><td class="label">Meja</td><td>' + tableLabel + '</td></tr>' +
    '</table>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '</div>' +
    '<div class="section">' +
    '<div class="section-title">Customer</div>' +
    '<table class="meta">' +
    '<tr><td class="label">Nama</td><td>' + (customerName || '-') + '</td></tr>' +
    '<tr><td class="label">Telepon</td><td>' + (phone || '-') + '</td></tr>' +
    '</table>' +
    '</div>' +
    '<div class="section">' +
    '<div class="section-title">Pre-order</div>' +
    '<div class="preorder">' + (preorderLabel || '<span class="muted">Tidak ada pre-order</span>') + '</div>' +
    '</div>' +
    '<div class="section">' +
    '<div class="section-title">Catatan</div>' +
    '<div class="notes">' + (cleanNotes ? cleanNotes.replace(/\n/g, '<br/>') : '<span class="muted">-</span>') + '</div>' +
    '</div>' +
    '</div>' +
    '<script>window.onload = function() { window.print(); };</script>' +
    '</body>' +
    '</html>'

  return html
}

function LayoutMejaView({ date, reservations, floors, tables }: { date:string; reservations:any[]; floors:any[]; tables:any[] }) {
  const [selectedFloorId, setSelectedFloorId] = useState<string>('')
  const [detailTableId, setDetailTableId] = useState<number | null>(null)

  const reservationsByTable = useMemo(() => {
    const map: Record<string, any[]> = {}
    const active = new Set(['pending','confirmed','seated'])
    for (const r of reservations) {
      if (String(r.date) !== date) continue
      if (!active.has(String(r.status))) continue
      const codes = String(r.table_codes || '').split(',').map((c:string)=> c.trim()).filter(Boolean)
      for (const code of codes) {
        if (!map[code]) map[code] = []
        map[code].push(r)
      }
    }
    return map
  }, [reservations, date])

  const tablesByFloor = useMemo(() => {
    const by: Record<string, any[]> = {}
    for (const t of tables) {
      const key = t.floor_id != null ? String(t.floor_id) : 'null'
      if (!by[key]) by[key] = []
      by[key].push(t)
    }
    return by
  }, [tables])

  const visibleFloorKeys = selectedFloorId ? [selectedFloorId] : Object.keys(tablesByFloor)

  const findFloorLabel = (key: string) => {
    const idNum = key === 'null' ? null : Number(key)
    const f = floors.find((x:any)=> Number(x.id) === idNum)
    return f ? `${f.code} — ${f.name}` : 'Tanpa Lantai'
  }

  const detailTable = detailTableId != null ? tables.find((t:any)=> Number(t.id)===detailTableId) : null
  const detailReservations = detailTable
    ? (reservationsByTable[detailTable.code] || []).filter((r:any)=> String(r.date)===date)
    : []

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          <span className="text-slate-600">Lantai</span>
          <select className="border border-slate-300 rounded px-2 py-1 bg-white shadow-sm" value={selectedFloorId} onChange={e=> setSelectedFloorId(e.target.value)}>
            <option value="">Semua</option>
            {floors.map((f:any)=> (
              <option key={f.id} value={String(f.id)}>{f.code} — {f.name}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-slate-300" />Tidak ada booking</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-300" />Ada booking</span>
        </div>
      </div>

      {visibleFloorKeys.length === 0 ? (
        <div className="text-slate-500">Belum ada meja terdaftar.</div>
      ) : (
        <div className="space-y-4">
          {visibleFloorKeys.map(key => {
            const list = tablesByFloor[key] || []
            if (!list.length) return null
            return (
              <div key={key} className="space-y-2">
                <div className="font-medium text-slate-800 text-[13px]">{findFloorLabel(key)}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {list.map((t:any)=> {
                    const resForTable = reservationsByTable[t.code] || []
                    const hasBooking = resForTable.some((r:any)=> String(r.date)===date)
                    const boxClass = hasBooking
                      ? 'border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-white before:bg-blue-400'
                      : 'border-2 border-slate-300 bg-white before:bg-white'
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={()=> setDetailTableId(Number(t.id))}
                        className={`relative rounded-xl p-2.5 text-left shadow-sm hover:shadow-md transition-all overflow-hidden ${boxClass} before:absolute before:left-0 before:top-0 before:bottom-0 before:w-2`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <div className="font-semibold text-slate-800 text-sm truncate" title={t.name || t.code}>{t.code}</div>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${hasBooking ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-white text-slate-700 border border-slate-300'}`}>
                            {hasBooking ? 'Terisi' : 'Kosong'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mb-1">Kapasitas: {t.capacity || 0} pax</div>
                        {resForTable.length === 0 ? (
                          <div className="text-[11px] text-slate-500 italic">Tidak ada booking</div>
                        ) : (
                          <div className="space-y-0.5 text-[11px]">
                            {resForTable
                              .filter((r:any)=> String(r.date)===date)
                              .slice(0,3)
                              .map((r:any, idx:number)=> (
                                <div key={idx} className="flex justify-between gap-1">
                                  <span className="truncate" title={r.customer_name || r.number}>{r.start_time}-{r.end_time}</span>
                                  <span className="truncate max-w-[80px] text-right" title={r.customer_name || r.number}>{r.customer_name || r.number}</span>
                                </div>
                              ))}
                            {resForTable.filter((r:any)=> String(r.date)===date).length > 3 && (
                              <div className="text-[10px] text-slate-500">+{resForTable.filter((r:any)=> String(r.date)===date).length - 3} lagi</div>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {detailTable && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-3 sm:mx-6 text-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-white text-slate-900 flex items-center justify-between">
              <div>
                <div className="font-semibold text-base md:text-lg">Detail Meja {detailTable.code}</div>
                <div className="text-xs md:text-sm text-slate-500">Kapasitas {detailTable.capacity || 0} pax • Zona: {detailTable.zone || '-'}</div>
              </div>
              <button className="text-xs md:text-sm text-slate-600 hover:text-slate-900" onClick={()=> setDetailTableId(null)}>Tutup</button>
            </div>
            <div className="p-4 md:p-5 max-h-[70vh] overflow-auto bg-slate-50/80">
              {detailReservations.length === 0 ? (
                <div className="text-slate-500 text-sm">Tidak ada booking pada tanggal ini.</div>
              ) : (
                <div className="space-y-2">
                  {detailReservations.map((r:any)=> (
                    <div key={r.id} className="border border-slate-200 rounded-xl px-3 py-2 flex flex-col gap-1 bg-white shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-sm">{r.number}</div>
                        <span className="px-2.5 py-0.5 rounded-full text-white text-[11px] shadow-sm" style={{backgroundColor: ({pending:'#64748b',confirmed:'#0284c7',seated:'#16a34a',completed:'#0ea5e9',canceled:'#ef4444',no_show:'#f97316'} as any)[r.status] || '#64748b'}}>{r.status}</span>
                      </div>
                      <div className="text-sm text-slate-700">{r.start_time}-{r.end_time} • {r.pax} pax</div>
                      <div className="text-sm text-slate-600">{r.customer_name || '-'} • {r.phone || '-'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
