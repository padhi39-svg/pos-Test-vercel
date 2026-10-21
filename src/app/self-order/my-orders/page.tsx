"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

function getCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(name + '='))
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
}

type OrderEntry = { uid: string; orderNumber: number }

export default function MyOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = getCookie("self_order_orders")
      if (raw) {
        const list = JSON.parse(raw)
        if (Array.isArray(list)) setOrders(list)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Memuat...</div>
  }

  return (
    <div className="space-y-4 m-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">Pesanan Saya</h1>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">Belum ada pesanan</div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <button
              key={order.uid}
              onClick={() => router.push(`/self-order/my-orders/${order.uid}`)}
              className="w-full bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-bg flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-teal-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-slate-800">Pesanan #{order.orderNumber}</div>
                </div>
              </div>
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => router.back()}
        className="w-full py-2.5 rounded-pill border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Kembali
      </button>
    </div>
  )
}
