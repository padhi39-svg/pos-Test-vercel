"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/regionalNumber"
import { showError } from "@/lib/notification"

type SoItem = {
  id: number
  barang_name: string
  unit_name: string
  quantity: number
  unit_price: number
  discount_total: number
  total_price: number
}

type SalesOrder = {
  id: number
  so_number: string
  so_date: string
  status: string
  customer_name: string
  customer_code?: string
  sales_name?: string
  warehouse_name?: string
  notes?: string
  subtotal: number
  discount_percent: number
  discount_amount: number
  tax_rate_percent: number
  ppn_amount: number
  grand_total: number
  items: SoItem[]
}

export default function MobileSalesOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<SalesOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/sales-orders/${params.id}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error || "Gagal memuat Sales Order")
        }
        const json = await res.json()
        setData(json)
      } catch (e: any) {
        console.error("Load SO detail failed:", e)
        showError(e?.message || "Gagal memuat Sales Order")
      } finally {
        setLoading(false)
      }
    }
    if (params?.id) load()
  }, [params?.id])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 md:hidden">
        <div className="text-center text-xs text-slate-600">Memuat Sales Order...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-3 md:hidden">
        <div className="text-xs text-red-600">Sales Order tidak ditemukan.</div>
      </div>
    )
  }

  const canEdit = data.status === "draft"

  return (
    <div className="p-3 space-y-3 md:hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-800">Sales Order</h1>
          <div className="text-[11px] text-slate-500">No: {data.so_number}</div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
            data.status === "confirmed"
              ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
              : "bg-amber-100 text-amber-700 border border-amber-300"
          }`}
        >
          {data.status}
        </span>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 space-y-2">
        <div className="text-[11px] text-slate-500">Tanggal SO</div>
        <div className="text-xs font-semibold text-slate-800">{data.so_date?.slice(0, 10)}</div>
        <div>
          <div className="text-[11px] text-slate-500">Customer</div>
          <div className="text-xs font-semibold text-slate-800">
            {data.customer_code ? `${data.customer_code} - ` : ""}
            {data.customer_name}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">Sales</div>
          <div className="text-xs font-semibold text-slate-800">{data.sales_name || "-"}</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">Gudang</div>
          <div className="text-xs font-semibold text-slate-800">{data.warehouse_name || "-"}</div>
        </div>
      </div>

      {/* Items as stacked list */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2">
        <div className="text-xs font-bold text-slate-800 mb-2">Detail Barang</div>
        <div className="space-y-2">
          {data.items?.map((it) => (
            <div key={it.id} className="border rounded-md p-2 text-[11px] space-y-1">
              <div className="font-semibold text-slate-800">{it.barang_name}</div>
              <div className="flex justify-between">
                <span className="text-slate-600">Qty</span>
                <span className="font-medium">{it.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Satuan</span>
                <span className="font-medium">{it.unit_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Harga</span>
                <span className="font-medium">{formatCurrency(it.unit_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Diskon</span>
                <span className="font-medium text-red-600">
                  {it.discount_total ? `-${formatCurrency(it.discount_total)}` : "-"}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-slate-700 font-semibold">Subtotal</span>
                <span className="font-semibold text-emerald-700">{formatCurrency(it.total_price)}</span>
              </div>
            </div>
          ))}
          {(!data.items || data.items.length === 0) && (
            <div className="text-center text-[11px] text-slate-500 py-2">Tidak ada item.</div>
          )}
        </div>
      </div>

      {/* Notes & summary */}
      <div className="space-y-2">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2">
          <div className="text-[11px] text-slate-500 mb-0.5">Catatan</div>
          <div className="text-xs whitespace-pre-wrap min-h-[40px] border border-slate-200 rounded-md p-2 bg-slate-50">
            {data.notes || "-"}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 text-[11px] space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-medium">{formatCurrency(data.subtotal || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Diskon ({(data.discount_percent || 0).toFixed(2)}%)</span>
            <span className="font-medium text-red-600">-{formatCurrency(data.discount_amount || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">PPN ({(data.tax_rate_percent || 0).toFixed(2)}%)</span>
            <span className="font-medium">{formatCurrency(data.ppn_amount || 0)}</span>
          </div>
          <div className="border-t border-slate-300 pt-1 mt-1">
            <div className="flex justify-between text-[12px] font-bold">
              <span className="text-slate-800">TOTAL</span>
              <span className="text-emerald-600">{formatCurrency(data.grand_total || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-1">
        <button
          type="button"
          onClick={() => router.push("/m/penjualan-sales-order")}
          className="px-3 py-1.5 rounded border text-xs"
        >
          Kembali
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => router.push(`/m/penjualan-sales-order/${data.id}/edit`)}
            className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  )
}
