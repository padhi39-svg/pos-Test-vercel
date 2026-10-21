"use client"

import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/regionalNumber'
import { showError, showSuccess } from '@/lib/notification'
import { printSalesOrderById } from '@/lib/printSalesOrder'
import SearchableSelect from '@/components/ui/SearchableSelect'
import SalesPickerModal from '@/components/sales/SalesPickerModal'
import FormField from '@/components/ui/FormField'
import FormHeader from '@/components/ui/FormHeader'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export interface SalesOrderFormProps {
  title?: string
  subtitle?: string
  backHref?: string
  initial?: SalesOrderInitial | null
  readonly?: boolean
}

export interface SalesOrderInitial {
  id?: number
  soNumber?: string
  soDate?: string
  soStatus?: string
  customerId?: number
  customerCode?: string
  customerName?: string
  customerDiscountPercent?: number
  salesId?: number | null
  salesCode?: string
  salesName?: string
  warehouseId?: number
  warehouseCode?: string
  warehouseName?: string
  discountPercent?: number
  ppnPercent?: number
  includeTax?: boolean
  notes?: string
  items?: SalesOrderInitialItem[]
}

export interface SalesOrderInitialItem {
  id?: number
  productId: number
  name: string
  quantity: number
  unit: string
  unitRatio: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  totalPrice: number
  realizedQtyBase?: number
}

type Customer = { id: number; code: string; name: string; discountPercent?: number; salesId?: number | null }
type Sales = { id: number; code?: string; name: string }
type Warehouse = { id: number; code: string; name: string; is_active?: number }

type Product = {
  id: number
  code: string
  name: string
  hpp?: number
  kategoriName?: string
  spesifikasiName?: string
  units?: { id: number; name: string; ratio: number }[]
  prices?: { unit_id: number; price: number; effectiveDate: string }[]
}

type SoItem = {
  id: string
  productId: number | null
  name: string
  quantity: number
  unit: string
  unitRatio: number
  price: number
  discountPercent: number
  discountAmount: number
  total: number
}

const roundRp = (n: number) => Math.round(Number(n) || 0)

export default function SalesOrderForm({ title, subtitle, backHref, initial, readonly: readonlyProp }: SalesOrderFormProps) {
  const router = useRouter()
  const isNew = !initial || !initial.id
  const isLocked = !!initial?.items?.some((it: any) => Number(it.realized_qty_base || 0) > 0) || initial?.soStatus === 'realisasi'
  const isVoided = initial?.soStatus === 'void'
  const isView = readonlyProp === true || isLocked || isVoided
  const readOnly = isView || readonlyProp === true
  const isEdit = !!initial?.id && !isLocked && !isVoided && !readonlyProp
  const headerDisabled = readOnly || isEdit

  const [customerList, setCustomerList] = useState<Customer[]>([])
  const [salesList, setSalesList] = useState<Sales[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [soDate, setSoDate] = useState(initial?.soDate || new Date().toISOString().slice(0, 10))
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedSales, setSelectedSales] = useState<Sales | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [notes, setNotes] = useState(initial?.notes || '')
  const [discountPercent, setDiscountPercent] = useState(initial?.discountPercent ?? 0)
  const [ppnPercent, setPpnPercent] = useState(initial?.ppnPercent ?? 11)
  const [includeTax, setIncludeTax] = useState(initial?.includeTax ?? false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [printPrompt, setPrintPrompt] = useState<{ id: number | null; number: string }>({ id: null, number: '' })

  // Product modal state
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showProductModal, setShowProductModal] = useState(false)
  const [searchProduct, setSearchProduct] = useState("")
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  // Customer modal state
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [searchCustomer, setSearchCustomer] = useState("")

  // Sales modal state
  const [showSalesModal, setShowSalesModal] = useState(false)

  // Scan/search bar state
  const [emptyRowSearch, setEmptyRowSearch] = useState("")
  const customerCache = useRef<Map<number, Customer>>(new Map())
  const salesCache = useRef<Map<number, Sales>>(new Map())
  const warehouseCache = useRef<Map<number, Warehouse>>(new Map())

  const emptyRow = (): SoItem => ({
    id: (Date.now() + 1).toString(),
    productId: null,
    name: '',
    quantity: 0,
    unit: '',
    unitRatio: 1,
    price: 0,
    discountPercent: 0,
    discountAmount: 0,
    total: 0,
  })

  const initItems = (): SoItem[] => {
    if (initial?.items && initial.items.length > 0) {
      return initial.items.map((it, i) => ({
        id: `${Date.now()}_${i}`,
        productId: it.productId,
        name: it.name,
        quantity: it.quantity || 1,
        unit: it.unit || '',
        unitRatio: it.unitRatio || 1,
        price: it.unitPrice || 0,
        discountPercent: it.discountPercent || 0,
        discountAmount: it.discountAmount || 0,
        total: it.totalPrice || 0,
      }))
    }
    return [emptyRow()]
  }

  const [items, setItems] = useState<SoItem[]>(initItems)

  const returnQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('return') || '' : ''

  const baseHref = backHref || '/penjualan-sales-order'

  const salesOptions = useMemo(() =>
    salesList.map(s => ({ value: s.id, label: (s.code ? s.code + ' - ' : '') + s.name })),
  [salesList])

  const warehouseOptions = useMemo(() =>
    warehouses.map(w => ({ value: w.id, label: `${w.code} - ${w.name}` })),
  [warehouses])

  const computeLine = (uiUnitPrice: number, qty: number, discPct: number, discAmtPerUnit: number) => {
    const r = Math.max(0, Number(ppnPercent) || 0) / 100
    const unitPriceEx = includeTax ? roundRp(uiUnitPrice / (1 + r)) : uiUnitPrice
    const perUnitDiscount = discAmtPerUnit > 0 ? discAmtPerUnit : roundRp(uiUnitPrice * (Math.max(0, discPct) / 100))
    if (includeTax) {
      const lineGrossInc = uiUnitPrice * qty
      const discountCalc = Math.min(lineGrossInc, roundRp(perUnitDiscount) * qty)
      const totalAfterDisc = Math.max(0, lineGrossInc - discountCalc)
      const dpp = roundRp(totalAfterDisc / (1 + r))
      const ppn = totalAfterDisc - dpp
      const total = totalAfterDisc
      return { unitPriceEx, dpp, ppn, total, perUnitDiscount }
    } else {
      const lineGrossEx = unitPriceEx * qty
      const discountCalc = Math.min(lineGrossEx, roundRp(perUnitDiscount) * qty)
      const dpp = Math.max(0, lineGrossEx - discountCalc)
      const ppn = roundRp(dpp * r)
      const total = dpp + ppn
      return { unitPriceEx, dpp, ppn, total, perUnitDiscount }
    }
  }

  const r = Math.max(0, Number(ppnPercent) || 0) / 100
  const { subtotal, headerDiscountAmount, ppnAmount, total } = (() => {
    let dppSum = 0
    let includeSum = 0
    for (const it of items) {
      const { dpp, total } = computeLine(it.price, it.quantity, it.discountPercent, it.discountAmount)
      dppSum += dpp
      includeSum += total
    }
    const headerDiscDpp = roundRp(dppSum * (Math.max(0, discountPercent) / 100))
    const headerDiscInclude = roundRp(headerDiscDpp + roundRp(headerDiscDpp * r))
    const adjustedInclude = Math.max(0, includeSum - headerDiscInclude)
    const dppAfter = roundRp(adjustedInclude / (1 + r))
    const ppnHdr = adjustedInclude - dppAfter
    const grand = adjustedInclude
    return { subtotal: dppSum, headerDiscountAmount: headerDiscDpp, ppnAmount: ppnHdr, total: grand }
  })()

  useEffect(() => {
    const load = async () => {
      try {
        const [custRes, salesRes, whRes, barangRes, settingsRes] = await Promise.all([
          fetch('/api/customer'),
          fetch('/api/sales'),
          fetch('/api/gudang'),
          fetch('/api/barang'),
          fetch('/api/settings?group=penjualan'),
        ])
        if (custRes.ok) {
          const data = await custRes.json()
          const list = Array.isArray(data) ? data : data?.rows || []
          const active = list.filter((c: any) => !c.isDelete && !c.isdelete)
          active.forEach((c: any) => {
            customerCache.current.set(c.id, {
              id: c.id,
              code: c.code,
              name: c.name,
              discountPercent: c.discountPercent || 0,
              salesId: c.salesId || c.sales_id || null,
            })
          })
          setCustomerList(active)
        }
        if (salesRes.ok) {
          const data = await salesRes.json()
          const list = Array.isArray(data) ? data : data?.rows || []
          const active = list.filter((s: any) => !s.isdelete)
          active.forEach((s: any) => {
            salesCache.current.set(s.id, {
              id: s.id,
              code: s.code || '',
              name: s.name,
            })
          })
          setSalesList(active)
        }
        if (whRes.ok) {
          const data = await whRes.json()
          const list = Array.isArray(data) ? data : data?.rows || []
          const actives = list.filter((w: any) => (w.is_active ?? 1) === 1 && (w.isdelete ?? 0) === 0)
          actives.forEach((w: any) => {
            warehouseCache.current.set(w.id, {
              id: w.id,
              code: w.code,
              name: w.name,
              is_active: w.is_active,
            })
          })
          setWarehouses(actives)
          if (actives.length > 0) setSelectedWarehouse(actives[0])
        }
        if (barangRes.ok) {
          const data = await barangRes.json()
          const list = Array.isArray(data) ? data : data?.rows || []
          const activeProducts = list.filter((b: any) => b.aktif)
          setProducts(
            activeProducts.map((item: any) => ({
              id: item.id,
              code: item.code,
              name: item.name,
              hpp: item.hpp,
              kategoriName: item.kategoriName || (item as any).kategori_name || '-',
              spesifikasiName: item.spesifikasiName || (item as any).spesifikasi_name || '-',
              units: item.units || [],
              prices: item.prices || [],
            })),
          )
        }
        if (settingsRes.ok) {
          const rows = await settingsRes.json()
          const map: Record<string, string> = {}
          ;(rows || []).forEach((r: any) => {
            map[String(r.setting_key)] = String(r.setting_value ?? '')
          })
          const inc = map['sales_include_tax'] === '1'
          const taxPct = Number(
            map['sales_default_ppn_percent'] ||
              map['sales_tax_percent'] ||
              map['default_ppn_percent'] ||
              map['ppn_percent'] ||
              11,
          )
          setIncludeTax(inc)
          setPpnPercent(!isNaN(taxPct) ? taxPct : 11)
        }
      } catch (e) {
        console.error('Load SO master data failed:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (initial && !isNew && !loading) {
      setSoDate(initial.soDate || new Date().toISOString().slice(0, 10))
      setNotes(initial.notes || '')
      setDiscountPercent(initial.discountPercent ?? 0)
      setPpnPercent(initial.ppnPercent ?? 11)
      setIncludeTax(initial.includeTax ?? false)
      if (initial.warehouseId && warehouses.length > 0) {
        const found = warehouses.find(w => w.id === initial.warehouseId)
        if (found) setSelectedWarehouse(found)
      }
      if (initial.customerId && customerList.length > 0) {
        const found = customerList.find(c => c.id === initial.customerId)
        if (found) {
          setSelectedCustomer(found)
        } else {
          setSelectedCustomer({
            id: initial.customerId,
            code: initial.customerCode || '',
            name: initial.customerName || '',
            discountPercent: initial.customerDiscountPercent || 0,
            salesId: initial.salesId,
          })
        }
      }
      if (initial.salesId && salesList.length > 0) {
        const found = salesList.find(s => s.id === initial.salesId)
        if (found) setSelectedSales(found)
      }
      const mapped = (initial.items || []).map((it, i) => ({
        id: `${Date.now()}_${i}`,
        productId: it.productId,
        name: it.name,
        quantity: it.quantity || 1,
        unit: it.unit || '',
        unitRatio: it.unitRatio || 1,
        price: it.unitPrice || 0,
        discountPercent: it.discountPercent || 0,
        discountAmount: it.discountAmount || 0,
        total: it.totalPrice || 0,
      }))
      setItems(readOnly ? mapped : [...mapped, emptyRow()])
    }
  }, [initial, isNew, loading])

  const getPriceForUnit = (product: Product, unitId: number | null | undefined, effDate?: string): number => {
    const prices = Array.isArray(product?.prices) ? product.prices : []
    if (!prices.length) return 0
    const dateStr = (effDate || soDate).slice(0, 10)
    const buildRows = (rows: any[]) =>
      rows.map((r: any) => ({
        price: Number(r?.price) || 0,
        eff: String(r?.effectiveDate || (r as any).effective_date || '0000-00-00'),
      }))
    const byUnit = unitId != null ? prices.filter((r: any) => Number(r?.unit_id) === Number(unitId)) : prices
    let rows = buildRows(byUnit)
    if (!rows.length) rows = buildRows(prices)
    if (!rows.length) return 0
    const past = rows.filter((r: any) => r.price > 0 && r.eff <= dateStr)
    let chosen: any = null
    if (past.length > 0) {
      past.sort((a: any, b: any) => (a.eff < b.eff ? -1 : a.eff > b.eff ? 1 : 0))
      chosen = past[past.length - 1]
    } else if (rows.length > 0) {
      rows.sort((a: any, b: any) => (a.eff < b.eff ? -1 : a.eff > b.eff ? 1 : 0))
      chosen = rows[0]
    }
    const p1 = Number(chosen?.price || 0)
    if (p1 > 0) return p1
    const p2 = Number((product as any)?.price || NaN)
    if (!isNaN(p2) && p2 > 0) return p2
    const p3 = Number(product?.hpp || NaN)
    if (!isNaN(p3) && p3 > 0) return p3
    return 0
  }

  const handleSelectProduct = (product: Product) => {
    const targetId = activeItemId
    const smallestUnit = product.units?.find((u) => u.ratio === 1) || product.units?.[0]
    const unitName = smallestUnit?.name || 'PCS'
    const unitRatio = smallestUnit?.ratio || 1
    const uiPrice = getPriceForUnit(product, (smallestUnit as any)?.id, soDate)
    const { total, perUnitDiscount } = computeLine(uiPrice, 1, 0, 0)

    const newItem: SoItem = {
      id: Date.now().toString(),
      productId: product.id,
      name: product.name,
      quantity: 1,
      unit: unitName,
      unitRatio,
      price: uiPrice,
      discountPercent: 0,
      discountAmount: perUnitDiscount,
      total,
    }

    if (targetId) {
      setItems(items.map((it) => (it.id === targetId ? newItem : it)))
    } else {
      const emptyIdx = items.findIndex((it) => !it.productId)
      if (emptyIdx >= 0) {
        const updated = items.map((it, idx) => (idx === emptyIdx ? newItem : it))
        setItems([...updated, emptyRow()])
      } else {
        setItems([...items, newItem, emptyRow()])
      }
    }

    setShowProductModal(false)
    setSearchProduct("")
    setActiveItemId(null)
  }

  const updateItemQuantity = (id: string, quantity: number) => {
    setItems(
      items.map((it) => {
        if (it.id === id) {
          const { total, perUnitDiscount } = computeLine(it.price, quantity, it.discountPercent, it.discountAmount)
          return { ...it, quantity, discountAmount: perUnitDiscount, total }
        }
        return it
      }),
    )
  }

  const updateItemPrice = (id: string, price: number) => {
    setItems(
      items.map((it) => {
        if (it.id === id) {
          const { total, perUnitDiscount } = computeLine(price, it.quantity, it.discountPercent, it.discountAmount)
          return { ...it, price, discountAmount: perUnitDiscount, total }
        }
        return it
      }),
    )
  }

  const updateItemUnit = (id: string, unit: string) => {
    setItems(
      items.map((it) => {
        if (it.id === id && it.productId) {
          const product = products.find((p) => p.id === it.productId)
          if (product) {
            const selectedUnit = product.units?.find((u: any) => u.name === unit)
            if (selectedUnit) {
              const newPrice = getPriceForUnit(product, (selectedUnit as any)?.id, soDate)
              const { total, perUnitDiscount } = computeLine(newPrice, it.quantity, it.discountPercent, it.discountAmount)
              return {
                ...it,
                unit,
                unitRatio: selectedUnit.ratio,
                price: newPrice,
                discountAmount: perUnitDiscount,
                total,
              }
            }
          }
          return { ...it, unit }
        }
        return it
      }),
    )
  }

  const updateItemDiscount = (id: string, discountPct: number) => {
    setItems(
      items.map((it) => {
        if (it.id === id) {
          const { total, perUnitDiscount } = computeLine(it.price, it.quantity, discountPct, 0)
          return { ...it, discountPercent: discountPct, discountAmount: perUnitDiscount, total }
        }
        return it
      }),
    )
  }

  const updateItemDiscountAmount = (id: string, discountAmt: number) => {
    setItems(
      items.map((it) => {
        if (it.id === id) {
          const pct = it.price > 0 ? Math.min(100, Math.max(0, (discountAmt / it.price) * 100)) : 0
          const { total, perUnitDiscount } = computeLine(it.price, it.quantity, pct, discountAmt)
          return { ...it, discountAmount: perUnitDiscount, discountPercent: Number(pct.toFixed(2)), total }
        }
        return it
      }),
    )
  }

  const removeItem = (id: string) => {
    if (items.length <= 1) return
    setItems(items.filter((it) => it.id !== id))
  }

  const handleSave = async () => {
    if (!selectedCustomer) return showError('Customer wajib dipilih')
    if (!selectedWarehouse) return showError('Gudang wajib dipilih')

    const filledItems = items.filter((it) => it.productId && it.quantity > 0)
    if (filledItems.length === 0) return showError('Minimal 1 item produk')

    setSaving(true)
    try {
      const payload = {
        so_date: soDate,
        customer_id: selectedCustomer.id,
        warehouse_id: selectedWarehouse.id,
        sales_id: selectedSales ? selectedSales.id : null,
        discount_percent: discountPercent,
        discount_amount: headerDiscountAmount,
        tax_rate_percent: ppnPercent,
        price_include_tax: includeTax ? 1 : 0,
        items: filledItems.map((it) => ({
          barangId: it.productId,
          quantity: it.quantity,
          unitName: it.unit,
          unitRatio: it.unitRatio,
          unitPrice: computeLine(it.price, 1, 0, 0).unitPriceEx,
          discon_total: it.discountAmount * it.quantity,
          totalPrice: it.total,
        })),
        notes,
      }

      const method = isNew ? 'POST' : 'PUT'
      const url = isNew ? '/api/sales-orders' : `/api/sales-orders/${initial!.id}`

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Gagal menyimpan Sales Order')
      }
      const result = await res.json()
      const soNumber = result?.so_number || initial?.soNumber || ''
      const soId = Number(result?.id || initial?.id || 0) || null
      showSuccess(isNew ? 'Sales Order berhasil dibuat' : 'Sales Order berhasil diupdate')
      setPrintPrompt({ id: soId, number: soNumber })
    } catch (e: any) {
      console.error('Save SO failed:', e)
      showError(e?.message || 'Gagal menyimpan Sales Order')
    } finally {
      setSaving(false)
    }
  }

  // Filtered products for modal
  const filteredProducts = useMemo(() => {
    const q = searchProduct.toLowerCase().trim()
    return products.filter(p => {
      if (!q) return true
      return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
    })
  }, [products, searchProduct])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center text-sm text-slate-600">Memuat data Sales Order...</div>
      </div>
    )
  }

  return (
    <div className="p-3 max-w-full mx-auto space-y-4">
      <FormHeader
        title={title || 'Sales Order'}
        subtitle={subtitle}
        backHref={baseHref + (returnQuery ? '?' + returnQuery : '')}
      />

      <div className="container-card p-3 text-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 pb-3 border-b">
          <FormField label="No. SO">
            <Input
              type="text"
              value={initial?.soNumber || ''}
              disabled
              placeholder="Akan digenerate saat disimpan"
              className="text-xs"
            />
          </FormField>

          <FormField label="Tanggal SO" required>
            <Input
              type="date"
              value={soDate}
              onChange={(e) => setSoDate(e.target.value)}
              disabled={headerDisabled}
              className="text-xs"
            />
          </FormField>

          <FormField label="Customer" required>
            {headerDisabled ? (
              <Input type="text" value={selectedCustomer ? `${selectedCustomer.code} - ${selectedCustomer.name}` : '-'} disabled className="text-xs" />
            ) : (
              <div>
                <input
                  type="text"
                  value={selectedCustomer ? `${selectedCustomer.code} - ${selectedCustomer.name}` : ''}
                  readOnly
                  placeholder="Klik untuk pilih customer..."
                  onClick={() => { setShowCustomerModal(true); setSearchCustomer("") }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-pill text-xs bg-white cursor-pointer hover:border-teal-primary focus:ring-2 focus:ring-teal-bg focus:border-teal-primary outline-none transition-colors"
                />
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-[10px] text-red-500 mt-0.5 hover:text-red-700"
                  >
                    Hapus
                  </button>
                )}
              </div>
            )}
          </FormField>

          <FormField label="Sales">
            {headerDisabled ? (
              <Input type="text" value={selectedSales?.name || '-'} disabled className="text-xs" />
            ) : (
              <div>
                <input
                  type="text"
                  value={selectedSales ? `${selectedSales.code ? selectedSales.code + ' - ' : ''}${selectedSales.name}` : ''}
                  readOnly
                  placeholder="Klik untuk pilih sales..."
                  onClick={() => setShowSalesModal(true)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-pill text-xs bg-white cursor-pointer hover:border-teal-primary focus:ring-2 focus:ring-teal-bg focus:border-teal-primary outline-none transition-colors"
                />
                {selectedSales && (
                  <button
                    type="button"
                    onClick={() => setSelectedSales(null)}
                    className="text-[10px] text-red-500 mt-0.5 hover:text-red-700"
                  >
                    Hapus
                  </button>
                )}
              </div>
            )}
          </FormField>

          <FormField label="Gudang" required>
            {headerDisabled ? (
              <Input type="text" value={selectedWarehouse ? `${selectedWarehouse.code} - ${selectedWarehouse.name}` : '-'} disabled className="text-xs" />
            ) : (
              <SearchableSelect
                options={warehouseOptions}
                value={selectedWarehouse?.id ?? null}
                onChange={(v) => {
                  if (v === null) { setSelectedWarehouse(null); return }
                  const cached = warehouseCache.current.get(Number(v))
                  if (cached) setSelectedWarehouse(cached)
                  else {
                    const found = warehouses.find(w => w.id === Number(v))
                    if (found) setSelectedWarehouse(found)
                  }
                }}
                placeholder="Cari gudang..."
                showSearch={true}
                allowClear={false}
                className="w-full"
                inputClassName="text-xs"
              />
            )}
          </FormField>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800">Detail Barang</h2>
            {!readOnly && (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={emptyRowSearch}
                  onChange={(e) => setEmptyRowSearch(e.target.value)}
                  placeholder="Scan Barcode / Ketik Kode Barang..."
                  className="w-64 text-xs"
                />
                <Button
                  type="button"
                  onClick={() => {
                    setActiveItemId(null)
                    setShowProductModal(true)
                    setSearchProduct(emptyRowSearch)
                  }}
                  className="text-xs !px-3 !py-1.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Cari
                </Button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
                <tr>
                  <th className="px-2 py-1.5 text-left w-48 text-xs font-semibold">Barang</th>
                  <th className="px-2 py-1.5 text-center w-20 text-xs font-semibold">Qty</th>
                  <th className="px-2 py-1.5 text-left w-24 text-xs font-semibold">Satuan</th>
                  <th className="px-2 py-1.5 text-right w-28 text-xs font-semibold">Harga Satuan</th>
                  <th className="px-2 py-1.5 text-right w-20 text-xs font-semibold">Disc %</th>
                  <th className="px-2 py-1.5 text-right w-28 text-xs font-semibold">Disc (Rp)</th>
                  <th className="px-2 py-1.5 text-right w-28 text-xs font-semibold">Subtotal</th>
                  {!readOnly && (
                    <th className="px-2 py-1.5 text-center w-16 text-xs font-semibold">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-teal-bg hover:bg-teal-bg/50">
                    <td className="px-2 py-1.5">
                      {readOnly ? (
                        <span className="text-xs text-slate-800 font-medium">{it.name || '-'}</span>
                      ) : it.productId ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={it.name}
                            readOnly
                            className="flex-1 px-2 py-1 border rounded text-xs bg-slate-50 text-slate-800 font-medium cursor-pointer"
                            onClick={() => {
                              setActiveItemId(it.id)
                              setShowProductModal(true)
                            }}
                            title="Klik untuk ganti barang"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveItemId(it.id)
                              setShowProductModal(true)
                            }}
                            className="px-2 py-1 text-xs text-teal-primary hover:bg-blue-50 rounded flex items-center"
                            title="Cari barang"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="Scan / Ketik Kode Barang..."
                            className="flex-1 px-2 py-1 border border-dashed border-slate-300 rounded text-xs text-slate-600 focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveItemId(null)
                              setShowProductModal(true)
                            }}
                            className="px-2 py-1 text-xs text-teal-primary hover:bg-blue-50 rounded flex items-center"
                            title="Cari barang"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        placeholder="0"
                        min={0}
                        value={it.quantity || ""}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === "") {
                            updateItemQuantity(it.id, 0)
                          } else {
                            updateItemQuantity(it.id, Number(v) || 0)
                          }
                        }}
                        disabled={readOnly}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-center disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={it.unit}
                        onChange={(e) => updateItemUnit(it.id, e.target.value)}
                        disabled={!it.productId || readOnly}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-left disabled:bg-slate-100 disabled:opacity-60"
                      >
                        <option value="">-</option>
                        {it.productId &&
                          products
                            .find((p) => p.id === it.productId)
                            ?.units?.map((u: any) => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={it.price ? it.price.toLocaleString('id-ID') : '0'}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '')
                          updateItemPrice(it.id, v === '' ? 0 : Number(v))
                        }}
                        disabled={readOnly}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={it.discountPercent || 0}
                        onChange={(e) => updateItemDiscount(it.id, e.target.value === '' ? 0 : Number(e.target.value))}
                        disabled={readOnly}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={it.discountAmount ? it.discountAmount.toLocaleString('id-ID') : '0'}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '')
                          updateItemDiscountAmount(it.id, v === '' ? 0 : Number(v))
                        }}
                        disabled={readOnly}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-teal-primary text-xs">
                      {formatCurrency(it.total || 0)}
                    </td>
                    {!readOnly && (
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(it.id)}
                          disabled={items.length <= 1}
                          className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-30 text-xs transition-colors"
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <div className="mt-2 flex justify-between items-center">
              <div className="text-[11px] text-slate-500 italic">Tambahkan baris kosong untuk menambah item baru.</div>
              <Button type="button" className="text-xs !px-3 !py-1.5" onClick={() => setItems([...items, emptyRow()])}>
                + Tambah Item
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-2">
            <FormField label="Catatan">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={readOnly}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary min-h-[56px] resize-none disabled:bg-slate-100 disabled:opacity-60"
              />
            </FormField>
          </div>
          <div>
            <div className="p-3 rounded bg-teal-bg">
              <h3 className="text-xs font-semibold text-slate-700 mb-2">Ringkasan</h3>
              <div className="space-y-1.5 mb-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 font-medium">Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 font-medium">Diskon:</span>
                    <input
                      type="number"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                      min={0}
                      max={100}
                      disabled={readOnly}
                      className="w-12 px-1 py-0.5 border border-slate-300 rounded text-xs text-center disabled:bg-slate-100 disabled:opacity-60"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <span className="font-semibold text-red-600">-{formatCurrency(headerDiscountAmount)}</span>
                </div>
                <div className="flex justify-between text-xs items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 font-medium">PPN:</span>
                    <input
                      type="number"
                      value={ppnPercent}
                      onChange={(e) => setPpnPercent(Number(e.target.value) || 0)}
                      min={0}
                      max={100}
                      disabled={readOnly}
                      className="w-12 px-1 py-0.5 border border-slate-300 rounded text-xs text-center disabled:bg-slate-100 disabled:opacity-60"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(ppnAmount)}</span>
                </div>
              </div>
              <div className="border-t border-slate-300 pt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-800">TOTAL:</span>
                  <span className="text-teal-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-teal-bg">
          <Button variant="outline" className="text-xs" onClick={() => router.push(baseHref + (returnQuery ? '?' + returnQuery : ''))}>
            Batal
          </Button>
          {!readOnly && (
            <Button className="text-xs" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          )}
          {readonlyProp === true && initial?.id && !isLocked && !isVoided && (
            <Button className="text-xs" onClick={() => router.push(`${baseHref}/${initial!.id}/edit?return=${encodeURIComponent(returnQuery)}`)}>
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Sales Picker Modal */}
      <SalesPickerModal
        open={showSalesModal}
        salesList={salesList}
        onSelect={(s) => { setSelectedSales(s); setShowSalesModal(false) }}
        onClose={() => setShowSalesModal(false)}
      />

      {/* Customer Selection Modal */}
      {showCustomerModal && !readOnly && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Pilih Customer</h3>
              <p className="text-xs text-slate-600 mt-1">Ketik nama atau kode customer</p>
            </div>
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
              <input
                type="text"
                placeholder="Ketik nama/kode customer..."
                value={searchCustomer}
                onChange={(e) => setSearchCustomer(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
              />
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Kode</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Nama Customer</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">Diskon</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(() => {
                      const q = searchCustomer.toLowerCase().trim()
                      const filtered = customerList.filter(c => {
                        if (!q) return true
                        return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
                      })
                      return filtered.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                            {searchCustomer ? "Customer tidak ditemukan" : "Ketik untuk mencari customer"}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((customer) => (
                          <tr key={customer.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono text-slate-600">{customer.code}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{customer.name}</td>
                            <td className="px-3 py-2 text-center text-slate-600">
                              {customer.discountPercent ? `${customer.discountPercent}%` : '-'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => {
                                  setSelectedCustomer(customer)
                                  setDiscountPercent(customer.discountPercent || 0)
                                  if (customer.salesId) {
                                    const s = salesList.find(x => x.id === customer.salesId)
                                    if (s) setSelectedSales(s)
                                  }
                                  setShowCustomerModal(false)
                                  setSearchCustomer("")
                                }}
                                className="px-3 py-1 bg-teal-primary hover:bg-teal-dark text-white rounded text-xs font-medium transition-colors"
                              >
                                Pilih
                              </button>
                            </td>
                          </tr>
                        ))
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-between items-center">
              <div className="text-xs text-slate-600">
                Ditemukan: <span className="font-semibold">{(() => {
                  const q = searchCustomer.toLowerCase().trim()
                  if (!q) return customerList.length
                  return customerList.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)).length
                })()}</span> customer
              </div>
              <button
                onClick={() => { setShowCustomerModal(false); setSearchCustomer("") }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-pill font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Selection Modal */}
      {showProductModal && !readOnly && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Cari Barang</h3>
              <p className="text-xs text-slate-600 mt-1">Ketik nama atau kode barang</p>
            </div>
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Ketik nama/kode barang..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
              />
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Kode</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Nama Barang</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Kategori</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Spesifikasi</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                          {searchProduct ? "Barang tidak ditemukan" : "Ketik untuk mencari barang"}
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-slate-600">{product.code}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{product.name}</td>
                          <td className="px-3 py-2 text-slate-600">{product.kategoriName || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{product.spesifikasiName || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleSelectProduct(product)}
                              className="px-3 py-1 bg-teal-primary hover:bg-teal-dark text-white rounded text-xs font-medium transition-colors"
                            >
                              Pilih
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-between items-center">
              <div className="text-xs text-slate-600">
                Ditemukan: <span className="font-semibold">{filteredProducts.length}</span> barang
              </div>
              <button
                onClick={() => {
                  setShowProductModal(false)
                  setSearchProduct("")
                  setActiveItemId(null)
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-pill font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print prompt after save */}
      {(printPrompt.id || printPrompt.number) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl w-full max-w-sm mx-4 p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-2">SO Tersimpan</h2>
            <p className="text-sm text-slate-700 mb-4">
              SO <span className="font-mono font-semibold">{printPrompt.number || '-'}</span> berhasil disimpan.
              <br />Apakah ingin langsung cetak sekarang?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPrintPrompt({ id: null, number: '' }); window.location.href = baseHref + (returnQuery ? '?' + returnQuery : '') }}>Tidak</Button>
              <Button onClick={async () => {
                const id = printPrompt.id; setPrintPrompt({ id: null, number: '' })
                if (id) await printSalesOrderById(id)
                window.location.href = baseHref + (returnQuery ? '?' + returnQuery : '')
              }}>Ya, Cetak</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function mapSalesOrderToInitial(data: any): SalesOrderInitial {
  return {
    id: data.id,
    soNumber: data.so_number || data.so_no || '',
    soDate: data.so_date ? String(data.so_date).slice(0, 10) : '',
    soStatus: data.so_status || 'outstanding',
    customerId: data.customer_id,
    customerCode: data.customer_code || '',
    customerName: data.customer_name || '',
    customerDiscountPercent: Number(data.customer_discount_percent || data.discount_percent || 0),
    salesId: data.sales_id || null,
    salesCode: data.sales_code || '',
    salesName: data.sales_name || '',
    warehouseId: data.warehouse_id,
    warehouseCode: data.warehouse_code || '',
    warehouseName: data.warehouse_name || '',
    discountPercent: Number(data.discount_percent || 0),
    ppnPercent: Number(data.tax_rate_percent || data.ppn_percent || 11),
    includeTax: data.price_include_tax === 1 || data.include_tax === true,
    notes: data.notes || '',
    items: Array.isArray(data.items) ? data.items.map((it: any) => ({
      id: it.id,
      productId: it.barang_id || it.product_id || it.productId,
      name: it.barang_name || it.name || '',
      quantity: Number(it.quantity || 0),
      unit: it.unit_name || it.unit || '',
      unitRatio: Number(it.unit_ratio || 1) || 1,
      unitPrice: Number(it.unit_price || it.unitPrice || 0),
      discountPercent: Number(it.discount_percent || it.discountPercent || 0),
      discountAmount: Number(it.discount_amount || it.discountAmount || it.discon_total || 0),
      totalPrice: Number(it.total_price || it.totalPrice || 0),
      realizedQtyBase: Number(it.realized_qty_base || 0),
    })) : [],
  }
}
