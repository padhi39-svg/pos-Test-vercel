"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'
import { useRouter } from 'next/navigation'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/purchase-orders')
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Purchase Orders</h1>
          <p className="text-xs text-slate-500">Daftar Purchase Order (PO) — belum menambah stok</p>
        </div>
        <button
          onClick={async () => {
            const today = new Date().toISOString().slice(0, 10)
            const ok = await ensurePeriodForDateOrToast(today)
            if (!ok) return
            router.push('/purchase-orders/new')
          }}
          className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm shadow"
        >
          Tambah PO
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left">PO Number</th>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Tanggal</th>
              <th className="px-3 py-2 text-right">DPP</th>
              <th className="px-3 py-2 text-right">PPN</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={8}>Memuat...</td></tr>
            ) : data.length === 0 ? (
              <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={8}>Belum ada data</td></tr>
            ) : (
              data.map(po => (
                <tr key={po.id} className="border-t">
                  <td className="px-3 py-2 font-medium text-slate-800">{po.po_number}</td>
                  <td className="px-3 py-2">{po.supplier_name || '-'}</td>
                  <td className="px-3 py-2">{po.order_date || '-'}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(po.subtotal || 0)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(po.ppn_amount || 0)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(po.total || 0)}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">{po.status}</span></td>
                  <td className="px-3 py-2 text-center">
                    <Link href={`/purchase-orders/${po.id}`} className="text-indigo-600 hover:underline">Lihat</Link>
                    <span className="mx-2">·</span>
                    <Link href={`/purchase-orders/${po.id}/edit`} className="text-emerald-600 hover:underline">Edit</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
