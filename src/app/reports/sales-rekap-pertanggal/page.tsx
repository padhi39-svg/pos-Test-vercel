"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sanitizeDateInput } from "@/lib/sanitizeDateInput"

interface Row {
  tanggal: string
  total: number
  pb1: number
  card_dpp: number
  card_pb1: number
  card_total: number
  cash_dpp: number
  cash_pb1: number
  cash_total: number
}

export default function SalesRekapPerTanggalPage() {
  const router = useRouter()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const fromDate = firstDay.toISOString().split('T')[0]
    const toDate = lastDay.toISOString().split('T')[0]
    setFrom(fromDate)
    setTo(toDate)
    load(fromDate, toDate, '')
  }, [])

  const load = async (f = from, t = to, ty = type) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (f) params.set('from', f)
      if (t) params.set('to', t)
      if (ty) params.set('type', ty)
      const res = await fetch(`/api/reports/sales-rekap-pertanggal?${params.toString()}`)
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        alert('Gagal memuat laporan: ' + (d?.details || d?.error || res.status))
        setRows([])
        return
      }
      const data = await res.json()
      setRows(data.rows || [])
    } catch (e: any) {
      console.error(e)
      alert('Gagal memuat laporan: ' + (e?.message || String(e)))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const totals = rows.reduce((acc, r) => {
    acc.total += Number(r.total||0)
    acc.pb1 += Number(r.pb1||0)
    acc.card_dpp += Number(r.card_dpp||0)
    acc.card_pb1 += Number(r.card_pb1||0)
    acc.card_total += Number(r.card_total||0)
    acc.cash_dpp += Number(r.cash_dpp||0)
    acc.cash_pb1 += Number(r.cash_pb1||0)
    acc.cash_total += Number(r.cash_total||0)
    return acc
  }, { total:0, pb1:0, card_dpp:0, card_pb1:0, card_total:0, cash_dpp:0, cash_pb1:0, cash_total:0 })

  const fmt = (n:number) => Number(n||0).toLocaleString('id-ID')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan Rekap Pertanggal</h1>
          <p className="text-sm text-slate-600 mt-1">Rekap DPP/PB1 dan CASH/CARD per tanggal</p>
        </div>
        <button onClick={()=>router.back()} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800">← Kembali</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Dari Tanggal</label>
            <input type="date" value={from} onChange={(e)=>setFrom(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Sampai Tanggal</label>
            <input type="date" value={to} onChange={(e)=>setTo(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Jenis Penjualan</label>
            <select value={type} onChange={e=>setType(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
              <option value="">Semua</option>
              <option value="1">Pos Resto</option>
              <option value="2">Pos Retail</option>
              <option value="3">Invoice</option>
            </select>
          </div>
          <button onClick={()=>load()} disabled={loading} className="px-4 py-1.5 bg-gradient-to-r from-[#2BA8A2] to-[#3CC4BD] text-white rounded-lg disabled:opacity-50 text-sm font-medium shadow">{loading? 'Memuat...' : 'Tampilkan'}</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-x-auto">
        <table className="w-full min-w-[920px] text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th rowSpan={2} className="px-2 py-2 text-left">TANGGAL</th>
              <th colSpan={2} className="px-2 py-2 text-right">TOTAL</th>
              <th colSpan={3} className="px-2 py-2 text-center">CARD</th>
              <th colSpan={3} className="px-2 py-2 text-center">CASH</th>
            </tr>
            <tr className="bg-slate-100">
              <th className="px-2 py-2 text-right">TOTAL</th>
              <th className="px-2 py-2 text-right">PB1</th>
              <th className="px-2 py-2 text-right">DPP</th>
              <th className="px-2 py-2 text-right">PB1</th>
              <th className="px-2 py-2 text-right">CARD</th>
              <th className="px-2 py-2 text-right">DPP</th>
              <th className="px-2 py-2 text-right">PB1</th>
              <th className="px-2 py-2 text-right">CASH</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-2 py-3 text-center text-slate-500">Tidak ada data</td></tr>
            ) : rows.map((r, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-2 py-1">{r.tanggal}</td>
                <td className="px-2 py-1 text-right">{fmt(r.total)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.pb1)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.card_dpp)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.card_pb1)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.card_total)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.cash_dpp)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.cash_pb1)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.cash_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2">
            <tr>
              <td className="px-2 py-2 font-semibold">TOTAL</td>
              <td className="px-2 py-2 text-right font-semibold">{fmt(totals.total)}</td>
              <td className="px-2 py-2 text-right font-semibold">{fmt(totals.pb1)}</td>
              <td className="px-2 py-2 text-right font-semibold">{fmt(totals.card_dpp)}</td>
              <td className="px-2 py-2 text-right font-semibold">{fmt(totals.card_pb1)}</td>
              <td className="px-2 py-2 text-right font-semibold">{fmt(totals.card_total)}</td>
              <td className="px-2 py-2 text-right font-semibold">{fmt(totals.cash_dpp)}</td>
              <td className="px-2 py-2 text-right font-semibold">{fmt(totals.cash_pb1)}</td>
              <td className="px-2 py-2 text-right font-semibold">{fmt(totals.cash_total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
