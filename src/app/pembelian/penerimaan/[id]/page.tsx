"use client"
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { formatCurrency } from '@/lib/regionalNumber'

export default function ViewGoodsReceiptPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/goods-receipts/${id}`)
      if (!res.ok) throw new Error('Penerimaan barang tidak ditemukan')
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      alert(e.message)
      router.push('/pembelian/penerimaan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-primary mx-auto mb-2"></div>
          <p className="text-slate-600">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Penerimaan barang tidak ditemukan</p>
          <button onClick={() => router.push('/pembelian/penerimaan')} className="mt-4 px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark">
            Kembali
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Detail Penerimaan Barang</h1>
          <p className="text-slate-600 text-sm mt-1">{data.gr_number}</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            Completed
          </span>
          <button onClick={() => router.push('/pembelian/penerimaan')} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-pill font-medium text-sm">
            Kembali
          </button>
        </div>
      </div>

      {/* Header Info */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-600 font-bold">No. PO:</span>
            <span className="ml-2 text-slate-800">{data.po_number || '-'}</span>
          </div>
          <div>
            <span className="text-slate-600 font-bold">Supplier:</span>
            <span className="ml-2 text-slate-800">{data.supplier_name || '-'}</span>
          </div>
          <div>
            <span className="text-slate-600 font-bold">Tanggal Terima:</span>
            <span className="ml-2 text-slate-800">{data.receipt_date || '-'}</span>
          </div>
          <div>
            <span className="text-slate-600 font-bold">Status:</span>
            <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Completed</span>
          </div>
          {data.notes && (
            <div className="md:col-span-2">
              <span className="text-slate-600 font-bold">Catatan:</span>
              <span className="ml-2 text-slate-800">{data.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
        <h3 className="text-base font-bold text-slate-800 mb-3">Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-2 text-left font-bold text-slate-700">Kode</th>
                <th className="px-2 py-2 text-left font-bold text-slate-700">Nama Barang</th>
                <th className="px-2 py-2 text-right font-bold text-slate-700">Qty</th>
                <th className="px-2 py-2 text-left font-bold text-slate-700">Unit</th>
                <th className="px-2 py-2 text-right font-bold text-slate-700">Harga</th>
                <th className="px-2 py-2 text-right font-bold text-slate-700">Disc%</th>
                <th className="px-2 py-2 text-right font-bold text-slate-700">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(data.items || []).map((it: any) => (
                <tr key={it.id} className="border-t">
                  <td className="px-2 py-2 text-slate-700">{it.barang_code}</td>
                  <td className="px-2 py-2 text-slate-700">{it.barang_name}</td>
                  <td className="px-2 py-2 text-right text-slate-700">{it.quantity}</td>
                  <td className="px-2 py-2 text-slate-700">{it.unit_name}</td>
                  <td className="px-2 py-2 text-right text-slate-700">{formatCurrency(it.unit_price)}</td>
                  <td className="px-2 py-2 text-right text-slate-700">{it.discount_percent}%</td>
                  <td className="px-2 py-2 text-right font-semibold text-slate-800">{formatCurrency(it.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="max-w-md ml-auto space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Subtotal:</span>
            <span className="font-medium">{formatCurrency(data.subtotal + data.discount_amount || 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Diskon ({data.discount_percent}%):</span>
            <span className="font-medium text-red-600">-{formatCurrency(data.discount_amount || 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">DPP:</span>
            <span className="font-medium">{formatCurrency(data.subtotal || 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">PPN ({data.ppn_percent}%):</span>
            <span className="font-medium">{formatCurrency(data.ppn_amount || 0)}</span>
          </div>
          <div className="border-t border-slate-300 pt-2">
            <div className="flex justify-between text-base font-bold">
              <span className="text-slate-800">TOTAL:</span>
              <span className="text-teal-primary">{formatCurrency(data.total || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
