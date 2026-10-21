"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import Input from '@/components/ui/Input'
import { useSort } from '@/lib/useSort'
import SortIcon from '@/components/ui/SortIcon'
import TableGrid from '@/components/TableGrid'

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
  const [dpPrompt, setDpPrompt] = useState<any | null>(null)

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
        pic: detail.pic || '',
        company: detail.company || '',
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
          fetch('/api/meja?active=1&limit=200'),
        ])
        const f = rf.ok ? await rf.json() : []
        const t = rt.ok ? await rt.json() : []
        const floorList = Array.isArray(f) ? f : (Array.isArray(f?.rows) ? f.rows : [])
        floorList.sort((a: any, b: any) => (a.levelNo ?? 999) - (b.levelNo ?? 999))
        setFloors(floorList)
        setTables(Array.isArray(t) ? t : (Array.isArray(t?.rows) ? t.rows : []))
      } catch {}
    }
    if (view === 'layout' && (floors.length === 0 || tables.length === 0)) loadMaster()
  }, [view])

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    const bySearch = rows.filter((r) => !s || `${r.number} ${r.customer_name||''} ${r.pic||''} ${r.company||''} ${r.phone||''} ${r.table_codes||''}`.toLowerCase().includes(s))
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
    if (st === 'pending') actions.push({ key:'confirm', label:'Confirm', color:'bg-teal-primary hover:bg-teal-dark' })
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

  const onToggleDp = (row: any) => {
    setDpPrompt(row)
  }

  const submitToggleDp = async () => {
    if (!dpPrompt) return
    try {
      const nextPaid = !dpPrompt.dp_paid
      const res = await fetch(`/api/reservations/${dpPrompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dp_paid: nextPaid }),
      })
      if (!res.ok) {
        const err = await res.json().catch(()=>({}))
        alert(err?.error || 'Gagal mengubah status DP')
        return
      }
      await res.json().catch(()=>null)
      setDpPrompt(null)
      load()
    } catch (e) {
      alert('Gagal mengubah status DP')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Booking Meja</h1>
          <p className="text-slate-500 text-xs mt-1">Kelola reservasi meja per tanggal</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center rounded-full bg-slate-100 border border-slate-200 text-xs p-0.5 shadow-sm">
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
              className="px-3 py-1.5 rounded-pill bg-gradient-to-r from-teal-primary to-teal-light hover:from-teal-dark hover:to-teal-primary text-white text-xs shadow-sm"
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
                className="px-2 py-1 rounded bg-teal-primary hover:bg-teal-dark text-white text-xs"
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
            onToggleDp={onToggleDp}
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
          <BookingLayoutView date={layoutDate} reservations={rows} floors={floors} tables={tables} />
        )}
      </div>
      {dpPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-5 text-xs">
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              {dpPrompt.dp_paid ? 'Batalkan status DP sudah masuk?' : 'DP sudah masuk?'}
            </h2>
            <div className="space-y-1 mb-4 text-slate-700">
              <div><span className="font-semibold">Nomor:</span> <span className="font-mono">{dpPrompt.number}</span></div>
              <div><span className="font-semibold">Customer:</span> {dpPrompt.customer_name || '-'}</div>
              <div><span className="font-semibold">DP:</span> {dpPrompt.dp_amount ? `Rp ${Number(dpPrompt.dp_amount).toLocaleString('id-ID')}` : '-'}</div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs"
                onClick={()=> setDpPrompt(null)}
              >
                Tidak
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded bg-teal-primary text-white hover:bg-teal-dark text-xs"
                onClick={submitToggleDp}
              >
                Ya
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDisplayDate(value?: string) {
  const v = String(value || '').slice(0, 10)
  if (!v || v.length !== 10 || v[4] !== '-' || v[7] !== '-') return value || ''
  const [y, m, d] = v.split('-')
  if (!y || !m || !d) return value || ''
  return `${d}/${m}/${y}`
}

function ListView({ paged, sorted, currentPage, totalPages, setPage, sortKey, sortOrder, toggleSort, allowedActions, onAction, handlePrint, canEdit, canConfirmCancel, onToggleDp }: any) {
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
                <Link href={`/reservasi/booking/${r.id}`} className="font-medium text-teal-primary hover:underline">{r.number}</Link>
                <span className="px-2 py-0.5 rounded text-white text-[11px]"
                  style={{backgroundColor: ({pending:'#64748b',confirmed:'#0284c7',seated:'#16a34a',completed:'#0ea5e9',canceled:'#ef4444',no_show:'#f97316'} as any)[r.status] || '#64748b'}}>
                  {r.status}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 mt-1">{r.date} • {r.start_time} - {r.end_time}</div>
              <div className="text-[11px] text-slate-600">Pax: {r.pax} • Meja: {r.table_codes || '-'}</div>
              <div className="text-[11px] text-slate-600">Cust: {r.customer_name || '-'}</div>
              <div className="text-[11px] text-slate-600">PIC: {r.pic || '-'} • Perusahaan: {r.company || '-'}</div>
              <div className="text-[11px] text-slate-600 flex items-center justify-between gap-2">
                <span>DP: {r.dp_amount ? `Rp ${Number(r.dp_amount).toLocaleString('id-ID')}` : '-' }{r.dp_amount ? (r.dp_paid? ' (Terbayar)' : ' (Belum)') : ''}</span>
                <button
                  type="button"
                  onClick={()=> onToggleDp(r)}
                  className={`px-2 py-1 rounded border flex items-center justify-center ${r.dp_paid ? 'border-teal-primary text-teal-primary bg-teal-bg' : 'border-slate-300 text-slate-600 bg-white'}`}
                  title={r.dp_paid ? 'DP sudah masuk (klik untuk batalkan)' : 'DP belum masuk (klik untuk approve)'}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="2" y="3" width="16" height="14" rx="2" ry="2" className={r.dp_paid ? 'fill-current' : ''} />
                    {r.dp_paid && (
                      <path d="M6 10.5l2.5 2.5L14 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white" />
                    )}
                  </svg>
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {canEdit && !['confirmed','canceled'].includes(String(r.status)) && (
                  <Link
                    href={`/reservasi/booking/${r.id}/edit`}
                    className="px-2 py-1 rounded bg-teal-primary hover:bg-teal-dark text-white flex items-center justify-center"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Link>
                )}
                {canConfirmCancel && allowedActions(String(r.status)).map((a: any) => (
                  <button
                    key={a.key}
                    onClick={()=> onAction(Number(r.id), a.key)}
                    className={`px-2 py-1 rounded text-white flex items-center justify-center ${a.key==='confirm' ? 'bg-teal-primary hover:bg-teal-dark' : a.key==='cancel' ? 'bg-red-600 hover:bg-red-700' : a.color}`}
                    title={a.label}
                  >
                    {a.key === 'confirm' ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                ))}
                <button
                  disabled={String(r.status)==='canceled'}
                  onClick={()=> handlePrint(r)}
                  className="text-[11px] px-2 py-1 rounded-pill border border-slate-300 text-slate-700 disabled:opacity-50"
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
              <th className="px-1 py-0.5">PIC</th>
              <th className="px-1 py-0.5">Perusahaan</th>
              <th className="px-1 py-0.5">Telp</th>
              <th className="px-1 py-0.5">
                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('pax')}>
                  Pax <SortIcon active={sortKey === 'pax'} order={sortKey === 'pax' ? sortOrder : undefined} />
                </button>
              </th>
              <th className="px-1 py-0.5 w-[110px] max-w-[110px]">Meja</th>
              <th className="px-1 py-0.5">
                Transfer A/N
              </th>
              <th className="px-1 py-0.5">
                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('dp_amount')}>
                  DP <SortIcon active={sortKey === 'dp_amount'} order={sortKey === 'dp_amount' ? sortOrder : undefined} />
                </button>
              </th>
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
                  <td className="px-1 py-0.5 font-medium"><Link href={`/reservasi/booking/${r.id}`} className="text-teal-primary hover:underline">{r.number}</Link></td>
                  <td className="px-1 py-0.5">{r.date}</td>
                  <td className="px-1 py-0.5">{r.start_time} - {r.end_time}</td>
                  <td className="px-1 py-0.5">{r.customer_name || '-'}</td>
                  <td className="px-1 py-0.5">{r.pic || '-'}</td>
                  <td className="px-1 py-0.5">{r.company || '-'}</td>
                  <td className="px-1 py-0.5">{r.phone || '-'}</td>
                  <td className="px-1 py-0.5">{r.pax}</td>
                  <td className="px-1 py-0.5 w-[110px] max-w-[110px] truncate" title={r.table_codes || '-' }>{r.table_codes || '-'}</td>
                  <td className="px-1 py-0.5">{r.transfer_name || '-'}</td>
                  <td className="px-1 py-0.5">
                    <div className="flex items-center gap-1 justify-between">
                      <span>{r.dp_amount ? `Rp ${Number(r.dp_amount).toLocaleString('id-ID')}` : '-' }{r.dp_amount ? (r.dp_paid? ' (Terbayar)' : ' (Belum)') : ''}</span>
                      <button
                        type="button"
                        onClick={()=> onToggleDp(r)}
                        className={`px-1.5 py-0.5 rounded border flex items-center justify-center ${r.dp_paid ? 'border-teal-primary text-teal-primary bg-teal-bg' : 'border-slate-300 text-slate-600 bg-white'}`}
                        title={r.dp_paid ? 'DP sudah masuk (klik untuk batalkan)' : 'DP belum masuk (klik untuk approve)'}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <rect x="2" y="3" width="16" height="14" rx="2" ry="2" className={r.dp_paid ? 'fill-current' : ''} />
                          {r.dp_paid && (
                            <path d="M6 10.5l2.5 2.5L14 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white" />
                          )}
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-1 py-0.5">
                    <span className="px-2 py-0.5 rounded text-white text-[11px]"
                      style={{backgroundColor: ({pending:'#64748b',confirmed:'#0284c7',seated:'#16a34a',completed:'#0ea5e9',canceled:'#ef4444',no_show:'#f97316'} as any)[r.status] || '#64748b'}}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-1 py-0.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5 flex-nowrap">
                      {canEdit && !['confirmed','canceled'].includes(String(r.status)) && (
                        <Link
                          href={`/reservasi/booking/${r.id}/edit`}
                          className="px-1.5 py-1 rounded bg-teal-primary hover:bg-teal-dark text-white flex items-center justify-center"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                      )}
                      {canConfirmCancel && allowedActions(String(r.status)).map((a: any) => (
                        <button
                          key={a.key}
                          onClick={()=> onAction(Number(r.id), a.key)}
                          className={`px-1.5 py-1 rounded text-white flex items-center justify-center ${a.key==='confirm' ? 'bg-teal-primary hover:bg-teal-dark' : a.key==='cancel' ? 'bg-red-600 hover:bg-red-700' : a.color}`}
                          title={a.label}
                        >
                          {a.key === 'confirm' ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      ))}
                      <button
                        disabled={String(r.status)==='canceled'}
                        onClick={()=> handlePrint(r)}
                        className="text-[11px] px-2 py-1 rounded-pill border border-slate-300 text-slate-700 disabled:opacity-50"
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
            <button className="px-2 py-0.5 border rounded-pill disabled:opacity-50" onClick={()=> setPage((p: number)=> Math.max(1, p-1))} disabled={currentPage===1}>‹</button>
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
    confirmed: 'bg-teal-primary',
    seated: 'bg-teal-600',
    completed: 'bg-cyan-600',
    canceled: 'bg-red-600',
    no_show: 'bg-orange-600',
  } as any)[s] || 'bg-slate-600'

  const actionStyle = (key:string) => {
    if (key === 'check_in') return 'bg-rose-600 hover:bg-rose-700 text-white'
    if (key === 'confirm') return 'bg-teal-primary hover:bg-teal-dark text-white'
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
            const preorderNames = preorder.map((m:any)=> m.name || m.code || '').filter(Boolean)
            const menuLabel = preorderNames.length ? preorderNames.join(', ') : null
            const cleanNotes = (() => {
              if (!r.notes) return ''
              const lines = String(r.notes).split(/\r?\n/)
              const filtered = lines.filter((l:string) => !l.trim().toUpperCase().startsWith('PREORDER:'))
              return filtered.join('\n').trim()
            })()
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
                      <span className="bg-white/20 rounded-full px-2 py-0.5">{formatDisplayDate(r.date)}</span>
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
                      <div className="text-slate-500">PIC</div>
                      <div className="font-medium text-slate-800 truncate max-w-[60%] text-right">{r.pic || '-'}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">Perusahaan</div>
                      <div className="font-medium text-slate-800 truncate max-w-[60%] text-right">{r.company || '-'}</div>
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
                      <div className="font-medium text-slate-800 text-right whitespace-pre-wrap max-w-[60%]">{r.table_codes || '-'}</div>
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
                        <div className="font-medium text-slate-800 text-right max-w-[60%] whitespace-pre-wrap">{menuLabel}</div>
                      </div>
                    )}
                    {cleanNotes && (
                      <div className="flex items-start justify-between">
                        <div className="text-slate-500">Catatan</div>
                        <div className="text-slate-700 text-right max-w-[60%] whitespace-pre-wrap">{cleanNotes}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-3 pb-3 pt-2 border-t bg-slate-50/60 space-y-2">
                  {canEdit && !['confirmed','canceled'].includes(String(r.status)) && (
                    <Link
                      href={`/reservasi/booking/${r.id}/edit`}
                      className="w-full inline-block text-center text-[12px] px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white"
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
  pic: string
  company: string
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
    pic,
    company,
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
    '<tr><td class="label">PIC</td><td>' + (pic || '-') + '</td></tr>' +
    '<tr><td class="label">Perusahaan</td><td>' + (company || '-') + '</td></tr>' +
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

function BookingLayoutView({ date, reservations, floors, tables }: { date:string; reservations:any[]; floors:any[]; tables:any[] }) {
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

  const tableStatus = (t: any) => {
    const resForTable = reservationsByTable[t.code] || []
    const hasBooking = resForTable.some((r:any)=> String(r.date)===date)
    if (hasBooking) return {
      bg: 'bg-white', border: 'border-amber-400', textColor: 'text-amber-500',
      badgeText: 'Booking', badgeClass: 'bg-amber-200 text-amber-800',
      indicatorColor: '#FDE68A', timerText: undefined,
    }
    return {
      bg: 'bg-white', border: 'border-emerald-300', textColor: 'text-emerald-500',
      badgeText: 'Avail', badgeClass: 'bg-green-200 text-green-800',
      indicatorColor: '#A7F3D0', timerText: undefined,
    }
  }

  const renderBookingContent = (t: any) => {
    const resForTable = reservationsByTable[t.code] || []
    const activeRes = resForTable.filter((r:any)=> String(r.date)===date)
    return (
      <>
        <div className={`text-[9px] truncate text-inherit opacity-80`}>Kap: {t.capacity || 0} pax</div>
        {activeRes.length === 0 ? (
          <div className={`text-[9px] italic text-inherit opacity-60 mt-auto`}>Tidak ada booking</div>
        ) : (
          <div className="space-y-0.5 text-[9px] mt-auto">
            {activeRes.slice(0,2).map((r:any, idx:number)=> (
              <div key={idx} className="flex justify-between gap-1 text-inherit opacity-90">
                <span className="truncate">{r.start_time}-{r.end_time}</span>
                <span className="truncate max-w-[70px] text-right">{r.customer_name || r.number}</span>
              </div>
            ))}
            {activeRes.length > 2 && (
              <div className="text-[8px] text-inherit opacity-70">+{activeRes.length - 2} lagi</div>
            )}
          </div>
        )}
      </>
    )
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
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-slate-300" />Available</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#F29F05] border border-[#F29F05]" />Booking</span>
        </div>
      </div>

      <TableGrid
        tables={tables}
        floors={floors}
        selectedFloorId={selectedFloorId ? Number(selectedFloorId) : null}
        getTableStatus={tableStatus}
        renderCardContent={renderBookingContent}
        onTableClick={(t) => t && setDetailTableId(Number(t.id))}
      />

      {detailTable && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-3 text-xs overflow-hidden">
            <div className="px-3 py-2 border-b bg-white text-slate-900 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[13px]">Detail Meja {detailTable.code}</div>
                <div className="text-[11px] text-slate-500">Kapasitas {detailTable.capacity || 0} pax • Zona: {detailTable.zone || '-'}</div>
              </div>
              <button className="text-[11px] text-slate-600 hover:text-slate-900" onClick={()=> setDetailTableId(null)}>Tutup</button>
            </div>
            <div className="p-3 max-h-80 overflow-auto bg-slate-50/80">
              {detailReservations.length === 0 ? (
                <div className="text-slate-500 text-[11px]">Tidak ada booking pada tanggal ini.</div>
              ) : (
                <div className="space-y-1">
                  {detailReservations.map((r:any)=> (
                    <div key={r.id} className="border border-slate-200 rounded-pill px-2 py-1 flex flex-col gap-0.5 bg-white shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-[11px]">{r.number}</div>
                        <span className="px-2 py-0.5 rounded-full text-white text-[10px] shadow-sm" style={{backgroundColor: ({pending:'#64748b',confirmed:'#0284c7',seated:'#16a34a',completed:'#0ea5e9',canceled:'#ef4444',no_show:'#f97316'} as any)[r.status] || '#64748b'}}>{r.status}</span>
                      </div>
                      <div className="text-[11px] text-slate-700">{r.start_time}-{r.end_time} • {r.pax} pax</div>
                      <div className="text-[11px] text-slate-600">{r.customer_name || '-'} • {r.phone || '-'}</div>
                      <div className="text-[11px] text-slate-600">PIC: {r.pic || '-'} • Perusahaan: {r.company || '-'}</div>
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
