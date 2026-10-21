"use client"

import { useEffect, useRef, useState } from "react"
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

type PaymentMethod = "cash" | "transfer" | "debit" | "credit"

type PaymentRow = {
  method: PaymentMethod
  bankId: number | null
  cardNumber: string
  amount: number
  amountDisplay: string
}

const statusLabel: Record<string, { text: string; color: string }> = {
  unpaid: { text: "Belum Bayar", color: "bg-amber-100 text-amber-700" },
  paid: { text: "Lunas", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { text: "Dibatalkan", color: "bg-red-100 text-red-700" },
}

export default function SelfOrderListPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [timezone, setTimezone] = useState("+7")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  // Payment state
  const [showPayModal, setShowPayModal] = useState(false)
  const [payOrder, setPayOrder] = useState<Order | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([
    { method: "cash", bankId: null, cardNumber: "", amount: 0, amountDisplay: "" },
  ])
  const [banks, setBanks] = useState<any[]>([])
  const [isPaying, setIsPaying] = useState(false)

  useEffect(() => {
    const el = pageRef.current
    if (!el) return
    const update = () => {
      if (!el) return
      const top = el.getBoundingClientRect().top
      el.style.height = `calc(100dvh - ${top}px)`
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const [ordersRes, tzRes, banksRes] = await Promise.all([
          fetch("/api/self-order/admin/orders"),
          fetch("/api/self-order/settings"),
          fetch("/api/banks"),
        ])
        if (ordersRes.ok) setOrders(await ordersRes.json())
        if (tzRes.ok) {
          const tz = await tzRes.json()
          if (tz.timezone) setTimezone(tz.timezone)
        }
        if (banksRes.ok) setBanks(await banksRes.json())
      } catch (e) {
        console.error("Error loading:", e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const res = await fetch("/api/self-order/admin/orders")
        if (res.ok) setOrders(await res.json())
      } catch {}
    }
    const interval = setInterval(loadOrders, 10000)
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

  const handleMarkPaid = async (uid: string) => {
    if (markingPaid) return
    setMarkingPaid(uid)
    try {
      const res = await fetch(`/api/self-order/order/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_status: "paid" }),
      })
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.uid === uid ? { ...o, payment_status: "paid" } : o))
        )
        setSelectedOrder((prev) =>
          prev && prev.uid === uid ? { ...prev, payment_status: "paid" } : prev
        )
      }
    } catch (e) {
      console.error("Error marking paid:", e)
    } finally {
      setMarkingPaid(null)
    }
  }

  const openPayModal = (order: Order) => {
    setPayOrder(order)
    setPayments([
      { method: "cash", bankId: null, cardNumber: "", amount: order.total_price, amountDisplay: order.total_price.toLocaleString("id-ID") },
    ])
    setShowPayModal(true)
  }

  const getTodayDate = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }

  const handlePayment = async () => {
    if (isPaying || !payOrder) return

    const paymentsForApi = payments
      .filter((p) => p.amount > 0)
      .map((p) => ({
        method: p.method === "debit" ? "Debit Card" : p.method === "credit" ? "Credit Card" : p.method,
        amount: p.amount,
        bankId: p.bankId,
        cardNumber: p.cardNumber.trim() || null,
      }))

    if (paymentsForApi.length === 0) {
      alert("Nominal pembayaran harus diisi")
      return
    }

    const totalPaid = paymentsForApi.reduce((sum, p) => sum + p.amount, 0)
    if (totalPaid < payOrder.total_price) {
      alert(`Total pembayaran (${formatCurrency(totalPaid)}) kurang dari total nota (${formatCurrency(payOrder.total_price)})`)
      return
    }

    for (const p of paymentsForApi) {
      if (p.method !== "cash" && !p.bankId) {
        alert(`Bank wajib dipilih untuk pembayaran ${p.method}`)
        return
      }
      if ((p.method === "Debit Card" || p.method === "Credit Card") && !p.cardNumber) {
        alert(`Nomor kartu wajib diisi untuk pembayaran ${p.method}`)
        return
      }
    }

    setIsPaying(true)
    try {
      const items = payOrder.items.map((item) => ({
        barangId: item.barang_id,
        quantity: item.qty,
        unitPrice: item.price,
        unitPriceIncludeTax: item.price,
        totalPrice: item.subtotal,
      }))

      const transactionData = {
        customerId: 1,
        items,
        subtotal: payOrder.total_price,
        total: payOrder.total_price,
        transactionType: 1,
        transactionDate: getTodayDate(),
        includeTax: 0,
        ppnPercent: 0,
        ppnAmount: 0,
        discountPercent: 0,
        discountAmount: 0,
        serviceChargePercent: 0,
        serviceChargeAmount: 0,
        price_include_tax: 0,
        payments: paymentsForApi,
        paymentMethod: paymentsForApi.length === 1 ? paymentsForApi[0].method : "multi",
        paymentAmount: totalPaid,
        changeAmount: Math.max(0, totalPaid - payOrder.total_price),
        cardNumber: paymentsForApi.find((p) => p.method === "Debit Card" || p.method === "Credit Card")?.cardNumber || null,
        bankId: paymentsForApi.find((p) => p.method !== "cash")?.bankId || null,
        tableId: payOrder.meja_id || null,
        Nm_cust: payOrder.meja_name || null,
      }

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionData),
      })

      if (!res.ok) {
        let msg = "Gagal membuat transaksi"
        try {
          const rawText = await res.text()
          try {
            const err = JSON.parse(rawText)
            msg = String(err?.error || err?.details || msg)
          } catch {}
        } catch {}
        alert(msg)
        return
      }

      // Mark self order as paid
      await fetch(`/api/self-order/order/${payOrder.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_status: "paid" }),
      })

      setOrders((prev) =>
        prev.map((o) => (o.uid === payOrder.uid ? { ...o, payment_status: "paid" } : o))
      )
      setSelectedOrder((prev) =>
        prev && prev.uid === payOrder.uid ? { ...prev, payment_status: "paid" } : prev
      )

      setShowPayModal(false)
      setPayOrder(null)
    } catch (e: any) {
      alert(e?.message || "Terjadi kesalahan saat pembayaran")
    } finally {
      setIsPaying(false)
    }
  }

  const filtered = orders.filter(
    (o) => filterStatus === "all" || o.payment_status === filterStatus
  )

  const counts = {
    all: orders.length,
    unpaid: orders.filter((o) => o.payment_status === "unpaid").length,
    paid: orders.filter((o) => o.payment_status === "paid").length,
    cancelled: orders.filter((o) => o.payment_status === "cancelled").length,
  }

  const payTotal = payOrder?.total_price || 0
  const payPaid = payments.reduce((s, p) => s + p.amount, 0)
  const payChange = Math.max(0, payPaid - payTotal)

  return (
    <div ref={pageRef} className="space-y-3 p-2 md:p-3 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-1">
        <div>
          <h1 className="text-xl font-semibold">Self Order</h1>
          <p className="text-slate-500 text-xs mt-1">Daftar pesanan dari pelanggan</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 px-1 overflow-x-auto">
        {[
          { key: "all", label: "Semua" },
          { key: "unpaid", label: "Belum Bayar" },
          { key: "paid", label: "Lunas" },
          { key: "cancelled", label: "Dibatalkan" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filterStatus === tab.key
                ? "bg-teal-primary text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              filterStatus === tab.key ? "bg-white/20" : "bg-slate-100"
            }`}>
              {counts[tab.key as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 border-2 border-slate-300 border-t-teal-primary rounded-full animate-spin" />
              <span className="text-xs text-slate-500">Memuat pesanan...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            {filterStatus === "all" ? "Belum ada pesanan" : "Tidak ada pesanan dengan status ini"}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-2 font-semibold text-slate-600">No</th>
                <th className="text-left px-4 py-2 font-semibold text-slate-600">Meja</th>
                <th className="text-left px-4 py-2 font-semibold text-slate-600">Item</th>
                <th className="text-left px-4 py-2 font-semibold text-slate-600">Total</th>
                <th className="text-left px-4 py-2 font-semibold text-slate-600">Status</th>
                <th className="text-left px-4 py-2 font-semibold text-slate-600">Waktu</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const badge = statusLabel[order.payment_status] || statusLabel.unpaid
                return (
                  <tr
                    key={order.uid}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="px-4 py-2.5 font-semibold text-slate-800">
                      #{order.order_number}
                    </td>
                    <td className="px-4 py-2.5">
                      {order.meja_name ? (
                        <span className="text-teal-primary font-medium">{order.meja_name}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{order.items.length} item</td>
                    <td className="px-4 py-2.5 font-bold text-teal-primary">
                      {formatCurrency(order.total_price)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${badge.color}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{formatTime(order.created_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {order.payment_status === "unpaid" && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openPayModal(order)
                            }}
                            className="text-xs px-3 py-1 rounded-full bg-[#FFD23F] text-slate-800 hover:bg-[#E6B800] transition-colors font-semibold"
                          >
                            Bayar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMarkPaid(order.uid)
                            }}
                            disabled={markingPaid === order.uid}
                            className="text-xs px-3 py-1 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium disabled:opacity-50"
                          >
                            {markingPaid === order.uid ? "..." : "Lunas"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail dialog */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setSelectedOrder(null)}>
          <div
            className="bg-white rounded-2xl w-[500px] max-w-[95vw] max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">Pesanan #{selectedOrder.order_number}</h3>
                {selectedOrder.meja_name && (
                  <span className="text-xs font-medium text-teal-primary bg-teal-bg px-2 py-0.5 rounded-full">
                    {selectedOrder.meja_name}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-slate-500">{formatTime(selectedOrder.created_at)}</div>
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${(statusLabel[selectedOrder.payment_status] || statusLabel.unpaid).color}`}>
                  {(statusLabel[selectedOrder.payment_status] || statusLabel.unpaid).text}
                </span>
              </div>

              {selectedOrder.notes && (
                <div className="mb-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                  <span className="font-medium">Catatan:</span> {selectedOrder.notes}
                </div>
              )}

              <div className="space-y-2">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{item.barang_name}</div>
                      <div className="text-xs text-slate-500">
                        {formatCurrency(item.price)} x {item.qty}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 ml-3">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Total</span>
                <span className="text-lg font-bold text-teal-primary">
                  {formatCurrency(selectedOrder.total_price)}
                </span>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0 flex gap-2">
              {selectedOrder.payment_status === "unpaid" && (
                <button
                  onClick={() => {
                    openPayModal(selectedOrder)
                    setSelectedOrder(null)
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#FFD23F] text-slate-800 hover:bg-[#E6B800] transition-colors font-semibold text-sm"
                >
                  Bayar
                </button>
              )}
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors font-medium text-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPayModal && payOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { if (!isPaying) { setShowPayModal(false); setPayOrder(null) } }}>
          <div
            className="bg-white rounded-2xl w-[600px] max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 rounded-t-2xl border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Pembayaran</h3>
              <button
                onClick={() => { if (!isPaying) { setShowPayModal(false); setPayOrder(null) } }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Order info */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Pesanan #{payOrder.order_number}</span>
                {payOrder.meja_name && (
                  <span className="text-xs font-medium text-teal-primary bg-teal-bg px-2 py-0.5 rounded-full">
                    {payOrder.meja_name}
                  </span>
                )}
              </div>

              {/* Total */}
              <div className="bg-teal-bg rounded-xl p-4 text-center">
                <div className="text-xs text-teal-dark mb-1">Total Yang Harus Dibayar</div>
                <div className="text-2xl font-bold text-teal-primary">{formatCurrency(payTotal)}</div>
              </div>

              {/* Payment methods */}
              <div className="space-y-2">
                <div className="text-[11px] text-slate-600 font-bold">Cara Bayar (maks. 2 metode)</div>
                {payments.map((row, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-600">Metode {idx + 1}</span>
                      {payments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          ✕ Hapus
                        </button>
                      )}
                    </div>
                    <select
                      value={row.method}
                      onChange={(e) => {
                        const newMethod = e.target.value as PaymentMethod
                        setPayments((prev) =>
                          prev.map((p, i) =>
                            i === idx
                              ? {
                                  ...p,
                                  method: newMethod,
                                  bankId: newMethod === "cash" ? null : p.bankId,
                                  cardNumber: newMethod === "debit" || newMethod === "credit" ? p.cardNumber : "",
                                  amount: newMethod !== "cash"
                                    ? Math.max(0, payTotal - payments.filter((_, j) => j !== idx).reduce((s, x) => s + x.amount, 0))
                                    : p.amount,
                                  amountDisplay: newMethod !== "cash"
                                    ? Math.max(0, payTotal - payments.filter((_, j) => j !== idx).reduce((s, x) => s + x.amount, 0)).toLocaleString("id-ID")
                                    : p.amountDisplay,
                                }
                              : p,
                          ),
                        )
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="cash">Cash</option>
                      <option value="transfer">Transfer</option>
                      <option value="debit">Kartu Debit</option>
                      <option value="credit">Kartu Kredit</option>
                    </select>

                    {row.method !== "cash" && (
                      <select
                        value={row.bankId || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value) || null
                          setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, bankId: val } : p)))
                        }}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Pilih Bank...</option>
                        {banks.map((bank: any) => {
                          const id = bank.id ?? bank.bank_id
                          const name = bank.bank_name ?? bank.bankName ?? bank.name ?? "Bank"
                          const no = bank.account_number ?? bank.accountNumber ?? bank.no_rek ?? ""
                          return <option key={id} value={id}>{name}{no ? ` - ${no}` : ""}</option>
                        })}
                      </select>
                    )}

                    {(row.method === "debit" || row.method === "credit") && (
                      <input
                        type="text"
                        value={row.cardNumber}
                        onChange={(e) => setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, cardNumber: e.target.value } : p)))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="No. Kartu"
                      />
                    )}

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">Rp</span>
                      <input
                        type="text"
                        value={row.amountDisplay}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, "")
                          const numValue = Number(value) || 0
                          setPayments((prev) =>
                            prev.map((p, i) =>
                              i === idx
                                ? { ...p, amount: numValue, amountDisplay: numValue ? numValue.toLocaleString("id-ID") : "" }
                                : p,
                            ),
                          )
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2 text-sm text-right"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}

                {payments.length < 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = Math.max(0, payTotal - payments.reduce((s, p) => s + p.amount, 0))
                      setPayments((prev) => [
                        ...prev,
                        { method: "transfer", bankId: null, cardNumber: "", amount: remaining, amountDisplay: remaining.toLocaleString("id-ID") },
                      ])
                    }}
                    className="w-full py-2 text-xs text-teal-primary font-semibold hover:bg-teal-bg rounded-lg transition-colors"
                  >
                    + Tambah Cara Bayar
                  </button>
                )}
              </div>

              {/* Summary */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total Nota</span>
                  <span className="font-semibold">{formatCurrency(payTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total Bayar</span>
                  <span className="font-semibold">{formatCurrency(payPaid)}</span>
                </div>
                {payChange > 0 && (
                  <div className="flex items-center justify-between text-emerald-600">
                    <span className="font-medium">Kembali</span>
                    <span className="font-bold">{formatCurrency(payChange)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
              <button
                onClick={() => { if (!isPaying) { setShowPayModal(false); setPayOrder(null) } }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors font-medium text-sm"
              >
                Batal
              </button>
              <button
                onClick={handlePayment}
                disabled={isPaying || payPaid < payTotal}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#FFD23F] hover:bg-[#E6B800] text-slate-800 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPaying ? "Memproses..." : "Bayar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
