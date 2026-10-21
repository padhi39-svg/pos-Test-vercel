"use client"
import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'
import SortIcon from '@/components/ui/SortIcon'
import { sanitizeDateInput } from '@/lib/sanitizeDateInput'

interface Row {
  transaction_id: number
  transaction_number: string
  transaction_date: string
  barang_id: number
  barang_code: string
  barang_name: string
  product_qty: number
  ingredient_id: number
  ingredient_code: string
  ingredient_name: string
  recipe_qty: number
  base_unit: string
  ingredient_hpp: number
  ingredient_used: number
  total_hpp: number
}

export default function SalesIngredientReportPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    // set default current month
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setFrom(firstDay.toISOString().split("T")[0])
    setTo(lastDay.toISOString().split("T")[0])
  }, [])

  const loadReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      if (note.trim()) params.set("transaction_number", note.trim())
      const res = await fetch(`/api/sales-ingredient-report?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRows(data.rows || [])
      } else {
        setRows([])
      }
    } catch (e) {
      console.error(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const totalHpp = rows.reduce((s, r) => s + Number(r.total_hpp || 0), 0)

  // Group rows by transaction_number then by finished goods
  type GroupMap = Record<string, Record<number, { header: Row; details: Row[] }>>
  const grouped: GroupMap = rows.reduce((acc: GroupMap, r: Row) => {
    if (!acc[r.transaction_number]) acc[r.transaction_number] = {}
    if (!acc[r.transaction_number][r.barang_id]) acc[r.transaction_number][r.barang_id] = { header: r, details: [] as Row[] }
    acc[r.transaction_number][r.barang_id].details.push(r)
    return acc
  }, {} as GroupMap)

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (!rows || rows.length === 0) {
      alert('Tidak ada data untuk di-export')
      return
    }
    const headers = [
      'Kode Nota',
      'Tanggal',
      'Barang Jadi',
      'Qty Produk',
      'Kode Bahan',
      'Nama Bahan',
      'Pemakaian',
      'Satuan',
      'HPP',
      'Total HPP'
    ]
    const lines = rows.map(r => [
      r.transaction_number,
      r.transaction_date,
      r.barang_name,
      String(r.product_qty),
      r.ingredient_code || '',
      r.ingredient_name,
      String(r.ingredient_used),
      r.base_unit,
      String(r.ingredient_hpp || 0),
      String(r.total_hpp || 0)
    ])
    const csv = [
      ['Laporan Penjualan Dengan Ingredient'],
      [`Periode: ${from} s/d ${to}`],
      [],
      headers,
      ...lines
    ].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Laporan_Penjualan_Ingredient_${from}_${to}.csv`
    a.click()
  }

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Laporan Penjualan Dengan Ingredient</h1>
        <p className="report-subtitle">Berbasis resep dan transaksi penjualan (Hanya POS Resto)</p>
      </div>

      {/* Filters */}
      <div className="report-card report-card-pad">
        <div className="flex items-end gap-3">
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Dari Tanggal</label>
            <input type="date" value={from} onChange={(e)=>setFrom(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Sampai Tanggal</label>
            <input type="date" value={to} onChange={(e)=>setTo(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-slate-700 mb-1">Filter Kode Nota (opsional)</label>
            <input type="text" placeholder="TRX-YYYYMMDD-XXXX" value={note} onChange={(e)=>setNote(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary" />
          </div>
          <div className="flex gap-2">
            <button onClick={loadReport} disabled={loading} className="px-4 py-1.5 bg-gradient-to-r from-[#2BA8A2] to-[#3CC4BD] text-white rounded-lg hover:from-[#1E8C86] hover:to-[#2BA8A2] disabled:opacity-50 text-sm font-medium shadow-lg">{loading? 'Memuat...' : 'Tampilkan'}</button>
            {rows.length > 0 && (
              <>
                <button onClick={handlePrint} className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-lg hover:from-teal-dark hover:to-teal-primary text-sm font-medium shadow flex items-center gap-1.5">Print</button>
                <button onClick={handleExportCSV} className="px-3 py-1.5 bg-gradient-to-r from-[#27AE60] to-[#3CC4BD] text-white rounded-lg hover:from-[#1E8C86] hover:to-[#2BA8A2] text-sm font-medium shadow flex items-center gap-1.5">Excel</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="report-card">
        <div className="report-table-wrapper">
        <table className="report-table">
          <thead className="bg-gradient-to-r from-[#2BA8A2] to-[#3CC4BD] text-white">
            <tr>
              <th className="px-2 py-1.5 text-left text-xs font-semibold">Kode Nota</th>
              <th className="px-2 py-1.5 text-left text-xs font-semibold">Barang Jadi</th>
              <th className="px-1 py-1.5 text-right text-xs font-semibold">Qty</th>
              <th className="px-2 py-1.5 text-left text-xs font-semibold">Nama Bahan</th>
              <th className="px-1 py-1.5 text-right text-xs font-semibold">Pemakaian</th>
              <th className="px-1 py-1.5 text-left text-xs font-semibold">Satuan</th>
              <th className="px-1 py-1.5 text-right text-xs font-semibold">HPP</th>
              <th className="px-2 py-1.5 text-right text-xs font-semibold">Total HPP</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(grouped).length === 0 ? (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-slate-500 text-xs">Tidak ada data</td>
              </tr>
            ) : (
              Object.entries(grouped).map(([trx, products]: [string, Record<number, { header: Row; details: Row[] }>]) => (
                Object.values(products).map(({ header, details }: { header: Row; details: Row[] }) => {
                  const rowSpan = Math.max(details.length, 1)
                  const first = details[0]
                  return (
                    <>
                      {/* First row renders merged cells for Kode Nota, Barang Jadi, Qty */}
                      {first && (
                        <tr key={`${trx}-${header.barang_id}-first`} className="border-t hover:bg-slate-50">
                          <td rowSpan={rowSpan} className="px-2 py-1 text-xs text-slate-700 align-top">{header.transaction_number}</td>
                          <td rowSpan={rowSpan} className="px-2 py-1 text-xs text-slate-800 font-semibold align-top">{header.barang_name}</td>
                          <td rowSpan={rowSpan} className="px-1 py-1 text-xs text-right font-semibold text-slate-800 align-top">{header.product_qty.toLocaleString('id-ID')}</td>
                          <td className="px-2 py-1 text-xs text-slate-700">{first.ingredient_name}</td>
                          <td className="px-1 py-1 text-xs text-right text-slate-800 font-semibold">{Number(first.ingredient_used).toLocaleString('id-ID', { maximumFractionDigits: 2 })}</td>
                          <td className="px-1 py-1 text-xs text-left text-slate-600">{first.base_unit}</td>
                          <td className="px-1 py-1 text-xs text-right text-slate-700">{Number(first.ingredient_hpp||0).toLocaleString('id-ID')}</td>
                          <td className="px-2 py-1 text-xs text-right font-bold text-teal-primary">{Number(first.total_hpp||0).toLocaleString('id-ID')}</td>
                        </tr>
                      )}
                      {/* Remaining ingredient rows */}
                      {details.slice(1).map((d: Row) => (
                        <tr key={`${trx}-${header.barang_id}-${d.ingredient_id}`} className="border-t hover:bg-slate-50">
                          <td className="px-2 py-1 text-xs text-slate-700">{d.ingredient_name}</td>
                          <td className="px-1 py-1 text-xs text-right text-slate-800 font-semibold">{Number(d.ingredient_used).toLocaleString('id-ID', { maximumFractionDigits: 2 })}</td>
                          <td className="px-1 py-1 text-xs text-left text-slate-600">{d.base_unit}</td>
                          <td className="px-1 py-1 text-xs text-right text-slate-700">{Number(d.ingredient_hpp||0).toLocaleString('id-ID')}</td>
                          <td className="px-2 py-1 text-xs text-right font-bold text-teal-primary">{Number(d.total_hpp||0).toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </>
                  )
                })
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-300">
            <tr>
              <td colSpan={7} className="px-2 py-1.5 text-xs font-bold text-slate-800 text-right">Total HPP:</td>
              <td className="px-2 py-1.5 text-xs font-bold text-[#B33A1A] text-right font-mono">Rp {totalHpp.toLocaleString('id-ID')}</td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </div>
  )
}
