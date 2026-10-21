"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/regionalNumber"

function toCurrency(n: number) {
  return (Number(n) || 0).toLocaleString("id-ID")
}

export default function ViewReturnPage() {
  const params = useParams()
  const router = useRouter()
  const id = Array.isArray(params?.id) ? params.id[0] : String(params?.id || "")

  const [loading, setLoading] = useState(true)
  const [tx, setTx] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/transactions/${id}`)
        if (!res.ok) throw new Error("not found")
        const data = await res.json()
        setTx(data)
      } catch {
        alert("Retur tidak ditemukan")
        router.push("/retur-penjualan")
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id, router])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-primary mx-auto mb-2" />
          <p className="text-slate-600">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (!tx) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-600">Retur tidak ditemukan</p>
      </div>
    )
  }

  const items = Array.isArray(tx.items) ? tx.items : []
  const r = Number(tx.ppn_percent || 0) / 100
  const includeTax = Number(tx.price_include_tax) === 1
  const discountPercent = Number(tx.discount_percent || 0)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Detail Retur Penjualan</h1>
          <p className="text-slate-500 text-xs mt-1">View retur penjualan</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push("/retur-penjualan")}
            className="px-3 py-1.5 rounded-pill border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm">Kembali</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 pb-3 border-b">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer</label>
            <input type="text" value={tx.customer_name || "-"} disabled className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-pill text-xs text-slate-700" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Gudang</label>
            <input type="text" value={tx.warehouse_name || tx.warehouse_code || `Gudang #${tx.warehouse_id || "-"}`} disabled className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-pill text-xs text-slate-700" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 pb-3 border-b">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Sales</label>
            <input type="text" value={tx.sales_name || "-"} disabled className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-pill text-xs text-slate-700" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">No. Faktur Pajak</label>
            <input type="text" value={tx.faktur_pajak || "-"} disabled className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-pill text-xs text-slate-700" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Referensi Invoice</label>
            <input type="text" value={tx.invoice_ref_number || tx.reference_transaction_id || "-"} disabled className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-pill text-xs text-slate-700" />
          </div>
        </div>

        <div className="mb-4">
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gradient-to-r from-slate-600 to-slate-700 text-white">
                <tr>
                  <th className="px-2 py-1.5 text-left">Barang</th>
                  <th className="px-2 py-1.5 text-center w-12">Qty</th>
                  <th className="px-2 py-1.5 text-left w-24">Satuan</th>
                  <th className="px-2 py-1.5 text-center w-16">Qty Bonus</th>
                  <th className="px-2 py-1.5 text-center w-16">Sat Bonus</th>
                  <th className="px-2 py-1.5 text-right w-28">Harga Satuan</th>
                  <th className="px-2 py-1.5 text-right w-16">Disc%</th>
                  <th className="px-2 py-1.5 text-right w-16">Disc1%</th>
                  <th className="px-2 py-1.5 text-right w-16">Disc2%</th>
                  <th className="px-2 py-1.5 text-right w-16">Disc3%</th>
                  <th className="px-2 py-1.5 text-right w-20">DiscRp</th>
                  <th className="px-2 py-1.5 text-right w-28">Netto</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={12} className="px-2 py-4 text-center text-slate-500">Tidak ada item</td></tr>
                ) : items.map((it: any, idx: number) => {
                  const qty = Number(it.quantity) || 0
                  const unitPrice = Number(it.unit_price) || (qty > 0 ? Math.round(Number(it.total_price || 0) / qty) : 0)
                  return (
                    <tr key={it.id || idx} className="border-b hover:bg-slate-50">
                      <td className="px-2 py-1.5">{it.barang_name || "-"}</td>
                      <td className="px-2 py-1.5 text-center">{toCurrency(qty)}</td>
                      <td className="px-2 py-1.5">{it.unit_name || "-"}</td>
                      <td className="px-2 py-1.5 text-center">{Number(it.bonus_qty || 0) > 0 ? toCurrency(it.bonus_qty) : "-"}</td>
                      <td className="px-2 py-1.5 text-center">{it.bonus_unit || "-"}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(unitPrice)}</td>
                      <td className="px-2 py-1.5 text-right">{toCurrency(it.discount_percent)}</td>
                      <td className="px-2 py-1.5 text-right">{toCurrency(it.disc1_percent)}</td>
                      <td className="px-2 py-1.5 text-right">{toCurrency(it.disc2_percent)}</td>
                      <td className="px-2 py-1.5 text-right">{toCurrency(it.disc3_percent)}</td>
                      <td className="px-2 py-1.5 text-right">{toCurrency(it.disc_nominal)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">{formatCurrency(it.net_amount || it.total_price || 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Catatan</label>
            <textarea value={tx.notes || ""} disabled className="w-full h-20 bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 resize-none" />
          </div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between py-1"><span className="text-slate-600">Subtotal</span><span className="font-semibold">{formatCurrency(tx.subtotal)}</span></div>
            {discountPercent > 0 && <div className="flex justify-between py-1"><span className="text-slate-600">Diskon {toCurrency(discountPercent)}%</span><span className="font-semibold text-red-600">- {formatCurrency(tx.discount_amount)}</span></div>}
            <div className="flex justify-between py-1"><span className="text-slate-600">PPN</span><span className="font-semibold text-teal-primary">+ {formatCurrency(tx.ppn_amount)}</span></div>
            <div className="flex justify-between py-1 border-t mt-1 pt-2"><span className="font-bold text-slate-800">Total Retur</span><span className="font-bold text-teal-primary">{formatCurrency(tx.total)}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
