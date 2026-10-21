"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/regionalNumber"
import { showError, showSuccess } from "@/lib/notification"

type Customer = { id: number; code: string; name: string }

type Product = {
  id: number
  code: string
  name: string
  hpp?: number
  prices?: { unit_id: number; price: number; effectiveDate?: string; effective_date?: string }[]
}

type SoMobileItem = {
  rowId: string
  detailId: number | null
  product: Product | null
  qty: number
  price: number
}

export default function MobileEditSalesOrderPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [items, setItems] = useState<SoMobileItem[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>("draft")
  const [todayStr, setTodayStr] = useState<string>("")

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [cRes, pRes, soRes] = await Promise.all([
          fetch("/api/customer"),
          fetch("/api/barang"),
          fetch(`/api/sales-orders/${params.id}`),
        ])
        if (!alive) return

        if (!soRes.ok) {
          const body = await soRes.json().catch(() => ({}))
          throw new Error(body?.error || "Gagal memuat Sales Order")
        }
        const so = await soRes.json()

        if (cRes.ok) {
          const data = await cRes.json()
          const list = Array.isArray(data) ? data.filter((x: any) => !x.isdelete && !x.isDelete) : []
          setCustomers(list)
          const c = list.find((x: any) => x.id === so.customer_id) || null
          setCustomer(c)
        }
        if (pRes.ok) {
          const data = await pRes.json()
          const list: Product[] = Array.isArray(data)
            ? data
                .filter((x: any) => x.aktif)
                .map((x: any) => ({
                  id: x.id,
                  code: x.code,
                  name: x.name,
                  hpp: x.hpp,
                  prices: Array.isArray(x.prices) ? x.prices : [],
                }))
            : []
          setProducts(list)
        }

        setTodayStr(String(so.so_date || "").slice(0, 10) || new Date().toISOString().slice(0, 10))
        setStatus(so.status || "draft")

        const detailItems: SoMobileItem[] = Array.isArray(so.items)
          ? so.items.map((it: any) => {
              const p = (products as Product[]).find((x) => x.id === it.barang_id) || null
              const qty = Number(it.quantity || it.qty || 0)
              const lineTotal = Number(it.total_price || 0)
              const discTotal = Number(it.discount_total || 0)
              let unitPrice = 0
              if (qty > 0) {
                const lineBeforeDisc = lineTotal + discTotal
                unitPrice = Math.round(lineBeforeDisc / qty)
              }
              return {
                rowId: String(it.id),
                detailId: Number(it.id),
                product: p,
                qty: qty || 1,
                price: unitPrice,
              }
            })
          : []

        setItems(detailItems.length ? detailItems : [
          { rowId: `${Date.now()}`, detailId: null, product: null, qty: 1, price: 0 },
        ])
      } catch (e: any) {
        console.error(e)
        showError(e?.message || "Gagal memuat Sales Order")
        router.push("/m/penjualan-sales-order")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [params?.id])

  const getPriceForProduct = (product: Product | null | undefined): number => {
    if (!product) return 0
    const prices = Array.isArray(product.prices) ? product.prices : []
    if (!prices.length) {
      const p2 = Number((product as any).price || NaN)
      if (!isNaN(p2) && p2 > 0) return p2
      const p3 = Number(product.hpp || NaN)
      if (!isNaN(p3) && p3 > 0) return p3
      return 0
    }
    const dateStr = todayStr || new Date().toISOString().slice(0, 10)
    const rows = prices
      .map((r: any) => ({
        price: Number(r?.price) || 0,
        eff: String(r?.effectiveDate || r?.effective_date || "0000-00-00"),
      }))
      .filter((r) => r.price > 0)
    if (!rows.length) return 0
    const past = rows.filter((r) => r.eff <= dateStr)
    if (past.length > 0) {
      past.sort((a, b) => (a.eff < b.eff ? -1 : a.eff > b.eff ? 1 : 0))
      return past[past.length - 1].price
    }
    rows.sort((a, b) => (a.eff < b.eff ? -1 : a.eff > b.eff ? 1 : 0))
    return rows[0].price
  }

  const grandTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.qty > 0 && it.price > 0 ? it.qty * it.price : 0), 0)
  }, [items])

  const handleChangeItem = (rowId: string, patch: Partial<SoMobileItem>) => {
    setItems((prev) =>
      prev.map((it) =>
        it.rowId === rowId
          ? {
              ...it,
              ...patch,
            }
          : it,
      ),
    )
  }

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        rowId: `${Date.now()}-${prev.length}`,
        detailId: null,
        product: null,
        qty: 1,
        price: 0,
      },
    ])
  }

  const handleRemoveRow = (rowId: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.rowId !== rowId)))
  }

  const handleSave = async () => {
    if (status !== "draft") {
      return showError("Sales Order yang sudah CONFIRMED tidak boleh diubah dari mobile")
    }
    if (!customer) {
      return showError("Customer wajib dipilih")
    }
    const filled = items.filter((it) => it.product && it.qty > 0 && it.price > 0)
    if (!filled.length) {
      return showError("Minimal 1 item dengan Qty & Harga > 0")
    }

    const payload = {
      so_date: todayStr || new Date().toISOString().slice(0, 10),
      customer_id: customer.id,
      warehouse_id: null,
      sales_id: null,
      status: "draft",
      discount_percent: 0,
      discount_amount: 0,
      tax_rate_percent: 0,
      price_include_tax: 0,
      notes: "",
      items: filled.map((it) => ({
        barangId: it.product!.id,
        quantity: it.qty,
        unitName: "PCS",
        unitRatio: 1,
        unitPrice: it.price,
        discon_total: 0,
        totalPrice: it.qty * it.price,
      })),
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/sales-orders/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.error || "Gagal mengubah Sales Order")
      }
      showSuccess("Sales Order berhasil diubah")
      router.push("/m/penjualan-sales-order")
    } catch (e: any) {
      console.error(e)
      showError(e?.message || "Gagal mengubah Sales Order")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 md:hidden">
        <div className="text-center text-xs text-slate-600">Memuat Sales Order...</div>
      </div>
    )
  }

  return (
    <div className="p-3 pb-16 md:hidden">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Edit SO (Mobile)</h1>
          <p className="text-[11px] text-slate-600 mt-0.5">Ubah Qty dan Harga tanpa scroll samping.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3 space-y-2">
        <div className="text-[11px] text-slate-500">Tanggal</div>
        <div className="text-xs font-semibold text-slate-800">{todayStr}</div>
        <div>
          <label className="block text-[11px] font-medium text-slate-700 mb-1">Customer *</label>
          <select
            value={customer?.id || ""}
            onChange={(e) => {
              const id = Number(e.target.value)
              const c = customers.find((x) => x.id === id) || null
              setCustomer(c)
            }}
            className="w-full border rounded px-2 py-1.5 text-[11px]"
          >
            <option value="">Pilih Customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((it) => {
          const total = it.qty > 0 && it.price > 0 ? it.qty * it.price : 0
          return (
            <div key={it.rowId} className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 space-y-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Barang</label>
                <select
                  value={it.product?.id || ""}
                  onChange={(e) => {
                    const id = Number(e.target.value)
                    const p = products.find((x) => x.id === id) || null
                    const autoPrice = getPriceForProduct(p)
                    handleChangeItem(it.rowId, { product: p, price: autoPrice })
                  }}
                  className="w-full border rounded px-2 py-1.5 text-[11px]"
                >
                  <option value="">Pilih Barang...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Qty</label>
                  <input
                    type="number"
                    min={0}
                    value={it.qty}
                    onChange={(e) => handleChangeItem(it.rowId, { qty: Number(e.target.value) || 0 })}
                    className="w-full border rounded px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Harga</label>
                  <input
                    type="text"
                    value={it.price ? it.price.toLocaleString("id-ID") : "0"}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "")
                      handleChangeItem(it.rowId, { price: raw === "" ? 0 : Number(raw) })
                    }}
                    className="w-full border rounded px-2 py-1.5 text-xs text-right"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="text-[11px] text-slate-500">Total</div>
                <div className="text-sm font-semibold text-emerald-700">{formatCurrency(total)}</div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleRemoveRow(it.rowId)}
                  className="px-2 py-1 text-[11px] rounded border text-red-600"
                  disabled={items.length <= 1}
                >
                  Hapus
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex justify-between items-center bg-white rounded-lg border border-slate-200 px-3 py-2">
        <div className="text-[11px] text-slate-500">Grand Total</div>
        <div className="text-base font-bold text-emerald-700">{formatCurrency(grandTotal)}</div>
      </div>

      <div className="mt-3 flex justify-between items-center">
        <button
          type="button"
          onClick={() => router.push("/m/penjualan-sales-order")}
          className="px-3 py-1.5 rounded border text-xs"
        >
          Batal
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="px-3 py-1.5 rounded border text-xs"
          >
            + Item
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs disabled:opacity-60"
          >
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  )
}
