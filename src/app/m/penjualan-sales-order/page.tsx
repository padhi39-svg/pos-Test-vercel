"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/regionalNumber"

interface SoRow {
  id: number
  so_number: string
  so_date: string
  customer_name: string
  grand_total: number
  status: string
}

export default function MobileSalesOrderListPage() {
  const router = useRouter()
  const [rows, setRows] = useState<SoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")
  const [q, setQ] = useState("")

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch("/api/sales-orders")
        const data = res.ok ? await res.json() : []
        if (!alive) return
        const list = Array.isArray(data)
          ? data.map((x: any) => ({
              id: x.id,
              so_number: x.so_number,
              so_date: x.so_date?.slice(0, 10) || "",
              customer_name: x.customer_name || x.customer || "",
              grand_total: Number(x.grand_total || x.total || 0),
              status: x.status || "draft",
            }))
          : []
        setRows(list)
      } catch (e) {
        console.error(e)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const filtered = rows.filter((r) => {
    const st = status.trim().toLowerCase()
    if (st && r.status.toLowerCase() !== st) return false
    const qq = q.trim().toLowerCase()
    if (qq && !`${r.so_number} ${r.customer_name}`.toLowerCase().includes(qq)) return false
    return true
  })

  return (
    <div className="p-3 space-y-3 md:hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Sales Order</h1>
          <p className="text-[11px] text-slate-600 mt-0.5">Mode mobile, fokus ke Qty, Harga dan Total.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/m/penjualan-sales-order/new")}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs"
        >
          + SO Baru
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 space-y-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari no / customer..."
          className="w-full border rounded px-2 py-1 text-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full border rounded px-2 py-1 text-xs"
        >
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
        </select>
      </div>

      <div className="space-y-2">
        {loading && <div className="text-center text-xs text-slate-500 py-4">Memuat...</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-center text-xs text-slate-500 py-4">Tidak ada Sales Order</div>
        )}
        {filtered.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => router.push(`/m/penjualan-sales-order/${r.id}`)}
            className="w-full text-left border rounded-lg bg-white shadow-sm p-3 space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] text-slate-500">No SO</div>
                <div className="text-sm font-semibold text-slate-800">{r.so_number}</div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                  r.status === "confirmed"
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                    : "bg-amber-100 text-amber-700 border border-amber-300"
                }`}
              >
                {r.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1">
              <div>{r.so_date}</div>
              <div className="font-medium text-emerald-700">{formatCurrency(r.grand_total || 0)}</div>
            </div>
            <div className="mt-1 text-[11px] text-slate-600 truncate">
              {r.customer_name || "Tanpa customer"}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
