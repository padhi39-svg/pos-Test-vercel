"use client"
import { useEffect, useState } from "react"
import { useSort } from "@/lib/useSort"
import SortIcon from "@/components/ui/SortIcon"
import { sanitizeDateInput } from "@/lib/sanitizeDateInput"
import * as XLSX from "xlsx"

interface Row {
  id: number
  number: string
  customer_name: string
  pic: string
  company: string
  phone: string
  date: string
  start_time: string
  end_time: string
  pax: number
  status: string
  dp_amount: number
  dp_paid: number
  notes: string
  transfer_name: string
  table_names: string
  table_codes: string
  floor_names: string
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
  canceled: 'Canceled',
  no_show: 'No Show',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  confirmed: 'bg-teal-bg text-teal-dark',
  seated: 'bg-teal-100 text-teal-700',
  completed: 'bg-cyan-100 text-cyan-700',
  canceled: 'bg-red-100 text-red-700',
  no_show: 'bg-orange-100 text-orange-700',
}

export default function ReservationRecapPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  const ALL_COLUMNS = [
    { key: 'number', label: 'No. Booking' },
    { key: 'date', label: 'Tanggal' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'pic', label: 'PIC' },
    { key: 'company', label: 'Perusahaan' },
    { key: 'phone', label: 'Telepon' },
    { key: 'time', label: 'Waktu' },
    { key: 'pax', label: 'Pax' },
    { key: 'table_names', label: 'Meja' },
    { key: 'floor_names', label: 'Lantai' },
    { key: 'status', label: 'Status' },
    { key: 'dp_amount', label: 'DP' },
    { key: 'dp_paid', label: 'DP Terbayar' },
    { key: 'transfer_name', label: 'Transfer Atas Nama' },
    { key: 'notes', label: 'Catatan' },
    { key: 'created_at', label: 'Dibuat' },
  ] as const
  type ColKey = (typeof ALL_COLUMNS)[number]['key']
  const DEFAULT_VISIBLE: ColKey[] = ['number', 'date', 'customer_name', 'time', 'pax', 'table_names', 'status', 'dp_amount']
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_VISIBLE)
  const [showColPicker, setShowColPicker] = useState(false)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('report_reservation_recap.columns.visible')
        if (saved) {
          const arr = JSON.parse(saved)
          if (Array.isArray(arr) && arr.length) {
            const allowed = ALL_COLUMNS.map(c => c.key)
            const filtered = arr.filter((k: any) => allowed.includes(k)) as ColKey[]
            if (filtered.length) setVisibleCols(filtered)
          }
        }
      }
    } catch {}
  }, [])
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem('report_reservation_recap.columns.visible', JSON.stringify(visibleCols)) } catch {}
  }, [visibleCols])
  const isVisible = (k: ColKey) => visibleCols.includes(k)
  const toggleVisible = (k: ColKey) => setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const visibleCount = visibleCols.length

  const loadReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      if (statusFilter) params.set("status", statusFilter)
      const res = await fetch(`/api/reports/reservation-recap?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRows(data.rows || [])
      } else {
        setRows([])
      }
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const { sorted: sortedRows, sortKey, sortOrder, toggleSort } = useSort(rows, 'date', 'desc')

  const totalPax = sortedRows.reduce((s, r) => s + Number(r.pax || 0), 0)
  const totalDp = sortedRows.reduce((s, r) => s + Number(r.dp_amount || 0), 0)

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    if (!rows || rows.length === 0) {
      alert('Tidak ada data untuk di-export')
      return
    }
    const headers = ALL_COLUMNS.map(c => c.label)
    const data = rows.map(r => [
      r.number,
      r.date,
      r.customer_name,
      r.pic,
      r.company,
      r.phone,
      `${r.start_time} - ${r.end_time}`,
      r.pax,
      r.table_names,
      r.floor_names,
      STATUS_LABEL[r.status] || r.status,
      r.dp_amount,
      r.dp_paid ? 'Ya' : 'Belum',
      r.transfer_name,
      r.notes,
      r.created_at,
    ])
    const summary = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
    summary[0] = 'TOTAL'
    summary[7] = totalPax
    summary[11] = totalDp

    const wsData = [
      ['Laporan Rekapitulasi Reservasi'],
      [`Periode: ${from} s/d ${to}`],
      [],
      headers,
      ...data,
      [],
      summary,
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Reservasi')
    ws['!cols'] = headers.map(() => ({ wch: 20 }))
    XLSX.writeFile(wb, `Laporan_Rekap_Reservasi_${from}_${to}.xlsx`)
  }

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Laporan Rekapitulasi Reservasi</h1>
        <p className="report-subtitle">Rekap reservasi per periode</p>
      </div>

      <div className="report-card report-card-pad">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Dari Tanggal</label>
            <input type="date" value={from} onChange={e => setFrom(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Sampai Tanggal</label>
            <input type="date" value={to} onChange={e => setTo(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
              <option value="">Semua</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="seated">Seated</option>
              <option value="completed">Completed</option>
              <option value="canceled">Canceled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>

          <div className="flex gap-2 relative">
            <button onClick={loadReport} disabled={loading} className="px-4 py-1.5 bg-teal-primary text-white rounded-pill hover:bg-teal-dark disabled:opacity-50 text-sm font-medium shadow-sm">
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
            {rows.length > 0 && (
              <>
                <button onClick={handlePrint} className="px-3 py-1.5 bg-teal-primary text-white rounded-pill hover:bg-teal-dark text-sm font-medium shadow-sm flex items-center gap-1.5">Print</button>
                <button onClick={handleExportExcel} className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary text-sm font-medium shadow flex items-center gap-1.5">Excel</button>
              </>
            )}
            <button onClick={() => setShowColPicker(v => !v)} className="px-3 py-1.5 border border-teal-primary text-teal-dark rounded-pill hover:bg-teal-bg text-sm">Pilih Kolom</button>
            {showColPicker && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow p-2 z-10">
                <div className="text-[10px] font-bold text-slate-600 mb-2">Tampilkan Kolom</div>
                <div className="max-h-64 overflow-auto pr-1 space-y-1">
                  {ALL_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" className="accent-teal-primary" checked={isVisible(col.key)} onChange={() => toggleVisible(col.key)} />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex justify-end">
                  <button onClick={() => setShowColPicker(false)} className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50">Tutup</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="report-card">
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead className="bg-teal-primary text-white">
              <tr>
                {isVisible('number') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('number')}>
                      No. Booking <SortIcon active={sortKey === 'number'} order={sortKey === 'number' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('date') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('date')}>
                      Tanggal <SortIcon active={sortKey === 'date'} order={sortKey === 'date' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('customer_name') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('customer_name')}>
                      Customer <SortIcon active={sortKey === 'customer_name'} order={sortKey === 'customer_name' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('pic') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('pic')}>
                      PIC <SortIcon active={sortKey === 'pic'} order={sortKey === 'pic' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('company') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('company')}>
                      Perusahaan <SortIcon active={sortKey === 'company'} order={sortKey === 'company' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('phone') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('phone')}>
                      Telepon <SortIcon active={sortKey === 'phone'} order={sortKey === 'phone' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('time') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('start_time')}>
                      Waktu <SortIcon active={sortKey === 'start_time'} order={sortKey === 'start_time' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('pax') && (
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('pax')}>
                      Pax <SortIcon active={sortKey === 'pax'} order={sortKey === 'pax' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('table_names') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('table_names')}>
                      Meja <SortIcon active={sortKey === 'table_names'} order={sortKey === 'table_names' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('floor_names') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('floor_names')}>
                      Lantai <SortIcon active={sortKey === 'floor_names'} order={sortKey === 'floor_names' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('status') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('status')}>
                      Status <SortIcon active={sortKey === 'status'} order={sortKey === 'status' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('dp_amount') && (
                  <th className="px-1 py-1.5 text-right text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('dp_amount')}>
                      DP <SortIcon active={sortKey === 'dp_amount'} order={sortKey === 'dp_amount' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('dp_paid') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('dp_paid')}>
                      DP Terbayar <SortIcon active={sortKey === 'dp_paid'} order={sortKey === 'dp_paid' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('transfer_name') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('transfer_name')}>
                      Transfer Atas Nama <SortIcon active={sortKey === 'transfer_name'} order={sortKey === 'transfer_name' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('notes') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('notes')}>
                      Catatan <SortIcon active={sortKey === 'notes'} order={sortKey === 'notes' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {isVisible('created_at') && (
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">
                    <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('created_at')}>
                      Dibuat <SortIcon active={sortKey === 'created_at'} order={sortKey === 'created_at' ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleCount} className="px-2 py-4 text-center text-slate-500 text-xs">Tidak ada data</td>
                </tr>
              ) : (
                sortedRows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-slate-50">
                    {isVisible('number') && <td className="px-2 py-1 text-xs text-slate-700 font-mono">{r.number}</td>}
                    {isVisible('date') && <td className="px-2 py-1 text-xs text-slate-700">{r.date}</td>}
                    {isVisible('customer_name') && <td className="px-2 py-1 text-xs text-slate-700">{r.customer_name || '-'}</td>}
                    {isVisible('pic') && <td className="px-2 py-1 text-xs text-slate-700">{r.pic || '-'}</td>}
                    {isVisible('company') && <td className="px-2 py-1 text-xs text-slate-700">{r.company || '-'}</td>}
                    {isVisible('phone') && <td className="px-2 py-1 text-xs text-slate-700">{r.phone || '-'}</td>}
                    {isVisible('time') && <td className="px-2 py-1 text-xs text-slate-700 whitespace-nowrap">{r.start_time} - {r.end_time}</td>}
                    {isVisible('pax') && <td className="px-1 py-1 text-xs text-right text-slate-800 font-semibold">{r.pax}</td>}
                    {isVisible('table_names') && <td className="px-2 py-1 text-xs text-slate-700">{r.table_names || '-'}</td>}
                    {isVisible('floor_names') && <td className="px-2 py-1 text-xs text-slate-700">{r.floor_names || '-'}</td>}
                    {isVisible('status') && (
                      <td className="px-2 py-1 text-xs">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLOR[r.status] || 'bg-slate-100 text-slate-700'}`}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </td>
                    )}
                    {isVisible('dp_amount') && <td className="px-1 py-1 text-xs text-right text-slate-800">{r.dp_amount ? Number(r.dp_amount).toLocaleString('id-ID') : '-'}</td>}
                    {isVisible('dp_paid') && (
                      <td className="px-2 py-1 text-xs text-slate-700">
                        {r.dp_amount ? (r.dp_paid ? <span className="text-teal-primary font-semibold">Ya</span> : <span className="text-orange-600">Belum</span>) : '-'}
                      </td>
                    )}
                    {isVisible('transfer_name') && <td className="px-2 py-1 text-xs text-slate-700">{r.transfer_name || '-'}</td>}
                    {isVisible('notes') && <td className="px-2 py-1 text-xs text-slate-600 max-w-[200px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>}
                    {isVisible('created_at') && <td className="px-2 py-1 text-xs text-slate-500 whitespace-nowrap">{r.created_at || '-'}</td>}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300">
              <tr>
                <td colSpan={Math.max(visibleCount - 3, 1)}></td>
                {isVisible('pax') && <td className="px-1 py-1.5 text-xs font-bold text-right font-mono">{totalPax}</td>}
                {isVisible('time') && <></>}
                {isVisible('table_names') && <></>}
                {isVisible('floor_names') && <></>}
                {isVisible('status') && <></>}
                {isVisible('dp_amount') && <td className="px-1 py-1.5 text-xs font-bold text-right font-mono">{totalDp.toLocaleString('id-ID')}</td>}
                {isVisible('dp_paid') && <td></td>}
                {isVisible('transfer_name') && <td></td>}
                {isVisible('notes') && <td></td>}
                {isVisible('created_at') && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
