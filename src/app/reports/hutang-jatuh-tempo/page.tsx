"use client"

import { useEffect, useState } from 'react'

interface Row {
  id: number
  kode_nota: string
  supplier: string
  tanggal_nota: string
  jatuh_tempo: string
  total: number
  sisa: number
}

interface Supplier {
  id: number
  name: string
}

export default function HutangJatuhTempoPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [supplierId, setSupplierId] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    fetch('/api/reports/hutang-jatuh-tempo?startDate='+from+'&endDate='+to).then(r => r.json()).then(d => {
      if (d?.suppliers) setSuppliers(d.suppliers)
    }).catch(() => {})
  }, [])

  const load = async () => {
    if (!from || !to) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate: from, endDate: to })
      if (supplierId) params.set('supplierId', supplierId)
      const res = await fetch(`/api/reports/hutang-jatuh-tempo?${params}`)
      const d = await res.json()
      if (d?.error) { alert(d.error); return }
      setRows(d.rows || [])
    } catch (e: any) { alert('Error: ' + (e?.message || e)) } finally { setLoading(false) }
  }

  const fmt = (n: number) => n.toLocaleString('id-ID')
  const totalNilai = rows.reduce((s, r) => s + Number(r.total || 0), 0)
  const totalSisa = rows.reduce((s, r) => s + Number(r.sisa || 0), 0)

  const handleExport = () => {
    if (!rows.length) return
    const headers = ['No', 'Kode Nota', 'Tanggal Nota', 'Jatuh Tempo', 'Supplier', 'Total', 'Sisa']
    const csvRows = rows.map((r, i) => [
      i+1, r.kode_nota, r.tanggal_nota, r.jatuh_tempo, r.supplier, r.total, r.sisa
    ])
    const csv = [headers, ...csvRows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `hutang-jatuh-tempo-${from}-${to}.csv`
    a.click()
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Hutang Jatuh Tempo</h1>
          <p className="text-xs text-slate-500">Daftar hutang yang masih outstanding</p>
        </div>
        {rows.length > 0 && (
          <button onClick={handleExport} className="px-3 py-1.5 text-xs rounded bg-teal-primary text-white hover:bg-teal-dark">Export CSV</button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px]">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Supplier</label>
            <select className="input text-xs h-8 w-full" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">-- Semua Supplier --</option>
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
          <button onClick={load} className="px-3 py-1.5 text-xs rounded bg-teal-primary text-white h-8">Tampilkan</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-6">Memuat...</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center text-slate-500">Tidak ada data hutang outstanding untuk periode ini</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex gap-4 px-3 py-2 bg-slate-50 border-b border-slate-200">
            <div className="text-xs"><span className="text-slate-500">Total Nota:</span> <strong>{rows.length}</strong></div>
            <div className="text-xs"><span className="text-slate-500">Total Nilai:</span> <strong className="text-teal-primary">{fmt(totalNilai)}</strong></div>
            <div className="text-xs"><span className="text-slate-500">Total Sisa:</span> <strong className="text-red-700">{fmt(totalSisa)}</strong></div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="text-left px-2 py-1.5">#</th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Kode Nota</th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Tanggal Nota</th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Jatuh Tempo</th>
                  <th className="text-left px-2 py-1.5">Supplier</th>
                  <th className="text-right px-2 py-1.5 whitespace-nowrap">Total Nota</th>
                  <th className="text-right px-2 py-1.5 whitespace-nowrap">Sisa Nota</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t hover:bg-slate-50">
                    <td className="px-2 py-1 text-slate-400">{i+1}</td>
                    <td className="px-2 py-1 whitespace-nowrap font-mono text-[10px]">{r.kode_nota}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{r.tanggal_nota}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-red-600 font-medium">{r.jatuh_tempo}</td>
                    <td className="px-2 py-1">{r.supplier}</td>
                    <td className="px-2 py-1 text-right font-mono">{fmt(r.total)}</td>
                    <td className="px-2 py-1 text-right font-mono text-red-700 font-bold">{fmt(r.sisa)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={5} className="px-2 py-1 text-xs font-bold text-right">TOTAL</td>
                  <td className="px-2 py-1 text-right font-mono font-bold">{fmt(totalNilai)}</td>
                  <td className="px-2 py-1 text-right font-mono font-bold text-red-700">{fmt(totalSisa)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
