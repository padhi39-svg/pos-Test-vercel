"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'
import { useRouter } from 'next/navigation'
import { showSuccess, showError } from '@/lib/notification'
import { printInvoiceById } from '@/lib/printInvoice'
import FormField from '@/components/ui/FormField'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import FormHeader from '@/components/ui/FormHeader'
import PageLoading from '@/components/ui/PageLoading'
import SearchableSelect from '@/components/ui/SearchableSelect'
import type { SearchableSelectOption } from '@/components/ui/SearchableSelect'
import SalesPickerModal from '@/components/sales/SalesPickerModal'
import CustomerPickerModal from '@/components/sales/CustomerPickerModal'
import SOPickerModal from '@/components/sales/SOPickerModal'

type Customer = { id: number; code: string; name: string; discountPercent: number; term?: number; salesId?: number | null }
type Sales = { id: number; code?: string; name: string }
type Product = { id: number; code: string; name: string; kategoriName?: string; spesifikasiName?: string; hpp?: number; units?: { id: number; name: string; ratio: number }[]; prices?: { unit_id: number; price: number; effectiveDate: string }[] }
type Warehouse = { id: number; code: string; name: string; is_active: number }

type InvoiceItem = {
  id: string; productId: number | null; name: string; quantity: number; unit: string; unitRatio: number
  price: number; discountPercent: number; disc1Percent: number; disc2Percent: number; disc3Percent: number
  discNominal: number; bonusProductId: number | null; bonusName: string; bonusQty: number; bonusUnit: string
  bonusUnitRatio: number; grossAmount: number; totalDiscount: number; netAmount: number; total: number
  soItemId?: number
}

export type SalesInvoiceFormInitialItem = {
  productId: number; name: string; quantity: number; unit: string; unitRatio: number; price: number
  discountPercent: number; disc1Percent: number; disc2Percent: number; disc3Percent: number; discNominal: number
  bonusProductId?: number | null; bonusName?: string; bonusQty?: number; bonusUnit?: string; bonusUnitRatio?: number
}

export type SalesInvoiceFormInitial = {
  invoiceNumber?: string; invoiceDate: string; dueDate?: string; fakturPajak?: string; notes?: string
  customer?: { id: number; code: string; name: string; discountPercent: number; term?: number }
  warehouse?: { id: number; code: string; name: string }
  sales?: { id: number; code?: string; name: string } | null
  soId?: number | null; soNumber?: string
  discountPercent: number; ppnPercent: number; includeTax: boolean
  items: SalesInvoiceFormInitialItem[]
}

export type SubmitPayload = {
  transactionDate: string; customerId: number; warehouseId: number; salesId: number | null
  subtotal: number; discountPercent: number; discountAmount: number; ppnPercent: number; ppnAmount: number
  total: number; dueDate: string; fakturPajak: string; notes: string
  priceIncludeTax: number; taxRatePercent: number
  transactionType?: number; paymentMethod?: string; paymentAmount?: number; soId?: number | null
  items: Array<{
    barangId: number; barangCode: string; barangName: string; quantity: number; unitName: string; unitRatio: number
    unitPrice: number; unitPriceIncludeTax: number; discountPercent: number
    disc1Percent: number; disc2Percent: number; disc3Percent: number; discNominal: number
    bonusBarangId: number | null; bonusName: string | null; bonusQty: number; bonusUnit: string | null; bonusUnitRatio: number
    grossAmount: number; totalDiscount: number; netAmount: number; totalPrice: number
  }>
}

export type SalesInvoiceFormProps = {
  title: string; subtitle?: string; backHref: string; readonly?: boolean
  initial?: SalesInvoiceFormInitial; onSubmit?: (data: SubmitPayload) => Promise<{ id: number; transactionNumber: string } | void>
  invoiceId?: number
}

const roundRp = (n: number) => Math.round(Number(n) || 0)

const calcItem = (
  price: number, qty: number, discPct: number, d1: number, d2: number, d3: number, discNominal: number = 0,
) => {
  const gross = roundRp(price * qty)
  const discAmt = roundRp(gross * (Math.max(0, Number(discPct) || 0) / 100))
  const afterDisc = Math.max(0, gross - discAmt)
  const d1Amt = roundRp(afterDisc * (Math.max(0, Number(d1) || 0) / 100))
  const after1 = Math.max(0, afterDisc - d1Amt)
  const d2Amt = roundRp(after1 * (Math.max(0, Number(d2) || 0) / 100))
  const after2 = Math.max(0, after1 - d2Amt)
  const d3Amt = roundRp(after2 * (Math.max(0, Number(d3) || 0) / 100))
  const after3 = Math.max(0, after2 - d3Amt)
  const discNomAmt = Math.min(Math.max(Number(discNominal) || 0, 0) * qty, after3)
  const netAmount = roundRp(after3 - discNomAmt)
  const totalDiscount = gross - netAmount
  return { grossAmount: gross, totalDiscount, netAmount }
}

const emptyInvoiceItem = (): InvoiceItem => ({
  id: Date.now().toString(), productId: null, name: '', quantity: 0, unit: '', unitRatio: 1,
  price: 0, discountPercent: 0, disc1Percent: 0, disc2Percent: 0, disc3Percent: 0, discNominal: 0,
  bonusProductId: null, bonusName: '', bonusQty: 0, bonusUnit: '', bonusUnitRatio: 1,
  grossAmount: 0, totalDiscount: 0, netAmount: 0, total: 0,
})

export default function SalesInvoiceForm({
  title, subtitle, backHref, readonly = false, initial, onSubmit, invoiceId,
}: SalesInvoiceFormProps) {
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [printPrompt, setPrintPrompt] = useState<{ id: number | null; number: string }>({ id: null, number: '' })

  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [salesList, setSalesList] = useState<Sales[]>([])
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showSOModal, setShowSOModal] = useState(false)
  const customerCache = useRef<Map<number, Customer>>(new Map())
  const warehouseCache = useRef<Map<number, Warehouse>>(new Map())
  const soCache = useRef<Map<number, any>>(new Map())

  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber || '')
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate || new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(initial?.dueDate || '')
  const [fakturPajak, setFakturPajak] = useState(initial?.fakturPajak || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    initial?.customer ? { id: initial.customer.id, code: initial.customer.code, name: initial.customer.name, discountPercent: initial.customer.discountPercent, term: initial.customer.term } : null,
  )
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(
    initial?.warehouse ? { id: initial.warehouse.id, code: initial.warehouse.code, name: initial.warehouse.name, is_active: 1 } : null,
  )
  const [selectedSales, setSelectedSales] = useState<Sales | null>(initial?.sales || null)
  const [selectedSO, setSelectedSO] = useState<any>(
    initial?.soId ? { id: initial.soId, so_number: initial.soNumber || '' } : null,
  )
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    if (initial?.items && initial.items.length > 0) {
      const mapped = initial.items.map((it, i) => {
        const calc = calcItem(
          it.price || 0, it.quantity || 0, it.discountPercent || 0,
          it.disc1Percent || 0, it.disc2Percent || 0, it.disc3Percent || 0, it.discNominal || 0,
        )
        return { ...emptyInvoiceItem(), id: `${Date.now()}_${i}`, productId: it.productId, name: it.name, quantity: it.quantity || 0, unit: it.unit || '', unitRatio: it.unitRatio || 1, price: it.price || 0, discountPercent: it.discountPercent || 0, disc1Percent: it.disc1Percent || 0, disc2Percent: it.disc2Percent || 0, disc3Percent: it.disc3Percent || 0, discNominal: it.discNominal || 0, bonusProductId: it.bonusProductId ?? null, bonusName: it.bonusName || '', bonusQty: it.bonusQty || 0, bonusUnit: it.bonusUnit || '', bonusUnitRatio: it.bonusUnitRatio || 1, ...calc }
      })
      return [...mapped, emptyInvoiceItem()]
    }
    return [emptyInvoiceItem()]
  })

  const [searchProduct, setSearchProduct] = useState('')
  const [showProductModal, setShowProductModal] = useState(false)
  const [showSalesModal, setShowSalesModal] = useState(false)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [canEditPrice, setCanEditPrice] = useState(false)
  const [allowBackdate, setAllowBackdate] = useState(true)
  const [emptyRowSearch, setEmptyRowSearch] = useState('')

  const [discountPercent, setDiscountPercent] = useState(initial?.discountPercent ?? 0)
  const [ppnPercent, setPpnPercent] = useState(initial?.ppnPercent ?? 11)
  const [includeTax, setIncludeTax] = useState(initial?.includeTax ?? false)

  const r = Math.max(0, Number(ppnPercent) || 0) / 100

  const computeLineTax = (netAmount: number) => {
    if (includeTax) {
      const dpp = roundRp(netAmount / (1 + r))
      const ppn = netAmount - dpp
      return { dpp, ppn, total: netAmount }
    }
    const ppn = roundRp(netAmount * r)
    return { dpp: netAmount, ppn, total: netAmount + ppn }
  }

  const { headerSubtotalDpp: subtotal, headerDiscountAmount: discountAmount, headerPpnAmount: ppnAmount, headerTotal: total } = useMemo(() => {
    let dppSum = 0
    let includeSum = 0
    for (const it of items) {
      const { dpp, total } = computeLineTax(it.netAmount)
      dppSum += dpp
      includeSum += total
    }
    const headerDiscDpp = roundRp(dppSum * (Math.max(0, discountPercent) / 100))
    const headerDiscInclude = roundRp(headerDiscDpp + roundRp(headerDiscDpp * r))
    const adjustedInclude = Math.max(0, includeSum - headerDiscInclude)
    const dppAfterHeader = roundRp(adjustedInclude / (1 + r))
    const ppnHdr = adjustedInclude - dppAfterHeader
    return {
      headerSubtotalDpp: dppSum,
      headerDiscountAmount: headerDiscDpp,
      headerPpnAmount: ppnHdr,
      headerTotal: adjustedInclude,
    }
  }, [items, discountPercent, ppnPercent, includeTax, r])

  const isEdit = !!initial && !!invoiceId && !readonly
  const headerDisabled = readonly || isEdit
  const displayItems = readonly ? items.filter(it => it.productId != null) : items

  useEffect(() => { loadData(); if (!initial && !readonly) generateInvoiceNumber() }, [])

  useEffect(() => {
    if (readonly) return
    const loadPerm = async () => {
      try {
        const authRes = await fetch('/api/auth/me')
        if (authRes.ok) {
          const auth = await authRes.json()
          const dyn = Array.isArray(auth?.user?.dynamicPermissions) ? auth.user.dynamicPermissions : []
          const has = dyn.some((p: any) => String(p.menuCode) === 'invoice' && String(p.permissionCode) === 'EDIT_PRICE' && Number(p.allowed) === 1)
          setCanEditPrice(Boolean(has))
          setAllowBackdate(auth.backdate_permissions?.['invoice'] ?? auth.allow_backdate === true)
        }
      } catch {}
    }
    loadPerm()
  }, [readonly])

  useEffect(() => {
    if (!allowBackdate && !readonly) {
      const today = new Date().toISOString().slice(0, 10)
      if (invoiceDate !== today) setInvoiceDate(today)
    }
  }, [allowBackdate, readonly])

  useEffect(() => {
    if (readonly) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); setShowProductModal(true) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [readonly])

  const loadData = async () => {
    try {
      const [barangResponse, customerResponse, warehouseResponse, settingsRes, salesRes] = await Promise.all([
        fetch('/api/barang'),
        fetch('/api/customer'),
        fetch('/api/gudang'),
        fetch('/api/settings?group=penjualan'),
        fetch('/api/sales'),
      ])

      if (barangResponse.ok) {
        const barangData = await barangResponse.json()
        const barangList = Array.isArray(barangData) ? barangData : (barangData?.rows || [])
        setProducts(barangList.filter((item: any) => item.aktif).map((item: any) => ({
          id: item.id, code: item.code, name: item.name, kategoriName: item.kategoriName,
          spesifikasiName: item.spesifikasiName, hpp: item.hpp, units: item.units || [], prices: item.prices || [],
        })))
      }
      if (customerResponse.ok) {
        const customerData = await customerResponse.json()
        const custList = Array.isArray(customerData) ? customerData : (customerData?.rows || [])
        const active = custList.filter((c: any) => !c.isdelete)
        active.forEach((c: any) => customerCache.current.set(c.id, { id: c.id, code: c.code, name: c.name, discountPercent: c.discountPercent || 0, term: c.term, salesId: c.salesId }))
        setCustomers(active)
      }
      if (warehouseResponse.ok) {
        const warehouseData = await warehouseResponse.json()
        const list = Array.isArray(warehouseData) ? warehouseData : warehouseData?.rows || []
        const active = list.filter((w: any) => w.is_active && !w.isdelete)
        active.forEach((w: any) => warehouseCache.current.set(w.id, { id: w.id, code: w.code, name: w.name, is_active: w.is_active }))
        setWarehouses(active)
        if (!selectedWarehouse && active.length > 0 && !initial?.warehouse) setSelectedWarehouse(active[0])
      }
      if (settingsRes.ok) {
        const settingsRows = await settingsRes.json()
        const settingsMap: Record<string, string> = {}
        ;(settingsRows || []).forEach((row: any) => { settingsMap[String(row.setting_key)] = String(row.setting_value ?? '') })
        const inc = settingsMap['sales_include_tax'] === '1'
        const taxPct = Number(settingsMap['sales_default_ppn_percent'] || settingsMap['sales_tax_percent'] || settingsMap['default_ppn_percent'] || settingsMap['ppn_percent'] || 11)
        if (!initial) {
          setIncludeTax(inc)
          setPpnPercent(!isNaN(taxPct) ? taxPct : 11)
        }
      } else if (!initial) {
        setIncludeTax(false); setPpnPercent(11)
      }
      if (salesRes.ok) {
        const data = await salesRes.json()
        const list = Array.isArray(data) ? data : data?.rows || []
        setSalesList(list.filter((s: any) => (s.isdelete ?? 0) === 0 && (s.aktif ?? 1) === 1))
      }
      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  const generateInvoiceNumber = async () => {
    try {
      const year = new Date().getFullYear()
      const countResult = await fetch('/api/transactions/count?year=' + year)
      if (countResult.ok) {
        const { count } = await countResult.json()
        const yearlyNumber = (count + 1).toString().padStart(6, '0')
        setInvoiceNumber(`JL/${year}/${yearlyNumber}`)
      }
    } catch (error) {
      console.error('Error generating invoice number:', error)
    }
  }

  const getPriceForUnit = (product: Product, unitId: number | null | undefined, effDate?: string): number => {
    const prices = Array.isArray(product?.prices) ? product.prices : []
    if (!prices.length) return 0
    const dateStr = (effDate || new Date().toISOString().slice(0, 10)).slice(0, 10)
    const buildRows = (rows: any[]) => rows.map((r: any) => ({ price: Number(r?.price) || 0, eff: String(r?.effectiveDate || (r as any).effective_date || '0000-00-00') }))
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

  const loadWarehouseOptions = async (query: string): Promise<SearchableSelectOption[]> => {
    try {
      const res = await fetch(`/api/gudang?q=${encodeURIComponent(query)}&limit=50`)
      if (!res.ok) return []
      const data = await res.json()
      const list = Array.isArray(data) ? data : data?.rows || []
      const active = list.filter((w: any) => w.is_active && !w.isdelete)
      active.forEach((w: any) => warehouseCache.current.set(w.id, { id: w.id, code: w.code, name: w.name, is_active: w.is_active }))
      return active.map((w: any) => ({ value: w.id, label: `${w.code} - ${w.name}` }))
    } catch { return [] }
  }

  const handleSelectSO = async (soId: number) => {
    if (readonly) return
    try {
      let detail = soCache.current.get(soId)
      if (!detail || !detail.items) {
        const res = await fetch(`/api/sales-orders/${soId}`)
        if (!res.ok) throw new Error('Gagal memuat SO')
        detail = await res.json()
        soCache.current.set(detail.id, detail)
      }
      setSelectedSO(detail)

      if (detail.customer_id) {
        const cached = customerCache.current.get(Number(detail.customer_id))
        setSelectedCustomer(cached ? { ...cached } : { id: Number(detail.customer_id), code: detail.customer_code || '', name: detail.customer_name || '', discountPercent: 0 })
      }
      if (detail.sales_id) {
        const s = salesList.find((x: Sales) => x.id === Number(detail.sales_id))
        if (s) setSelectedSales(s)
      }
      if (detail.warehouse_id) {
        const wh = warehouseCache.current.get(Number(detail.warehouse_id))
        if (wh) setSelectedWarehouse(wh)
      }
      setDiscountPercent(Number(detail.discount_percent || 0))

      const mapped = (detail.items || []).map((it: any) => {
        const qty = Number(it.quantity || 0)
        const unitPrice = Number(it.unit_price || 0)
        const itemDiscPct = Number(it.discount_percent || 0)
        const calc = calcItem(unitPrice, qty, itemDiscPct, 0, 0, 0, 0)
        const { total } = computeLineTax(calc.netAmount)
        return {
          ...emptyInvoiceItem(), id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          productId: Number(it.barang_id) || null, name: String(it.barang_name || ''),
          quantity: qty, unit: String(it.unit_name || 'pcs'), unitRatio: Number(it.unit_ratio || 1) || 1,
          price: unitPrice, discountPercent: itemDiscPct, ...calc, total, soItemId: it.id,
        }
      }).filter((x: InvoiceItem) => Number(x.quantity || 0) > 0)

      setItems(mapped.length ? [...mapped, emptyInvoiceItem()] : [emptyInvoiceItem()])
    } catch (err) {
      console.error('Failed to apply SO:', err)
    }
  }

  const applyCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setSelectedSO(null)
    setDiscountPercent(customer.discountPercent || 0)
    const termDays = customer.term || 30
    try {
      const base = new Date(invoiceDate)
      base.setDate(base.getDate() + termDays)
      setDueDate(base.toISOString().split('T')[0])
    } catch {}
    if (customer.salesId) {
      const s = salesList.find((x) => x.id === customer.salesId)
      if (s) setSelectedSales(s)
    }
  }

  const filteredProducts = products.filter(product => {
    const q = searchProduct.toLowerCase().trim()
    if (!q) return true
    return product.code.toLowerCase().includes(q) || product.name.toLowerCase().includes(q)
  })

  const handleSelectProduct = (product: Product) => {
    if (readonly) return
    const smallestUnit = product.units?.find(u => u.ratio === 1) || product.units?.[0]
    const defaultUnit = smallestUnit?.name || 'pcs'
    const defaultUnitRatio = smallestUnit?.ratio || 1
    const baseUiPrice = getPriceForUnit(product, smallestUnit?.id ?? null, invoiceDate)

    const baseItem = {
      productId: product.id, name: product.name, unit: defaultUnit, unitRatio: defaultUnitRatio,
      price: baseUiPrice, quantity: 1, discountPercent: 0, disc1Percent: 0, disc2Percent: 0,
      disc3Percent: 0, discNominal: 0, bonusProductId: null, bonusName: '', bonusQty: 0,
      bonusUnit: '', bonusUnitRatio: 1,
    }

    if (activeItemId) {
      setItems((prev) => prev.map((item) => {
        if (item.id !== activeItemId) return item
        const calc = calcItem(baseItem.price, baseItem.quantity, baseItem.discountPercent, baseItem.disc1Percent, baseItem.disc2Percent, baseItem.disc3Percent, baseItem.discNominal)
        const { total } = computeLineTax(calc.netAmount)
        return { ...item, ...baseItem, ...calc, total }
      }))
      setActiveItemId(null)
      setShowProductModal(false)
      setSearchProduct('')
      return
    }

    setItems((prev) => {
      const emptyRowIndex = prev.findIndex(item => !item.productId)
      if (emptyRowIndex >= 0) {
        const updated = prev.map((item, index) => {
          if (index !== emptyRowIndex) return item
          const calc = calcItem(baseItem.price, baseItem.quantity, baseItem.discountPercent, baseItem.disc1Percent, baseItem.disc2Percent, baseItem.disc3Percent, baseItem.discNominal)
          const { total } = computeLineTax(calc.netAmount)
          return { ...item, ...baseItem, ...calc, total }
        })
        const selectedItem = updated[emptyRowIndex]
        setTimeout(() => {
          const qtyInput = document.querySelector(`input[data-itemid="${selectedItem.id}"][data-field="quantity"]`) as HTMLInputElement
          if (qtyInput) { qtyInput.focus(); qtyInput.select() }
        }, 100)
        return [...updated, emptyInvoiceItem()]
      }
      const calc = calcItem(baseItem.price, baseItem.quantity, baseItem.discountPercent, baseItem.disc1Percent, baseItem.disc2Percent, baseItem.disc3Percent, baseItem.discNominal)
      const { total } = computeLineTax(calc.netAmount)
      const newItem = { ...emptyInvoiceItem(), ...baseItem, ...calc, total }
      setTimeout(() => {
        const qtyInput = document.querySelector(`input[data-itemid="${newItem.id}"][data-field="quantity"]`) as HTMLInputElement
        if (qtyInput) { qtyInput.focus(); qtyInput.select() }
      }, 100)
      return [...prev, newItem, emptyInvoiceItem()]
    })

    setSearchProduct('')
    setShowProductModal(false)
  }

  const updateItemQuantity = (id: string, quantity: number) => {
    if (readonly) return
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const calc = calcItem(item.price, quantity || 0, item.discountPercent, item.disc1Percent, item.disc2Percent, item.disc3Percent, item.discNominal)
      const { total } = computeLineTax(calc.netAmount)
      return { ...item, quantity: quantity || 0, ...calc, total }
    }))
  }

  const updateItemPrice = (id: string, price: number) => {
    if (readonly) return
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const calc = calcItem(price || 0, item.quantity, item.discountPercent, item.disc1Percent, item.disc2Percent, item.disc3Percent, item.discNominal)
      const { total } = computeLineTax(calc.netAmount)
      return { ...item, price: price || 0, ...calc, total }
    }))
  }

  const updateItemUnit = (id: string, unit: string) => {
    if (readonly) return
    setItems((prev) => prev.map((item) => {
      if (item.id !== id || !item.productId) return item
      const product = products.find(p => p.id === item.productId)
      if (product) {
        const selectedUnit = product.units?.find((u: any) => u.name === unit)
        if (selectedUnit) {
          const newPrice = getPriceForUnit(product, selectedUnit?.id, invoiceDate)
          const calc = calcItem(newPrice, item.quantity, item.discountPercent, item.disc1Percent, item.disc2Percent, item.disc3Percent, item.discNominal)
          const { total } = computeLineTax(calc.netAmount)
          return { ...item, unit, unitRatio: selectedUnit.ratio, price: newPrice, ...calc, total }
        }
      }
      return { ...item, unit }
    }))
  }

  const updateItemDiscPercent = (id: string, discPct: number) => {
    if (readonly) return
    const clamped = Math.min(Math.max(discPct || 0, 0), 100)
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const calc = calcItem(item.price, item.quantity, clamped, item.disc1Percent, item.disc2Percent, item.disc3Percent, item.discNominal)
      const { total } = computeLineTax(calc.netAmount)
      return { ...item, discountPercent: clamped, ...calc, total }
    }))
  }

  const updateItemDisc1 = (id: string, d1: number) => {
    if (readonly) return
    const clamped = Math.min(Math.max(d1 || 0, 0), 100)
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const calc = calcItem(item.price, item.quantity, item.discountPercent, clamped, item.disc2Percent, item.disc3Percent, item.discNominal)
      const { total } = computeLineTax(calc.netAmount)
      return { ...item, disc1Percent: clamped, ...calc, total }
    }))
  }

  const updateItemDisc2 = (id: string, d2: number) => {
    if (readonly) return
    const clamped = Math.min(Math.max(d2 || 0, 0), 100)
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const calc = calcItem(item.price, item.quantity, item.discountPercent, item.disc1Percent, clamped, item.disc3Percent, item.discNominal)
      const { total } = computeLineTax(calc.netAmount)
      return { ...item, disc2Percent: clamped, ...calc, total }
    }))
  }

  const updateItemDisc3 = (id: string, d3: number) => {
    if (readonly) return
    const clamped = Math.min(Math.max(d3 || 0, 0), 100)
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const calc = calcItem(item.price, item.quantity, item.discountPercent, item.disc1Percent, item.disc2Percent, clamped, item.discNominal)
      const { total } = computeLineTax(calc.netAmount)
      return { ...item, disc3Percent: clamped, ...calc, total }
    }))
  }

  const updateItemDiscNominal = (id: string, discNominal: number) => {
    if (readonly) return
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const calc = calcItem(item.price, item.quantity, item.discountPercent, item.disc1Percent, item.disc2Percent, item.disc3Percent, Math.max(0, discNominal || 0))
      const { total } = computeLineTax(calc.netAmount)
      return { ...item, discNominal: Math.max(0, discNominal || 0), ...calc, total }
    }))
  }

  const updateItemBonus = (id: string, bonusProductId: number | null, bonusName: string, bonusQty: number, bonusUnit: string) => {
    if (readonly) return
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const bpId = bonusProductId ?? (item.productId || null)
      return { ...item, bonusProductId: bpId, bonusName: bonusName || (bpId === item.productId ? item.name : ''), bonusQty, bonusUnit }
    }))
  }

  const removeItem = (id: string) => {
    if (readonly) return
    setItems((prev) => prev.filter(item => item.id !== id))
  }

  const handleSave = async () => {
    if (readonly || saving) return
    if (!selectedCustomer) { alert('Silakan pilih customer terlebih dahulu'); return }
    if (!selectedWarehouse) { alert('Silakan pilih gudang'); return }
    const validItems = items.filter(item => item.productId && item.quantity > 0)
    if (validItems.length === 0) { alert('Silakan tambahkan minimal 1 item'); return }
    if (!dueDate || dueDate < invoiceDate) { alert('Jatuh tempo harus sama atau setelah tanggal invoice'); return }

    setSaving(true)
    try {
      const payload: SubmitPayload = {
        transactionDate: invoiceDate, customerId: selectedCustomer.id,
        warehouseId: selectedWarehouse.id, salesId: selectedSales ? selectedSales.id : null,
        subtotal, discountPercent, discountAmount, ppnPercent, ppnAmount, total,
        dueDate, fakturPajak, notes, priceIncludeTax: includeTax ? 1 : 0, taxRatePercent: ppnPercent,
        transactionType: 3, paymentMethod: 'piutang', paymentAmount: total, soId: selectedSO?.id || null,
        items: validItems.map(item => {
          const p = products.find(p => p.id === item.productId)
          const pc = p?.code || ''
          const pn = p?.name || item.name || ''
          return {
            barangId: item.productId!, barangCode: pc, barangName: pn, quantity: item.quantity, unitName: item.unit,
          unitRatio: item.unitRatio, unitPrice: computeLineTax(item.price).dpp,
          unitPriceIncludeTax: includeTax ? Number(item.price) : roundRp(Number(item.price) * (1 + ppnPercent / 100)),
          discountPercent: item.discountPercent, disc1Percent: item.disc1Percent,
          disc2Percent: item.disc2Percent, disc3Percent: item.disc3Percent, discNominal: item.discNominal,
          bonusBarangId: item.bonusProductId, bonusName: item.bonusName || null,
          bonusQty: item.bonusQty, bonusUnit: item.bonusUnit || null, bonusUnitRatio: item.bonusUnitRatio,
          grossAmount: item.grossAmount, totalDiscount: item.totalDiscount,
            netAmount: item.netAmount, totalPrice: item.total,
          }
        })
      }
      if (onSubmit) {
        const result = await onSubmit(payload)
        if (result && result.id) {
          setPrintPrompt({ id: result.id, number: result.transactionNumber || '-' })
        } else {
          router.push(backHref)
        }
        return
      }

      const url = initial && invoiceId ? `/api/transactions/${invoiceId}` : '/api/transactions'
      const method = initial && invoiceId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const result = await response.json()
        const no = result?.transactionNumber || result?.number || invoiceNumber || '-'
        const id = Number(result?.transactionId || result?.id || 0) || null
        if (initial) showSuccess('Invoice berhasil diupdate')
        setPrintPrompt({ id, number: no })
      } else {
        const error = await response.json().catch(() => ({}))
        showError(error?.details || error?.error || 'Gagal menyimpan invoice')
        console.error('Invoice save error:', error)
      }
    } catch (error: any) {
      console.error('Error saving invoice:', error)
      showError(error?.message || 'Terjadi kesalahan saat menyimpan invoice')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoading />

  return (
    <div className="p-3 max-w-full mx-auto space-y-4">
      <FormHeader title={title} subtitle={subtitle} backHref={backHref} />

      <div className="container-card p-3 text-xs space-y-3">
        {/* Header Fields */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 pb-3 border-b">
          <FormField label="No. Invoice">
            <Input type="text" value={invoiceNumber} disabled placeholder="Akan digenerate saat disimpan" className="text-xs" />
          </FormField>

          <FormField label="Tanggal Invoice" required>
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} disabled={headerDisabled || !allowBackdate} className="text-xs" />
          </FormField>

          <FormField label="Customer" required>
            {headerDisabled ? (
              <Input type="text" value={selectedCustomer ? `${selectedCustomer.code} - ${selectedCustomer.name}` : '-'} disabled className="text-xs" />
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <div
                  className={`flex-1 px-3 py-1.5 text-xs border rounded-pill cursor-pointer ${
                    selectedCustomer
                      ? 'border-teal-bg text-slate-800'
                      : 'border-slate-300 text-slate-400'
                  } bg-white hover:border-slate-400`}
                  onClick={() => setShowCustomerModal(true)}
                >
                  {selectedCustomer
                    ? `${selectedCustomer.code} - ${selectedCustomer.name}`
                    : 'Klik untuk pilih customer...'}
                </div>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-xs text-red-500 hover:text-red-700 shrink-0"
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
                options={[]}
                value={selectedWarehouse?.id ?? null}
                onChange={(v) => {
                  if (v === null) { setSelectedWarehouse(null); return }
                  const cached = warehouseCache.current.get(Number(v))
                  if (cached) setSelectedWarehouse(cached)
                }}
                loadOptions={loadWarehouseOptions}
                placeholder="Cari gudang..."
                showSearch={true} allowClear={false}
                className="w-full" inputClassName="text-xs"
              />
            )}
          </FormField>

          <FormField label="Sales">
            {headerDisabled ? (
              <Input type="text" value={selectedSales ? `${selectedSales.code ? selectedSales.code + ' - ' : ''}${selectedSales.name}` : '-'} disabled className="text-xs" />
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

          <FormField label="No. Faktur Pajak">
            <Input type="text" value={fakturPajak} onChange={(e) => setFakturPajak(e.target.value)} disabled={headerDisabled} placeholder="Kosongkan untuk diisi nanti" className="text-xs" />
          </FormField>

          <FormField label="Ambil dari SO (Opsional)">
            {headerDisabled ? (
              <Input type="text" value={selectedSO ? selectedSO.so_number || '' : ''} disabled className="text-xs" />
            ) : (
              <div>
                <input
                  type="text"
                  value={selectedSO ? selectedSO.so_number || '' : ''}
                  readOnly
                  placeholder="Klik untuk pilih SO..."
                  onClick={() => setShowSOModal(true)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-pill text-xs bg-white cursor-pointer hover:border-teal-primary focus:ring-2 focus:ring-teal-bg focus:border-teal-primary outline-none transition-colors"
                />
                {selectedSO && (
                  <button
                    type="button"
                    onClick={() => setSelectedSO(null)}
                    className="text-[10px] text-red-500 mt-0.5 hover:text-red-700"
                  >
                    Hapus
                  </button>
                )}
              </div>
            )}
          </FormField>
        </div>

        {/* Detail Transaksi */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800">Detail Transaksi</h2>
            {!readonly && (
              <div className="flex gap-2">
                <Input
                  type="text" value={emptyRowSearch} onChange={(e) => setEmptyRowSearch(e.target.value)}
                  placeholder="Scan Barcode / Ketik Kode Barang..." className="w-64 text-xs"
                />
                <Button type="button" onClick={() => setShowProductModal(true)} className="text-xs px-3 py-1.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
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
                  <th className="px-2 py-1.5 text-left text-xs font-semibold w-48">Barang</th>
                  <th className="px-2 py-1.5 text-center w-14 text-xs font-semibold">Qty</th>
                  <th className="px-2 py-1.5 text-left w-24 text-xs font-semibold">Satuan</th>
                  <th className="px-2 py-1.5 text-center w-16 text-xs font-semibold">Qty Bonus</th>
                  <th className="px-2 py-1.5 text-left w-20 text-xs font-semibold">Sat Bonus</th>
                  <th className="px-2 py-1.5 text-right w-28 text-xs font-semibold">Harga Satuan</th>
                  <th className="px-1 py-1.5 text-right w-14 text-xs font-semibold">Disc%</th>
                  <th className="px-1 py-1.5 text-right w-14 text-xs font-semibold">Disc1%</th>
                  <th className="px-1 py-1.5 text-right w-14 text-xs font-semibold">Disc2%</th>
                  <th className="px-1 py-1.5 text-right w-14 text-xs font-semibold">Disc3%</th>
                  <th className="px-1 py-1.5 text-right w-24 text-xs font-semibold">DiscRp</th>
                  <th className="px-2 py-1.5 text-right w-28 text-xs font-semibold">Netto</th>
                  {!readonly && <th className="px-2 py-1.5 text-center w-16 text-xs font-semibold">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayItems.map((item) => (
                  <tr key={item.id} className="border-t border-teal-bg hover:bg-teal-bg/50">
                    <td className="px-2 py-1.5">
                      {item.productId ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <input type="text" value={item.name} readOnly
                              className="flex-1 px-2 py-1 border rounded text-xs bg-slate-50 text-slate-800 font-medium cursor-pointer"
                              onClick={() => { if (!readonly) { setActiveItemId(item.id); setShowProductModal(true) } }}
                              title="Klik untuk ganti barang" />
                            {!readonly && (
                              <button type="button" onClick={() => { setActiveItemId(item.id); setShowProductModal(true) }}
                                className="px-2 py-1 text-xs text-teal-primary hover:bg-teal-bg rounded flex items-center" title="Cari barang">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {item.bonusName && <div className="text-[10px] text-teal-primary mt-0.5 truncate">Bonus: {item.bonusName}</div>}
                        </div>
                      ) : (
                        !readonly && (
                          <div className="flex items-center gap-1">
                            <input type="text" placeholder="Scan / Ketik Kode Barang..."
                              onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { e.currentTarget.value = '' } }}
                              className="flex-1 px-2 py-1 border border-dashed border-slate-300 rounded text-xs text-slate-600 focus:border-blue-500 focus:outline-none" />
                            <button type="button" onClick={() => { setActiveItemId(null); setShowProductModal(true) }}
                              className="px-2 py-1 text-xs text-teal-primary hover:bg-teal-bg rounded flex items-center" title="Cari barang">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                              </svg>
                            </button>
                          </div>
                        )
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" placeholder="0" value={item.quantity || ''}
                        onChange={(e) => updateItemQuantity(item.id, Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        data-itemid={item.id} data-field="quantity"
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-center disabled:bg-slate-100 disabled:opacity-60" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={item.unit}
                        onChange={(e) => updateItemUnit(item.id, e.target.value)}
                        disabled={!item.productId || readonly}
                        className="w-full px-1.5 py-0.5 border rounded text-xs disabled:bg-slate-100 disabled:opacity-60">
                        <option value="">-</option>
                        {item.productId && products.find(p => p.id === item.productId)?.units?.map((u: any) => (
                          <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} value={item.bonusQty}
                        onChange={(e) => updateItemBonus(item.id, item.bonusProductId, item.bonusName, e.target.value === '' ? 0 : Number(e.target.value), item.bonusUnit)}
                        disabled={readonly}
                        className="w-full px-1 py-0.5 border rounded text-xs text-center disabled:bg-slate-100 disabled:opacity-60" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={item.bonusUnit}
                        onChange={(e) => updateItemBonus(item.id, item.bonusProductId, item.bonusName, item.bonusQty, e.target.value)}
                        disabled={readonly}
                        className="w-full px-1.5 py-0.5 border rounded text-xs disabled:bg-slate-100 disabled:opacity-60">
                        <option value="">-</option>
                        {products.find(p => p.id === item.productId)?.units?.map((u: any) => (
                          <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={item.price ? item.price.toLocaleString('id-ID') : '0'}
                        onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); updateItemPrice(item.id, v === '' ? 0 : Number(v)) }}
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        className={`w-full px-1.5 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60 ${!canEditPrice && !readonly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                        readOnly={!canEditPrice} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} max={100} step={0.1} value={item.discountPercent || 0}
                        onChange={(e) => updateItemDiscPercent(item.id, e.target.value === '' ? 0 : Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} max={100} step={0.1} value={item.disc1Percent || 0}
                        onChange={(e) => updateItemDisc1(item.id, e.target.value === '' ? 0 : Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} max={100} step={0.1} value={item.disc2Percent || 0}
                        onChange={(e) => updateItemDisc2(item.id, e.target.value === '' ? 0 : Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} max={100} step={0.1} value={item.disc3Percent || 0}
                        onChange={(e) => updateItemDisc3(item.id, e.target.value === '' ? 0 : Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={item.discNominal ? item.discNominal.toLocaleString('id-ID') : '0'}
                        onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); updateItemDiscNominal(item.id, v === '' ? 0 : Number(v)) }}
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60" />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-teal-primary text-xs">
                      {formatCurrency(computeLineTax(item.netAmount).dpp)}
                    </td>
                    {!readonly && (
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => removeItem(item.id)}
                          disabled={items.length <= 1}
                          className="px-1.5 py-0.5 rounded bg-coral-bg text-coral-dark hover:bg-coral-primary hover:text-white disabled:opacity-40 text-xs transition-colors">✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!readonly && (
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-slate-500 italic">Scan barcode atau klik &ldquo;Cari&rdquo; untuk menambah item.</div>
              <Button type="button" onClick={() => setItems((prev) => [...prev, emptyInvoiceItem()])} className="text-xs px-3 py-1.5">+ Tambah Item</Button>
            </div>
          )}
        </div>

        {/* Footer: Notes & Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-2">
            <FormField label="Catatan">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} readOnly={readonly} rows={2} placeholder="Catatan tambahan untuk invoice ini..." />
            </FormField>
            <FormField label="Jatuh Tempo" required>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={readonly} min={invoiceDate} className="text-xs" />
            </FormField>
          </div>

          <div>
            <div className="bg-cream p-3 rounded-card border border-teal-bg shadow-card">
              <h3 className="text-xs font-semibold text-slate-700 mb-2">Ringkasan</h3>
              <div className="space-y-1.5 mb-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {!readonly ? (
                  <>
                    <div className="flex justify-between text-xs items-center">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-600">Diskon:</span>
                        <input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))}
                          min="0" max="100" className="w-16 px-2 py-1 rounded-pill border border-teal-bg text-sm text-center outline-none" />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                      <span className="font-medium text-coral-dark">-{formatCurrency(discountAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs items-center">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-600">PPN:</span>
                        <input type="number" value={ppnPercent} onChange={(e) => setPpnPercent(Number(e.target.value))}
                          min="0" max="100" className="w-16 px-2 py-1 rounded-pill border border-teal-bg text-sm text-center outline-none" />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                      <span className="font-medium">{formatCurrency(ppnAmount)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">Diskon:</span>
                        <span className="font-medium text-coral-dark">-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">PPN:</span>
                      <span className="font-medium">{formatCurrency(ppnAmount)}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="border-t border-teal-bg pt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-800">TOTAL:</span>
                  <span className="text-teal-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {!readonly && (
          <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-teal-bg">
            <Button variant="outline" onClick={() => router.push(backHref)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving || items.filter(i => i.productId).length === 0 || !selectedCustomer}>
              {saving ? 'Menyimpan...' : initial && invoiceId ? 'Simpan Perubahan' : 'Simpan Invoice'}
            </Button>
          </div>
        )}
      </div>

      {/* Product Search Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col">
            <div className="p-3 border-b border-teal-bg flex items-center justify-between shrink-0">
              <div className="font-medium text-sm">Cari Barang</div>
              <button onClick={() => { setShowProductModal(false); setSearchProduct('') }} className="text-sm text-slate-500 hover:text-slate-700">Tutup</button>
            </div>
            <div className="p-3 border-b border-teal-bg shrink-0">
              <input ref={searchInputRef} type="text" placeholder="Ketik nama/kode barang atau scan barcode..." value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)} autoFocus
                className="w-full rounded-pill border border-slate-300 px-3 py-2 text-sm outline-none transition-colors hover:border-slate-400 focus:ring-2 focus:ring-[#E8F6F5] focus:border-[#2BA8A2]" />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <table className="w-full text-xs">
                <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold">Kode</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold">Nama Barang</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold">Kategori</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold">Spesifikasi</th>
                    <th className="px-2 py-1.5 text-center text-xs font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">{searchProduct ? 'Barang tidak ditemukan' : 'Ketik untuk mencari barang'}</td></tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-teal-bg/50">
                        <td className="px-2 py-1.5 font-mono text-slate-600">{product.code}</td>
                        <td className="px-2 py-1.5 font-medium text-slate-800">{product.name}</td>
                        <td className="px-2 py-1.5 text-slate-600">{product.kategoriName || '-'}</td>
                        <td className="px-2 py-1.5 text-slate-600">{product.spesifikasiName || '-'}</td>
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => handleSelectProduct(product)}
                            className="px-3 py-1 bg-teal-primary hover:bg-teal-dark text-white rounded-pill text-xs transition-colors">Pilih</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sales Picker Modal */}
      <SalesPickerModal
        open={showSalesModal}
        salesList={salesList}
        onSelect={(s) => { setSelectedSales(s); setShowSalesModal(false) }}
        onClose={() => setShowSalesModal(false)}
      />

      {/* Print Confirmation Modal */}
      {(printPrompt.id || printPrompt.number) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl w-full max-w-sm mx-4 p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-2">Invoice Tersimpan</h2>
            <p className="text-sm text-slate-700 mb-4">
              Invoice <span className="font-mono font-semibold">{printPrompt.number || '-'}</span> berhasil disimpan.
              <br />Apakah ingin langsung cetak sekarang?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPrintPrompt({ id: null, number: '' }); router.push(backHref) }}>Tidak</Button>
              <Button onClick={async () => {
                const id = printPrompt.id; setPrintPrompt({ id: null, number: '' })
                if (id) await printInvoiceById(id)
                router.push(backHref)
              }}>Ya, Cetak</Button>
            </div>
          </div>
        </div>
      )}

      <CustomerPickerModal
        open={showCustomerModal}
        customerList={customers}
        onSelect={(c) => {
          applyCustomer(c)
          setShowCustomerModal(false)
        }}
        onClose={() => setShowCustomerModal(false)}
      />

      <SOPickerModal
        open={showSOModal}
        customerId={selectedCustomer?.id}
        onSelect={(so) => {
          handleSelectSO(so.id)
          setShowSOModal(false)
        }}
        onClose={() => setShowSOModal(false)}
      />
    </div>
  )
}
