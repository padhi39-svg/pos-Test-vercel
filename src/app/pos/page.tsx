"use client"
import { useState, useEffect, useRef } from 'react'
import PosRestoPageInner from '@/app/pos/resto/PosRestoPageInner'
import { getAllBarang } from '@/lib/barangStoreDB'
import { getAllCustomers } from '@/lib/customerStoreDB'
import { createTransaction } from '@/lib/transactionStoreDB'
import { formatCurrency } from '@/lib/regionalNumber'
import { LiveClock } from '@/components/LiveClock'
import { getTodayDate } from '@/lib/date-utils'

type CartItem = {
  id: number
  code: string
  name: string
  price: number
  quantity: number
  total: number
  kategoriId?: number | null
  modifier?: string | null
}

type Customer = {
  id: number
  code: string
  name: string
  discountPercent: number
}

type POSPageProps = {
  restoTableLabel?: string
}

export default function POSPage({ restoTableLabel }: POSPageProps) {
  // Gunakan implementasi yang sama persis dengan POS Resto Table
  return <PosRestoPageInner restoTableLabel={restoTableLabel} />

  // -- Kode lama di bawah ini tidak akan dieksekusi --
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchProduct, setSearchProduct] = useState('')
  const [searchCustomer, setSearchCustomer] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [discountPercent, setDiscountPercent] = useState<number>(0)
  const [ppnPercent, setPpnPercent] = useState<number>(10)
  const [includeTax, setIncludeTax] = useState<boolean>(false)
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false)
  const [newCustomerCode, setNewCustomerCode] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash')
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [paymentAmountDisplay, setPaymentAmountDisplay] = useState<string>('')
  const [discountPercentInput, setDiscountPercentInput] = useState<string>('')
  const [discountAmountInput, setDiscountAmountInput] = useState<string>('')
  const [cardNumber, setCardNumber] = useState<string>('')
  const [cardType, setCardType] = useState<'debit' | 'credit' | ''>('')
  const [selectedBank, setSelectedBank] = useState<any>(null)
  const [banks, setBanks] = useState<any[]>([])
  const [qzStatus, setQzStatus] = useState<{version: string|null, error: string|null}>({ version: null, error: null })
  // Meja (untuk POS Resto)
  const [tables, setTables] = useState<any[]>([])
  const [selectedTable, setSelectedTable] = useState<any|null>(null)
  const [showTableDropdown, setShowTableDropdown] = useState(false)
  const [tableSearch, setTableSearch] = useState('')
  const tableDropdownRef = useRef<HTMLDivElement|null>(null)
  const posRef = useRef<HTMLDivElement>(null)
  // Modal produk (qty + modifier)
  const [showProductModal, setShowProductModal] = useState(false)
  const [selectedProduct, setSelectedProductState] = useState<any|null>(null)
  const [productQty, setProductQty] = useState<number>(1)
  const [productModifier, setProductModifier] = useState<string>('')
  // Nama di pembayaran (Nm_cust)
  const [paymentName, setPaymentName] = useState<string>('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTableDropdown(false)
      }
    }
    if (showTableDropdown) {
      document.addEventListener('keydown', onKey)
    }
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [showTableDropdown])

  // Click-away untuk menutup dropdown meja saat klik di luar
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!showTableDropdown) return
      const el = tableDropdownRef.current
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setShowTableDropdown(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [showTableDropdown])

  // Caption Order (per device)
  const [captionCfg, setCaptionCfg] = useState<Record<string,string>>({
    order_caption_enabled: '0',
    order_caption_header: 'ORDER PESANAN',
    order_caption_show_customer: '1',
    order_caption_show_table: '1',
    order_caption_footer: '',
    cap_backend_mode: 'server',
    cap_network_host: '',
    cap_network_port: '9100',
    cap_local_helper_id: '',
    cap_local_usb_name: '',
  })
  // Kitchen/Pantry printer (per device)
  const [kitchenCfg, setKitchenCfg] = useState<Record<string,string>>({
    kitchen_print_mode: 'combined',
    combined_backend_mode: 'server',
    combined_network_host: '',
    combined_network_port: '9100',
    combined_local_helper_id: '',
    combined_local_usb_name: '',
    pantry_backend_mode: 'server',
    pantry_network_host: '',
    pantry_network_port: '9100',
    pantry_local_helper_id: '',
    pantry_local_usb_name: '',
    kitchen_backend_mode: 'server',
    kitchen_network_host: '',
    kitchen_network_port: '9100',
    kitchen_local_helper_id: '',
    kitchen_local_usb_name: '',
  })
  const [deviceId, setDeviceId] = useState<string>('')
  const [isPaying, setIsPaying] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ name: string } | null>(null)
  // Missing states for categories and loading (used below)
  const [categories, setCategories] = useState<any[]>([])
  const [kategoriPrintMap, setKategoriPrintMap] = useState<Record<number, string>>({})
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [loading, setLoading] = useState<boolean>(true)
  // Printer config & company info
  const [printerCfg, setPrinterCfg] = useState<{ deviceName: string; autoPrint: boolean; copies: number; cut: boolean; chars: number; paper: string; backendMode: 'server'|'local_helper'|'local_helper_apk'|'local_helper_offline'|'mobile_rawbt'|'browser_print'; host: string; port: number; localHelperId: string; localHelperIp: string; localUsbName: string }>({
    deviceName: '', autoPrint: false, copies: 1, cut: true, chars: 48, paper: '80mm', backendMode: 'server', host: '', port: 9100, localHelperId: '', localHelperIp: '', localUsbName: ''
  })
  const [companyInfo, setCompanyInfo] = useState<{ name: string; address: string; phone: string }>({ name: '', address: '', phone: '' })
  // Layout nota (global)
  type LayoutCfg = {
    header_title: string
    show_company: '0'|'1'
    show_address: '0'|'1'
    show_phone: '0'|'1'
    show_invoice_code: '0'|'1'
    separator_char: '-'|'='
    thankyou_text: string
    align_header: 'left'|'center'
    columns_style: 'standard'|'compact'
    label_subtotal: string
    label_tax: string
    label_total: string
    label_paid: string
    label_change: string
  }
  const [layoutCfg, setLayoutCfg] = useState<LayoutCfg>({
    header_title: '',
    show_company: '1',
    show_address: '1',
    show_phone: '1',
    show_invoice_code: '1',
    separator_char: '-',
    thankyou_text: 'Terima kasih',
    align_header: 'center',
    columns_style: 'standard',
    label_subtotal: 'Subtotal',
    label_tax: 'PPN',
    label_total: 'TOTAL',
    label_paid: 'Bayar',
    label_change: 'Kembali',
  })
  const catContainerRef = useRef<HTMLDivElement>(null)
  const [catsPerPage, setCatsPerPage] = useState<number>(7)
  const [catPage, setCatPage] = useState<number>(0)
  useEffect(() => {
    const el = catContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      const est = Math.max(3, Math.floor(w / 88))
      setCatsPerPage(est)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const totalCatPages = Math.max(1, Math.ceil(Math.max(0, categories.length - 1) / Math.max(1, catsPerPage)))
  const visibleCategories = (() => {
    // Always include 'Semua' di awal halaman pertama
    const others = categories.filter((c: any) => c.id !== 'all')
    const limit = Math.max(1, catsPerPage)
    const start = catPage * limit
    const pageSlice = others.slice(start, start + limit)
    return catPage === 0 ? [categories.find((c: any)=>c.id==='all'), ...pageSlice].filter(Boolean) : pageSlice
  })()
  // Lock body scroll when payment modal open
  useEffect(() => {
    if (showPaymentModal) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [showPaymentModal])

  // Initialize discount inputs when opening payment modal (parity with POS Resto Table)
  useEffect(() => {
    if (showPaymentModal) {
      const pct = 0 // reset setiap buka modal
      setDiscountPercent(0)
      const pctClamped = Math.max(0, Math.min(100, Number(pct.toFixed(2))))
      setDiscountPercentInput(String(pctClamped))
      const computedDiscAmt = 0
      setDiscountAmountInput(computedDiscAmt > 0 ? Math.round(computedDiscAmt).toLocaleString('id-ID') : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaymentModal])

  // Per-device device_id cookie helper (same as Settings page)
  useEffect(()=>{
    try {
      if (typeof document !== 'undefined') {
        const getCookie = (name: string) => document.cookie.split('; ').find(r=>r.startsWith(name+'='))?.split('=')[1]
        let did = getCookie('device_id')
        if (!did) {
          const uuid = (crypto && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : (Date.now().toString(36)+Math.random().toString(36).slice(2))
          const exp = new Date(); exp.setFullYear(exp.getFullYear()+5)
          document.cookie = `device_id=${uuid}; path=/; expires=${exp.toUTCString()}`
          did = uuid
        }
        setDeviceId(did || '')
      }
    } catch {}
  }, [])

  // Load per-device Caption Order & Kitchen printers
  useEffect(() => {
    if (!deviceId) return
    const loadClientGroup = async (group: string): Promise<Record<string,string>> => {
      try {
        const res = await fetch(`/api/client-settings?device_id=${encodeURIComponent(deviceId)}&group=${encodeURIComponent(group)}`)
        const data = await res.json()
        if (!res.ok) return {}
        const map: Record<string,string> = {}
        ;(data?.settings || []).forEach((row: any) => {
          map[row.setting_key] = String(row.setting_value ?? '')
        })
        return map
      } catch { return {} }
    }
    ;(async()=>{
      const a = await loadClientGroup('order_caption_client')
      if (Object.keys(a).length) setCaptionCfg(v=>({ ...v, ...a }))
      const b = await loadClientGroup('kitchen_client')
      if (Object.keys(b).length) setKitchenCfg(v=>({ ...v, ...b }))
    })()
  }, [deviceId])

  // Load printer settings (per device via client-settings 'printer'), company info, layout & current user
  useEffect(() => {
    const loadPrinterAndCompany = async () => {
      try {
        const [companyRes, layoutRes, meRes] = await Promise.all([
          fetch('/api/settings?group=company', { cache: 'no-store' }),
          fetch('/api/settings?group=printer_layout', { cache: 'no-store' }),
          fetch('/api/me'),
        ])

        // Per-device printer config via client-settings group 'printer'
        if (deviceId) {
          try {
            const res = await fetch(`/api/client-settings?device_id=${encodeURIComponent(deviceId)}&group=printer`)
            const data = await res.json()
            if (res.ok && Array.isArray(data?.settings)) {
              const map: Record<string,string> = {}
              ;(data.settings || []).forEach((row: any) => {
                map[row.setting_key] = String(row.setting_value ?? '')
              })
              const backend = String(map['printer_backend_mode'] || 'server')
              setPrinterCfg(prev => ({
                ...prev,
                autoPrint: map['printer_auto_print'] === '1',
                copies: Math.max(1, parseInt(map['printer_copies'] || '1') || 1),
                cut: map['printer_cut_paper'] !== '0',
                chars: Math.max(24, Math.min(64, parseInt(map['printer_chars_per_line'] || '48') || 48)),
                backendMode:
                  backend === 'local_helper' || backend === 'local_helper_apk' || backend === 'local_helper_offline' || backend === 'mobile_rawbt' || backend === 'browser_print'
                    ? (backend as any)
                    : 'server',
                host: String(map['printer_network_host'] || '').trim(),
                port: Math.max(1, Math.min(65535, parseInt(map['printer_network_port'] || '9100') || 9100)),
                localHelperId: String(map['printer_local_helper_id'] || ''),
                localHelperIp: String(map['printer_local_helper_ip'] || '').trim(),
                localUsbName: String(map['printer_local_usb_name'] || ''),
              }))
            }
          } catch {}
        }
        if (companyRes.ok) {
          const rows = await companyRes.json()
          const map: Record<string,string> = {}
          ;(rows||[]).forEach((r:any)=> map[r.setting_key] = String(r.setting_value ?? ''))
          setCompanyInfo({
            name: map['company_name'] || '',
            address: map['company_address'] || '',
            phone: map['company_phone'] || ''
          })
        }
        if (layoutRes.ok) {
          const data = await layoutRes.json()
          const map: Record<string,string> = {}
          ;(data || []).forEach((row: any) => {
            map[row.setting_key] = String(row.setting_value ?? '')
          })
          setLayoutCfg(prev => ({
            ...prev,
            header_title: map.header_title ?? prev.header_title,
            show_company: (map.show_company as any) ?? prev.show_company,
            show_address: (map.show_address as any) ?? prev.show_address,
            show_phone: (map.show_phone as any) ?? prev.show_phone,
            show_invoice_code: (map.show_invoice_code as any) ?? prev.show_invoice_code,
            separator_char: (map.separator_char as any) || prev.separator_char,
            thankyou_text: map.thankyou_text ?? prev.thankyou_text,
            align_header: (map.align_header as any) || prev.align_header,
            columns_style: (map.columns_style as any) || prev.columns_style,
            label_subtotal: map.label_subtotal ?? prev.label_subtotal,
            label_tax: map.label_tax ?? prev.label_tax,
            label_total: map.label_total ?? prev.label_total,
            label_paid: map.label_paid ?? prev.label_paid,
            label_change: map.label_change ?? prev.label_change,
          }))
        }
        // Load current user (kasir)
        try {
          const meRes = await fetch('/api/me')
          if (meRes.ok) {
            const me = await meRes.json()
            if (me && typeof me === 'object') {
              setCurrentUser({ name: String(me.name || me.username || me.email || 'User') })
            }
          }
        } catch {}
      } catch (e) {
        console.warn('Gagal memuat setting printer/company', e)
      }
    }
    loadPrinterAndCompany()
  }, [deviceId])

  // Helpers referenced in JSX
  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }
  const clearCart = () => setCart([])
  const selectCustomer = (customer: Customer | null) => {
    setSelectedCustomer(customer)
    setDiscountPercent(customer?.discountPercent || 0)
    setShowCustomerModal(false)
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        // Use SQLite API endpoints
        const [barangResponse, customerResponse, kategoriResponse, banksResponse, settingsResponse, mejaResponse] = await Promise.all([
          fetch('/api/barang'),
          fetch('/api/customer'),
          fetch('/api/kategori'),
          fetch('/api/banks'),
          fetch('/api/settings?group=penjualan'),
          fetch('/api/meja?active=1')
        ])
        
        if (!barangResponse.ok || !customerResponse.ok || !kategoriResponse.ok || !banksResponse.ok || !settingsResponse.ok || !mejaResponse.ok) {
          throw new Error('Failed to load data')
        }
        
        const barangData = await barangResponse.json()
        const customerData = await customerResponse.json()
        const kategoriData = await kategoriResponse.json()
        const banksData = await banksResponse.json()
        const settingsRows = await settingsResponse.json()
        const mejaData = await mejaResponse.json()
        
        // Filter to show only menu items (jenis=1, aktif=true, tampilMenu=true)
        const menuItems = barangData.filter((item: any) => 
          item.jenis === 1 && item.aktif && item.tampilMenu
        )
        
        // Set categories from kategori data
        const categoriesFromAPI = [
          { id: 'all', name: 'Semua', print_target: null },
          ...kategoriData.map((kat: any) => ({
            id: kat.id.toString(),
            name: kat.name,
            print_target: kat.print_target || null,
          }))
        ]
        
        setProducts(menuItems)
        setCustomers(customerData)
        setCategories(categoriesFromAPI)
        const printMap: Record<number, string> = {}
        ;(kategoriData || []).forEach((kat: any) => {
          if (kat && kat.id != null) {
            printMap[Number(kat.id)] = kat.print_target || ''
          }
        })
        setKategoriPrintMap(printMap)
        setBanks(banksData)
        setTables(Array.isArray(mejaData) ? mejaData : [])
        // settings
        const settingsMap: Record<string,string> = {}
        ;(settingsRows||[]).forEach((row:any)=> { settingsMap[row.setting_key] = String(row.setting_value ?? '') })
        setPpnPercent(Number(settingsMap['sales_default_ppn_percent'] || 10))
        setIncludeTax(settingsMap['sales_include_tax'] === '1')
        
        // Set default customer (ID 1)
        const defaultCustomer = customerData.find((c: Customer) => c.id === 1)
        if (defaultCustomer) {
          setSelectedCustomer(defaultCustomer)
          setDiscountPercent(defaultCustomer.discountPercent || 0)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

  const filteredProducts = products.filter(product => {
    const matchSearch = !searchProduct || 
      product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
      product.code.toLowerCase().includes(searchProduct.toLowerCase())
    
    const matchCategory = activeCategory === 'all' || product.kategoriId === Number(activeCategory) || product.kategori_id === Number(activeCategory)
    
    return matchSearch && matchCategory
  })

  const rawSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const discountAmount = rawSubtotal * (discountPercent / 100)
  const r = Math.max(0, ppnPercent) / 100
  let subtotal = 0, ppnAmount = 0, total = 0
  if (includeTax) {
    // harga sudah termasuk PPN pada price unit
    const afterDisc = Math.max(0, rawSubtotal - discountAmount)
    const dpp = Math.round(afterDisc / (1 + r))
    const ppn = afterDisc - dpp
    subtotal = dpp
    ppnAmount = ppn
    total = afterDisc
  } else {
    const dpp = Math.max(0, rawSubtotal - discountAmount)
    const ppn = Math.round(dpp * r)
    subtotal = dpp
    ppnAmount = ppn
    total = dpp + ppn
  }

  // Ambil harga sesuai yang tampil di menu/master
  const getUnitPrice = (product: any): number => {
    const prices = Array.isArray(product?.prices) ? product.prices : []
    const today = new Date().toISOString().slice(0, 10)
    const rows = prices.map((r: any) => ({
      price: Number(r?.price) || 0,
      eff: String(r?.effectiveDate || r?.effective_date || '0000-00-00'),
    }))
    const past = rows.filter((r: any) => r.price > 0 && r.eff <= today)
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
    const p2 = Number(product?.price || NaN)
    if (!isNaN(p2) && p2 > 0) return p2
    const p3 = Number(product?.hpp || NaN)
    if (!isNaN(p3) && p3 > 0) return p3
    return 0
  }

  const addToCart = (product: any, qty: number = 1, modifier?: string | null) => {
    const unitPrice = getUnitPrice(product)
    const safeQty = Math.max(1, Math.floor(qty || 1))
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        const newQty = existing.quantity + safeQty
        return prev.map(item => item.id === product.id 
          ? { 
              ...item, 
              quantity: newQty, 
              total: newQty * item.price,
              modifier: modifier != null ? modifier : item.modifier ?? null,
            }
          : item)
      }
      return [...prev, {
        id: product.id,
        code: product.code,
        name: product.name,
        price: unitPrice,
        quantity: safeQty,
        total: unitPrice * safeQty,
        kategoriId: product.kategoriId ?? product.kategori_id ?? null,
        modifier: modifier ?? null,
      }]
    })
  }

  const openProductModal = (product: any) => {
    setSelectedProductState(product)
    setProductQty(1)
    setProductModifier('')
    setShowProductModal(true)
  }

  const confirmAddProduct = () => {
    if (!selectedProduct) return
    addToCart(selectedProduct, productQty, productModifier.trim() || null)
    setShowProductModal(false)
  }

  const updateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id))
      return
    }
    setCart(prev => prev.map(item => item.id === id 
      ? { ...item, quantity, total: quantity * item.price }
      : item))
  }

  // Util untuk format teks struk thermal
  const padRight = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length))
  const padLeft = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s)
  const wrap = (text: string, width: number) => {
    const words = String(text || '').split(/\s+/)
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const cand = line ? line + ' ' + w : w
      if (cand.length <= width) line = cand
      else { if (line) lines.push(line); line = w }
    }
    if (line) lines.push(line)
    return lines
  }

  // Format rupiah khusus untuk STRUK (hindari non-breaking space dari style 'currency')
  const formatReceiptCurrency = (value: number): string => {
    if (isNaN(value) || value === null || value === undefined) return 'Rp 0'
    // toLocaleString tanpa style 'currency' menggunakan spasi biasa yang aman untuk ESC/POS
    const num = value.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    return `Rp ${num}`
  }

  const buildReceipt = (
    trxNo: string,
    items: CartItem[],
    totals: { subtotal: number; ppn: number; total: number; disc: number; paid: number; change: number },
    paymentMethod: 'cash' | 'transfer' | 'card',
    cashierName: string,
    tableDisplay?: string | null,
    freshLayout?: Record<string,string>
  ) => {
    const W = printerCfg.chars
    const L: string[] = []
    // Layout dari konfigurasi global (printer_layout) — prioritaskan freshLayout jika ada
    let layout: any = freshLayout && Object.keys(freshLayout).length ? freshLayout : { ...layoutCfg }
    const sep = String(layout.separator_char || '-').repeat(W)
    const centerLine = (line: string) => {
      if (layout.align_header !== 'center') return line
      const pad = Math.max(0, Math.floor((W - line.length)/2))
      return ' '.repeat(pad) + line
    }
    const pushWrapped = (text: string) => {
      const lines = wrap(text, W)
      for (const ln of lines) {
        L.push(centerLine(ln))
      }
    }
    // ESC/POS inline formatting helpers
    const escBoldOn = "\x1bE\x01"
    const escBoldOff = "\x1bE\x00"
    const escSize = (s: string) => {
      const v = parseInt(s) || 0
      const h = v === 1 || v === 3 ? 1 : 0
      const w = v === 2 || v === 3 ? 1 : 0
      return "\x1d\x21" + String.fromCharCode(((h & 0x07) << 4) | (w & 0x07))
    }
    const escSizeNormal = "\x1d\x21\x00"
    const escCondOn = "\x0f"
    const escCondOff = "\x12"
    const now = new Date().toLocaleString()
    // Header font: bold + size
    const hdrBold = layout.header_font_bold === "1"
    const hdrScale = String(layout.header_font_scale || "0")
    if (hdrBold) L.push(escBoldOn)
    if (hdrScale !== "0") L.push(escSize(hdrScale))
    // Company block (optional)
    if (layout.show_company === '1' && companyInfo.name) pushWrapped(companyInfo.name.toUpperCase())
    if (layout.show_address === '1' && companyInfo.address) pushWrapped(companyInfo.address)
    if (layout.show_phone === '1' && companyInfo.phone) pushWrapped('Tel: ' + companyInfo.phone)
    L.push(sep)
    const headerTitle = String(layout.header_title || 'NOTA PENJUALAN')
    pushWrapped(headerTitle.toUpperCase())
    if (layout.show_invoice_code === '1') pushWrapped('No: ' + (trxNo || '-'))
    pushWrapped(now)
    // Reset header font
    if (hdrBold) L.push(escBoldOff)
    if (hdrScale !== "0") L.push(escSizeNormal)
    L.push(sep)
    // Item condensed mode
    const itemCond = layout.item_font_condensed === "1"
    if (itemCond) L.push(escCondOn)
    for (const it of items) {
      const nameLines = wrap(it.name, W)
      if (nameLines.length) L.push(nameLines[0])
      const qtyPrice = `${it.quantity} x ${formatReceiptCurrency(it.price)}`
      const totStr = formatReceiptCurrency(it.total)
      const left = Math.max(0, W - qtyPrice.length - totStr.length)
      L.push(qtyPrice + ' '.repeat(left) + totStr)
      for (let i = 1; i < nameLines.length; i++) L.push(nameLines[i])
    }
    if (itemCond) L.push(escCondOff)
    L.push(sep)
    // Info metode pembayaran (kasir akan ditampilkan di footer bawah)
    const payLabel = paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'transfer' ? 'Transfer' : 'Kartu'
    L.push(padRight('Metode', W - 12) + padLeft(payLabel, 12))
    // Totals (labels bisa dikonfigurasi dari Layout Nota)
    const lblSubtotal = layout.label_subtotal || 'Subtotal'
    const lblTax = layout.label_tax || 'PPN'
    const lblTotal = layout.label_total || 'TOTAL'
    const lblPaid = layout.label_paid || 'Bayar'
    const lblChange = layout.label_change || 'Kembali'
    L.push(padRight(lblSubtotal, W - 12) + padLeft(formatReceiptCurrency(totals.subtotal), 12))
    if (totals.disc > 0) L.push(padRight('Diskon', W - 12) + padLeft('-' + formatReceiptCurrency(totals.disc), 12))
    if (totals.ppn > 0) L.push(padRight(lblTax, W - 12) + padLeft(formatReceiptCurrency(totals.ppn), 12))
    // Total font: bold + size
    const totBold = layout.total_font_bold === "1"
    const totScale = String(layout.total_font_scale || "0")
    if (totBold) L.push(escBoldOn)
    if (totScale !== "0") L.push(escSize(totScale))
    L.push(padRight(lblTotal, W - 12) + padLeft(formatReceiptCurrency(totals.total), 12))
    if (totBold) L.push(escBoldOff)
    if (totScale !== "0") L.push(escSizeNormal)
    L.push(padRight(lblPaid, W - 12) + padLeft(formatReceiptCurrency(totals.paid), 12))
    L.push(padRight(lblChange, W - 12) + padLeft(formatReceiptCurrency(totals.change), 12))
    L.push(sep)
    const rawFooter = String(layout.thankyou_text || 'Terima kasih')
    const footerLines = rawFooter.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    if (footerLines.length === 0) footerLines.push('Terima kasih')
    for (const fl of footerLines) {
      const wrapped = wrap(fl, W)
      for (const ln of wrapped) {
        L.push(centerLine(ln))
      }
    }
    // Tampilkan No. Meja di footer jika ada input meja
    if (tableDisplay) {
      L.push('')
      L.push(centerLine(`Meja: ${tableDisplay}`))
    }
    // Baris kasir di paling bawah footer
    if (cashierName) {
      L.push('')
      L.push(centerLine(`Kasir: ${cashierName}`))
    }
    // Extra feed lines to help dot-matrix printers advance paper further
    for (let i = 0; i < 5; i++) {
      L.push('')
    }
    L.push('\n')
    return L.join('\n')
  }

  // Generic sender for ESC/POS or Local Helper backends
  const sendToPrinterBackend = async (
    backend: 'server' | 'local_helper' | 'local_helper_apk' | 'local_helper_offline',
    opts: { host?: string; port?: number; localHelperId?: string; localUsbName?: string },
    text: string,
    cut: boolean
  ) => {
    if (!text.trim()) return
    if (backend === 'server') {
      const host = (opts.host || printerCfg.host || '').trim()
      const port = opts.port || printerCfg.port || 9100
      if (!host) return
      await fetch('/api/print/escpos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, host, port, cut })
      })
    } else if (backend === 'local_helper') {
      const id = opts.localHelperId || ''
      const h = printerCfg.localHelperIp || '127.0.0.1'
      const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/,'') : `http://${h.trim()}:27128`
      await fetch(`${baseUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, cut, id })
      })
    } else if (backend === 'local_helper_apk') {
      const id = opts.localHelperId || ''
      const h = printerCfg.localHelperIp || '127.0.0.1'
      const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/,'') : `http://${h.trim()}:27128`
      await fetch(`${baseUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, cut, id })
      })
    } else if (backend === 'local_helper_offline') {
      const printerName = opts.localUsbName || ''
      if (!printerName) return
      await fetch('http://127.0.0.1:27128/print/usb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, cut, printerName })
      })
    }
  }

  // Build Caption Order text (ringkas untuk dapur/bar)
  const buildOrderCaption = (
    trxNo: string,
    items: CartItem[],
    customerName: string | null,
    tableDisplay: string | null,
    opts?: { includeHeader?: boolean }
  ): string => {
    if (!captionCfg) return ''
    const W = printerCfg.chars
    const L: string[] = []
    const includeHeader = opts?.includeHeader !== false
    if (includeHeader) {
      const header = String(captionCfg.order_caption_header || 'ORDER PESANAN')
      const centerLine = (line: string) => {
        const pad = Math.max(0, Math.floor((W - line.length)/2))
        return ' '.repeat(pad) + line
      }
      L.push(centerLine(header.toUpperCase()))
    }
    // Info customer & meja tetap ditampilkan di semua printer jika diaktifkan
    if (captionCfg.order_caption_show_table === '1' && tableDisplay) {
      L.push('Meja    : ' + tableDisplay)
    }
    if (captionCfg.order_caption_show_customer === '1' && customerName) {
      L.push('Nama    : ' + customerName)
    }
    // Tidak menampilkan nomor jual di Caption Order
    L.push('-'.repeat(W))
    for (const it of items) {
      const nameLines = wrap(it.name, W)
      const qtyLine = `Qty: ${it.quantity}`
      if (nameLines.length) L.push(nameLines[0])
      L.push(qtyLine)
      if (it.modifier) {
        const modLines = wrap(String(it.modifier), W)
        for (const ml of modLines) {
          L.push('  * ' + ml)
        }
      }
      for (let i = 1; i < nameLines.length; i++) L.push(nameLines[i])
    }
    if (captionCfg.order_caption_footer) {
      L.push('-'.repeat(W))
      L.push(captionCfg.order_caption_footer)
    }
    // Extra feed lines to help dot-matrix printers advance paper further
    for (let i = 0; i < 5; i++) {
      L.push('')
    }
    L.push('\n')
    return L.join('\n')
  }

  // Ambil layout langsung dari server untuk memastikan data terkini
  const fetchLayout = async (): Promise<Record<string,string>> => {
    try {
      const r = await fetch('/api/settings?group=printer_layout', { cache: 'no-store' })
      if (!r.ok) return {}
      const d = await r.json()
      const m: Record<string,string> = {}
      ;(d||[]).forEach((row:any) => { m[row.setting_key] = String(row.setting_value ?? '') })
      return m
    } catch { return {} }
  }

  const tryAutoPrint = async (
    trxNo: string,
    items: CartItem[],
    paid: number,
    change: number,
    tableDisplay?: string | null
  ) => {
    try {
      if (!printerCfg.autoPrint) return
      // Refresh layout dari server agar selalu uptodate
      const freshLayout = await fetchLayout()
      const txt = buildReceipt(trxNo, items, { subtotal, ppn: ppnAmount, total, disc: discountAmount, paid, change }, paymentMethod, currentUser?.name || '', tableDisplay, freshLayout)
      const copies = Math.max(1, printerCfg.copies)
      if (printerCfg.backendMode === 'server') {
        if (!printerCfg.host) return
        for (let i=0;i<copies;i++) {
          await fetch('/api/print/escpos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: txt, host: printerCfg.host, port: printerCfg.port, cut: printerCfg.cut && i===copies-1 }) })
        }
      } else if (printerCfg.backendMode === 'local_helper') {
        const id = printerCfg.localHelperId
        const h = printerCfg.localHelperIp || '127.0.0.1'
        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/,'') : `http://${h.trim()}:27128`
        for (let i=0;i<copies;i++) {
          await fetch(`${baseUrl}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: txt, cut: printerCfg.cut && i===copies-1, id }) })
        }
      } else if (printerCfg.backendMode === 'local_helper_apk') {
        const id = printerCfg.localHelperId
        const h = printerCfg.localHelperIp || '127.0.0.1'
        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/,'') : `http://${h.trim()}:27128`
        for (let i=0;i<copies;i++) {
          await fetch(`${baseUrl}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: txt, cut: printerCfg.cut && i===copies-1, id }) })
        }
      } else if (printerCfg.backendMode === 'local_helper_offline') {
        const printerName = printerCfg.localUsbName
        if (!printerName) return
        for (let i=0;i<copies;i++) {
          await fetch('http://127.0.0.1:27128/print/usb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: txt, cut: printerCfg.cut && i===copies-1, printerName }) })
        }
      } else if (printerCfg.backendMode === 'mobile_rawbt') {
        try {
          const base64 = typeof window !== 'undefined' ? btoa(unescape(encodeURIComponent(txt))) : ''
          window.location.href = 'rawbt:base64,' + base64
        } catch {}
      } else if (printerCfg.backendMode === 'browser_print') {
        const cleanBody = txt.replace(/[\x00-\x1f]/g, "").replace(/\x7f/g, "")
        const w = window.open('', '_blank', 'width=480,height=640')
        if (w) {
          w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap">${cleanBody.replace(/</g,'&lt;')}</pre><script>window.focus();window.print();</script>`)
          w.document.close()
        }
      }
    } catch (e) {
      console.warn('Auto print gagal:', e)
    }
  }

  // Cetak Caption Order ke Caption Printer + Pantry/Kitchen (jika dikonfigurasi)
  const tryPrintCaption = async (
    trxNo: string,
    items: CartItem[],
    customerName: string | null,
    tableDisplay: string | null
  ) => {
    try {
      // 1) Caption Printer (dari grup Caption Order) - gunakan header
      const captionText = buildOrderCaption(trxNo, items, customerName, tableDisplay, { includeHeader: true })
      // 2) Pantry/Kitchen printers (grup kitchen_client) - tanpa header caption
      const baseKitchenText = buildOrderCaption(trxNo, items, customerName, tableDisplay, { includeHeader: false })

      // Caption printer hanya jika diaktifkan dan ada teks
      if (captionCfg && captionCfg.order_caption_enabled === '1') {
        if (!captionText.trim()) return
        const capMode = (captionCfg.cap_backend_mode as 'server'|'local_helper'|'local_helper_apk'|'local_helper_offline'|undefined) || 'server'
        if (capMode === 'server') {
          await sendToPrinterBackend('server', {
            host: captionCfg.cap_network_host,
            port: Number(captionCfg.cap_network_port || '9100') || 9100,
          }, captionText, true)
        } else if (capMode === 'local_helper') {
          await sendToPrinterBackend('local_helper', {
            localHelperId: captionCfg.cap_local_helper_id,
          }, captionText, true)
        } else if (capMode === 'local_helper_apk') {
          await sendToPrinterBackend('local_helper_apk', {
            localHelperId: captionCfg.cap_local_helper_id,
          }, captionText, true)
        } else if (capMode === 'local_helper_offline') {
          await sendToPrinterBackend('local_helper_offline', {
            localUsbName: captionCfg.cap_local_usb_name,
          }, captionText, true)
        }
      }

      // 2) Pantry/Kitchen printers (grup kitchen_client) - selalu mencoba jika backend terisi
      const mode = kitchenCfg.kitchen_print_mode || 'combined'
      if (mode === 'combined') {
        if (!baseKitchenText.trim()) return
        const bMode = (kitchenCfg.combined_backend_mode as 'server'|'local_helper'|'local_helper_apk'|'local_helper_offline'|undefined) || 'server'
        if (bMode === 'server') {
          await sendToPrinterBackend('server', {
            host: kitchenCfg.combined_network_host,
            port: Number(kitchenCfg.combined_network_port || '9100') || 9100,
          }, baseKitchenText, true)
        } else if (bMode === 'local_helper') {
          await sendToPrinterBackend('local_helper', {
            localHelperId: kitchenCfg.combined_local_helper_id,
          }, baseKitchenText, true)
        } else if (bMode === 'local_helper_apk') {
          await sendToPrinterBackend('local_helper_apk', {
            localHelperId: kitchenCfg.combined_local_helper_id,
          }, baseKitchenText, true)
        } else if (bMode === 'local_helper_offline') {
          await sendToPrinterBackend('local_helper_offline', {
            localUsbName: kitchenCfg.combined_local_usb_name,
          }, baseKitchenText, true)
        }
      } else if (mode === 'split') {
        // Pisahkan item berdasarkan kategori.print_target
        const pantryItems = items.filter(it => {
          const kid = it.kategoriId != null ? Number(it.kategoriId) : NaN
          const tgt = !isNaN(kid) ? (kategoriPrintMap[kid] || '') : ''
          return tgt === 'pantry'
        })
        const kitchenItems = items.filter(it => {
          const kid = it.kategoriId != null ? Number(it.kategoriId) : NaN
          const tgt = !isNaN(kid) ? (kategoriPrintMap[kid] || '') : ''
          return tgt === 'kitchen'
        })

        // Pantry: hanya item dengan kategori.print_target='pantry'
        if (pantryItems.length > 0) {
          const pantryText = buildOrderCaption(trxNo, pantryItems, customerName, tableDisplay, { includeHeader: false })
          if (pantryText.trim()) {
            const pantryMode = (kitchenCfg.pantry_backend_mode as 'server'|'local_helper'|'local_helper_apk'|'local_helper_offline'|undefined) || 'server'
            if (pantryMode === 'server') {
              await sendToPrinterBackend('server', {
                host: kitchenCfg.pantry_network_host,
                port: Number(kitchenCfg.pantry_network_port || '9100') || 9100,
              }, pantryText, true)
            } else if (pantryMode === 'local_helper') {
              await sendToPrinterBackend('local_helper', {
                localHelperId: kitchenCfg.pantry_local_helper_id,
              }, pantryText, true)
            } else if (pantryMode === 'local_helper_apk') {
              await sendToPrinterBackend('local_helper_apk', {
                localHelperId: kitchenCfg.pantry_local_helper_id,
              }, pantryText, true)
            } else if (pantryMode === 'local_helper_offline') {
              await sendToPrinterBackend('local_helper_offline', {
                localUsbName: kitchenCfg.pantry_local_usb_name,
              }, pantryText, true)
            }
          }
        }

        // Kitchen: hanya item dengan kategori.print_target='kitchen'
        if (kitchenItems.length > 0) {
          const kitchenText = buildOrderCaption(trxNo, kitchenItems, customerName, tableDisplay, { includeHeader: false })
          if (kitchenText.trim()) {
            const kitchenMode = (kitchenCfg.kitchen_backend_mode as 'server'|'local_helper'|'local_helper_apk'|'local_helper_offline'|undefined) || 'server'
            if (kitchenMode === 'server') {
              await sendToPrinterBackend('server', {
                host: kitchenCfg.kitchen_network_host,
                port: Number(kitchenCfg.kitchen_network_port || '9100') || 9100,
              }, kitchenText, true)
            } else if (kitchenMode === 'local_helper') {
              await sendToPrinterBackend('local_helper', {
                localHelperId: kitchenCfg.kitchen_local_helper_id,
              }, kitchenText, true)
            } else if (kitchenMode === 'local_helper_apk') {
              await sendToPrinterBackend('local_helper_apk', {
                localHelperId: kitchenCfg.kitchen_local_helper_id,
              }, kitchenText, true)
            } else if (kitchenMode === 'local_helper_offline') {
              await sendToPrinterBackend('local_helper_offline', {
                localUsbName: kitchenCfg.kitchen_local_usb_name,
              }, kitchenText, true)
            }
          }
        }
      }
    } catch (e) {
      console.warn('Print Caption Order gagal:', e)
    }
  }

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    setDiscountPercent(customer.discountPercent || 0)
    setShowCustomerModal(false)
    setSearchCustomer('')
  }

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) {
      alert('Nama customer harus diisi')
      return
    }
    
    try {
      const response = await fetch('/api/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: (newCustomerName || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || `CUST${Date.now()}`,
          name: newCustomerName,
          discountPercent: 0
        })
      })
      
      if (response.ok) {
        const newCustomer = await response.json()
        setCustomers(prev => [...prev, newCustomer])
        setSelectedCustomer(newCustomer)
        setDiscountPercent(0)
        setShowCreateCustomerModal(false)
        setNewCustomerName('')
        alert('Customer berhasil ditambahkan!')
      } else {
        alert('Gagal menambahkan customer')
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      alert('Terjadi kesalahan saat menambahkan customer')
    }
  }

  const handlePayment = async () => {
    if (isPaying) return
    
    // Guard 1: Cek canPay
    if (!canPay) {
      console.warn('Payment blocked: canPay is false')
      return
    }

    if (cart.length === 0) {
      alert('Keranjang kosong')
      return
    }

    // Guard 2: Validasi nominal sebelum setIsPaying
    const payAmt = typeof paymentAmount === 'number' ? paymentAmount : (Number(paymentAmount) || 0)
    
    if (paymentMethod === 'cash') {
      if (payAmt <= 0) {
        alert('Nominal pembayaran harus diisi')
        return
      }
      if (payAmt < total) {
        alert(`Nominal pembayaran tidak boleh kurang dari total (${formatCurrency(total)})`)
        return
      }
    }

    const isNonCash = (paymentMethod === 'transfer' || paymentMethod === 'card')
    if (isNonCash) {
      if (!selectedBank) {
        alert('Bank tujuan wajib dipilih')
        return
      }
      if (paymentMethod === 'card' && !cardNumber.trim()) {
        alert('Nomor kartu wajib diisi untuk pembayaran kartu')
        return
      }
      if (paymentMethod === 'card' && !cardType) {
        alert('Silakan pilih tipe kartu: Debit atau Kredit')
        return
      }
    }

    setIsPaying(true)

    try {
      const cartSnapshot = [...cart]
      const effPaymentAmount = isNonCash ? total : payAmt
      const rTax = Math.max(0, ppnPercent) / 100
      const transactionItems = cart.map(item => {
        const rawPrice = Number(item.price) || 0
        const unitPriceEx = includeTax ? Math.round(rawPrice / (1 + rTax)) : rawPrice
        return {
          barangId: item.id,
          quantity: item.quantity,
          unitPrice: unitPriceEx,
          unitPriceIncludeTax: includeTax ? rawPrice : Math.round(rawPrice * (1 + rTax)),
          totalPrice: Number(item.price) * Number(item.quantity),
          modifier: item.modifier ?? null,
        }
      })

      // Map paymentMethod to 'Debit Card' or 'Credit Card' for API
      const paymentMethodForApi = paymentMethod === 'card'
        ? (cardType === 'credit' ? 'Credit Card' : cardType === 'debit' ? 'Debit Card' : 'card')
        : paymentMethod

      // Siapkan payments[] sesuai kontrak backend: satu metode sesuai pilihan saat ini
      const normalizedMethod = paymentMethodForApi
      const payments = [
        {
          method: normalizedMethod,
          amount: effPaymentAmount,
          bankId: isNonCash ? (selectedBank?.id ?? null) : null,
          cardNumber: paymentMethod === 'card' ? cardNumber.trim() : null,
          notes: null as any,
        }
      ]

      const transactionData = {
        transactionDate: getTodayDate(),
        customerId: selectedCustomer?.id ?? null,
        items: transactionItems,
        subtotal, // DPP jika includeTax=true (disajikan sebagai subtotal), atau DPP sebelum PPN jika exclude
        total,
        transactionType: 1,
        includeTax,
        ppnPercent,
        ppnAmount,
        discountPercent,
        discountAmount,
        price_include_tax: includeTax ? 1 : 0,
        // Header payment fields dibiarkan kosong (Opsi A)
        paymentMethod: null,
        paymentAmount: null,
        changeAmount: null,
        cardNumber: null,
        bankId: null,
        payments,
        tableId: selectedTable?.id ?? selectedTable?.table_id ?? null,
        Nm_cust: paymentName.trim() || null,
      }
      
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      })
      
      if (!response.ok) {
        let msg = 'Failed to create transaction'
        try {
          const err = await response.json()
          msg = String(err?.error || err?.details || msg)
        } catch {}
        alert(msg)
        throw new Error(msg)
      }
      
      const result = await response.json()
      const trxNo = String(result?.transactionNumber || '')
      const tableDisplay = selectedTable ? `${selectedTable.code || ''} - ${selectedTable.name || ''}`.trim() : null

      // Reset cart and customer dulu supaya UI terasa cepat
      setCart([])
      setSelectedCustomer(null)
      setShowPaymentModal(false)
      setPaymentAmount(0)
      setPaymentAmountDisplay('')
      setCardNumber('')
      setCardType('')
      setPaymentMethod('cash')
      setSelectedBank(null)
      setSelectedTable(null)
      setShowTableDropdown(false)
      setPaymentName('')
      
      alert(`Pembayaran berhasil! No. Transaksi: ${trxNo}`)

      // Proses cetak dibuat non-blocking (tidak menghambat UI)
      const paidTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      const change = Math.max(0, paidTotal - total)
      tryAutoPrint(
        trxNo,
        cartSnapshot,
        paidTotal,
        change,
        tableDisplay
      ).catch(err => {
        console.warn('Auto print gagal:', err)
      })

      tryPrintCaption(
        trxNo,
        cartSnapshot,
        (paymentName.trim() || selectedCustomer?.name || null),
        tableDisplay
      ).catch(err => {
        console.warn('Print caption gagal:', err)
      })
    } catch (error) {
      console.error('Payment error:', error)
      alert('Terjadi kesalahan saat memproses pembayaran')
    } finally {
      setIsPaying(false)
    }
  }

  // Enable/Disable tombol Bayar sesuai aturan pembayaran
  const isNonCashPay = (paymentMethod === 'transfer' || paymentMethod === 'card')

  // Parsing nominal langsung dari teks input yang terlihat user
  const payFromDisplay = (() => {
    const raw = String(paymentAmountDisplay || '').replace(/\./g, '').replace(/,/g, '')
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  })()

  // Aturan validasi:
  // - Cash: nominal harus > 0 DAN >= total (boleh lebih untuk kembalian)
  // - Transfer/Kartu: nominal otomatis = total, harus pilih bank (+ nomor kartu untuk kartu)
  const nominalValid = paymentMethod === 'cash'
    ? (payFromDisplay > 0 && payFromDisplay >= total)
    : (payFromDisplay > 0 && payFromDisplay === total)

  const nonCashFieldsValid = !isNonCashPay || (
    !!selectedBank && (paymentMethod !== 'card' || !!cardNumber.trim())
  )

  const canPay = !isPaying && cart.length > 0 && total > 0 && nominalValid && nonCashFieldsValid

  useEffect(() => {
    const el = posRef.current
    if (!el) return
    const update = () => {
      if (!el) return
      const top = el.getBoundingClientRect().top
      el.style.height = `calc(100dvh - ${top}px)`
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <div ref={posRef} className="w-full max-w-full bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex flex-col md:flex-row overflow-x-hidden overflow-y-hidden gap-1 px-0 md:px-1 lg:px-2">

      {/* Product Modal (Qty + Modifier) */}
      {showProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-[420px] max-w-full shadow-2xl border border-slate-200" onClick={(e)=>e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 rounded-t-2xl flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Tambah Item</h3>
                <p className="text-[11px] text-slate-500 truncate" title={selectedProduct.name}>{selectedProduct.name}</p>
              </div>
              <button
                onClick={()=> setShowProductModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <div className="w-24 h-24 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                  {selectedProduct.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedProduct.photoUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🍽️</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  <p className="font-semibold text-slate-800 line-clamp-2" title={selectedProduct.name}>{selectedProduct.name}</p>
                  <p className="text-indigo-600 font-bold mt-1">{formatCurrency(getUnitPrice(selectedProduct))}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-slate-600 font-medium">Qty</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={()=> setProductQty(q=> Math.max(1, q-1))}
                    className="w-8 h-8 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold"
                  >-
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={productQty}
                    onChange={(e)=> setProductQty(Math.max(1, Number(e.target.value)||1))}
                    className="w-16 text-center border border-slate-300 rounded-md text-sm py-1"
                  />
                  <button
                    type="button"
                    onClick={()=> setProductQty(q=> q+1)}
                    className="w-8 h-8 rounded-md bg-teal-bg hover:bg-teal-bg text-teal-dark flex items-center justify-center text-sm font-bold"
                  >+
                  </button>
                </div>
              </div>
              <div>
                <textarea
                  value={productModifier}
                  onChange={(e)=> setProductModifier(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs resize-none"
                  placeholder="catatan"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex gap-2">
              <button
                type="button"
                onClick={()=> setShowProductModal(false)}
                className="flex-1 px-3 py-2 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmAddProduct}
                className="flex-[1.2] px-3 py-2 rounded-full bg-teal-primary hover:bg-teal-dark text-white text-sm font-semibold"
              >
                Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Panel - Products */}
      <div className="flex-1 p-2 min-w-0">
        <div className="bg-white rounded-xl shadow-md border border-slate-200/50 h-full flex flex-col min-w-0 max-w-full">
          {/* Header */}
          <div className="px-2 py-1.5 sm:px-2.5 sm:py-1.5 border-b border-slate-200/50 bg-white rounded-t-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-800">Point of Sale</h1>
              <LiveClock />
            </div>
            {restoTableLabel && (
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate" title={restoTableLabel}>
                {restoTableLabel}
              </div>
            )}
          </div>

          {/* Search & Categories */}
          <div className="p-2 sm:p-2.5 border-b border-slate-200/50 space-y-2 bg-slate-50/50">
            <input
              type="text"
              placeholder="🔍 Cari produk..."
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm"
            />
            
            <div className="flex items-center gap-1.5 pb-0.5">
              <button
                onClick={()=> setCatPage(p=> Math.max(0, p-1))}
                disabled={catPage===0}
                className={`px-2 py-1.5 rounded-pill text-xs font-medium ${catPage===0? 'bg-slate-100 text-slate-400 cursor-not-allowed':'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 shadow-sm'}`}
                title="Sebelumnya"
              >
                ‹
              </button>
              <div ref={catContainerRef} className="flex gap-1.5 overflow-hidden">
                {visibleCategories.map((category: any) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 ${
                      activeCategory === category.id
                        ? 'bg-teal-bg text-teal-dark shadow-sm border border-teal-primary'
                        : 'bg-white text-slate-700 hover:bg-teal-bg hover:text-teal-dark border border-slate-200 shadow-sm'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
              <button
                onClick={()=> setCatPage(p=> Math.min(totalCatPages-1, p+1))}
                disabled={catPage>= totalCatPages-1}
                className={`px-2 py-1.5 rounded-pill text-xs font-medium ${catPage>= totalCatPages-1? 'bg-slate-100 text-slate-400 cursor-not-allowed':'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 shadow-sm'}`}
                title="Berikutnya"
              >
                ›
              </button>
            </div>
          </div>

          {/* Products Grid - Fixed Height with Scroll */}
          <div className="flex-1 p-2 sm:p-3 min-h-0">
            <div className="h-full overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                    <p className="text-slate-600 text-sm">Memuat menu...</p>
                  </div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="text-3xl mb-3">🍽️</div>
                    <p className="text-slate-600 text-sm">Tidak ada menu tersedia</p>
                    <p className="text-[11px] text-slate-400 mt-1.5">Total produk: {products.length}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-1 sm:gap-1.5">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => openProductModal(product)}
                      className="bg-white border-2 border-teal-bg rounded-lg p-1.5 sm:p-2 cursor-pointer hover:shadow-lg hover:border-teal-primary transition-all duration-150 group"
                    >
                      <div className="h-32 rounded-md mb-1 sm:mb-1.5 overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
                        {product.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-50">
                            <span className="text-sm">🍽️</span>
                          </div>
                        )}
                      </div>
                      {/* Product Info */}
                      <h3
                        className="font-semibold text-[11px] sm:text-xs text-slate-800 mb-0.5 line-clamp-2 group-hover:text-indigo-700 min-h-[28px]"
                        title={product.name}
                      >
                        {product.name}
                      </h3>
                      <p className="font-bold text-indigo-600 text-[10px] sm:text-[11px]">
                        {formatCurrency(product.prices?.[0]?.price || 0)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e)=>{ e.stopPropagation() }}>
          <div className="bg-white rounded-2xl w-[680px] max-w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200" onClick={(e)=> e.stopPropagation()}>
            <div className="px-5 py-3 rounded-t-2xl bg-teal-primary text-white flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold">Pembayaran</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-white/80 hover:text-white">✕</button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] text-slate-600 font-bold mb-1">Metode Pembayaran</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { setPaymentMethod('cash'); setCardType(''); setPaymentAmount(0); setPaymentAmountDisplay('') }} className={`px-3 py-2 rounded-pill border text-sm font-bold ${paymentMethod==='cash' ? 'bg-teal-bg border-teal-light text-teal-dark' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Cash</button>
                    <button onClick={() => { setPaymentMethod('transfer'); setCardType(''); setPaymentAmount(total); setPaymentAmountDisplay(total ? total.toLocaleString('id-ID') : ''); /* paksa pilih manual */ setSelectedBank(null); }} className={`px-3 py-2 rounded-pill border text-sm font-bold ${paymentMethod==='transfer' ? 'bg-teal-bg border-teal-light text-teal-dark' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Transfer</button>
                    <button onClick={() => { setPaymentMethod('card'); setCardType(''); setPaymentAmount(total); setPaymentAmountDisplay(total ? total.toLocaleString('id-ID') : ''); /* paksa pilih manual */ setSelectedBank(null); }} className={`px-3 py-2 rounded-pill border text-sm font-bold ${paymentMethod==='card' ? 'bg-teal-bg border-teal-light text-teal-dark' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Kartu</button>
                  </div>
                  {/* No. Meja (opsional) */}
                  <div className="mt-3">
                    <div className="text-[11px] text-slate-600 font-bold mb-1">No. Meja <span className="text-slate-400 font-normal">(opsional)</span></div>
                    <div className="relative" ref={tableDropdownRef}>
                      <input
                        type="text"
                        placeholder={selectedTable ? `${selectedTable.code || ''} - ${selectedTable.name || ''}` : 'Cari / pilih meja...'}
                        value={tableSearch}
                        onChange={(e)=>{ setTableSearch(e.target.value); setShowTableDropdown(true) }}
                        onFocus={()=> setShowTableDropdown(true)}
                        onKeyDown={(e)=>{ if (e.key === 'Escape') { e.stopPropagation(); setShowTableDropdown(false) } }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      {showTableDropdown && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-auto">
                          {(tables||[])
                            .filter((t:any)=>{
                              const q = tableSearch.toLowerCase()
                              if(!q) return true
                              const s = `${t.code||''} ${t.name||''} ${t.floor_name||''} ${t.zone||''}`.toLowerCase()
                              return s.includes(q)
                            })
                            .slice(0,50)
                            .map((t:any)=> (
                              <button key={t.id}
                                type="button"
                                onClick={()=>{ setSelectedTable(t); setTableSearch(''); setShowTableDropdown(false) }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                                title={`${t.code || ''} - ${t.name || ''}`}
                              >
                                <div className="font-medium text-slate-800">{t.code || ''} - {t.name || ''}</div>
                                <div className="text-[11px] text-slate-500">{t.floor_name || '-'}{t.zone ? ` • ${t.zone}` : ''}</div>
                              </button>
                            ))}
                          {(!tables || tables.length===0) && (
                            <div className="px-3 py-2 text-sm text-slate-500">Tidak ada data meja</div>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedTable && (
                      <div className="mt-1 text-[11px] text-slate-500">Dipilih: <span className="font-semibold text-slate-700">{selectedTable.code || ''} - {selectedTable.name || ''}</span></div>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between"><span className="text-slate-600">Subtotal</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-red-600">Diskon</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={discountPercentInput}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
                              setDiscountPercentInput(raw)
                              const num = Math.max(0, Math.min(100, Number(raw) || 0))
                              // update percent state and mirror nominal input
                              setDiscountPercent(num)
                              const amt = Math.max(0, Math.min(rawSubtotal, Math.round(rawSubtotal * (num / 100))))
                              setDiscountAmountInput(amt ? amt.toLocaleString('id-ID') : '')
                            }}
                            onFocus={(e) => e.currentTarget.select()}
                            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs text-right"
                            placeholder="0"
                          />
                          <span className="text-red-600 text-xs">%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-xs">atau</span>
                          <input
                            type="text"
                            value={discountAmountInput}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '')
                              const num = Math.max(0, Math.min(rawSubtotal, Number(raw) || 0))
                              setDiscountAmountInput(num ? num.toLocaleString('id-ID') : '')
                              // derive percent from nominal
                              const pct = rawSubtotal > 0 ? Math.min(100, (num / rawSubtotal) * 100) : 0
                              const pctRounded = Math.round(pct * 100) / 100
                              setDiscountPercent(pctRounded)
                              setDiscountPercentInput(String(pctRounded))
                            }}
                            onFocus={(e) => e.currentTarget.select()}
                            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs text-right"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <span className="text-red-600">- {formatCurrency(discountAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between"><span className="text-sky-600">PPN</span><span className="text-sky-600">+ {formatCurrency(ppnAmount)}</span></div>
                    <div className="flex items-center justify-between mt-1 pt-1 border-t"><span className="font-bold">Total</span><span className="font-extrabold text-teal-primary">{formatCurrency(total)}</span></div>
                  </div>
                </div>
                <div>
                  {/* Nama / keterangan di pembayaran (Nm_cust, optional) */}
                  <div className="mb-3">
                    <div className="text-[11px] text-slate-600 font-bold mb-1">Nama / Keterangan (opsional)</div>
                    <input
                      type="text"
                      value={paymentName}
                      onChange={(e)=> setPaymentName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Nama customer atau catatan singkat"
                    />
                  </div>

                  {paymentMethod !== 'cash' && (
                    <div className="mb-3">
                      <div className="text-[11px] text-slate-600 font-bold mb-1">Bank Tujuan</div>
                      <select
                        value={(selectedBank?.id ?? selectedBank?.bank_id) || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          const bank = banks.find(b => Number(b.id ?? b.bank_id) === val)
                          setSelectedBank(bank || null)
                        }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="" disabled>{`Pilih Bank...`}</option>
                        {banks.map((bank: any) => {
                          const id = bank.id ?? bank.bank_id
                          const name = bank.bank_name ?? bank.bankName ?? bank.name ?? 'Bank'
                          const no = bank.account_number ?? bank.accountNumber ?? bank.no_rek ?? ''
                          const owner = bank.owner_name ?? bank.ownerName ?? bank.holder_name ?? ''
                          const label = `${name}${no ? ` - ${no}` : ''}${owner ? ` (${owner})` : ''}`
                          return (
                            <option key={id} value={id}>{label}</option>
                          )
                        })}
                      </select>
                    </div>
                  )}
                  {paymentMethod === 'card' && (
                    <>
                      <div className="mb-3">
                        <div className="text-[11px] text-slate-600 font-bold mb-1">Tipe Kartu</div>
                        <select
                          value={cardType}
                          onChange={(e) => setCardType(e.target.value as 'debit' | 'credit' | '')}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option value="">Pilih tipe kartu...</option>
                          <option value="debit">Debit</option>
                          <option value="credit">Kredit</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <div className="text-[11px] text-slate-600 font-bold mb-1">Nomor Kartu</div>
                        <input type="text" value={cardNumber} onChange={(e)=> setCardNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="0000 0000 0000 0000" />
                      </div>
                    </>
                  )}
                  <div>
                    <div className="text-[11px] text-slate-600 font-bold mb-1">Nominal Pembayaran</div>
                    <input
                      type="text"
                      value={paymentAmountDisplay}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '')
                        const numValue = Number(value) || 0
                        setPaymentAmount(numValue)
                        setPaymentAmountDisplay(numValue ? numValue.toLocaleString('id-ID') : '')
                      }}
                      onFocus={(e) => e.target.select()}
                      readOnly={paymentMethod !== 'cash'}
                      className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${paymentMethod!=='cash' ? 'bg-slate-50 text-slate-500' : ''}`}
                      placeholder="0"
                    />
                  </div>
                  {paymentMethod === 'cash' && (
                    <div className="mt-2 flex items-center justify-between text-slate-700">
                      <span className="text-sm font-bold">Kembalian</span>
                      <span className="text-base font-semibold">{formatCurrency(Math.max(0, paymentAmount - total))}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 rounded-b-2xl flex gap-2 flex-shrink-0">
              <button onClick={() => {
                setShowPaymentModal(false)
                setPaymentAmount(0)
                setPaymentAmountDisplay('')
                setCardNumber('')
                setCardType('')
                setSelectedBank(null)
                setPaymentMethod('cash')
              }} className="px-3 py-2 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold flex-1">Batal</button>
              <button
                type="button"
                onClick={() => {
                  if (!canPay) return
                  handlePayment()
                }}
                disabled={!canPay}
                className={`px-3 py-2 rounded-full text-white text-sm font-bold flex-[1.5] transition-all
                  ${canPay ? 'bg-teal-primary hover:bg-teal-dark cursor-pointer' : 'bg-slate-400 cursor-not-allowed'}
                `}
              >
                {isPaying ? 'Memproses...' : 'Bayar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right Panel - Cart */}
      <div className="w-72 sm:w-80 p-2 flex-shrink-0">
        <div className="bg-white rounded-xl shadow-md border border-slate-200/50 h-full flex flex-col relative z-10">
          {/* Cart Header */}
          <div className="px-2 py-1 sm:px-2.5 sm:py-1 border-b border-slate-200/50 bg-white rounded-t-xl flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-slate-800">Keranjang</h2>
            <span className="text-[10px] sm:text-xs text-slate-500">{cart.length} item</span>
          </div>

          {/* Customer Selection */}
          <div className="p-2 sm:p-2 border-b border-slate-200/50 bg-slate-50/50">
            <button
              onClick={() => setShowCustomerModal(true)}
              className="w-full p-2 sm:p-2.5 border border-slate-300 rounded-lg text-left text-xs sm:text-sm hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-150 bg-white shadow-sm"
            >
              {selectedCustomer ? (
                <div>
                  <p className="font-semibold text-sm text-slate-800">{selectedCustomer.name}</p>
                  <p className="text-[11px] text-slate-500">Diskon: {selectedCustomer.discountPercent}%</p>
                </div>
              ) : (
                <div className="text-slate-600 text-xs">+ Pilih Customer</div>
              )}
            </button>
          </div>

          {/* Cart Items - Scrollable Area */}
          <div className="flex-1 p-2 sm:p-2.5 min-h-0">
            {cart.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl mb-2">🛒</div>
                  <p className="text-sm">Keranjang kosong</p>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 pr-2">
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-2 sm:gap-2.5 p-2 sm:p-2 border border-slate-200 rounded-lg bg-slate-50/50 hover:bg-indigo-50/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[11px] sm:text-xs text-slate-800 line-clamp-2 break-words" title={item.name}>{item.name}</h4>
                        <p className="text-[10px] sm:text-xs text-slate-500">{formatCurrency(item.price)} × {item.quantity}</p>
                        {item.modifier && (
                          <p className="text-[10px] sm:text-xs text-slate-500 italic break-words">* {item.modifier}</p>
                        )}
                        <p className="text-xs sm:text-sm font-bold text-indigo-600">{formatCurrency(item.total)}</p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center font-bold transition-colors text-xs">-</button>
                        <span className="w-5 sm:w-6 text-center text-xs sm:text-sm font-semibold">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-teal-bg hover:bg-teal-bg text-teal-primary flex items-center justify-center font-bold transition-colors text-xs">+</button>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 sm:p-1.5 rounded-md transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cart Summary - Always Visible */}
          <div className="p-1.5 sm:p-2 border-t border-slate-200/50 bg-white mt-auto">
            <div className="flex items-center justify-between text-slate-600 mb-1.5">
              <span className="text-[10px] sm:text-xs">Subtotal</span>
              <span className="text-[10px] sm:text-xs">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-800 mb-1.5">
              <span className="text-xs sm:text-sm font-bold">Total</span>
              <span className="text-xs sm:text-sm font-extrabold text-indigo-600">{formatCurrency(total)}</span>
            </div>
            <div className="flex gap-1.5">
              <button onClick={clearCart} className="flex-1 px-2 py-1 border rounded-md text-slate-700 text-xs hover:bg-slate-50">Kosongkan</button>
              <button onClick={() => { setPaymentAmount(total); setShowPaymentModal(true) }} className="flex-[2] px-2.5 py-1.5 rounded-md bg-teal-primary hover:bg-teal-dark text-white text-xs font-semibold">Bayar Sekarang</button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-96 max-h-96 flex flex-col shadow-2xl border border-slate-200/50">
            <div className="p-6 border-b border-slate-200/50 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl">
              <h3 className="text-lg font-bold text-white">Pilih Customer</h3>
              <input
                type="text"
                placeholder="🔍 Cari customer..."
                value={searchCustomer}
                onChange={(e) => setSearchCustomer(e.target.value)}
                className="w-full mt-3 px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white focus:border-white bg-white/95 shadow-sm"
              />
            </div>
            <div className="flex-1 overflow-auto p-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
              <div className="space-y-3">
                <button
                  onClick={() => selectCustomer(null as any)}
                  className="w-full p-4 text-left border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-200 bg-gradient-to-r from-slate-50 to-slate-100"
                >
                  <p className="font-semibold text-sm text-slate-800">👤 Customer Umum</p>
                  <p className="text-xs text-slate-500">Tanpa diskon khusus</p>
                </button>
                {customers
                  .filter(c => !searchCustomer || 
                    c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
                    c.code.toLowerCase().includes(searchCustomer.toLowerCase())
                  )
                  .map(customer => (
                    <button
                      key={customer.id}
                      onClick={() => selectCustomer(customer)}
                      className="w-full p-4 text-left border border-slate-200 rounded-xl hover:bg-teal-bg hover:border-teal-light transition-all duration-200 bg-white"
                    >
                      <p className="font-semibold text-sm text-slate-800">{customer.name}</p>
                      <p className="text-xs text-slate-500">
                        {customer.code} • 💰 Diskon {customer.discountPercent}%
                      </p>
                    </button>
                  ))}
              </div>
            </div>
            <div className="p-4 border-t border-slate-200/50 bg-slate-50/50 rounded-b-2xl">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-xl font-medium transition-colors"
              >
                ✕ Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        html, body { height: 100%; overflow: hidden; }
      `}</style>
    </div>
  )
}
