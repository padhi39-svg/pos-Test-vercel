"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/regionalNumber'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'

export default function GoodsReceiptListPage() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/goods-receipts')
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = data.filter(gr => 
    gr.gr_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    gr.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    gr.po_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalGR = filtered.length
  const totalNilai = filtered.reduce((sum, gr) => sum + (gr.total || 0), 0)

  return (
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">Penerimaan Barang</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">Daftar Penerimaan Barang (Goods Receipt)</p>
        </div>
        <button
          onClick={async () => {
            const today = new Date().toISOString().slice(0, 10)
            const ok = await ensurePeriodForDateOrToast(today)
            if (!ok) return
            router.push('/pembelian/penerimaan/new')
          }}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-teal-primary to-teal-light hover:from-teal-dark hover:to-teal-primary text-white rounded-pill font-medium transition-colors text-xs sm:text-sm flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Terima Barang
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-teal-primary to-teal-dark rounded-lg shadow-sm p-3 sm:p-4 text-white">
          <div className="text-xs sm:text-sm opacity-90 mb-1">Total Penerimaan</div>
          <div className="text-xl sm:text-2xl md:text-3xl font-bold">{totalGR}</div>
        </div>
        <div className="bg-gradient-to-br from-teal-primary to-teal-light rounded-lg shadow-sm p-3 sm:p-4 text-white">
          <div className="text-xs sm:text-sm opacity-90 mb-1">Total Nilai</div>
          <div className="text-xl sm:text-2xl md:text-3xl font-bold">{formatCurrency(totalNilai)}</div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <input
          type="text"
          placeholder="Cari No. GR, No. PO, Supplier..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-primary mx-auto mb-2"></div>
            <p className="text-slate-600 text-sm">Memuat data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            {searchTerm ? 'Tidak ada data yang sesuai dengan pencarian' : 'Belum ada penerimaan barang'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-gradient-to-r from-teal-primary to-teal-light text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">No. GR</th>
                  <th className="px-3 py-2 text-left font-semibold">No. PO</th>
                  <th className="px-3 py-2 text-left font-semibold">Supplier</th>
                  <th className="px-3 py-2 text-left font-semibold">Tanggal</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-center font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((gr) => (
                  <tr key={gr.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{gr.gr_number}</td>
                    <td className="px-3 py-2 text-slate-600">{gr.po_number || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{gr.supplier_name || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{gr.receipt_date}</td>
                    <td className="px-3 py-2 text-right font-semibold text-teal-primary">{formatCurrency(gr.total)}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => router.push(`/pembelian/penerimaan/${gr.id}`)}
                        className="text-teal-primary hover:text-blue-800 font-medium text-xs"
                      >
                        Lihat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
