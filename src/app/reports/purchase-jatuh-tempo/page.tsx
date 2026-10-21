"use client"
import { useEffect, useState, useMemo } from "react"
import { formatCurrency } from "@/lib/regionalNumber"

interface Row {
  id: number
  kode_nota: string
  supplier: string
  tanggal_nota: string
  total: number
  jatuh_tempo: string
}

export default function PurchaseJatuhTempoPage() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    loadReport()
  }, [])

  const loadReport = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/reports/purchase-jatuh-tempo')
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

  const totalAmount = useMemo(() => rows.reduce((s, r) => s + Number(r.total || 0), 0), [rows])

  const formatDate = (d: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const handlePrint = () => { window.print() }

  const handleExportCSV = () => {
    if (!rows.length) { alert('Tidak ada data'); return }
    const csv = [
      ['Laporan Pembelian Jatuh Tempo'],
      [],
      ['Kode Nota', 'Supplier', 'Tanggal Nota', 'Total', 'Jatuh Tempo'],
      ...rows.map(r => [r.kode_nota, r.supplier, r.tanggal_nota, String(r.total), r.jatuh_tempo]),
    ].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Pembelian_Jatuh_Tempo.csv`
    a.click()
  }

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Laporan Pembelian Jatuh Tempo</h1>
        <p className="report-subtitle">Nota pembelian yang sudah jatuh tempo</p>
      </div>

      <div className="report-card report-card-pad flex items-center gap-3">
        <button onClick={loadReport} disabled={loading} className="px-4 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary disabled:opacity-50 text-sm font-medium shadow-lg">{loading ? 'Memuat...' : 'Refresh'}</button>
        {rows.length > 0 && (
          <>
            <button onClick={handlePrint} className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary text-sm font-medium shadow">Print</button>
            <button onClick={handleExportCSV} className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary text-sm font-medium shadow">Excel</button>
          </>
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex gap-4 mb-4">
          <div className="report-card px-4 py-2">
            <div className="text-xs text-slate-600">Total Nota</div>
            <div className="text-lg font-bold text-slate-800">{rows.length}</div>
          </div>
          <div className="report-card px-4 py-2">
            <div className="text-xs text-slate-600">Total Nilai</div>
            <div className="text-lg font-bold text-red-600">{formatCurrency(totalAmount)}</div>
          </div>
        </div>
      )}

      <div className="report-card">
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead className="bg-gradient-to-r from-teal-primary to-teal-light text-white">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold">Kode Nota</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Supplier</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Tanggal Nota</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Total</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Jatuh Tempo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">Memuat data...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">Tidak ada pembelian yang jatuh tempo</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs font-medium text-slate-800">{r.kode_nota}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{r.supplier}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{r.tanggal_nota ? formatDate(r.tanggal_nota) : '-'}</td>
                    <td className="px-3 py-2 text-xs text-right font-semibold text-teal-primary">{formatCurrency(r.total)}</td>
                    <td className="px-3 py-2 text-xs text-red-600 font-medium">{r.jatuh_tempo ? formatDate(r.jatuh_tempo) : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && rows.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={3} className="px-3 py-1.5 text-xs font-bold text-slate-700 text-right">TOTAL</td>
                  <td className="px-3 py-1.5 text-xs font-bold text-teal-primary text-right font-mono">{formatCurrency(totalAmount)}</td>
                  <td className="px-3 py-1.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
