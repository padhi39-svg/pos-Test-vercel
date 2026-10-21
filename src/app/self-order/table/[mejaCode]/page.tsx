"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { formatCurrency } from "@/lib/regionalNumber"
import { DEFAULT_CACHE_TTL_HOURS } from "../../config"

function setCookie(name: string, value: string, ttlMs: number) {
  const expires = new Date(Date.now() + ttlMs).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function getCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(name + '='))
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
}

const MAX_RECENT_ORDERS = 10

type Meja = { id: number; code: string; name: string }
type Category = { id: number; name: string }
type Product = {
  id: number
  code: string
  name: string
  price: number
  photoUrl: string | null
  kategoriId: number | null
}
type CartItem = { product: Product; qty: string }

export default function SelfOrderPage() {
  const router = useRouter()
  const params = useParams()
  const mejaCode = params.mejaCode as string

  const [meja, setMeja] = useState<Meja | null>(null)
  const [mejaError, setMejaError] = useState("")
  const [mejaLoading, setMejaLoading] = useState(true)

  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [cart, setCart] = useState<Record<number, CartItem>>({})
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const observerRef = useRef<HTMLDivElement>(null)

  // Validate meja on load
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/self-order/meja/${mejaCode}`)
        if (res.ok) {
          setMeja(await res.json())
        } else {
          setMejaError("Meja tidak ditemukan")
        }
      } catch {
        setMejaError("Gagal memeriksa meja")
      } finally {
        setMejaLoading(false)
      }
    })()
  }, [mejaCode])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/self-order/categories")
        if (res.ok) {
          const data = await res.json()
          setCategories(Array.isArray(data) ? data : [])
        }
      } catch (e) {
        console.error("Error loading categories:", e)
      } finally {
        setLoadingCategories(false)
      }
    })()
  }, [])

  const fetchProducts = useCallback(
    async (pageNum: number, reset: boolean) => {
      if (loadingProducts) return
      setLoadingProducts(true)
      try {
        const params = new URLSearchParams({ page: String(pageNum), limit: "20" })
        if (selectedCategoryId) params.set("kategori_id", String(selectedCategoryId))
        if (debouncedSearch) params.set("q", debouncedSearch)
        const res = await fetch(`/api/self-order/products?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          const items: Product[] = data.items || []
          setProducts((prev) => (reset ? items : [...prev, ...items]))
          setHasMore(items.length >= 20)
        }
      } catch (e) {
        console.error("Error loading products:", e)
      } finally {
        setLoadingProducts(false)
      }
    },
    [selectedCategoryId, debouncedSearch, loadingProducts],
  )

  useEffect(() => {
    setProducts([])
    setPage(1)
    setHasMore(true)
    fetchProducts(1, true)
  }, [selectedCategoryId, debouncedSearch])

  useEffect(() => {
    if (page > 1) fetchProducts(page, false)
  }, [page])

  useEffect(() => {
    const el = observerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingProducts) {
          setPage((p) => p + 1)
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingProducts])

  const updateQty = (productId: number, delta: number) => {
    setCart((prev) => {
      const existing = prev[productId]
      const current = parseInt(existing?.qty || "0", 10) || 0
      const newQty = current + delta
      if (newQty <= 0) {
        const { [productId]: _, ...rest } = prev
        return rest
      }
      const product = products.find((p) => p.id === productId)
      if (!product) return prev
      return { ...prev, [productId]: { product, qty: String(newQty) } }
    })
  }

  const setQtyManual = (productId: number, value: string) => {
    if (value === "" || value === "0") {
      setCart((prev) => {
        const { [productId]: _, ...rest } = prev
        return rest
      })
      return
    }
    const num = parseInt(value, 10)
    if (!num || num <= 0) return
    const product = products.find((p) => p.id === productId)
    if (!product) return
    setCart((prev) => ({ ...prev, [productId]: { product, qty: String(num) } }))
  }

  const cartCount = Object.values(cart).reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0)
  const cartTotal = Object.values(cart).reduce((sum, item) => sum + item.product.price * (parseInt(item.qty, 10) || 0), 0)

  const [ordering, setOrdering] = useState(false)
  const [recentOrders, setRecentOrders] = useState<{ uid: string; orderNumber: number }[]>([])

  useEffect(() => {
    try {
      const raw = getCookie("self_order_orders")
      if (raw) {
        const list = JSON.parse(raw)
        if (Array.isArray(list)) setRecentOrders(list)
      }
    } catch { /* ignore */ }
  }, [])

  const handleOrder = async () => {
    if (ordering || !meja) return
    setOrdering(true)
    try {
      const items = Object.values(cart).map((item) => ({
        barangId: item.product.id,
        barangName: item.product.name,
        price: item.product.price,
        qty: parseInt(item.qty, 10) || 0,
      }))
      const res = await fetch("/api/self-order/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mejaId: meja.id, items }),
      })
      if (res.ok) {
        const data = await res.json()
        const newOrder = { uid: data.uid, orderNumber: data.orderNumber }
        const updated = [newOrder, ...recentOrders.filter((o) => o.uid !== data.uid)].slice(0, MAX_RECENT_ORDERS)
        setRecentOrders(updated)
        // Fetch cache TTL from settings
        let cacheTtlMs = DEFAULT_CACHE_TTL_HOURS * 60 * 60 * 1000
        try {
          const settingsRes = await fetch("/api/self-order/settings")
          if (settingsRes.ok) {
            const settings = await settingsRes.json()
            cacheTtlMs = (settings.cacheTtlHours || DEFAULT_CACHE_TTL_HOURS) * 60 * 60 * 1000
          }
        } catch {}
        setCookie("self_order_orders", JSON.stringify(updated), cacheTtlMs)
        router.push(`/self-order/my-orders/${data.uid}`)
      } else {
        alert("Gagal membuat pesanan")
      }
    } catch {
      alert("Gagal membuat pesanan")
    } finally {
      setOrdering(false)
    }
  }

  // Loading state
  if (mejaLoading) {
    return <div className="p-6 text-center text-slate-500">Memuat...</div>
  }

  // Meja not found
  if (mejaError) {
    return (
      <div className="space-y-4 m-4">
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-slate-700 mb-1">Meja Tidak Ditemukan</h2>
          <p className="text-sm text-slate-500">{mejaError}</p>
        </div>
      </div>
    )
  }

  if (loadingCategories) {
    return <div className="p-6 text-center text-slate-500">Memuat...</div>
  }

  return (
    <div className="space-y-4 m-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">Self Order</h1>
        <p className="text-slate-500 text-xs mt-1">Meja: {meja?.name} ({meja?.code})</p>
      </div>

      {/* My Order button */}
      {recentOrders.length > 0 && (
        <button
          onClick={() => router.push("/self-order/my-orders")}
          className="w-full bg-teal-bg border border-teal-primary/30 rounded-lg p-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-teal-dark font-medium">Pesanan Saya</span>
          </div>
          <span className="text-xs text-teal-primary shrink-0 ml-2">Lihat</span>
        </button>
      )}

      {/* Category chips */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-2 w-max">
          {categories.map((cat) => {
            const isActive = selectedCategoryId === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(isActive ? null : cat.id)}
                className={`px-4 py-1.5 rounded-pill text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-teal-primary text-white"
                    : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
                }`}
              >
                {cat.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Search box */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Cari menu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-pill border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
        />
      </div>

      {/* Product list - single column */}
      <div className="space-y-2">
        {products.map((product) => {
          const qty = cart[product.id]?.qty || ""
          return (
            <div key={product.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3">
              {product.photoUrl ? (
                <img src={product.photoUrl} alt={product.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 line-clamp-2">{product.name}</div>
                <div className="text-sm text-teal-primary font-semibold">{formatCurrency(product.price)}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => updateQty(product.id, -1)}
                  className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  min={0}
                  value={qty}
                  placeholder="0"
                  onChange={(e) => setQtyManual(product.id, e.target.value)}
                  className="w-10 h-8 text-center text-sm font-medium border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
                />
                <button
                  onClick={() => updateQty(product.id, 1)}
                  className="w-8 h-8 rounded-full bg-teal-primary flex items-center justify-center text-white hover:bg-teal-dark active:bg-teal-dark"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
          )
        })}

        <div ref={observerRef} className="h-4" />

        {loadingProducts && (
          <div className="text-center py-3 text-slate-400 text-sm">Memuat lainnya...</div>
        )}

        {!loadingProducts && products.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">Tidak ada menu</div>
        )}
      </div>

      {/* Cart summary bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex items-center justify-between z-50">
          <div>
            <span className="text-sm font-medium text-slate-800">{cartCount} item</span>
            <span className="text-sm text-slate-500 ml-2">{formatCurrency(cartTotal)}</span>
          </div>
          <button
            onClick={handleOrder}
            disabled={ordering}
            className="px-5 py-2 rounded-pill bg-teal-primary text-white text-sm font-medium hover:bg-teal-dark disabled:opacity-50"
          >
            {ordering ? "Memproses..." : "Pesan"}
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {ordering && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-modal p-6 flex flex-col items-center gap-3 shadow-2xl">
            <svg className="w-8 h-8 animate-spin text-teal-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">Memproses pesanan...</span>
          </div>
        </div>
      )}
    </div>
  )
}
