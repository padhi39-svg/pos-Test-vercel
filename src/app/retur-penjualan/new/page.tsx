"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/regionalNumber'
import { showError } from '@/lib/notification'
import { printReturnById } from '@/lib/printReturn'

type Customer = { id: number; code: string; name: string; discountPercent?: number; term?: number; salesId?: number | null }
type Sales = { id: number; code?: string; name: string }
type Warehouse = { id: number; code: string; name: string; is_active: number }
type Product = { id: number; code: string; name: string; kategoriName?: string; spesifikasiName?: string; hpp?: number; units?: { id:number; name:string; ratio:number }[]; prices?: any[] }

type TxItem = {
  id: string
  productId: number | null
  name: string
  quantity: number
  unit: string
  unitRatio: number
  price: number
  discountPercent: number
  disc1Percent: number
  disc2Percent: number
  disc3Percent: number
  discNominal: number
  bonusProductId: number | null
  bonusName: string
  bonusQty: number
  bonusUnit: string
  bonusUnitRatio: number
  grossAmount: number
  totalDiscount: number
  netAmount: number
}

type InvoiceRow = any & { id:number; transaction_number:string; customer_name?:string; status:string; items?: any[] }

export default function NewSalesReturnPage(){
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [salesList, setSalesList] = useState<Sales[]>([])

  const [allowBackdate, setAllowBackdate] = useState(true)
  const [canEditPrice, setCanEditPrice] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [printPrompt, setPrintPrompt] = useState<{ id: number | null; number: string }>({ id: null, number: '' })

  const [selectedCustomer, setSelectedCustomer] = useState<Customer|null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse|null>(null)
  const [selectedSales, setSelectedSales] = useState<Sales|null>(null)

  const nextId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const emptyItem = (): TxItem => ({ id:nextId(), productId:null, name:'', quantity:0, unit:'', unitRatio:1, price:0, discountPercent:0, disc1Percent:0, disc2Percent:0, disc3Percent:0, discNominal:0, bonusProductId:null, bonusName:'', bonusQty:0, bonusUnit:'', bonusUnitRatio:1, grossAmount:0, totalDiscount:0, netAmount:0 })
  const [items, setItems] = useState<TxItem[]>([emptyItem()])

  const [includeTax, setIncludeTax] = useState(false)
  const [ppnPercent, setPpnPercent] = useState(11)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [fakturPajak, setFakturPajak] = useState('')
  const [notes, setNotes] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0,10))
  const [dueDate, setDueDate] = useState('')
  const [emptyRowSearch, setEmptyRowSearch] = useState('')
  const productSearchInputRef = useRef<HTMLInputElement>(null)

  const [refInvoice, setRefInvoice] = useState<InvoiceRow|null>(null)
  const [showRefModal, setShowRefModal] = useState(false)
  const [refSearch, setRefSearch] = useState('')
  const [allInvoices, setAllInvoices] = useState<InvoiceRow[]>([])

  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [searchCustomer, setSearchCustomer] = useState('')

  const [showProductModal, setShowProductModal] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const roundRp = (n:number)=> Math.round(Number(n)||0)
  const r = Math.max(0, Number(ppnPercent)||0)/100

  const calcItem = (price: number, qty: number, discPct: number, d1: number, d2: number, d3: number, discNominal: number = 0) => {
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

  const computeLineTax = (netAmount: number) => {
    if (includeTax) {
      const dpp = roundRp(netAmount / (1 + r))
      const ppn = netAmount - dpp
      return { dpp, ppn, total: netAmount }
    } else {
      const ppn = roundRp(netAmount * r)
      return { dpp: netAmount, ppn, total: netAmount + ppn }
    }
  }

  const { subtotal, discountAmount, ppnAmount, total } = (() => {
    let dppSum = 0
    let includeSum = 0
    for (const it of items) {
      const { dpp, total } = computeLineTax(it.netAmount)
      dppSum += dpp
      includeSum += total
    }
    const hdrDiscDpp = roundRp(dppSum * (Math.max(0, discountPercent) / 100))
    const hdrDiscInc = roundRp(hdrDiscDpp + roundRp(hdrDiscDpp * r))
    const adjustedInc = Math.max(0, includeSum - hdrDiscInc)
    const dppAfter = roundRp(adjustedInc / (1 + r))
    const ppn = adjustedInc - dppAfter
    return { subtotal: dppSum, discountAmount: hdrDiscDpp, ppnAmount: ppn, total: adjustedInc }
  })()

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setAllowBackdate(d.backdate_permissions?.['sales_return'] ?? d.allow_backdate === true)
      const dyn = Array.isArray(d?.user?.dynamicPermissions) ? d.user.dynamicPermissions : []
      const has = dyn.some((p: any) => String(p.menuCode) === 'invoice' && String(p.permissionCode) === 'EDIT_PRICE' && Number(p.allowed) === 1)
      setCanEditPrice(Boolean(has))
    }).catch(() => { setAllowBackdate(false); setCanEditPrice(false) })
  }, [])

  useEffect(() => {
    if (!allowBackdate) {
      const today = new Date().toISOString().slice(0, 10)
      if (invoiceDate !== today) setInvoiceDate(today)
    }
  }, [allowBackdate, invoiceDate])

  useEffect(() => {
    ;(async()=>{
      try{
        const [cRes, wRes, pRes, sRes, tRes, salesRes] = await Promise.all([
          fetch('/api/customer'),
          fetch('/api/gudang'),
          fetch('/api/barang'),
          fetch('/api/settings?group=penjualan'),
          fetch('/api/transactions'),
          fetch('/api/sales')
        ])
        if (cRes.ok) {
          const data = await cRes.json()
          const list = Array.isArray(data) ? data : (data?.rows || [])
          setCustomers(list.filter((c:any)=>!c.isdelete))
        }
        if (wRes.ok) {
          const data = await wRes.json()
          const list = Array.isArray(data) ? data : (data?.rows || [])
          const ws = list.filter((w:any)=> w.is_active && !w.isdelete)
          setWarehouses(ws)
          if (ws.length) setSelectedWarehouse(ws[0])
        }
        if (pRes.ok) {
          const data = await pRes.json()
          const list = Array.isArray(data) ? data : (data?.rows || [])
          setProducts(list.filter((p:any)=> p.aktif))
        }
        if (sRes.ok){
          const rows = await sRes.json(); const map:Record<string,string> = {}
          ;(rows||[]).forEach((r:any)=>{ map[r.setting_key]=String(r.setting_value??'') })
          setIncludeTax(map['sales_include_tax']==='1')
          setPpnPercent(Number(map['sales_default_ppn_percent']||11)||11)
        }
        if (tRes.ok){
          const data = await tRes.json()
          const tx = Array.isArray(data) ? data : (data?.rows || [])
          const inv = tx.filter((t:any)=> Number(t?.transaction_type)===3 && String(t?.status).toLowerCase()!=='void' && Number(t?.is_return)!==1)
          setAllInvoices(inv)
        }
        if (salesRes.ok) {
          const data = await salesRes.json()
          const list = Array.isArray(data) ? data : (data?.rows || [])
          setSalesList(list.filter((s:any) => (s.isdelete??0)===0 && (s.aktif??1)===1))
        }
        setLoading(false)
      }catch(e){ console.error(e); setLoading(false) }
    })()
  },[])

  const filteredInvoices = useMemo(()=>{
    const s = refSearch.toLowerCase()
    return allInvoices.filter((t:any)=>
      String(t.transaction_number||'').toLowerCase().includes(s) ||
      String(t.customer_name||'').toLowerCase().includes(s)
    )
  }, [allInvoices, refSearch])

  const filteredCustomers = useMemo(() => {
    const s = searchCustomer.toLowerCase()
    return customers.filter((c) => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s))
  }, [customers, searchCustomer])

  const filteredProducts = products.filter(product =>
    product.code.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  const getPriceForUnit = (product: Product, unitId: number | null | undefined, effDate?: string): number => {
    const prices = Array.isArray(product?.prices) ? product.prices : []
    if (!prices.length) return 0
    const dateStr = (effDate || new Date().toISOString().slice(0,10)).slice(0,10)
    const rows = prices.map((r:any)=>({ price:Number(r?.price)||0, eff:String(r?.effectiveDate || r?.effective_date || '0000-00-00'), unit_id:Number(r?.unit_id)||null }))
    const byUnit = unitId!=null ? rows.filter(r=> Number(r.unit_id)===Number(unitId)) : rows
    const pool = byUnit.length? byUnit : rows
    const past = pool.filter(r=> r.price>0 && r.eff <= dateStr)
    const pick = past.length ? past.sort((a,b)=> a.eff<b.eff?-1:a.eff>b.eff?1:0)[past.length-1] : pool.sort((a,b)=> a.eff<b.eff?-1:a.eff>b.eff?1:0)[0]
    const p = Number(pick?.price||0)
    if (p>0) return p
    return 0
  }

  const handleSelectProduct = (product: Product) => {
    const emptyRowIndex = items.findIndex(item => !item.productId)
    const smallestUnit = product.units?.find(u => u.ratio === 1) || product.units?.[0]
    const defaultUnit = smallestUnit?.name || 'pcs'
    const defaultUnitRatio = smallestUnit?.ratio || 1

    // Jika ada refInvoice, isi dari data invoice asli (seperti retur pembelian)
    const srcItem = sourceItemMap.get(product.id)
    const srcQty = srcItem ? Number(srcItem.quantity || srcItem.qty || 0) : 0
    const srcPrice = srcItem ? Number(srcItem.unitPrice || srcItem.unit_price || 0) : getPriceForUnit(product, (smallestUnit as any)?.id, invoiceDate)
    const srcUnit = srcItem ? (srcItem.unitName || srcItem.unit_name || defaultUnit) : defaultUnit
    const srcUnitRatio = srcItem ? (Number(srcItem.unitRatio || srcItem.unit_ratio || 1) || 1) : defaultUnitRatio
    const srcDiscPct = srcItem ? Number(srcItem.discountPercent || srcItem.discount_percent || 0) : 0
    const srcDisc1 = srcItem ? Number(srcItem.disc1Percent || srcItem.disc1_percent || 0) : 0
    const srcDisc2 = srcItem ? Number(srcItem.disc2Percent || srcItem.disc2_percent || 0) : 0
    const srcDisc3 = srcItem ? Number(srcItem.disc3Percent || srcItem.disc3_percent || 0) : 0
    const srcDiscNominal = srcItem ? Number(srcItem.discNominal || srcItem.disc_nominal || 0) : 0

    const initCalc = calcItem(srcPrice, refInvoice ? srcQty : 0, refInvoice ? srcDiscPct : 0, refInvoice ? srcDisc1 : 0, refInvoice ? srcDisc2 : 0, refInvoice ? srcDisc3 : 0, refInvoice ? srcDiscNominal : 0)

    const newItem: TxItem = {
      id: nextId(),
      productId: product.id,
      name: product.name,
      quantity: refInvoice ? srcQty : 0,
      unit: srcUnit,
      unitRatio: srcUnitRatio,
      price: srcPrice,
      discountPercent: refInvoice ? srcDiscPct : 0,
      disc1Percent: refInvoice ? srcDisc1 : 0,
      disc2Percent: refInvoice ? srcDisc2 : 0,
      disc3Percent: refInvoice ? srcDisc3 : 0,
      discNominal: refInvoice ? srcDiscNominal : 0,
      bonusProductId: null,
      bonusName: '',
      bonusQty: 0,
      bonusUnit: '',
      bonusUnitRatio: 1,
      ...initCalc
    }

    if (emptyRowIndex >= 0) {
      const updated = items.map((item, idx) => idx === emptyRowIndex ? newItem : item)
      setItems([...updated, emptyItem()])
      setTimeout(() => {
        const qtyInput = document.querySelector(`input[data-itemid="${newItem.id}"][data-field="quantity"]`) as HTMLInputElement
        if (qtyInput) { qtyInput.focus(); qtyInput.select() }
      }, 100)
    } else {
      setItems([...items, newItem, emptyItem()])
      setTimeout(() => {
        const qtyInput = document.querySelector(`input[data-itemid="${newItem.id}"][data-field="quantity"]`) as HTMLInputElement
        if (qtyInput) { qtyInput.focus(); qtyInput.select() }
      }, 100)
    }
    setProductSearch('')
    setShowProductModal(false)
  }

  const updateItemQuantity = (id: string, quantity: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const calc = calcItem(item.price, quantity || 0, item.discountPercent, item.disc1Percent, item.disc2Percent, item.disc3Percent, item.discNominal)
      return { ...item, quantity: quantity || 0, ...calc }
    }))
  }
  const updateItemPrice = (id: string, price: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const calc = calcItem(price || 0, item.quantity, item.discountPercent, item.disc1Percent, item.disc2Percent, item.disc3Percent, item.discNominal)
      return { ...item, price: price || 0, ...calc }
    }))
  }
  const updateItemUnit = (id: string, unit: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id || !item.productId) return item
      const product = products.find(p => p.id === item.productId)
      const selectedUnit = product?.units?.find((u: any) => u.name === unit)
      const unitRatio = selectedUnit?.ratio ?? item.unitRatio
      const newPrice = getPriceForUnit(product!, (selectedUnit as any)?.id, invoiceDate)
      const calc = calcItem(newPrice, item.quantity, item.discountPercent, item.disc1Percent, item.disc2Percent, item.disc3Percent, item.discNominal)
      return { ...item, unit, unitRatio, price: newPrice, ...calc }
    }))
  }
  const updateItemDiscPercent = (id: string, discPct: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const calc = calcItem(item.price, item.quantity, discPct, item.disc1Percent, item.disc2Percent, item.disc3Percent, item.discNominal)
      return { ...item, discountPercent: discPct, ...calc }
    }))
  }
  const updateItemDisc1 = (id: string, d1: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const calc = calcItem(item.price, item.quantity, item.discountPercent, Math.min(Math.max(d1 || 0, 0), 100), item.disc2Percent, item.disc3Percent, item.discNominal)
      return { ...item, disc1Percent: Math.min(Math.max(d1 || 0, 0), 100), ...calc }
    }))
  }
  const updateItemDisc2 = (id: string, d2: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const calc = calcItem(item.price, item.quantity, item.discountPercent, item.disc1Percent, Math.min(Math.max(d2 || 0, 0), 100), item.disc3Percent, item.discNominal)
      return { ...item, disc2Percent: Math.min(Math.max(d2 || 0, 0), 100), ...calc }
    }))
  }
  const updateItemDisc3 = (id: string, d3: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const calc = calcItem(item.price, item.quantity, item.discountPercent, item.disc1Percent, item.disc2Percent, Math.min(Math.max(d3 || 0, 0), 100), item.discNominal)
      return { ...item, disc3Percent: Math.min(Math.max(d3 || 0, 0), 100), ...calc }
    }))
  }
  const updateItemDiscNominal = (id: string, discNominal: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const calc = calcItem(item.price, item.quantity, item.discountPercent, item.disc1Percent, item.disc2Percent, item.disc3Percent, discNominal || 0)
      return { ...item, discNominal: discNominal || 0, ...calc }
    }))
  }
  const updateItemBonus = (id: string, field: 'bonusName' | 'bonusQty' | 'bonusUnit', value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      if (field === 'bonusQty' && Number(value) > 0 && !item.bonusProductId && item.productId) {
        updated.bonusProductId = item.productId
        updated.bonusName = item.name
      }
      return updated
    }))
  }
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const sourceItemMap = useMemo(() => {
    const map = new Map<number, any>()
    if (refInvoice?.items) {
      for (const it of refInvoice.items) {
        if (it.barangId) map.set(Number(it.barangId), it)
      }
    }
    return map
  }, [refInvoice])

  const modalProducts = useMemo(()=>{
    if (refInvoice) {
      const its = Array.isArray(refInvoice.items) ? refInvoice.items : []
      const s = productSearch.toLowerCase()
      return its
        .filter((it:any)=> String(it.barangCode||it.barangName||'').toLowerCase().includes(s) || String(it.barangName||'').toLowerCase().includes(s))
        .map((it:any)=> {
          const master = products.find(p => p.id === Number(it.barangId))
          return { id: Number(it.barangId)||0, code: String(it.barangCode||''), name: String(it.barangName||''), units: [{ id:0, name: it.unitName || 'pcs', ratio: Number(it.unitRatio)||1 }], kategoriName: master?.kategoriName, spesifikasiName: master?.spesifikasiName }
        })
    }
    return filteredProducts
  }, [products, refInvoice, productSearch, filteredProducts])

  const handleSave = async ()=>{
    if (!selectedCustomer) { alert('Pilih customer'); return }
    if (!selectedWarehouse) { alert('Pilih gudang'); return }
    const valid = items.filter(it=> it.productId && it.quantity>0)
    if (!valid.length) { alert('Minimal 1 item'); return }

    setSaving(true)
    try{
      const payload:any = {
        transactionDate: invoiceDate,
        dueDate: dueDate || null,
        customerId: selectedCustomer.id,
        warehouseId: selectedWarehouse.id,
        salesId: selectedSales ? selectedSales.id : null,
        discountPercent,
        ppnPercent,
        fakturPajak,
        notes,
        transactionType: 3,
        isReturn: 1,
        invoiceId: refInvoice?.id || null,
        paymentMethod: 'piutang',
        paymentAmount: 0,
        changeAmount: 0,
        items: valid.map(it=> ({
          barangId: it.productId,
          quantity: it.quantity,
          unitName: it.unit,
          unitRatio: it.unitRatio,
          unitPrice: computeLineTax(it.price).dpp,
          unitPriceIncludeTax: includeTax ? Number(it.price) : roundRp(Number(it.price) * (1 + ppnPercent / 100)),
          discountPercent: it.discountPercent,
          disc1Percent: it.disc1Percent,
          disc2Percent: it.disc2Percent,
          disc3Percent: it.disc3Percent,
          discNominal: it.discNominal,
          bonusBarangId: it.bonusProductId,
          bonusName: it.bonusName,
          bonusQty: it.bonusQty,
          bonusUnit: it.bonusUnit,
          totalPrice: it.netAmount,
        }))
      }
      const res = await fetch('/api/transactions', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const err = await res.json().catch(()=>({}))
        showError(err?.error || 'Gagal menyimpan retur')
        return
      }
      const data = await res.json()
      const idNum = Number(data?.id || data?.transactionId || 0)
      const noStr = String(data?.transactionNumber || data?.transaction_number || '-')
      setPrintPrompt({ id: idNum || null, number: noStr })
    } catch (e:any) {
      showError(e?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
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
    <div className="p-3 max-w-full mx-auto">
      <div className="mb-2">
        <h1 className="text-lg font-bold text-slate-800">RETUR PENJUALAN</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-3">
        {/* Header Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 pb-3 border-b">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">No. Retur</label>
            <input disabled placeholder="Akan digenerate (RJ/...)" className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-500 placeholder-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Retur *</label>
            <input type="date" value={invoiceDate} onChange={e=> setInvoiceDate(e.target.value)}
              disabled={!allowBackdate}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer *</label>
            <div className="relative">
              <input type="text"
                value={searchCustomer || (selectedCustomer ? `${selectedCustomer.code} - ${selectedCustomer.name}` : '')}
                onChange={(e) => { setSearchCustomer(e.target.value); setShowCustomerModal(e.target.value.length > 0) }}
                onFocus={() => setShowCustomerModal(true)}
                onClick={() => setShowCustomerModal(true)}
                placeholder={selectedCustomer ? `${selectedCustomer.code} - ${selectedCustomer.name}` : "Ketik untuk cari customer..."}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary text-slate-800" />
              {selectedCustomer && (
                <div className="absolute right-2 top-1.5 text-xs text-teal-primary">
                  {(selectedCustomer.discountPercent ?? 0) > 0 && `Diskon ${selectedCustomer.discountPercent}%`}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Gudang *</label>
            <select value={selectedWarehouse?.id || ''} onChange={(e)=> setSelectedWarehouse(warehouses.find(w=> w.id===Number(e.target.value))||null)}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary">
              <option value="">Pilih Gudang...</option>
              {warehouses.map(w=> <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
            </select>
            {!selectedWarehouse && (
              <p className="mt-1 text-[11px] text-red-600">Gudang wajib dipilih.</p>
            )}
          </div>
        </div>

        {/* Header Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 pb-3 border-b">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Sales</label>
            <select value={selectedSales?.id || ''} onChange={(e)=> setSelectedSales(salesList.find(x=> x.id===Number(e.target.value))||null)}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary">
              <option value="">Pilih Sales...</option>
              {salesList.map(s=> <option key={s.id} value={s.id}>{(s.code?s.code+' - ':'')+s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">No. Faktur Pajak</label>
            <input value={fakturPajak} onChange={e=> setFakturPajak(e.target.value)} placeholder="Kosongkan untuk diisi nanti"
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Referensi Invoice (opsional)</label>
            <div className="flex gap-2 items-center">
              <input type="text" readOnly value={refInvoice ? `${refInvoice.transaction_number} - ${refInvoice.customer_name||''}` : ''} placeholder="Klik untuk pilih invoice" onClick={()=> { if (!selectedCustomer) { alert('Pilih customer terlebih dahulu'); return }; setShowRefModal(true) }} className="flex-1 px-2 py-1.5 border rounded-lg text-xs bg-slate-50 cursor-pointer" />
              {refInvoice && (
                <button type="button" onClick={()=> setRefInvoice(null)} className="px-2 py-1.5 text-xs rounded-pill border border-slate-300 text-slate-600 hover:bg-slate-50 shrink-0">Hapus</button>
              )}
            </div>
          </div>
        </div>

        {/* Detail Retur */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800">Detail Retur</h2>
            <div className="flex gap-2">
              <input ref={productSearchInputRef} type="text" value={emptyRowSearch}
                onChange={e=> { setEmptyRowSearch(e.target.value); setProductSearch(e.target.value) }}
                onKeyDown={(e)=>{ if ((e as any).key==='Enter') { setShowProductModal(true) } }}
                placeholder="Scan Barcode / Ketik Kode Barang..."
                className="px-2 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary w-64 text-xs" />
              <button type="button" onClick={()=> { setProductSearch(emptyRowSearch); setShowProductModal(true) }}
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
                        {row.productId && products.find(p=>p.id===row.productId)?.units?.map((u:any)=> <option key={u.id} value={u.name}>{u.name}</option>)}
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
                        {row.productId && products.find(p=>p.id===row.productId)?.units?.map((u:any) => <option key={u.id} value={u.name}>{u.name}</option>)}
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
                        data-itemid={row.id} data-field="discountPercent"
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
                      <button onClick={()=> removeItem(row.id)} disabled={items.length === 1}
                        className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-30 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tambah Item Button */}
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-slate-500 italic">
              💡 Scan barcode atau klik &ldquo;Cari&rdquo; untuk menambah item.
            </div>
            <button type="button" onClick={()=> setItems(prev => [...prev, emptyItem()])}
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
                placeholder="Catatan tambahan untuk retur ini..."
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
          <button onClick={()=> router.push('/retur-penjualan')}
            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-pill font-medium transition-colors">Batal</button>
          <button onClick={() => {
            setItems([emptyItem()])
            setSelectedCustomer(null); setDueDate(''); setDiscountPercent(0); setPpnPercent(11); setFakturPajak(''); setNotes('')
            setInvoiceDate(new Date().toISOString().slice(0,10)); setRefInvoice(null); setSelectedSales(null)
          }}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-pill font-medium transition-colors">Reset</button>
          <button onClick={handleSave} disabled={saving || !selectedCustomer || !items.some(i => !!i.productId)}
            className={`px-6 py-2 rounded-pill font-medium transition-colors ${
              saving || !selectedCustomer || !items.some(i => !!i.productId)
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-teal-primary hover:bg-teal-dark text-white'
            }`}>
            {saving ? 'Menyimpan...' : 'Simpan Retur'}
          </button>
        </div>
      </div>

      {/* Modal Referensi */}
      {showRefModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 shrink-0">
              <h3 className="text-lg font-semibold text-slate-800">Pilih Invoice</h3>
              <p className="text-xs text-slate-600 mt-1">Hanya menampilkan invoice (bukan retur)</p>
            </div>
            <div className="p-6 border-b border-slate-200 shrink-0">
              <input value={refSearch} onChange={e=> setRefSearch(e.target.value)} placeholder="Cari No. Invoice / Customer..." autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">No. Invoice</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Customer</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Tanggal</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Total</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-500">Tidak ada data</td>
                    </tr>
                  ) : (
                    filteredInvoices.map(inv=> (
                      <tr key={inv.id} className="hover:bg-slate-50 cursor-pointer" onClick={()=>{ setRefInvoice(inv); setShowRefModal(false) }}>
                        <td className="px-3 py-2 font-medium text-slate-800">{inv.transaction_number}</td>
                        <td className="px-3 py-2 text-slate-600">{inv.customer_name||'-'}</td>
                        <td className="px-3 py-2 text-slate-600">{new Date((inv as any).tgl_nota || inv.created_at).toLocaleDateString('id-ID')}</td>
                        <td className="px-3 py-2 text-right text-slate-800">{formatCurrency(inv.total)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-teal-primary text-xs font-medium">Pilih</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-between items-center shrink-0">
              <div className="text-xs text-slate-600">Ditemukan: <span className="font-semibold">{filteredInvoices.length}</span> invoice</div>
              <button onClick={()=> setShowRefModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-pill font-medium">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Customer */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Pilih Customer</h3>
            </div>
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
              <input type="text" placeholder="Cari customer..." value={searchCustomer}
                onChange={e=> setSearchCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
              <div className="flex-1 overflow-y-auto space-y-2">
                {filteredCustomers.map(c => (
                  <button key={c.id}
                    onClick={()=> { setSelectedCustomer(c); setDiscountPercent(c.discountPercent || 0); const termDays = c.term || 30; const d = new Date(invoiceDate); d.setDate(d.getDate() + termDays); setDueDate(d.toISOString().split('T')[0]); if (c.salesId) { const s = salesList.find(x => x.id === c.salesId); if (s) setSelectedSales(s) }; setShowCustomerModal(false); setSearchCustomer('') }}
                    className="w-full text-left p-3 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                    <div className="font-medium text-slate-800">{c.code}</div>
                    <div className="text-slate-600 text-sm">{c.name}</div>
                    {(c.discountPercent ?? 0) > 0 && (
                      <div className="text-teal-primary text-xs mt-1">Diskon: {c.discountPercent}%</div>
                    )}
                  </button>
                ))}
                {filteredCustomers.length===0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">Tidak ada customer ditemukan</div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button onClick={()=> setShowCustomerModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-pill font-medium">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Produk */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">{refInvoice ? 'Pilih Barang dari Invoice' : 'Cari Barang'}</h3>
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
                    {modalProducts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                          {productSearch ? 'Barang tidak ditemukan' : 'Ketik untuk mencari barang'}
                        </td>
                      </tr>
                    ) : (
                      modalProducts.map((p:any) => (
                        <tr key={`${p.id}-${p.code||p.name}`} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-slate-600">{p.code || '-'}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                          <td className="px-3 py-2 text-slate-600">{(p as any).kategoriName || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{(p as any).spesifikasiName || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={()=> { handleSelectProduct(p); setShowProductModal(false) }}
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
              <div className="text-xs text-slate-600">
                Ditemukan: <span className="font-semibold">{modalProducts.length}</span> barang
              </div>
              <button onClick={()=> { setShowProductModal(false); setProductSearch('') }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-pill font-medium">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal konfirmasi cetak */}
      {printPrompt.id && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Cetak Retur?</h2>
            <p className="text-sm text-slate-600 mb-4">
              Retur <span className="font-mono font-semibold">{printPrompt.number}</span> berhasil disimpan.
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
