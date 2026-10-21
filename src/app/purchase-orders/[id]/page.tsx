"use client"
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/regionalNumber'

export default function ViewPurchaseOrderPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/purchase-orders/${id}`)
      if (!res.ok) throw new Error('PO tidak ditemukan')
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      alert(e.message)
      router.push('/purchase-orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleVoid = async () => {
    if (!confirm('Yakin ingin void PO ini?')) return
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'void' })
      })
      if (!res.ok) throw new Error('Gagal void PO')
      alert('PO berhasil di-void')
      load()
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
  }

  if (loading) return <div className="p-4 text-center">Memuat...</div>
  if (!data) return <div className="p-4 text-center">Data tidak ditemukan</div>

  const isVoid = data.status === 'void'

  return (
    <div className="p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Purchase Order: {data.po_number}</h1>
          {isVoid && <span className="text-xs text-red-600 font-semibold">VOID</span>}
        </div>
        <button onClick={() => router.back()} className="text-sm text-slate-600 hover:text-slate-800">← Kembali</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-slate-600">Supplier:</span> <span className="font-medium">{data.supplier_name || '-'}</span></div>
          <div><span className="text-slate-600">Tanggal Order:</span> <span className="font-medium">{data.order_date || '-'}</span></div>
          <div><span className="text-slate-600">Tanggal Diharapkan:</span> <span className="font-medium">{data.expected_date || '-'}</span></div>
          <div><span className="text-slate-600">Status:</span> <span className="font-medium">{data.status}</span></div>
          <div className="md:col-span-2"><span className="text-slate-600">Catatan:</span> <span className="font-medium">{data.notes || '-'}</span></div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-800 mb-2">Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-1 text-left">Kode</th>
                <th className="px-2 py-1 text-left">Nama</th>
                <th className="px-2 py-1 text-right">Qty</th>
                <th className="px-2 py-1 text-left">Unit</th>
                <th className="px-2 py-1 text-right">Harga</th>
                <th className="px-2 py-1 text-right">Disc%</th>
                <th className="px-2 py-1 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(data.items || []).map((it: any) => (
                <tr key={it.id} className="border-t">
                  <td className="px-2 py-1">{it.barang_code}</td>
                  <td className="px-2 py-1">{it.barang_name}</td>
                  <td className="px-2 py-1 text-right">{it.quantity}</td>
                  <td className="px-2 py-1">{it.unit_name}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(it.unit_price)}</td>
                  <td className="px-2 py-1 text-right">{it.discount_percent}%</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(it.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm"><span className="text-slate-600">DPP (Subtotal):</span><span className="font-semibold">{formatCurrency(data.subtotal || 0)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-slate-600">PPN ({data.ppn_percent}%):</span><span className="font-semibold">{formatCurrency(data.ppn_amount || 0)}</span></div>
        <div className="flex justify-between text-base font-bold border-t pt-2"><span>Total:</span><span>{formatCurrency(data.total || 0)}</span></div>
      </div>

      <div className="flex gap-2">
        {!isVoid && (
          <>
            <Link href={`/purchase-orders/${id}/edit`} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">Edit</Link>
            <button onClick={handleVoid} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Void</button>
          </>
        )}
        <button onClick={() => router.push('/purchase-orders')} className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300">Kembali ke Daftar</button>
      </div>
    </div>
  )
}
