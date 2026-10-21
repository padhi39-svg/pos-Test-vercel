"use client"
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'

type CartItem = {
  id: number
  code: string
  name: string
  unitName: string
  unitRatio: number
  price: number
  quantity: number
  discountPercent: number
  discountAmount: number
  total: number
}

type Customer = {
  id: number
  code: string
  name: string
  discountPercent: number
}

export default function POSRetailPage() {
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileTab, setMobileTab] = useState<'products'|'cart'|'pay'>('products')
  const [showCartSheet, setShowCartSheet] = useState(false)
  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash')
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [paymentAmountDisplay, setPaymentAmountDisplay] = useState<string>('')
  const [cardNumber, setCardNumber] = useState<string>('')
  const [selectedBank, setSelectedBank] = useState<any>(null)
  const [banks, setBanks] = useState<any[]>([])
  const [ppnPercent, setPpnPercent] = useState<number>(10)
  const [includeTax, setIncludeTax] = useState<boolean>(true)
  
  // Unit selection modal
  const [showUnitModal, setShowUnitModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [productUnits, setProductUnits] = useState<any[]>([])
  const [selectedUnit, setSelectedUnit] = useState<any>(null)
  const [unitQuantity, setUnitQuantity] = useState(1)
  const [itemDiscountPercent, setItemDiscountPercent] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [barangResponse, customerResponse, banksResponse, settingsResponse] = await Promise.all([
        fetch('/api/barang'),
        fetch('/api/customer'),
        fetch('/api/banks'),
        fetch('/api/settings?group=penjualan'),
      ])
      
      if (!barangResponse.ok || !customerResponse.ok || !banksResponse.ok || !settingsResponse.ok) {
        throw new Error('Failed to load data')
      }
      
      const barangData = await barangResponse.json()
      const customerData = await customerResponse.json()
      const banksData = await banksResponse.json()
      const settingsRows = await settingsResponse.json()
      
      // Filter retail products (jenis=2)
      const retailProducts = barangData.filter((item: any) => 
        item.jenis === 2 && item.aktif
      )
      
      setProducts(retailProducts)
      setCustomers(customerData)
      setBanks(Array.isArray(banksData) ? banksData : [])
      const settingsMap: Record<string,string> = {}
      ;(settingsRows||[]).forEach((row:any)=> { settingsMap[row.setting_key] = String(row.setting_value ?? '') })
      setPpnPercent(Number(settingsMap['sales_default_ppn_percent'] || 10))
      setIncludeTax(settingsMap['sales_include_tax'] === '1')
      
      // Set default customer
      const defaultCustomer = customerData.find((c: Customer) => c.id === 1)
      if (defaultCustomer) {
        setSelectedCustomer(defaultCustomer)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openUnitModal = async (product: any) => {
    try {
      // Use units and prices from product data (already loaded)
      const units = product.units || []
      const prices = product.prices || []
      
      // Build units with prices
      const unitsWithPrices = units.map((unit: any) => {
        // Find price for this specific unit by unit_id
        const unitPrice = prices.find((p: any) => p.unit_id === unit.id)
        
        return {
          unitId: unit.id,
          unitName: unit.name,
          ratio: unit.ratio,
          isSmallest: unit.ratio === 1,
          price: unitPrice?.price || product.hpp || 0,
          effectiveDate: unitPrice?.effectiveDate || null
        }
      })
      
      // If no units, create default unit
      if (unitsWithPrices.length === 0) {
        unitsWithPrices.push({
          unitId: 0,
          unitName: 'PCS',
          ratio: 1,
          isSmallest: true,
          price: product.hpp || 0,
          effectiveDate: null
        })
      }
      
      setSelectedProduct(product)
      setProductUnits(unitsWithPrices)
      setSelectedUnit(unitsWithPrices[0] || null)
      setUnitQuantity(1)
      setItemDiscountPercent(0)
      setShowUnitModal(true)
    } catch (error) {
      console.error('Error opening unit modal:', error)
      alert('Gagal membuka form pemesanan')
    }
  }

  const addToCartWithUnit = () => {
    if (!selectedProduct || !selectedUnit) return
    
    const price = selectedUnit.price || 0
    const qty = unitQuantity
    const discPercent = itemDiscountPercent
    const subtotal = price * qty
    const discAmount = subtotal * (discPercent / 100)
    const total = subtotal - discAmount
    
    setCart(prev => {
      const existing = prev.find(item => 
        item.id === selectedProduct.id && item.unitName === selectedUnit.unitName
      )
      
      if (existing) {
        return prev.map(item => {
          if (item.id === selectedProduct.id && item.unitName === selectedUnit.unitName) {
            const newQty = item.quantity + qty
            const newSubtotal = item.price * newQty
            const newDiscAmount = newSubtotal * (item.discountPercent / 100)
            const newTotal = newSubtotal - newDiscAmount
            return { 
              ...item, 
              quantity: newQty, 
              discountAmount: newDiscAmount,
              total: newTotal 
            }
          }
          return item
        })
      }
      
      return [...prev, {
        id: selectedProduct.id,
        code: selectedProduct.code,
        name: selectedProduct.name,
        unitName: selectedUnit.unitName,
        unitRatio: selectedUnit.ratio,
        price: price,
        quantity: qty,
        discountPercent: discPercent,
        discountAmount: discAmount,
        total: total
      }]
    })
    
    setShowUnitModal(false)
    setSelectedProduct(null)
    setProductUnits([])
  }

  const updateQuantity = (id: number, unitName: string, newQty: number) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(item => !(item.id === id && item.unitName === unitName)))
    } else {
      setCart(prev => prev.map(item => {
        if (item.id === id && item.unitName === unitName) {
          const newSubtotal = item.price * newQty
          const newDiscAmount = newSubtotal * (item.discountPercent / 100)
          const newTotal = newSubtotal - newDiscAmount
          return { 
            ...item, 
            quantity: newQty,
            discountAmount: newDiscAmount,
            total: newTotal
          }
        }
        return item
      }))
    }
  }

  const updateUnit = (id: number, oldUnitName: string, newUnitName: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === id && item.unitName === oldUnitName) {
        // Find product to get new unit price
        const product = products.find(p => p.id === id)
        if (product) {
          const newUnit = product.units?.find((u: any) => u.name === newUnitName)
          if (newUnit) {
            // Find price for new unit
            const unitPrice = product.prices?.find((p: any) => p.unit_id === newUnit.id)
            const newPrice = unitPrice?.price || product.hpp || 0
            
            // Recalculate with new price
            const newSubtotal = item.quantity * newPrice
            const newDiscAmount = newSubtotal * (item.discountPercent / 100)
            const newTotal = newSubtotal - newDiscAmount
            
            return {
              ...item,
              unitName: newUnitName,
              unitRatio: newUnit.ratio,
              price: newPrice,
              discountAmount: newDiscAmount,
              total: newTotal
            }
          }
        }
      }
      return item
    }))
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const totalDiscount = cart.reduce((sum, item) => sum + item.discountAmount, 0)
  const dppAfterDisc = Math.max(0, subtotal - totalDiscount)
  const r = Math.max(0, ppnPercent) / 100
  const total = includeTax ? Math.round(dppAfterDisc * (1 + r)) : (dppAfterDisc + Math.round(dppAfterDisc * r))

  const openPayment = () => {
    if (cart.length === 0) return
    setPaymentMethod('cash')
    setSelectedBank(null)
    setCardNumber('')
    setPaymentAmount(total)
    setPaymentAmountDisplay(String(total))
    setShowPaymentModal(true)
  }

  const confirmPayment = async () => {
    try {
      if (cart.length === 0) return
      const items = cart.map(it => {
        const qty = Math.max(1, Number(it.quantity) || 1)
        const unitPriceEx = Number(it.price) || 0 // treat as ex-tax
        const discTotal = Number(it.discountAmount) || 0
        const lineNetEx = Math.max(0, unitPriceEx * qty - discTotal)
        const taxAmt = Math.round(lineNetEx * r)
        const lineTotal = lineNetEx + taxAmt
        return {
          barangId: it.id,
          quantity: qty,
          unitPrice: unitPriceEx,
          discon_total: discTotal,
          totalPrice: includeTax ? (lineTotal) : (lineTotal),
          unitName: it.unitName || 'PCS',
          unitRatio: it.unitRatio || 1,
        }
      })

      const payments = [{
        method: paymentMethod,
        amount: Number(paymentAmount) || total,
        bankId: selectedBank ? Number(selectedBank.id || selectedBank.bank_id) : null,
        cardNumber: cardNumber || null,
        notes: 'POS Retail',
      }]

      const payload = {
        transactionType: 2,
        customerId: selectedCustomer?.id || 1,
        items,
        subtotal: dppAfterDisc,
        discountPercent: 0,
        discountAmount: totalDiscount,
        ppnPercent,
        ppnAmount: Math.round(dppAfterDisc * r),
        total,
        includeTax,
        price_include_tax: includeTax ? 1 : 0,
        payments,
      }

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data?.error || 'Gagal membuat transaksi')
        return
      }
      // Success
      setCart([])
      setShowPaymentModal(false)
      setMobileTab('products')
      alert('Transaksi berhasil dibuat')
    } catch (e) {
      console.error('Checkout error:', e)
      alert('Gagal proses pembayaran')
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
          <p className="text-slate-600">Memuat data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex flex-col lg:flex-row overflow-hidden -m-2 sm:-m-3 md:-m-4 relative">
      {/* Left Panel - Products */}
      <div className="flex-1 p-3 sm:p-4 pb-24 lg:pb-4 min-w-0">
        <div className="bg-white rounded-xl shadow-md h-full flex flex-col">
          <div className="p-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl">
            <h2 className="text-xl font-bold text-white">🛒 POS Retail</h2>
          </div>
          {/* Mobile Top Tabs */}
          <div className="lg:hidden px-4 pt-3 border-b bg-white">
            <div className="flex items-center gap-2">
              <button
                onClick={()=>setMobileTab('products')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mobileTab==='products'?'bg-indigo-50 border-indigo-300 text-indigo-700':'bg-white border-slate-300 text-slate-700'}`}
              >Produk</button>
              <button
                onClick={()=>setMobileTab('cart')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mobileTab==='cart'?'bg-emerald-50 border-emerald-300 text-emerald-700':'bg-white border-slate-300 text-slate-700'}`}
              >Keranjang ({cart.length})</button>
              <button
                onClick={()=>setMobileTab('pay')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mobileTab==='pay'?'bg-amber-50 border-amber-300 text-amber-700':'bg-white border-slate-300 text-slate-700'}`}
              >Bayar</button>
            </div>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto">
            {mobileTab === 'products' && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map(product => (
                  <div
                    key={product.id}
                    onClick={() => openUnitModal(product)}
                    className="bg-white border-2 border-slate-200 rounded-lg p-3 cursor-pointer hover:shadow-lg hover:border-indigo-400 transition-all"
                  >
                    <div className="h-24 bg-slate-100 rounded-md mb-2 flex items-center justify-center">
                      <span className="text-4xl">📦</span>
                    </div>
                    <h3 className="font-semibold text-sm text-slate-800 truncate">{product.name}</h3>
                    <p className="text-xs text-slate-500">{product.code}</p>
                  </div>
                ))}
              </div>
            )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="p-5 border-b bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-2xl">
              <h3 className="text-lg font-bold text-white">Pembayaran</h3>
              <p className="text-sm text-emerald-100">Pilih metode dan konfirmasi</p>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal (DPP)</span>
                  <span className="font-semibold">{formatCurrency(dppAfterDisc)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">PPN {ppnPercent}%</span>
                  <span className="font-semibold">{formatCurrency(Math.round(dppAfterDisc * r))}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span className="text-indigo-600">{formatCurrency(total)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Metode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash','transfer','card'] as const).map(m => (
                    <button
                      key={m}
                      onClick={()=> setPaymentMethod(m)}
                      className={`p-3 rounded-lg border-2 text-sm font-semibold ${paymentMethod===m?'border-emerald-600 bg-emerald-50':'border-slate-200 hover:border-emerald-300'}`}
                    >{m==='cash'?'Cash':m==='transfer'?'Transfer':'Kartu'}</button>
                  ))}
                </div>
              </div>

              {(paymentMethod==='transfer' || paymentMethod==='card') && (
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Bank</label>
                    <select
                      value={selectedBank?.id || ''}
                      onChange={(e)=>{
                        const b = banks.find((x:any)=> String(x.id||x.bank_id)===e.target.value)
                        setSelectedBank(b||null)
                      }}
                      className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
                    >
                      <option value="">Pilih bank</option>
                      {banks.map((b:any)=> (
                        <option key={String(b.id||b.bank_id)} value={String(b.id||b.bank_id)}>{b.bank_name || b.name}</option>
                      ))}
                    </select>
                  </div>

                  {paymentMethod==='card' && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">No Kartu</label>
                      <input
                        value={cardNumber}
                        onChange={(e)=> setCardNumber(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
                        placeholder="1234 5678 9012 3456"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nominal Bayar</label>
                <input
                  type="number"
                  min="0"
                  value={paymentAmountDisplay}
                  onChange={(e)=>{
                    setPaymentAmountDisplay(e.target.value)
                    const n = Number(e.target.value) || 0
                    setPaymentAmount(n)
                  }}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
                />
                {paymentMethod==='cash' && (
                  <p className="text-sm text-slate-500 mt-1">Kembali: <span className="font-semibold">{formatCurrency(Math.max(0, (Number(paymentAmount)||0) - total))}</span></p>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t bg-slate-50 rounded-b-2xl flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border-2 border-slate-300 font-semibold hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                onClick={confirmPayment}
                className="flex-[2] px-4 py-2 rounded-lg font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
              >
                Konfirmasi & Bayar
              </button>
            </div>
          </div>
        </div>
      )}

            {mobileTab === 'cart' && (
              <div className="space-y-3 lg:hidden">
                {cart.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <div className="text-4xl mb-2">🛒</div>
                      <p className="text-sm">Keranjang kosong</p>
                    </div>
                  </div>
                ) : (
                  cart.map((item, index) => (
                    <div key={`${item.id}-${item.unitName}-tab-${index}`} className="border border-slate-200 rounded-lg p-3">
                      <h4 className="font-semibold text-sm text-slate-800">{item.name}</h4>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(item.price)}/{item.unitName} × {item.quantity} {item.unitName}
                      </p>
                      {item.discountPercent > 0 && (
                        <p className="text-xs text-orange-600">Disc {item.discountPercent}%: -{formatCurrency(item.discountAmount)}</p>
                      )}
                      <p className="text-sm font-bold text-indigo-600 mt-1">{formatCurrency(item.total)}</p>

                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.unitName, item.quantity - 1)}
                          className="w-7 h-7 rounded bg-red-100 hover:bg-red-200 text-red-600 font-bold"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.unitName, item.quantity + 1)}
                          className="w-7 h-7 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-600 font-bold"
                        >
                          +
                        </button>
                        <button
                          onClick={() => updateQuantity(item.id, item.unitName, 0)}
                          className="ml-auto text-red-500 hover:text-red-700 text-sm"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {mobileTab === 'pay' && (
              <div className="lg:hidden">
                <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-semibold">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Diskon</span>
                    <span>-{formatCurrency(totalDiscount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total</span>
                    <span className="text-indigo-600">{formatCurrency(total)}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    onClick={openPayment}
                    disabled={cart.length === 0}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
                  >
                    Checkout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Cart (Desktop / Large Screen) */}
      <div className="hidden lg:block w-full lg:w-96 p-3 sm:p-4 flex-shrink-0 lg:flex-shrink-0">
        <div className="bg-white rounded-xl shadow-md h-full flex flex-col">
          <div className="p-4 border-b bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-xl">
            <h2 className="text-lg font-bold text-white">Keranjang</h2>
            <p className="text-sm text-emerald-100">{cart.length} item</p>
          </div>

          {/* Cart Items */}
          <div className="flex-1 p-4 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="text-4xl mb-2">🛒</div>
                  <p className="text-sm">Keranjang kosong</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, index) => (
                  <div key={`${item.id}-${item.unitName}-${index}`} className="border border-slate-200 rounded-lg p-3">
                    <h4 className="font-semibold text-sm text-slate-800">{item.name}</h4>
                    <p className="text-xs text-slate-500">
                      {formatCurrency(item.price)}/{item.unitName} × {item.quantity} {item.unitName}
                    </p>
                    {item.discountPercent > 0 && (
                      <p className="text-xs text-orange-600">Disc {item.discountPercent}%: -{formatCurrency(item.discountAmount)}</p>
                    )}
                    <p className="text-sm font-bold text-indigo-600 mt-1">{formatCurrency(item.total)}</p>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <button 
                        onClick={() => updateQuantity(item.id, item.unitName, item.quantity - 1)}
                        className="w-7 h-7 rounded bg-red-100 hover:bg-red-200 text-red-600 font-bold"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.unitName, item.quantity + 1)}
                        className="w-7 h-7 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-600 font-bold"
                      >
                        +
                      </button>
                      <button 
                        onClick={() => updateQuantity(item.id, item.unitName, 0)}
                        className="ml-auto text-red-500 hover:text-red-700 text-sm"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary (Desktop) */}
          <div className="p-4 border-t bg-slate-50">
            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-orange-600">
                <span>Diskon</span>
                <span>-{formatCurrency(totalDiscount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total</span>
                <span className="text-indigo-600">{formatCurrency(total)}</span>
              </div>
            </div>
            <button
              onClick={openPayment}
              disabled={cart.length === 0}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Bar & Bottom Sheet disabled in tabbed design */}
      {false && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-20" />
      )}

      {false && showCartSheet && (
        <div />
      )}

      {/* Unit Selection Modal */}
      {showUnitModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="p-5 border-b bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl">
              <h3 className="text-lg font-bold text-white">{selectedProduct.name}</h3>
              <p className="text-sm text-indigo-100">Pilih satuan dan jumlah</p>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Unit Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Satuan</label>
                <div className="grid grid-cols-2 gap-2">
                  {productUnits.map(unit => (
                    <button
                      key={unit.unitId}
                      onClick={() => setSelectedUnit(unit)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedUnit?.unitId === unit.unitId
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="text-sm font-bold">{unit.unitName}</div>
                      <div className="text-xs text-slate-600">{formatCurrency(unit.price)}</div>
                      {!unit.isSmallest && (
                        <div className="text-[10px] text-slate-500">1 = {unit.ratio} PCS</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Jumlah</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setUnitQuantity(Math.max(1, unitQuantity - 1))}
                    className="w-10 h-10 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 font-bold"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={unitQuantity}
                    onChange={(e) => setUnitQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 text-center text-lg font-bold border-2 border-slate-300 rounded-lg py-2"
                  />
                  <button
                    onClick={() => setUnitQuantity(unitQuantity + 1)}
                    className="w-10 h-10 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-600 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Discount */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Diskon (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={itemDiscountPercent}
                  onChange={(e) => setItemDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
                />
              </div>

              {/* Summary */}
              {selectedUnit && (
                <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span className="font-semibold">{formatCurrency(selectedUnit.price * unitQuantity)}</span>
                  </div>
                  {itemDiscountPercent > 0 && (
                    <div className="flex justify-between text-sm text-orange-600">
                      <span>Diskon {itemDiscountPercent}%</span>
                      <span>-{formatCurrency((selectedUnit.price * unitQuantity) * (itemDiscountPercent / 100))}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total</span>
                    <span className="text-indigo-600">
                      {formatCurrency((selectedUnit.price * unitQuantity) * (1 - itemDiscountPercent / 100))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t bg-slate-50 rounded-b-2xl flex gap-3">
              <button
                onClick={() => setShowUnitModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border-2 border-slate-300 font-semibold hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                onClick={addToCartWithUnit}
                disabled={!selectedUnit}
                className="flex-[2] px-4 py-2 rounded-lg font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
              >
                Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
