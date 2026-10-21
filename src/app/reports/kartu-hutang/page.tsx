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

interface Group {
  purchase_number: string
  purchase_date: string
  rows: Omit<Row, 'balance'>[]
}

interface Supplier {
  id: number
  name: string
}

export default function KartuHutangPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [supplierId, setSupplierId] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [mode, setMode] = useState<'reguler' | 'per-transaksi'>('reguler')
  const [rows, setRows] = useState<Row[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [supplierName, setSupplierName] = useState('')

  useEffect(() => {
    fetch('/api/reports/kartu-hutang').then(r => r.json()).then(d => {
      if (d?.suppliers) setSuppliers(d.suppliers)
    }).catch(() => {})
  }, [])

  const load = async () => {
    if (!from || !to || !supplierId) return
    setLoading(true)
    setErrMsg('')
    try {
      const params = new URLSearchParams({ startDate: from, endDate: to, supplierId, mode })
      const res = await fetch(`/api/reports/kartu-hutang?${params}`)
      const d = await res.json()
      if (d?.error) { setErrMsg(d.error); return }
      if (d?.mode === 'per-transaksi') {
        setGroups(d.groups || [])
        setRows([])
        setSupplierName(d.supplier_name || '')
      } else if (d?.mode === 'reguler') {
        setRows(d.rows || [])
        setGroups([])
        setSupplierName(d.supplier_name || '')
      } else {
        setErrMsg('Respon tidak dikenal: ' + JSON.stringify(d).slice(0,200))
      }
    } catch (e: any) { setErrMsg('Error: ' + (e?.message || e)) } finally { setLoading(false) }
  }

  useEffect(() => { if (supplierId) load() }, [mode])

  const handleExport = () => {
    if (!from || !to || !supplierId) return
    const params = new URLSearchParams({ startDate: from, endDate: to, supplierId, mode })
    window.open(`/api/reports/kartu-hutang/export?${params}`, '_blank')
  }

  const visible = rows.length > 0 || groups.length > 0

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Kartu Hutang</h1>
          <p className="text-xs text-slate-500">Riwayat hutang per supplier</p>
        </div>
        {visible && (
          <button onClick={handleExport} className="px-3 py-1.5 text-xs rounded bg-teal-primary text-white hover:bg-teal-dark">Export Excel</button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px]">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Supplier</label>
            <select className="input text-xs h-8 w-full" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">-- Pilih Supplier --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
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
          <div className="flex items-center gap-1 pb-0.5">
            <label className="text-[10px] font-bold text-slate-600 mr-1">Mode:</label>
            <button
              className={`px-2 py-1 text-[10px] rounded-l ${mode === 'reguler' ? 'bg-teal-primary text-white' : 'bg-slate-200 text-slate-600'}`}
              onClick={() => setMode('reguler')}
            >Reguler</button>
            <button
              className={`px-2 py-1 text-[10px] rounded-r ${mode === 'per-transaksi' ? 'bg-teal-primary text-white' : 'bg-slate-200 text-slate-600'}`}
              onClick={() => setMode('per-transaksi')}
            >Per Transaksi</button>
          </div>
          <button onClick={load} className="px-3 py-1.5 text-xs rounded bg-teal-primary text-white h-8">Tampilkan</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-6">Memuat...</div>
      ) : errMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-xs">
          <strong>Error:</strong> {errMsg}
        </div>
      ) : !visible ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center text-slate-500">
          {supplierId && from && to ? 'Tidak ada data untuk periode ini' : 'Pilih supplier, periode, dan klik "Tampilkan"'}
        </div>
      ) : mode === 'reguler' ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-sm text-slate-800">{supplierName}</span>
            <span className="text-xs text-slate-500">{from} s.d {to}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Tanggal</th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Kode Nota</th>
                  <th className="text-left px-2 py-1.5">Keterangan</th>
                  <th className="text-right px-2 py-1.5 whitespace-nowrap">Debit</th>
                  <th className="text-right px-2 py-1.5 whitespace-nowrap">Kredit</th>
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
                      <td className="px-2 py-1 text-right font-mono text-teal-dark">{r.debit > 0 ? r.debit.toLocaleString('id-ID') : ''}</td>
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
      ) : (
        <div className="space-y-3">
          {groups.map((g, gi) => (
            <div key={gi} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">{g.purchase_number}</span>
                <span className="text-xs text-slate-500">{g.purchase_date}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-2 py-1.5 whitespace-nowrap">Tanggal</th>
                      <th className="text-left px-2 py-1.5 whitespace-nowrap">Kode Nota</th>
                      <th className="text-left px-2 py-1.5">Keterangan</th>
                      <th className="text-right px-2 py-1.5 whitespace-nowrap">Debit</th>
                      <th className="text-right px-2 py-1.5 whitespace-nowrap">Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, i) => {
                      const isFirst = i === 0
                      return (
                        <tr key={i} className={`${isFirst ? 'border-t-2 border-slate-400' : 'border-t'} hover:bg-slate-50 ${isFirst ? 'font-semibold bg-blue-50/30' : ''}`}>
                          <td className={`px-2 py-1 whitespace-nowrap ${isFirst ? '' : 'pl-6'}`}>{r.tdate}</td>
                          <td className={`px-2 py-1 whitespace-nowrap font-mono text-[10px] ${isFirst ? '' : 'pl-6'}`}>{r.source_number || '-'}</td>
                          <td className="px-2 py-1 text-slate-500">{r.description || '-'}</td>
                          <td className="px-2 py-1 text-right font-mono text-teal-dark">{r.debit > 0 ? r.debit.toLocaleString('id-ID') : ''}</td>
                          <td className="px-2 py-1 text-right font-mono text-red-700">{r.kredit > 0 ? r.kredit.toLocaleString('id-ID') : ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
