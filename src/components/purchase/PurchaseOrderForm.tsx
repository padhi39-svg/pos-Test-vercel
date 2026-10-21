"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'
import { useRouter } from 'next/navigation'
import { showSuccess, showError } from '@/lib/notification'
import { printPurchaseOrderById } from '@/lib/printPurchaseOrder'
import SearchPickerModal from '@/components/SearchPickerModal'
import SupplierPickerModal from '@/components/purchase/SupplierPickerModal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Checkbox from '@/components/ui/Checkbox'
import FormHeader from '@/components/ui/FormHeader'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'

type Customer = {
  id: number
  code: string
  name: string
  discountPercent: number
  term?: number
}

type Product = {
  id: number
  code: string
  name: string
  kategoriName?: string
  spesifikasiName?: string
  hpp?: number
  units?: { id: number; name: string; ratio: number }[]
  prices?: { unit_id: number; price: number; effectiveDate: string }[]
}

type InvoiceItem = {
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

export type PurchaseOrderFormInitial = {
  poNumber?: string
  orderDate: string
  expectedDate?: string
  notes?: string
  supplierId?: number | null
  supplierName?: string
  supplierCode?: string
  discountPercent?: number
  ppnPercent?: number
  poStatus?: 'outstanding' | 'realisasi'
  isVoid?: number
  items?: {
    productId: number | null
    name: string
    quantity: number
    unit: string
    unitRatio: number
    price: number
    discountPercent: number
    discountAmount: number
  }[]
}

export type PurchaseOrderFormProps = {
  title: string
  subtitle?: string
  backHref?: string
  readonly?: boolean
  initial?: PurchaseOrderFormInitial
  onSubmit?: (data: {
    orderDate: string
    expectedDate?: string | null
    supplierId: number | null
    supplierName: string | null
    discountPercent: number
    ppnPercent: number
    poStatus: 'outstanding' | 'realisasi'
    notes?: string | null
    items: {
      barangId: number | null
      barangName: string
      quantity: number
      unitName: string
      unitRatio: number
      unitPrice: number
      discountPercent: number
      discountAmount: number
      totalPrice: number
    }[]
  }) => Promise<{ id?: number; poNumber?: string } | void>
}

export default function PurchaseOrderForm({ title, subtitle, backHref = '/pembelian/po', readonly = false, initial, onSubmit }: PurchaseOrderFormProps) {
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [supplierList, setSupplierList] = useState<import('@/components/purchase/SupplierPickerModal').Supplier[]>([])
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const supplierCache = useRef<Map<number, Customer>>(new Map())

  const [orderDate, setOrderDate] = useState(initial?.orderDate ?? new Date().toISOString().split('T')[0])
  const [expectedDate, setExpectedDate] = useState(initial?.expectedDate ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    if (initial?.items && initial.items.length > 0) {
      return [
        ...initial.items.map((it, i) => ({
          id: (Date.now() + i).toString(),
          productId: it.productId,
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          unitRatio: it.unitRatio,
          price: it.price,
          discountPercent: it.discountPercent,
          discountAmount: it.discountAmount,
          total: it.quantity * it.price - it.discountAmount * it.quantity,
        })),
        { id: Date.now().toString(), productId: null, name: '', quantity: 0, unit: '', unitRatio: 1, price: 0, discountPercent: 0, discountAmount: 0, total: 0 },
      ]
    }
    return [{ id: Date.now().toString(), productId: null, name: '', quantity: 0, unit: '', unitRatio: 1, price: 0, discountPercent: 0, discountAmount: 0, total: 0 }]
  })

  const [showProductModal, setShowProductModal] = useState(false)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [emptyRowSearch, setEmptyRowSearch] = useState('')
  const [printPrompt, setPrintPrompt] = useState<{ id: number | null; number: string }>({ id: null, number: '' })
  const [allowBackdate, setAllowBackdate] = useState(true)
  const [discountPercent, setDiscountPercent] = useState(initial?.discountPercent ?? 0)
  const [ppnPercent, setPpnPercent] = useState(initial?.ppnPercent ?? 11)
  const [poStatus, setPoStatus] = useState<'outstanding' | 'realisasi'>(initial?.poStatus ?? 'outstanding')
  const [isVoid, setIsVoid] = useState(initial?.isVoid ?? 0)

  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const discountAmount = Math.round(subtotal * (discountPercent / 100))
  const dpp = subtotal - discountAmount
  const ppnAmount = Math.round(dpp * (ppnPercent / 100))
  const total = dpp + ppnAmount

  const isEdit = !!initial
  const displayItems = readonly ? items.filter(it => it.productId != null && (it.name ?? '').trim().length > 0) : items

  const loadMasterData = useCallback(async () => {
    try {
      const [barangResponse, supplierResponse] = await Promise.all([
        fetch('/api/barang'),
        fetch('/api/supplier'),
      ])
      if (barangResponse.ok) {
        const barangData = await barangResponse.json()
        const barangList = Array.isArray(barangData) ? barangData : (barangData?.rows || [])
        const activeProducts = barangList.filter((item: any) => item.aktif)
        setProducts(activeProducts.map((item: any) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          kategoriName: item.kategoriName,
          spesifikasiName: item.spesifikasiName,
          hpp: item.hpp,
          units: item.units || [],
          prices: item.prices || [],
        })))
      }
      if (supplierResponse.ok) {
        const supplierData = await supplierResponse.json()
        const list = Array.isArray(supplierData) ? supplierData : (supplierData?.rows || [])
        const active = list.filter((c: any) => !c.isdelete)
        setSupplierList(active.map((c: any) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          discountPercent: c.discountPercent || 0,
          term: c.term,
        })))
        active.forEach((c: any) => {
          supplierCache.current.set(c.id, { id: c.id, code: c.code, name: c.name, discountPercent: c.discountPercent || 0, term: c.term })
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Error loading master data:', error)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (readonly) { setLoading(false); return }
    loadMasterData()
    if (!initial?.expectedDate && !initial) {
      const dd = new Date()
      dd.setDate(dd.getDate() + 30)
      setExpectedDate(dd.toISOString().split('T')[0])
    }
  }, [loadMasterData, initial])

  useEffect(() => {
    // Set initial supplier from edit data
    if (initial?.supplierId && initial?.supplierName && !selectedCustomer) {
      setSelectedCustomer({ id: initial.supplierId, code: initial.supplierCode || '', name: initial.supplierName, discountPercent: initial.discountPercent ?? 0 })
    }
  }, [initial])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setAllowBackdate(d.backdate_permissions?.['po'] ?? d.allow_backdate === true)
    }).catch(() => setAllowBackdate(false))
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); setShowProductModal(true) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  const handleSelectProduct = (product: Product) => {
    const smallestUnit = product.units?.find(u => u.ratio === 1) || product.units?.[0]
    const defaultUnit = smallestUnit?.name || 'pcs'
    const defaultUnitRatio = smallestUnit?.ratio || 1
    const latestPrice = 0

    if (activeItemId) {
      setItems(items.map(item =>
        item.id === activeItemId
          ? { ...item, productId: product.id, name: product.name, unit: defaultUnit, unitRatio: defaultUnitRatio, price: latestPrice, total: 0 }
          : item
      ))
      setActiveItemId(null)
      setShowProductModal(false)
      return
    }

    const emptyRowIndex = items.findIndex(item => !item.productId)

    if (emptyRowIndex >= 0) {
      const updatedItems = items.map((item, index) =>
        index === emptyRowIndex
          ? { ...item, productId: product.id, name: product.name, unit: defaultUnit, unitRatio: defaultUnitRatio, price: latestPrice, total: 0 }
          : item
      )
      const emptyRow = { id: Date.now().toString(), productId: null, name: '', quantity: 0, unit: '', unitRatio: 1, price: 0, discountPercent: 0, discountAmount: 0, total: 0 }
      setItems([...updatedItems, emptyRow])
      const selectedItem = updatedItems[emptyRowIndex]
      setTimeout(() => {
        const qtyInput = document.querySelector(`input[data-itemid="${selectedItem.id}"][data-field="quantity"]`) as HTMLInputElement
        if (qtyInput) { qtyInput.focus(); qtyInput.select() }
      }, 100)
    } else {
      const newItem: InvoiceItem = { id: Date.now().toString(), productId: product.id, name: product.name, quantity: 0, unit: defaultUnit, unitRatio: defaultUnitRatio, price: latestPrice, discountPercent: 0, discountAmount: 0, total: 0 }
      const newEmpty: InvoiceItem = { id: (Date.now() + 1).toString(), productId: null, name: '', quantity: 0, unit: '', unitRatio: 1, price: 0, discountPercent: 0, discountAmount: 0, total: 0 }
      setItems([...items, newItem, newEmpty])
      setTimeout(() => {
        const qtyInput = document.querySelector(`input[data-itemid="${newItem.id}"][data-field="quantity"]`) as HTMLInputElement
        if (qtyInput) { qtyInput.focus(); qtyInput.select() }
      }, 100)
    }
    setShowProductModal(false)
  }

  const updateItemQuantity = (id: string, quantity: number) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, quantity, total: Math.max(0, quantity * item.price - (item.discountAmount || 0) * quantity) } : item
    ))
  }
  const updateItemPrice = (id: string, price: number) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, price, total: Math.max(0, item.quantity * price - (item.discountAmount || 0) * item.quantity) } : item
    ))
  }
  const updateItemUnit = (id: string, unit: string) => {
    setItems(items.map(item => {
      if (item.id !== id || !item.productId) return item
      const product = products.find(p => p.id === item.productId)
      const selectedUnit = product?.units?.find((u: any) => u.name === unit)
      const unitRatio = selectedUnit?.ratio ?? item.unitRatio
      const perUnitDisc = item.price * (item.discountPercent || 0) / 100
      const total = Math.max(0, item.quantity * item.price - perUnitDisc * item.quantity)
      return { ...item, unit, unitRatio, discountAmount: perUnitDisc, total }
    }))
  }
  const updateItemDiscount = (id: string, discountPercent: number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item
      const perUnitDisc = item.price * discountPercent / 100
      const total = Math.max(0, item.quantity * item.price - perUnitDisc * item.quantity)
      return { ...item, discountPercent, discountAmount: perUnitDisc, total }
    }))
  }
  const updateItemDiscountAmount = (id: string, discountAmount: number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item
      const discountPercent = item.price > 0 ? (discountAmount / item.price) * 100 : 0
      const total = Math.max(0, item.quantity * item.price - discountAmount * item.quantity)
      return { ...item, discountAmount, discountPercent, total }
    }))
  }
  const removeItem = (id: string) => setItems(items.filter(item => item.id !== id))
  const addEmptyRow = () => {
    setItems([...items, { id: Date.now().toString(), productId: null, name: '', quantity: 0, unit: '', unitRatio: 1, price: 0, discountPercent: 0, discountAmount: 0, total: 0 }])
  }

  const handleSave = async () => {
    if (readonly) return
    if (isVoid === 1) { showError('PO yang sudah void tidak bisa diedit'); return }
    if (saving) return
    if (!selectedCustomer || !selectedCustomer.id) { showError('Silakan pilih supplier terlebih dahulu'); return }
    const validItems = items.filter(it => it.productId)
    if (validItems.length === 0) { showError('Silakan tambahkan minimal 1 item'); return }
    if (!onSubmit) return
    setSaving(true)
    try {
      const result = await onSubmit({
        orderDate,
        expectedDate: expectedDate || null,
        supplierId: selectedCustomer.id,
        supplierName: selectedCustomer.name,
        discountPercent,
        ppnPercent,
        poStatus,
        notes: notes || null,
        items: validItems.map(item => ({
          barangId: item.productId,
          barangName: item.name,
          quantity: item.quantity,
          unitName: item.unit,
          unitRatio: item.unitRatio,
          unitPrice: item.price,
          discountPercent: item.discountPercent || 0,
          discountAmount: item.discountAmount || 0,
          totalPrice: item.total,
        })),
      })
      if (result && 'poNumber' in result) {
        setPrintPrompt({ id: (result as any).id ?? null, number: (result as any).poNumber ?? '' })
      }
    } catch (error: any) {
      showError(error.message || 'Gagal menyimpan PO')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-primary mx-auto mb-2"></div>
          <p className="text-slate-600">Memuat data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <SearchPickerModal
        open={showProductModal}
        title="Cari Barang"
        subtitle="Ketik nama atau kode barang, atau scan barcode"
        placeholder="Ketik nama/kode barang atau scan barcode..."
        columns={[
          { key: 'code', label: 'Kode', className: 'font-mono text-slate-600' },
          { key: 'name', label: 'Nama Barang', className: 'font-medium text-slate-800' },
          { key: 'kategoriName', label: 'Kategori', render: (r) => r.kategoriName || '-' },
          { key: 'spesifikasiName', label: 'Spesifikasi', render: (r) => r.spesifikasiName || '-' },
          { key: 'aksi', label: 'Aksi', className: 'text-center', render: (r) => <Button type="button" onClick={() => handleSelectProduct(r)} className="!px-2 !py-1 text-xs">Pilih</Button> },
        ]}
        searchKeys={['code', 'name']}
        data={products}
        onPick={handleSelectProduct}
        onClose={() => setShowProductModal(false)}
      />

      {printPrompt.id && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800">Cetak Purchase Order</h2>
            </div>
            <div className="px-4 py-3 text-sm text-slate-700 space-y-2">
              <p>{isEdit ? 'PO berhasil diperbarui.' : 'PO berhasil disimpan.'}</p>
              <p>Nomor PO: <span className="font-mono font-semibold text-slate-900 ml-1">{printPrompt.number || '-'}</span></p>
              <p>Apakah Anda ingin langsung mencetak Purchase Order (A4)?</p>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => { setPrintPrompt({ id: null, number: '' }); router.push(backHref) }}>Tidak</Button>
              <Button type="button" onClick={async () => { const pid = printPrompt.id; setPrintPrompt({ id: null, number: '' }); if (pid) await printPurchaseOrderById(pid); router.push(backHref) }}>Ya, Cetak</Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-full mx-auto">
        <FormHeader title={title} subtitle={subtitle} backHref={backHref} />

        <div className="container-card p-3 text-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">No. PO</span>
              <Input
                type="text"
                value={initial?.poNumber || ''}
                readOnly
                placeholder="Akan digenerate saat disimpan"
                className="text-xs text-slate-500"
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Tanggal PO *</span>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} disabled={readonly || isVoid === 1} className="text-xs" />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Supplier *</span>
              <div className="flex-1 flex items-center gap-2">
                <div
                  className={`flex-1 px-3 py-1.5 text-xs border rounded-pill cursor-pointer ${
                    selectedCustomer
                      ? 'border-teal-bg text-slate-800'
                      : 'border-slate-300 text-slate-400'
                  } ${readonly || isVoid === 1 ? 'bg-slate-50' : 'bg-white hover:border-slate-400'}`}
                  onClick={() => { if (!readonly && isVoid !== 1) setShowSupplierModal(true) }}
                >
                  {selectedCustomer
                    ? (selectedCustomer.code ? selectedCustomer.code + ' - ' : '') + selectedCustomer.name
                    : 'Klik untuk pilih supplier...'}
                </div>
                {selectedCustomer && !readonly && isVoid !== 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-xs text-red-500 hover:text-red-700 shrink-0"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </label>
          </div>

          {!readonly && (
          <div className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Status</span>
            <Checkbox
              label="Status Realisasi"
              checked={poStatus === 'realisasi'}
              onChange={(e) => setPoStatus(e.target.checked ? 'realisasi' : 'outstanding')}
              disabled={readonly || isVoid === 1}
            />
          </div>
          )}
          {!selectedCustomer && !readonly && <p className="text-[11px] text-red-600 ml-[136px]">Supplier wajib dipilih.</p>}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-800">Detail Transaksi</h2>
              {!readonly && (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={emptyRowSearch}
                  onChange={(e) => setEmptyRowSearch(e.target.value)}
                  placeholder="Scan Barcode / Ketik Kode Barang..."
                  className="w-64 text-xs"
                />
                <Button type="button" onClick={() => setShowProductModal(true)}>
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
                    <th className="px-2 py-1.5 text-center w-20 text-xs font-semibold">Qty</th>
                    <th className="px-2 py-1.5 text-left w-24 text-xs font-semibold">Satuan</th>
                    <th className="px-2 py-1.5 text-right w-28 text-xs font-semibold">Harga Satuan</th>
                    <th className="px-2 py-1.5 text-right w-20 text-xs font-semibold">Diskon %</th>
                    <th className="px-2 py-1.5 text-right w-28 text-xs font-semibold">Diskon (Rp)</th>
                    <th className="px-2 py-1.5 text-right w-28 text-xs font-semibold">Subtotal</th>
                    <th className="px-2 py-1.5 text-center w-16 text-xs font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {displayItems.length === 0 && (
                    <tr>
                      <td colSpan={readonly ? 7 : 8} className="px-1 py-4 text-center text-slate-400 italic text-xs">Belum ada item</td>
                    </tr>
                  )}
                  {displayItems.map((item, idx) => (
                    <tr key={item.id} className="border-t border-teal-bg hover:bg-teal-bg/50">
                      <td className="px-2 py-1.5">
                        {(item.productId || (item.name && item.name.length > 0)) ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="text"
                              value={item.name || ''}
                              readOnly
                              className="flex-1 text-xs !px-2 !py-1 bg-slate-50 text-slate-800 font-medium cursor-pointer"
                              onClick={() => { if (!readonly) { setActiveItemId(item.id); setShowProductModal(true) } }}
                              title="Klik untuk ganti barang"
                            />
                            {!readonly && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => { if (!readonly) { setActiveItemId(item.id); setShowProductModal(true) } }}
                              className="!px-2 !py-1 text-xs"
                              title="Cari barang"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                              </svg>
                            </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Input
                              type="text"
                              placeholder="Scan / Ketik Kode Barang..."
                              onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) e.currentTarget.value = '' }}
                              className="flex-1 text-xs !px-2 !py-1 border-dashed border-slate-300 text-slate-600"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => { setActiveItemId(null); setShowProductModal(true) }}
                              className="!px-2 !py-1 text-xs"
                              title="Cari barang"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                              </svg>
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          placeholder="0"
                          value={item.quantity || ''}
                          onChange={(e) => updateItemQuantity(item.id, Number(e.target.value))}
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={readonly}
                          data-itemid={item.id}
                          data-field="quantity"
                          className="!px-1.5 !py-0.5 text-xs text-center"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select
                          value={item.unit}
                          onChange={(e) => updateItemUnit(item.id, e.target.value)}
                          disabled={!item.productId || readonly}
                          className="!px-1.5 !py-0.5 text-xs"
                        >
                          <option value="">-</option>
                          {item.productId && products.find(p => p.id === item.productId)?.units?.map((u: any) => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="text"
                          value={item.price ? item.price.toLocaleString('id-ID') : '0'}
                          onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); updateItemPrice(item.id, v === '' ? 0 : Number(v)) }}
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={readonly}
                          data-itemid={item.id}
                          data-field="price"
                          className="!px-1.5 !py-0.5 text-xs text-right"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={item.discountPercent || 0}
                          onChange={(e) => updateItemDiscount(item.id, e.target.value === '' ? 0 : Number(e.target.value))}
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={readonly}
                          data-itemid={item.id}
                          data-field="discountPercent"
                          className="!px-1.5 !py-0.5 text-xs text-right"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="text"
                          value={item.discountAmount ? item.discountAmount.toLocaleString('id-ID') : '0'}
                          onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); updateItemDiscountAmount(item.id, v === '' ? 0 : Number(v)) }}
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={readonly}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const currentIndex = items.findIndex(i => i.id === item.id)
                              if (currentIndex < items.length - 1) {
                                const nextItem = items[currentIndex + 1]
                                setTimeout(() => {
                                  const nextInput = document.querySelector(`input[data-itemid="${nextItem.id}"][data-field="quantity"]`) as HTMLInputElement
                                  if (nextInput) nextInput.focus()
                                }, 50)
                              } else if (item.productId) {
                                const saveButton = document.querySelector('button[type="submit"]') as HTMLButtonElement
                                if (saveButton) saveButton.focus()
                              }
                            }
                          }}
                          data-itemid={item.id}
                          data-field="discountAmount"
                          className="!px-1.5 !py-0.5 text-xs text-right"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-teal-primary text-xs">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1 || readonly}
                          className="text-coral-dark hover:underline disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                          title="Hapus"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!readonly && (
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs italic">
                <div className="text-slate-500">💡 Scan barcode atau klik &ldquo;Cari&rdquo; untuk menambah item.</div>
                {!items.some(i => !!i.productId) && <div className="text-red-600">Minimal satu item harus dipilih.</div>}
              </div>
              <button
                type="button"
                onClick={addEmptyRow}
                className="px-3 py-1.5 rounded-pill border border-teal-primary text-teal-primary hover:bg-teal-bg text-sm"
              >
                + Tambah Item
              </button>
            </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
    <div className="space-y-4">
              <label className="flex items-start gap-3">
                <span className="w-28 text-slate-600 shrink-0 pt-2">Catatan</span>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={readonly}
                  placeholder="Catatan tambahan untuk PO ini..."
                />
              </label>
              <div>
                <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Jatuh Tempo *</span>
                <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} min={orderDate} disabled={readonly || isVoid === 1} className="text-xs" />
              </label>
              </div>
            </div>
            <div>
              <div className="bg-teal-bg p-3 rounded">
                <h3 className="text-xs font-semibold text-teal-dark mb-2">Ringkasan</h3>
                <div className="space-y-1.5 mb-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600">Diskon:</span>
                      <Input
                        type="number"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(Number(e.target.value))}
                        min="0" max="100"
                        disabled={readonly}
                        className="!w-12 !px-1 !py-0.5 text-xs text-center"
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                    <span className="font-medium text-red-600">-{formatCurrency(discountAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600">PPN:</span>
                      <Input
                        type="number"
                        value={ppnPercent}
                        onChange={(e) => setPpnPercent(Number(e.target.value))}
                        min="0" max="100"
                        disabled={readonly}
                        className="!w-12 !px-1 !py-0.5 text-xs text-center"
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                    <span className="font-medium">{formatCurrency(ppnAmount)}</span>
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

          {!readonly && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setItems([{ id: Date.now().toString(), productId: null, name: '', quantity: 0, unit: '', unitRatio: 1, price: 0, discountPercent: 0, discountAmount: 0, total: 0 }])
              setSelectedCustomer(null)
              setDiscountPercent(0)
              setPpnPercent(11)
              setNotes('')
              setOrderDate(new Date().toISOString().split('T')[0])
              const dd = new Date()
              dd.setDate(dd.getDate() + 30)
              setExpectedDate(dd.toISOString().split('T')[0])
            }}>Reset</Button>
            <Button
              onClick={handleSave}
              type="submit"
              disabled={saving || !selectedCustomer || !items.some(i => !!i.productId) || isVoid === 1}
            >
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan PO'}
            </Button>
          </div>
          )}
        </div>
      </div>
      <SupplierPickerModal
        open={showSupplierModal}
        supplierList={supplierList}
        onSelect={(s) => {
          setSelectedCustomer(s)
          setDiscountPercent(s.discountPercent || 0)
          const termDays = s.term || 30
          const d = new Date(orderDate)
          d.setDate(d.getDate() + termDays)
          setExpectedDate(d.toISOString().split('T')[0])
          setShowSupplierModal(false)
        }}
        onClose={() => setShowSupplierModal(false)}
      />
    </div>
  )
}
