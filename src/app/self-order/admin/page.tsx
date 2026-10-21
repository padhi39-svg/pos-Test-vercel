"use client"

import { useEffect, useState } from "react"
import { formatCurrency } from "@/lib/regionalNumber"

type OrderItem = {
  barang_id: number
  barang_name: string
  price: number
  qty: number
  subtotal: number
}

type Order = {
  uid: string
  order_number: number
  total_price: number
  payment_status: string
  status: string
  notes: string | null
  created_at: string
  meja_id: number | null
  meja_name: string | null
  items: OrderItem[]
}

const statusLabel: Record<string, { text: string; color: string }> = {
  unpaid: { text: "Belum Bayar", color: "bg-amber-100 text-amber-700" },
  paid: { text: "Lunas", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { text: "Dibatalkan", color: "bg-red-100 text-red-700" },
}

export default function SelfOrderAdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [timezone, setTimezone] = useState("+7")
  const [expandedUid, setExpandedUid] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const [ordersRes, tzRes] = await Promise.all([
          fetch("/api/self-order/admin/orders"),
          fetch("/api/self-order/settings"),
        ])
        if (ordersRes.ok) setOrders(await ordersRes.json())
        if (tzRes.ok) {
          const tz = await tzRes.json()
          if (tz.timezone) setTimezone(tz.timezone)
        }
      } catch (e) {
        console.error("Error loading orders:", e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const offset = parseFloat(timezone) * 60
    const utc = date.getTime() + date.getTimezoneOffset() * 60000
    const local = new Date(utc + offset * 60000)
    const d = local.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
    const hh = String(local.getUTCHours()).padStart(2, "0")
    const mm = String(local.getUTCMinutes()).padStart(2, "0")
    const ss = String(local.getUTCSeconds()).padStart(2, "0")
    return `${d}, ${hh}:${mm}:${ss}`
  }

  const handleMarkPaid = async (uid: string) => {
    try {
      const res = await fetch(`/api/self-order/order/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_status: "paid" }),
      })
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.uid === uid ? { ...o, payment_status: "paid" } : o
          )
        )
      }
    } catch (e) {
      console.error("Error marking paid:", e)
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Memuat...</div>
  }

  return (
    <div className="space-y-4 m-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">Self Order</h1>
        <p className="text-slate-500 text-xs mt-1">Daftar pesanan dari pelanggan</p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">Belum ada pesanan</div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const badge = statusLabel[order.payment_status] || statusLabel.unpaid
            const isExpanded = expandedUid === order.uid
            return (
              <div
                key={order.uid}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedUid(isExpanded ? null : order.uid)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-semibold text-slate-800">
                      #{order.order_number}
                    </div>
                    {order.meja_name && (
                      <div className="text-xs font-medium text-teal-primary bg-teal-bg px-2 py-0.5 rounded">
                        {order.meja_name}
                      </div>
                    )}
                    <div className="text-xs text-slate-500">
                      {order.items.length} item
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-teal-primary">
                      {formatCurrency(order.total_price)}
                    </span>
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${badge.color}`}>
                      {badge.text}
                    </span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100">
                    <div className="px-4 py-2 bg-slate-50 flex items-center justify-between">
                      <span className="text-xs text-slate-500">{formatTime(order.created_at)}</span>
                      {order.payment_status === "unpaid" && (
                        <button
                          onClick={() => handleMarkPaid(order.uid)}
                          className="text-xs px-2 py-1 rounded-pill bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                        >
                          Tandai Lunas
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="px-4 py-2 flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-800 truncate">
                              {item.barang_name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatCurrency(item.price)} x {item.qty}
                            </div>
                          </div>
                          <span className="text-sm font-medium text-slate-800 ml-3">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
