"use client"

import { useEffect, useMemo, useState } from 'react'

type MenuItem = {
  id: number
  code: string
  name: string
  photoUrl: string | null
  kategoriId: number | null
  kategoriName: string | null
  units: { id: number; name: string; ratio: number }[]
  prices: { unit_id: number | null; price: number; effectiveDate: string }[]
}

type TableInfo = { id: number; code: string; name: string } | null

type CartLine = {
  item: MenuItem
  qty: number
  unitId: number | null
  unitPrice: number
}

const fmt = (n: number) =>
  `Rp ${Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`

function basePrice(item: MenuItem): { unitId: number | null; price: number } {
  const baseUnit = item.units[0]
  const baseUnitId = baseUnit?.id ?? null
  const match = item.prices.find((p) => Number(p.unit_id) === Number(baseUnitId))
  const price = match ? match.price : (item.prices[0]?.price ?? 0)
  return { unitId: baseUnitId, price }
}

export default function CustomerOrderPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code || '').trim()

  const [table, setTable] = useState<TableInfo>(null)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cart, setCart] = useState<Record<number, CartLine>>({})
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [orderRef, setOrderRef] = useState<{ tempOrderId: number; qrToken: string } | null>(null)
  const [lastTotal, setLastTotal] = useState(0)
  const [paying, setPaying] = useState(false)
  const [payMethod, setPayMethod] = useState('cash')
  const [payAmount, setPayAmount] = useState('')
  const [payError, setPayError] = useState<string | null>(null)
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [payDone, setPayDone] = useState(false)
  const [payTxNo, setPayTxNo] = useState('')

  useEffect(() => {
    if (!code) {
      setError('Kode meja tidak valid')
      setLoading(false)
      return
    }
    let active = true
    ;(async () => {
      try {
        const [tRes, mRes] = await Promise.all([
          fetch(`/api/pos/table-by-code/${encodeURIComponent(code)}`, { cache: 'no-store' }),
          fetch(`/api/pos/customer-menu`, { cache: 'no-store' }),
        ])
        if (!active) return
        if (!tRes.ok) {
          const d = await tRes.json().catch(() => ({}))
          setError(d?.error || 'Meja tidak ditemukan')
          setLoading(false)
          return
        }
        const t = await tRes.json()
        setTable({ id: t.id, code: t.code, name: t.name })
        if (mRes.ok) {
          const m = await mRes.json()
          setMenu(Array.isArray(m) ? m : [])
        }
        setLoading(false)
      } catch {
        if (active) {
          setError('Gagal memuat data')
          setLoading(false)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [code])

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>()
    for (const it of menu) {
      const key = it.kategoriName || 'Lainnya'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(it)
    }
    return Array.from(map.entries())
  }, [menu])

  const total = useMemo(
    () =>
      Object.values(cart).reduce((s, l) => s + l.unitPrice * l.qty, 0),
    [cart],
  )
  const totalQty = useMemo(
    () => Object.values(cart).reduce((s, l) => s + l.qty, 0),
    [cart],
  )

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev[item.id]
      const { unitId, price } = basePrice(item)
      if (existing) {
        return { ...prev, [item.id]: { ...existing, qty: existing.qty + 1 } }
      }
      return { ...prev, [item.id]: { item, qty: 1, unitId, unitPrice: price } }
    })
  }
  const decCart = (id: number) => {
    setCart((prev) => {
      const existing = prev[id]
      if (!existing) return prev
      if (existing.qty <= 1) {
        const copy = { ...prev }
        delete copy[id]
        return copy
      }
      return { ...prev, [id]: { ...existing, qty: existing.qty - 1 } }
    })
  }

  const submit = async () => {
    if (submitting) return
    if (!customerName.trim()) {
      setSubmitError('Mohon isi nama Anda')
      return
    }
    if (totalQty <= 0) {
      setSubmitError('Pesanan masih kosong')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const items = Object.values(cart).map((l) => ({
        barangId: l.item.id,
        unitId: l.unitId,
        quantity: l.qty,
      }))
      const res = await fetch('/api/pos/customer-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableCode: code, customerName: customerName.trim(), items }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError(d?.error || 'Gagal mengirim pesanan')
        return
      }
      setOrderRef({ tempOrderId: d.tempOrderId, qrToken: d.qrToken })
      setLastTotal(total)
      setSuccess(true)
    } catch {
      setSubmitError('Gagal mengirim pesanan')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#EFF8F7]">
        <div className="flex flex-col items-center gap-2">
          <div className="h-7 w-7 border-2 border-slate-300 border-t-teal-primary rounded-full animate-spin" />
          <span className="text-xs text-slate-500">Memuat...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#EFF8F7] p-4">
        <div className="bg-white rounded-2xl shadow-card border border-teal-bg p-6 text-center max-w-sm w-full">
          <div className="text-base font-semibold text-slate-800">Meja Tidak Ditemukan</div>
          <p className="text-xs text-slate-500 mt-2">{error}</p>
          <p className="text-xs text-slate-400 mt-4">Pastikan QR code yang dipindai benar.</p>
        </div>
      </div>
    )
  }

  if (success) {
    if (payDone) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-[#EFF8F7] p-4">
          <div className="bg-white rounded-2xl shadow-card border border-teal-bg p-6 text-center max-w-sm w-full">
            <div className="mx-auto w-14 h-14 rounded-full bg-teal-bg flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-teal-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-base font-semibold text-slate-800">Pembayaran Berhasil!</div>
            <p className="text-xs text-slate-500 mt-2">
              Pesanan Meja <span className="font-semibold">{table?.code}</span> lunas.
            </p>
            {payTxNo && (
              <p className="text-xs text-slate-600 mt-1 font-medium">No: {payTxNo}</p>
            )}
            <button
              onClick={() => {
                setCart({})
                setCustomerName('')
                setSuccess(false)
                setPayDone(false)
                setPaying(false)
                setPayAmount('')
                setPayError(null)
              }}
              className="mt-5 w-full px-4 py-3 rounded-pill bg-teal-primary hover:bg-teal-dark text-white text-sm font-semibold"
            >
              Selesai
            </button>
          </div>
        </div>
      )
    }

    if (paying) {
      const amountNum = Number(payAmount) || 0
      const submitPay = async () => {
        if (paySubmitting || !orderRef) return
        if (amountNum < lastTotal) {
          setPayError('Nominal pembayaran kurang dari total')
          return
        }
        setPaySubmitting(true)
        setPayError(null)
        try {
          const res = await fetch('/api/pos/customer-pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tempOrderId: orderRef.tempOrderId,
              qrToken: orderRef.qrToken,
              payments: [{ method: payMethod, amount: amountNum }],
            }),
          })
          const d = await res.json().catch(() => ({}))
          if (!res.ok) {
            setPayError(d?.error || 'Gagal memproses pembayaran')
            setPaySubmitting(false)
            return
          }
          setPayTxNo(d.transactionNumber || '')
          setPayDone(true)
        } catch {
          setPayError('Gagal memproses pembayaran')
        } finally {
          setPaySubmitting(false)
        }
      }

      return (
        <div className="min-h-dvh flex items-center justify-center bg-[#EFF8F7] p-4">
          <div className="bg-white rounded-2xl shadow-card border border-teal-bg p-6 max-w-sm w-full">
            <div className="text-base font-semibold text-slate-800 text-center mb-4">Bayar Sekarang</div>
            <div className="text-center text-teal-primary font-bold text-xl mb-4">{fmt(lastTotal)}</div>
            <div className="flex gap-2 mb-3">
              {['cash', 'card', 'transfer'].map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={`flex-1 py-2 rounded-pill text-xs font-semibold border ${
                    payMethod === m
                      ? 'bg-teal-primary text-white border-teal-primary'
                      : 'border-slate-300 text-slate-600'
                  }`}
                >
                  {m === 'cash' ? 'Tunai' : m === 'card' ? 'Kartu' : 'Transfer'}
                </button>
              ))}
            </div>
            {payError && <div className="text-xs text-red-600 mb-2">{payError}</div>}
            <label className="block mb-1 text-xs text-slate-500">Nominal Bayar</label>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder={String(lastTotal)}
              className="w-full border border-slate-300 rounded-pill px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary text-right"
            />
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setPaying(false); setPayError(null) }}
                className="flex-1 px-4 py-3 rounded-pill border border-slate-300 text-sm font-semibold text-slate-700"
              >
                Kembali
              </button>
              <button
                onClick={submitPay}
                disabled={paySubmitting}
                className="flex-1 px-4 py-3 rounded-pill bg-teal-primary hover:bg-teal-dark text-white text-sm font-semibold disabled:opacity-60"
              >
                {paySubmitting ? 'Memproses...' : 'Bayar'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#EFF8F7] p-4">
        <div className="bg-white rounded-2xl shadow-card border border-teal-bg p-6 text-center max-w-sm w-full">
          <div className="mx-auto w-14 h-14 rounded-full bg-teal-bg flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-teal-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-base font-semibold text-slate-800">Pesanan Terkirim!</div>
          <p className="text-xs text-slate-500 mt-2">
            Pesanan untuk <span className="font-semibold">Meja {table?.code}</span> telah dikirim ke dapur.
          </p>
          <p className="text-xs text-slate-600 mt-3 font-medium">Silakan ke kasir untuk melakukan pembayaran.</p>
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => {
                setCart({})
                setCustomerName('')
                setSuccess(false)
              }}
              className="flex-1 px-4 py-3 rounded-pill border border-slate-300 text-sm font-semibold text-slate-700"
            >
              Pesan Lagi
            </button>
            <button
              onClick={() => { setPaying(true); setPayAmount(String(lastTotal)) }}
              className="flex-1 px-4 py-3 rounded-pill bg-teal-primary hover:bg-teal-dark text-white text-sm font-semibold"
            >
              Bayar Sekarang
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#EFF8F7] flex flex-col">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-teal-bg px-4 py-3">
        <div className="text-xs text-slate-500">Pesan di Meja</div>
        <div className="text-lg font-bold text-slate-800">{table?.code} — {table?.name}</div>
      </header>

      <div className="flex-1 overflow-auto px-3 py-3 space-y-5 pb-40">
        {grouped.map(([cat, items]) => (
          <section key={cat}>
            <h2 className="text-sm font-semibold text-slate-700 mb-2">{cat}</h2>
            <div className="grid grid-cols-2 gap-2">
              {items.map((it) => {
                const { price } = basePrice(it)
                const line = cart[it.id]
                return (
                  <div key={it.id} className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col">
                    <div className="text-sm font-medium text-slate-800 leading-snug">{it.name}</div>
                    <div className="text-teal-primary font-semibold text-sm mt-1">{fmt(price)}</div>
                    <div className="mt-2">
                      {!line ? (
                        <button
                          onClick={() => addToCart(it)}
                          className="w-full px-3 py-2 rounded-pill bg-teal-primary hover:bg-teal-dark text-white text-xs font-semibold"
                        >
                          + Tambah
                        </button>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => decCart(it.id)}
                            className="w-8 h-8 rounded-full border border-teal-primary text-teal-primary text-lg font-bold"
                          >
                            −
                          </button>
                          <span className="text-sm font-semibold text-slate-800">{line.qty}</span>
                          <button
                            onClick={() => addToCart(it)}
                            className="w-8 h-8 rounded-full bg-teal-primary text-white text-lg font-bold"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {totalQty > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-teal-bg px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          {submitError && <div className="text-xs text-red-600 mb-2">{submitError}</div>}
          <div className="flex items-center gap-2 mb-2">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama Anda"
              className="flex-1 border border-slate-300 rounded-pill px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500">
              {totalQty} item · <span className="text-teal-primary font-semibold">{fmt(total)}</span>
            </div>
            <button
              onClick={submit}
              disabled={submitting}
              className="ml-auto px-5 py-2.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? 'Mengirim...' : 'Pesan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
