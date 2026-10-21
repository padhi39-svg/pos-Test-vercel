"use client"
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/regionalNumber'
import { showError } from '@/lib/notification'
import { printReturnById } from '@/lib/printReturn'

type Customer = { id: number; code: string; name: string; discountPercent?: number; term?: number; salesId?: number | null }
type Sales = { id: number; code?: string; name: string }
type Warehouse = { id: number; code: string; name: string; is_active: number }

type TxItem = {
  id:string; productId:number|null; name:string; quantity:number; unit:string; unitRatio:number; price:number
  discountPercent:number; disc1Percent:number; disc2Percent:number; disc3Percent:number; discNominal:number
  bonusProductId:number|null; bonusName:string; bonusQty:number; bonusUnit:string; bonusUnitRatio:number
  grossAmount:number; totalDiscount:number; netAmount:number
}

type TxDetail = {
  id:number; transaction_number:string; tgl_nota?:string; transaction_date?:string; created_at?:string
  customer_id?:number; customer_name?:string; warehouse_id?:number; sales_id?:number; sales_name?:string
  notes?:string; subtotal:number; discount_amount:number; ppn_amount:number; total:number; due_date?:string
  faktur_pajak?: string; discount_percent?: number
  items:Array<{ id:number; barang_id:number; barang_name:string; unit_name:string; unit_ratio?:number; quantity:number; unit_price?:number; total_price:number; discon_total?:number; disc1_percent?:number; disc2_percent?:number; disc3_percent?:number; disc_nominal?:number; discount_percent?:number; bonus_barang_id?:number; bonus_qty?:number; bonus_unit?:string }>
}

const calcItem = (price: number, qty: number, discPct: number, d1: number, d2: number, d3: number, discNominal: number = 0) => {
  const roundRp = (v: number) => Math.round(v || 0)
  const gross = roundRp(price * qty)
  const discPctAmt = roundRp(gross * (Math.max(0, Number(discPct) || 0) / 100))
  const afterPct = Math.max(0, gross - discPctAmt)
  const disc1Amt = roundRp(afterPct * (Math.max(0, Number(d1) || 0) / 100))
  const after1 = Math.max(0, afterPct - disc1Amt)
  const disc2Amt = roundRp(after1 * (Math.max(0, Number(d2) || 0) / 100))
  const after2 = Math.max(0, after1 - disc2Amt)
  const disc3Amt = roundRp(after2 * (Math.max(0, Number(d3) || 0) / 100))
  const after3 = Math.max(0, after2 - disc3Amt)
  const discNomAmt = Math.min(Math.max(Number(discNominal) || 0, 0) * qty, after3)
  const netAmount = roundRp(after3 - discNomAmt)
  const totalDiscount = gross - netAmount
  return { grossAmount: gross, totalDiscount, netAmount }
}

export default function EditSalesReturnPage({ params }: { params: { id: string } }){
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tx, setTx] = useState<TxDetail|null>(null)
  const [items, setItems] = useState<TxItem[]>([])
  const [fakturPajak, setFakturPajak] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [ppnPercent, setPpnPercent] = useState(11)
  const [includeTax, setIncludeTax] = useState(false)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [products, setProducts] = useState<any[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductModal, setShowProductModal] = useState(false)
  const [canEditPrice, setCanEditPrice] = useState(false)
  const [emptyRowSearch, setEmptyRowSearch] = useState('')
  const [printPrompt, setPrintPrompt] = useState<{ id: number | null; number: string }>({ id: null, number: '' })
  const [refInvoice, setRefInvoice] = useState<any>(null)

  // Master data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesList, setSalesList] = useState<Sales[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [pendingCustomerId, setPendingCustomerId] = useState<number | null>(null)
  const [pendingSalesId, setPendingSalesId] = useState<number | null>(null)

  // Picker states
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedSales, setSelectedSales] = useState<Sales | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [searchCustomer, setSearchCustomer] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [invoiceDate, setInvoiceDate] = useState('')
  const [allowBackdate, setAllowBackdate] = useState(true)

  const normalizeDate = (val?: string | null) => { if (!val) return ''; return String(val).slice(0, 10) }

  const nextId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const emptyItem = (): TxItem => ({ id:nextId(), productId:null, name:'', quantity:0, unit:'', unitRatio:1, price:0, discountPercent:0, disc1Percent:0, disc2Percent:0, disc3Percent:0, discNominal:0, bonusProductId:null, bonusName:'', bonusQty:0, bonusUnit:'', bonusUnitRatio:1, grossAmount:0, totalDiscount:0, netAmount:0 })
  const r = Math.max(0, Number(ppnPercent)||0)/100

  const computeLineTax = (netAmount: number) => {
    if (includeTax) {
      const dpp = Math.round(netAmount / (1 + r))
      const ppn = netAmount - dpp
      return { dpp, ppn, total: netAmount }
    } else {
      const ppn = Math.round(netAmount * r)
      return { dpp: netAmount, ppn, total: netAmount + ppn }
    }
  }

  const { subtotal, discountAmount, ppnAmount, total } = (() => {
    let dppSum = 0, includeSum = 0
    for (const it of items) {
      const { dpp, total } = computeLineTax(it.netAmount)
      dppSum += dpp; includeSum += total
    }
    const hdrDiscDpp = Math.round(dppSum * (Math.max(0, discountPercent) / 100))
    const hdrDiscInc = Math.round(hdrDiscDpp + Math.round(hdrDiscDpp * r))
    const adjustedInc = Math.max(0, includeSum - hdrDiscInc)
    const dppAfter = Math.round(adjustedInc / (1 + r))
    const ppn = adjustedInc - dppAfter
    return { subtotal: dppSum, discountAmount: hdrDiscDpp, ppnAmount: ppn, total: adjustedInc }
  })()

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      const dyn = Array.isArray(d?.user?.dynamicPermissions) ? d.user.dynamicPermissions : []
      const has = dyn.some((p: any) => String(p.menuCode) === 'invoice' && String(p.permissionCode) === 'EDIT_PRICE' && Number(p.allowed) === 1)
      setCanEditPrice(Boolean(has))
      setAllowBackdate(d.backdate_permissions?.['invoice'] ?? d.allow_backdate === true)
    }).catch(() => {})
  }, [])

  const loadData = async () => {
    try {
      const [barangRes, customerRes, warehouseRes, settingsRes, salesRes] = await Promise.all([
        fetch('/api/barang'),
        fetch('/api/customer'),
        fetch('/api/gudang'),
        fetch('/api/settings?group=penjualan'),
        fetch('/api/sales'),
      ])
      if (barangRes.ok) {
        const barangData = await barangRes.json()
        const barangList = Array.isArray(barangData) ? barangData : (barangData?.rows || [])
        setProducts(barangList.filter((item: any) => item.aktif))
      }
      if (customerRes.ok) {
        const customerData = await customerRes.json()
        const custList = Array.isArray(customerData) ? customerData : (customerData?.rows || [])
        setCustomers(custList.filter((c: any) => !c.isdelete))
      }
      if (warehouseRes.ok) {
        const warehouseData = await warehouseRes.json()
        setWarehouses(warehouseData.filter((w: any) => w.is_active && !w.isdelete))
      }
      if (settingsRes.ok) {
        const rows = await settingsRes.json()
        const map: Record<string, string> = {}
        ;(rows || []).forEach((r: any) => map[r.setting_key] = String(r.setting_value ?? ''))
        setIncludeTax(map['sales_include_tax'] === '1')
        setPpnPercent(Number(map['sales_default_ppn_percent'] || map['sales_tax_percent'] || 11) || 11)
      }
      if (salesRes.ok) {
        const data = await salesRes.json()
        const list = Array.isArray(data) ? data : data?.rows || []
        setSalesList(list.filter((s: any) => (s.isdelete ?? 0) === 0 && (s.aktif ?? 1) === 1))
      }
    } catch (error) {
      console.error('Error loading master data:', error)
    }
  }

  const loadInvoice = async () => {
    try {
      const response = await fetch(`/api/transactions/${params.id}`)
      if (!response.ok) throw new Error('not found')
      const data: TxDetail = await response.json()
      setTx(data)
      setInvoiceDate(normalizeDate(data.tgl_nota) || normalizeDate(data.transaction_date) || normalizeDate(data.created_at))
      setDueDate(normalizeDate(data.due_date))
      setFakturPajak(data.faktur_pajak || '')
      setNotes(data.notes || '')
      setDiscountPercent(Number(data.discount_percent || 0))

      // Set customer
      const custId = Number(data.customer_id)
      if (customers.length > 0) {
        const c = customers.find(x => x.id === custId)
        if (c) setSelectedCustomer(c)
      } else if (custId) {
        setPendingCustomerId(custId)
      }
      if (!custId && (data as any).customer_name) {
        setSearchCustomer(`${(data as any).customer_code || ''} - ${(data as any).customer_name || ''}`.replace(/^ - /, ''))
      }

      // Set sales (via separate effect to handle race with loadData)
      if (Number(data.sales_id)) setPendingSalesId(Number(data.sales_id))

      // Set warehouse (via separate effect to handle race with loadData)

      // Set items
      const mapped: TxItem[] = (data.items || []).map((it: any) => {
        const qty = Number(it.quantity) || 0
        const unitPrice = Number(it.unit_price) || (qty > 0 ? Math.round(Number(it.total_price || 0) / qty) : 0)
        const d1 = Number(it.disc1_percent || it.disc1Percent || 0)
        const d2 = Number(it.disc2_percent || it.disc2Percent || 0)
        const d3 = Number(it.disc3_percent || it.disc3Percent || 0)
        const dNom = Number(it.disc_nominal || it.discNominal || 0)
        const itemDiscPct = Number(it.discount_percent || 0)
        const calc = calcItem(unitPrice, qty, itemDiscPct, d1, d2, d3, dNom)
        return {
          id: String(it.id), productId: Number(it.barang_id) || null, name: String(it.barang_name || ''),
          quantity: qty, unit: String(it.unit_name || 'pcs'), unitRatio: Number(it.unit_ratio) || 1,
          price: unitPrice, discountPercent: itemDiscPct,
          disc1Percent: d1, disc2Percent: d2, disc3Percent: d3, discNominal: dNom,
          bonusProductId: Number(it.bonus_barang_id || it.bonusBarangId) || null,
          bonusName: '', bonusQty: Number(it.bonus_qty || it.bonusQty || 0),
          bonusUnit: String(it.bonus_unit || it.bonusUnit || ''), bonusUnitRatio: 1, ...calc
        }
      })
      setItems(mapped.length ? [...mapped, emptyItem()] : [emptyItem()])

      // Load reference invoice
      const refTxId = (data as any).invoice_id || (data as any).reference_transaction_id
      if (refTxId) {
        try {
          const refRes = await fetch(`/api/transactions/${refTxId}`)
          if (refRes.ok) {
            const refData = await refRes.json()
            setRefInvoice(refData)
          }
        } catch {}
      }
    } catch (e) {
      alert('Retur tidak ditemukan')
      router.push('/retur-penjualan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (params.id) {
      loadInvoice()
    }
  }, [params.id])

  useEffect(() => {
    if (pendingCustomerId && customers.length > 0) {
      const c = customers.find(x => x.id === pendingCustomerId)
      if (c) setSelectedCustomer(c)
      setPendingCustomerId(null)
    }
  }, [customers, pendingCustomerId])

  useEffect(() => {
    if (pendingSalesId && salesList.length > 0) {
      const s = salesList.find(x => x.id === pendingSalesId)
      if (s) setSelectedSales(s)
      setPendingSalesId(null)
    }
  }, [salesList, pendingSalesId])

  useEffect(() => {
    if (warehouses.length > 0 && tx) {
      const whId = Number((tx as any).warehouse_id)
      if (whId) {
        const wh = warehouses.find(w => w.id === whId)
        if (wh) setSelectedWarehouse(wh)
      } else if (!selectedWarehouse) {
        setSelectedWarehouse(warehouses[0])
      }
    }
  }, [warehouses, tx])

  useEffect(() => {
    if (selectedCustomer && selectedCustomer.name) {
      setSearchCustomer(`${selectedCustomer.code} - ${selectedCustomer.name}`)
    }
  }, [selectedCustomer])

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    c.code.toLowerCase().includes(searchCustomer.toLowerCase())
  )

  const filteredProducts = products.filter((p:any) =>
    String(p.code||'').toLowerCase().includes(productSearch.toLowerCase()) ||
    String(p.name||'').toLowerCase().includes(productSearch.toLowerCase())
  )

  const updateItemQuantity = (id: string, quantity: number) => setItems(prev => prev.map(item => item.id !== id ? item : { ...item, quantity: quantity || 0, ...calcItem(item.price, quantity || 0, item.discountPercent, item.disc1Percent, item.disc2Percent, item.disc3Percent, item.discNominal) }))
  const updateItemPrice = (id: string, price: number) => setItems(prev => prev.map(item => item.id !== id ? item : { ...item, price: price || 0, ...calcItem(price || 0, item.quantity, item.discountPercent, item.disc1Percent, item.disc2Percent, item.disc3Percent, item.discNominal) }))
  const updateItemUnit = (id: string, unit: string) => setItems(prev => prev.map(item => {
    if (item.id !== id || !item.productId) return item
    const prod = products.find((p:any) => p.id === item.productId)
    const selUnit = prod?.units?.find((u: any) => u.name === unit)
    const ratio = selUnit?.ratio ?? item.unitRatio
    return { ...item, unit, unitRatio: ratio, ...calcItem(item.price, item.quantity, item.discountPercent, item.disc1Percent, item.disc2Percent, item.disc3Percent, item.discNominal) }
  }))
  const updateItemDiscPercent = (id: string, discPct: number) => setItems(prev => prev.map(item => item.id !== id ? item : { ...item, discountPercent: discPct, ...calcItem(item.price, item.quantity, discPct, item.disc1Percent, item.disc2Percent, item.disc3Percent, item.discNominal) }))
  const updateItemDisc1 = (id: string, d1: number) => setItems(prev => prev.map(item => item.id !== id ? item : { ...item, disc1Percent: Math.min(Math.max(d1 || 0, 0), 100), ...calcItem(item.price, item.quantity, item.discountPercent, Math.min(Math.max(d1 || 0, 0), 100), item.disc2Percent, item.disc3Percent, item.discNominal) }))
  const updateItemDisc2 = (id: string, d2: number) => setItems(prev => prev.map(item => item.id !== id ? item : { ...item, disc2Percent: Math.min(Math.max(d2 || 0, 0), 100), ...calcItem(item.price, item.quantity, item.discountPercent, item.disc1Percent, Math.min(Math.max(d2 || 0, 0), 100), item.disc3Percent, item.discNominal) }))
  const updateItemDisc3 = (id: string, d3: number) => setItems(prev => prev.map(item => item.id !== id ? item : { ...item, disc3Percent: Math.min(Math.max(d3 || 0, 0), 100), ...calcItem(item.price, item.quantity, item.discountPercent, item.disc1Percent, item.disc2Percent, Math.min(Math.max(d3 || 0, 0), 100), item.discNominal) }))
  const updateItemDiscNominal = (id: string, discNominal: number) => setItems(prev => prev.map(item => item.id !== id ? item : { ...item, discNominal: discNominal || 0, ...calcItem(item.price, item.quantity, item.discountPercent, item.disc1Percent, item.disc2Percent, item.disc3Percent, discNominal || 0) }))
  const updateItemBonus = (id: string, field: 'bonusName' | 'bonusQty' | 'bonusUnit', value: string | number) => setItems(prev => prev.map(item => {
    if (item.id !== id) return item
    const updated = { ...item, [field]: value }
    if (field === 'bonusQty' && Number(value) > 0 && !item.bonusProductId && item.productId) { updated.bonusProductId = item.productId; updated.bonusName = item.name }
    return updated
  }))
  const removeRow = (id: string) => setItems(prev => prev.filter(x => x.id !== id))

  const handleSelectProduct = (product: any) => {
    const idx = items.findIndex(x => !x.productId)
    const unitName = (product?.units?.find((u:any)=> u.ratio===1)?.name) || (product?.units?.[0]?.name) || 'pcs'
    const unitRatio = (product?.units?.find((u:any)=> u.ratio===1)?.ratio) || (product?.units?.[0]?.ratio) || 1
    const basePrice = 0
    const calc = calcItem(basePrice, 0, 0, 0, 0, 0, 0)
    const patch: TxItem = { id:nextId(), productId: product.id, name: product.name, unit: unitName, unitRatio, price: basePrice, quantity:0, discountPercent:0, disc1Percent:0, disc2Percent:0, disc3Percent:0, discNominal:0, bonusProductId:null, bonusName:'', bonusQty:0, bonusUnit:'', bonusUnitRatio:1, ...calc }
    if (idx >= 0) {
      const upd = [...items]; upd[idx] = patch; upd.push(emptyItem()); setItems(upd)
    } else {
      setItems([...items, patch, emptyItem()])
    }
    setShowProductModal(false)
    setProductSearch('')
  }

  const handleSave = async () => {
    if (!tx) return
    if (!selectedCustomer) { alert('Pilih customer'); return }
    if (!selectedWarehouse) { alert('Pilih gudang'); return }
    const valid = items.filter(it => it.productId && it.quantity > 0)
    if (!valid.length) { alert('Minimal 1 item'); return }
    setSaving(true)
    try {
      const payload: any = {
        transactionDate: invoiceDate || null,
        customerId: selectedCustomer.id,
        warehouseId: selectedWarehouse.id,
        salesId: selectedSales?.id || null,
        fakturPajak, dueDate: dueDate || null, notes, discountPercent, ppnPercent,
        paymentMethod: 'piutang',
        paymentAmount: 0,
        changeAmount: 0,
        items: valid.map(it => ({
          barangId: it.productId, barangName: it.name, quantity: it.quantity, unitName: it.unit,
          unitPrice: computeLineTax(it.price).dpp,
          unitPriceIncludeTax: includeTax ? Number(it.price) : Math.round(Number(it.price) * (1 + ppnPercent / 100)),
          discountPercent: it.discountPercent,
          disc1Percent: it.disc1Percent, disc2Percent: it.disc2Percent, disc3Percent: it.disc3Percent,
          discNominal: it.discNominal,
          bonusBarangId: it.bonusProductId, bonusQty: it.bonusQty, bonusUnit: it.bonusUnit,
          totalPrice: it.netAmount,
        }))
      }
      const res = await fetch(`/api/transactions/${tx.id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const err = await res.json().catch(()=>({})); showError(err?.error || 'Gagal menyimpan perubahan'); return }
      setPrintPrompt({ id: Number(tx.id) || null, number: tx.transaction_number || String(tx.id || '') })
    } catch (e: any) { showError(e?.message || 'Gagal menyimpan') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-primary mx-auto mb-2"></div>
        <p className="text-slate-600">Memuat data...</p>
      </div>
    </div>
  )
  if (!tx) return null

  return (
    <div className="p-3 max-w-full mx-auto">
      <div className="mb-2">
        <h1 className="text-lg font-bold text-slate-800">EDIT RETUR PENJUALAN</h1>
        <div className="text-xs text-slate-500 mt-0.5">No: {tx.transaction_number}</div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-3">
        {/* Header Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 pb-3 border-b">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer *</label>
            <input type="text" readOnly value={selectedCustomer ? `${selectedCustomer.code} - ${selectedCustomer.name}` : '-'}
              className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-pill text-xs text-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Gudang *</label>
            <input type="text" readOnly value={selectedWarehouse ? `${selectedWarehouse.code} - ${selectedWarehouse.name}` : '-'}
              className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-pill text-xs text-slate-500" />
          </div>
        </div>

        {/* Header Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 pb-3 border-b">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Sales</label>
            <input type="text" readOnly value={selectedSales ? `${selectedSales.code ? selectedSales.code + ' - ' : ''}${selectedSales.name}` : '-'}
              className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-pill text-xs text-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">No. Faktur Pajak</label>
            <input value={fakturPajak} readOnly placeholder="Kosongkan untuk diisi nanti"
              className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-pill text-xs text-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Referensi Invoice</label>
            <input type="text" readOnly value={refInvoice ? `${refInvoice.transaction_number} - ${refInvoice.customer_name||''}` : '-'} placeholder="Invoice referensi"
              className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-pill text-xs text-slate-500" />
          </div>
        </div>

        {/* Detail Retur */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800">Detail Retur</h2>
            <div className="flex gap-2">
              <input type="text" value={emptyRowSearch}
                onChange={e=> { setEmptyRowSearch(e.target.value); setProductSearch(e.target.value) }}
                onKeyDown={(e)=>{ if ((e as any).key==='Enter') { setShowProductModal(true) } }}
                placeholder="Scan Barcode / Ketik Kode Barang..."
                className="px-2 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary w-64 text-xs" />
              <button type="button" onClick={() => { setProductSearch(emptyRowSearch); setShowProductModal(true) }}
                className="px-3 py-1.5 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors flex items-center gap-1 text-xs">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                Cari
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gradient-to-r from-slate-600 to-slate-700 text-white">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold w-48">Barang</th>
                  <th className="px-2 py-1.5 text-center w-12 text-xs font-semibold">Qty</th>
                  <th className="px-2 py-1.5 text-left w-24 text-xs font-semibold">Satuan</th>
                  <th className="px-2 py-1.5 text-center w-16 text-xs font-semibold">Qty Bonus</th>
                  <th className="px-2 py-1.5 text-center w-16 text-xs font-semibold">Sat Bonus</th>
                  <th className="px-2 py-1.5 text-right w-28 text-xs font-semibold">Harga Satuan</th>
                  <th className="px-2 py-1.5 text-right w-16 text-xs font-semibold">Disc%</th>
                  <th className="px-2 py-1.5 text-right w-16 text-xs font-semibold">Disc1%</th>
                  <th className="px-2 py-1.5 text-right w-16 text-xs font-semibold">Disc2%</th>
                  <th className="px-2 py-1.5 text-right w-16 text-xs font-semibold">Disc3%</th>
                  <th className="px-2 py-1.5 text-right w-20 text-xs font-semibold">DiscRp</th>
                  <th className="px-2 py-1.5 text-right w-28 text-xs font-semibold">Netto</th>
                  <th className="px-2 py-1.5 text-center w-16 text-xs font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((row, idx) => (
                  <tr key={row.id} className="border-b hover:bg-slate-50">
                    <td className="px-2 py-1.5">
                      {row.productId ? (
                        <div className="flex items-center gap-1">
                          <input type="text" value={row.name} readOnly
                            className="flex-1 px-2 py-1 border rounded text-xs bg-slate-50 text-slate-800 font-medium cursor-pointer"
                            onClick={() => setShowProductModal(true)} title="Klik untuk ganti barang" />
                          <button type="button" onClick={() => setShowProductModal(true)}
                            className="px-2 py-1 text-xs text-teal-primary hover:bg-teal-bg rounded flex items-center" title="Cari barang">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input type="text" placeholder="Scan / Ketik Kode Barang..."
                            className="flex-1 px-2 py-1 border border-dashed border-slate-300 rounded text-xs text-slate-600 focus:border-blue-500 focus:outline-none" />
                          <button type="button" onClick={() => setShowProductModal(true)}
                            className="px-2 py-1 text-xs text-teal-primary hover:bg-teal-bg rounded flex items-center" title="Cari barang">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                          </button>
                        </div>
                      )}
                      {row.bonusName && <div className="text-[10px] text-teal-primary">Bonus: {row.bonusName}</div>}
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" placeholder="0" value={row.quantity || ''}
                        onChange={e=> updateItemQuantity(row.id, Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        data-itemid={row.id} data-field="quantity"
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-center" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={row.unit} onChange={(e)=> updateItemUnit(row.id, e.target.value)}
                        disabled={!row.productId}
                        className="w-full px-1.5 py-0.5 border rounded text-xs">
                        <option value="">-</option>
                        {row.productId && products.find((p:any)=>p.id===row.productId)?.units?.map((u:any)=> <option key={u.id} value={u.name}>{u.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} value={row.bonusQty}
                        onChange={(e) => updateItemBonus(row.id, 'bonusQty', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full px-1 py-0.5 border rounded text-xs text-center" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={row.bonusUnit} onChange={(e) => updateItemBonus(row.id, 'bonusUnit', e.target.value)}
                        className="w-full px-1.5 py-0.5 border rounded text-xs">
                        <option value="">-</option>
                        {row.productId && products.find((p:any)=>p.id===row.productId)?.units?.map((u:any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={row.price ? row.price.toLocaleString('id-ID') : '0'}
                        onChange={e=> { const v = e.target.value.replace(/\D/g,''); updateItemPrice(row.id, v===''?0:Number(v)) }}
                        onFocus={(e) => e.currentTarget.select()}
                        data-itemid={row.id} data-field="price"
                        className={`w-full px-1.5 py-0.5 border rounded text-xs text-right ${!canEditPrice ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                        readOnly={!canEditPrice} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} max={100} step={0.1} value={row.discountPercent||0}
                        onChange={e=> updateItemDiscPercent(row.id, e.target.value===''?0:Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} max={100} step={0.1} value={row.disc1Percent||0}
                        onChange={e=> updateItemDisc1(row.id, e.target.value===''?0:Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} max={100} step={0.1} value={row.disc2Percent||0}
                        onChange={e=> updateItemDisc2(row.id, e.target.value===''?0:Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} max={100} step={0.1} value={row.disc3Percent||0}
                        onChange={e=> updateItemDisc3(row.id, e.target.value===''?0:Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={row.discNominal>0 ? row.discNominal.toLocaleString('id-ID') : '0'}
                        onChange={e=>{ const v = e.target.value.replace(/\D/g,''); updateItemDiscNominal(row.id, v===''?0:Number(v)) }}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right" />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-teal-primary text-xs">
                      {formatCurrency(computeLineTax(row.netAmount).dpp)}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={()=> removeRow(row.id)} disabled={items.length === 1}
                        className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-30 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-slate-500 italic">
              💡 Scan barcode atau klik &ldquo;Cari&rdquo; untuk menambah item.
            </div>
            <button type="button" onClick={() => setItems(prev => [...prev, emptyItem()])}
              className="px-3 py-1.5 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors flex items-center gap-1 text-xs font-medium">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Item
            </button>
          </div>
        </div>

        {/* Footer: Notes & Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Catatan</label>
              <textarea value={notes} onChange={e=> setNotes(e.target.value)} rows={2}
                placeholder="Catatan tambahan..."
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Jatuh Tempo</label>
              <input type="date" value={dueDate} onChange={e=> setDueDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
            </div>
          </div>

          <div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <h3 className="text-xs font-semibold text-slate-700 mb-2">Ringkasan</h3>
              <div className="space-y-1.5 mb-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Subtotal DPP:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600">Diskon:</span>
                    <input type="number" value={discountPercent === 0 ? '' : discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value === '' ? 0 : Number(e.target.value))}
                      min="0" max="100" placeholder="0"
                      className="w-12 px-1 py-0.5 border border-slate-300 rounded text-xs text-center" />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <span className="font-medium text-red-600">-{formatCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between text-xs items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600">PPN:</span>
                    <input type="number" value={ppnPercent}
                      onChange={(e) => setPpnPercent(Number(e.target.value))}
                      min="0" max="100"
                      className="w-12 px-1 py-0.5 border border-slate-300 rounded text-xs text-center" />
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

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-slate-200">
          <button onClick={() => router.push('/retur-penjualan')}
            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-pill font-medium transition-colors">Batal</button>
          <button onClick={() => {
            setItems([emptyItem()])
            setDiscountPercent(0); setPpnPercent(11); setFakturPajak(''); setDueDate(''); setNotes('')
          }}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-pill font-medium transition-colors">Reset</button>
          <button onClick={handleSave}
            disabled={saving || !items.some(i => !!i.productId)}
            className={`px-6 py-2 rounded-pill font-medium transition-colors ${
              saving || !items.some(i => !!i.productId)
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-teal-primary hover:bg-teal-dark text-white'
            }`}>
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>

      {/* Modal Produk */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Cari Barang</h3>
              <p className="text-xs text-slate-600 mt-1">Ketik nama atau kode barang, atau scan barcode</p>
            </div>
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
              <input ref={searchInputRef} type="text"
                placeholder="Ketik nama/kode barang atau scan barcode..." value={productSearch}
                onChange={e=> setProductSearch(e.target.value)} autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
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
                          {productSearch ? 'Barang tidak ditemukan' : 'Ketik untuk mencari barang'}
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p: any) => (
                        <tr key={`${p.id}-${p.code||p.name}`} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-slate-600">{p.code}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                          <td className="px-3 py-2 text-slate-600">{p.kategoriName || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{p.spesifikasiName || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => handleSelectProduct(p)}
                              className="px-3 py-1 bg-teal-primary hover:bg-teal-dark text-white rounded text-xs font-medium transition-colors">Pilih</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-between items-center">
              <div className="text-xs text-slate-600">Ditemukan: <span className="font-semibold">{filteredProducts.length}</span> barang</div>
              <button onClick={() => { setShowProductModal(false); setProductSearch('') }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-pill font-medium">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal konfirmasi cetak setelah update */}
      {printPrompt.id && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Cetak Retur?</h2>
            <p className="text-sm text-slate-600 mb-4">
              Retur <span className="font-mono font-semibold">{printPrompt.number}</span> berhasil diupdate.
              <br />
              Apakah Anda ingin mencetak retur sekarang?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
                onClick={() => {
                  setPrintPrompt({ id: null, number: '' })
                  router.push('/retur-penjualan')
                }}
              >
                Tidak
              </button>
              <button
                type="button"
                className="px-3 py-1.5 bg-teal-primary hover:bg-teal-dark text-white rounded-pill text-sm shadow-teal-glow"
                onClick={async () => {
                  const id = printPrompt.id
                  setPrintPrompt({ id: null, number: '' })
                  if (id) {
                    await printReturnById(id)
                  }
                  router.push('/retur-penjualan')
                }}
              >
                Ya, Cetak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
