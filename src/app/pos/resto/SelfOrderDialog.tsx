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

export default function SelfOrderDialog({ onClose, onPay }: { onClose: () => void; onPay?: (order: Order) => void }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [timezone, setTimezone] = useState("+7")

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/self-order/admin/orders")
      if (res.ok) setOrders(await res.json())
    } catch {}
  }

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    ;(async () => {
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

  useEffect(() => {
    const interval = setInterval(fetchOrders, 10000)
    return () => clearInterval(interval)
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

  const unpaidOrders = orders.filter((o) => o.payment_status === "unpaid")

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[800px] max-w-[95vw] max-h-[85vh] flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-bold text-[#3C3C3C]">Self Order</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-primary border-t-transparent"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Belum ada pesanan</div>
          ) : unpaidOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Tidak ada pesanan belum bayar</div>
          ) : (
            <div className="space-y-4">
              {/* Unpaid orders table */}
              {unpaidOrders.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-600 mb-2">Belum Bayar ({unpaidOrders.length})</div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">No</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">Meja</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">Item</th>
                          <th className="text-right px-3 py-2 font-semibold text-slate-600">Total</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">Status</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">Waktu</th>
                          <th className="text-right px-3 py-2 font-semibold text-slate-600">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unpaidOrders.map((order) => {
                          const badge = statusLabel[order.payment_status] || statusLabel.unpaid
                          return (
                            <tr key={order.uid} className="border-b border-slate-100 last:border-0">
                              <td className="px-3 py-2 font-semibold text-slate-800">#{order.order_number}</td>
                              <td className="px-3 py-2">
                                {order.meja_name ? (
                                  <span className="text-teal-primary font-medium">{order.meja_name}</span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-600">{order.items.length} item</td>
                              <td className="px-3 py-2 text-right font-bold text-teal-primary">
                                {formatCurrency(order.total_price)}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${badge.color}`}>
                                  {badge.text}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-500">{formatTime(order.created_at)}</td>
                              <td className="px-3 py-2 text-right">
                                {onPay && (
                                  <button
                                    onClick={() => { onPay(order); onClose(); }}
                                    className="text-xs px-3 py-1 rounded-full bg-[#FFD23F] text-slate-800 hover:bg-[#E6B800] transition-colors font-semibold"
                                  >
                                    Bayar
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl font-medium transition-colors text-sm"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
