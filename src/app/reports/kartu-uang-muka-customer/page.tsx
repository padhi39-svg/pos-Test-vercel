"use client"

import { useEffect, useState } from 'react'

interface Row {
  tdate: string
  source_number: string
  description: string
  debit: number
  kredit: number
  balance: number
}

interface Customer {
  id: number
  name: string
}

export default function KartuUangMukaCustomerPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [customerId, setCustomerId] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [customerName, setCustomerName] = useState('')

  useEffect(() => {
    fetch('/api/reports/kartu-uang-muka-customer').then(r => r.json()).then(d => {
      if (d?.customers) setCustomers(d.customers)
    }).catch(() => {})
  }, [])

  const load = async () => {
    if (!from || !to || !customerId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate: from, endDate: to, customerId })
      const res = await fetch(`/api/reports/kartu-uang-muka-customer?${params}`)
      const d = await res.json()
      if (d?.error) { alert(d.error); return }
      setCustomerName(d.customer_name || '')
      setRows(d.rows || [])
    } catch (e: any) { alert('Error: ' + (e?.message || e)) } finally { setLoading(false) }
  }

  useEffect(() => { if (customerId) load() }, [])

  const visible = rows.length > 0

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Kartu Uang Muka Customer</h1>
          <p className="text-xs text-slate-500">Riwayat uang muka per pelanggan</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px]">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Customer</label>
            <select className="input text-xs h-8 w-full" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">-- Pilih Customer --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Dari Tanggal</label>
            <input type="date" className="input text-xs h-8" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Sampai Tanggal</label>
            <input type="date" className="input text-xs h-8" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button onClick={load} className="px-3 py-1.5 text-xs rounded bg-[#3C3C3C] text-white h-8">Tampilkan</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-6">Memuat...</div>
      ) : !visible ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center text-slate-500">
          {customerId && from && to ? 'Tidak ada data untuk periode ini' : 'Pilih customer, periode, dan klik "Tampilkan"'}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-sm text-slate-800">{customerName}</span>
            <span className="text-xs text-slate-500">{from} s.d {to}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Tanggal</th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Kode Nota</th>
                  <th className="text-left px-2 py-1.5">Keterangan</th>
                  <th className="text-right px-2 py-1.5 whitespace-nowrap">Debit (-)</th>
                  <th className="text-right px-2 py-1.5 whitespace-nowrap">Kredit (+)</th>
                  <th className="text-right px-2 py-1.5 whitespace-nowrap">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isNewNota = i > 0 && rows[i-1].source_number !== r.source_number
                  const isSaldoAwal = r.description === 'Saldo Awal'
                  return (
                    <tr key={i} className={`${isNewNota || isSaldoAwal ? 'border-t-2 border-slate-400' : 'border-t'} hover:bg-slate-50 ${isSaldoAwal ? 'bg-yellow-50/50 italic text-slate-600' : ''}`}>
                      <td className="px-2 py-1 whitespace-nowrap">{r.tdate}</td>
                      <td className="px-2 py-1 whitespace-nowrap font-mono text-[10px]">{r.source_number || '-'}</td>
                      <td className={`px-2 py-1 ${isSaldoAwal ? 'font-semibold' : 'text-slate-500'}`}>{r.description || '-'}</td>
                      <td className="px-2 py-1 text-right font-mono text-emerald-700">{r.debit > 0 ? r.debit.toLocaleString('id-ID') : ''}</td>
                      <td className="px-2 py-1 text-right font-mono text-red-700">{r.kredit > 0 ? r.kredit.toLocaleString('id-ID') : ''}</td>
                      <td className="px-2 py-1 text-right font-mono font-bold">{r.balance.toLocaleString('id-ID')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rows.length > 0 && (
            <div className="px-3 py-1.5 bg-slate-100 border-t border-slate-200 font-bold text-xs flex justify-between">
              <span>Saldo Akhir</span>
              <span className="font-mono">{rows[rows.length-1].balance.toLocaleString('id-ID')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
