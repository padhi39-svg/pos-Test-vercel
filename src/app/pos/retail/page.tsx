"use client"
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/regionalNumber'
import { showSuccess, showError } from '@/lib/notification'
import { LiveClock } from '@/components/LiveClock'
import { getTodayDate } from '@/lib/date-utils'

type Product = {
  id: number
  code: string
  name: string
  prices?: { price: number }[]
  units?: { id: number; name: string; ratio: number }[]
}

type Customer = {
  id: number
  code: string
  name: string
  discountPercent?: number
  jenisCustomerId?: number | null
}

type DetailItem = {
  tempId: string
  barangId: number | null
  barangName: string
  qty: number
  unitId: number | null
  unitName: string
  unitRatio: number
  hargaSatuan: number
  diskonPersen: number
  diskon: number
  subtotal: number
}

export default function POSRetailPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [tanggalNota, setTanggalNota] = useState<string>(getTodayDate())
  const [details, setDetails] = useState<DetailItem[]>([{
    tempId: Date.now().toString(),
    barangId: null,
    barangName: '',
    qty: 1,
    unitId: null,
    unitName: '',
    unitRatio: 1,
    hargaSatuan: 0,
    diskonPersen: 0,
    diskon: 0,
    subtotal: 0
  }])
  const [loading, setLoading] = useState(true)
  const [banks, setBanks] = useState<any[]>([])
  const [ppnPercent, setPpnPercent] = useState<number>(10)
  const [includeTax, setIncludeTax] = useState<boolean>(false)
  const prefilledRef = useRef(false)
  const [currentUser, setCurrentUser] = useState<{ name: string } | null>(null)
  const [canEditPrice, setCanEditPrice] = useState<boolean>(false)
  const [canQtyMinus, setCanQtyMinus] = useState<boolean>(false)
  const [canBackdate, setCanBackdate] = useState<boolean>(false)
  

  // Konfigurasi printer & layout nota (shared dengan POS resto)
  const [printerCfg, setPrinterCfg] = useState<{
    deviceName: string
    autoPrint: boolean
    copies: number
    cut: boolean
    chars: number
    paper: string
    backendMode: 'server' | 'local_helper' | 'local_helper_apk' | 'local_helper_offline' | 'mobile_rawbt' | 'browser_print' | 'android_intent'
    host: string
    port: number
    localHelperId: string
    localHelperIp: string
    localUsbName: string
  }>({
    deviceName: '',
    autoPrint: false,
    copies: 1,
    cut: true,
    chars: 48,
    paper: '80mm',
    backendMode: 'server',
    host: '',
    port: 9100,
    localHelperId: '',
    localHelperIp: '',
    localUsbName: '',
  })
  const [companyInfo, setCompanyInfo] = useState<{ name: string; address: string; phone: string }>({
    name: '',
    address: '',
    phone: '',
  })

  const [deviceId, setDeviceId] = useState<string>('')

  type LayoutCfg = {
    header_title: string
    show_company: '0' | '1'
    show_address: '0' | '1'
    show_phone: '0' | '1'
    show_invoice_code: '0' | '1'
    separator_char: '-' | '='
    thankyou_text: string
    align_header: 'left' | 'center'
    columns_style: 'standard' | 'compact'
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

  

  // Payment modal (unified with POS Resto)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  type PaymentRowType = { method: 'cash' | 'transfer' | 'Debit Card' | 'Credit Card'; amount: number; amountDisplay: string; bankId: number | null; cardNumber: string }
  const [payments, setPayments] = useState<PaymentRowType[]>([
    { method: 'cash', amount: 0, amountDisplay: '', bankId: null, cardNumber: '' }
  ])
  const [isPaying, setIsPaying] = useState(false)
  const [generatedNotaNumber, setGeneratedNotaNumber] = useState<string>('')
  const [editId, setEditId] = useState<number | null>(null)
  
  // Barcode and search modal
  const [barcodeInput, setBarcodeInput] = useState<string>('')
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [barangRes, custRes, bankRes, penjualanSettingsRes] = await Promise.all([
          fetch('/api/barang'),
          fetch('/api/customer'),
          fetch('/api/banks'),
          fetch('/api/settings?group=penjualan'),
        ])
        const [barangData, custData, bankData, penjualanSettingsRows] = await Promise.all([
          barangRes.ok ? barangRes.json() : [],
          custRes.ok ? custRes.json() : [],
          bankRes.ok ? bankRes.json() : [],
          penjualanSettingsRes.ok ? penjualanSettingsRes.json() : [],
        ])
        setProducts(barangData || [])
        setCustomers(custData || [])
        setBanks(bankData || [])
        const settingsMap: Record<string, string> = {}
        ;(penjualanSettingsRows || []).forEach((row: any) => { settingsMap[row.setting_key] = String(row.setting_value ?? '') })
        setPpnPercent(Number(settingsMap['sales_default_ppn_percent'] || 10))
        setIncludeTax(settingsMap['sales_include_tax'] === '1')

        const defaultCustomer = (custData || []).find((c: Customer) => c.id === 1)
        if (defaultCustomer) {
          setSelectedCustomer(defaultCustomer)
        }

  // Simple suggestion: default to cash
  const suggestPaymentMethod = (_amount: number): 'cash' | 'transfer' | 'card' => 'cash'
      } catch (e) {
        console.error('Load retail data error:', e)
      } finally {
        setLoading(false)
      }
    }
    loadMasterData()
  }, [])

  useEffect(() => {
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

  // Load printer settings (per device via client-settings 'printer'), company info, layout & current user
  useEffect(() => {
    const loadPrinterAndCompany = async () => {
      try {
        const [companyRes, layoutRes, meRes] = await Promise.all([
          fetch('/api/settings?group=company'),
          fetch('/api/settings?group=printer_layout'),
          fetch('/api/me'),
        ])

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
          const map: Record<string, string> = {}
          ;(rows || []).forEach((r: any) => { map[r.setting_key] = String(r.setting_value ?? '') })
          setCompanyInfo({
            name: map['company_name'] || '',
            address: map['company_address'] || '',
            phone: map['company_phone'] || '',
          })
        }

        if (layoutRes.ok) {
          const data = await layoutRes.json()
          const map: Record<string, string> = {}
          ;(data || []).forEach((row: any) => { map[row.setting_key] = String(row.setting_value ?? '') })
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

        if (meRes.ok) {
          const me = await meRes.json()
          if (me && typeof me === 'object') {
            setCurrentUser({ name: String(me.name || me.username || me.email || 'User') })
          }
        }
        try {
          const authRes = await fetch('/api/auth/me')
          if (authRes.ok) {
            const auth = await authRes.json()
            const dyn = Array.isArray(auth?.user?.dynamicPermissions)
              ? auth.user.dynamicPermissions
              : (Array.isArray(auth?.user?.dynamicPermissions) ? auth.user.dynamicPermissions : [])
            const hasEditPrice = dyn.some((p: any) => String(p.menu_code) === 'pos_retail' && String(p.permission_code) === 'EDIT_PRICE' && Number(p.allowed) === 1)
            setCanEditPrice(Boolean(hasEditPrice))

            const hasQtyMinus = dyn.some((p: any) => String(p.menu_code) === 'pos_retail' && String(p.permission_code) === 'QTY_MINUS' && Number(p.allowed) === 1)
            setCanQtyMinus(Boolean(hasQtyMinus))

            const hasBackdate = auth.backdate_permissions?.['pos_retail'] ?? auth.allow_backdate === true
            setCanBackdate(Boolean(hasBackdate))
            if (!hasBackdate) {
              setTanggalNota(getTodayDate())
            }
          }
        } catch {}
      } catch (e) {
        console.warn('Gagal memuat konfigurasi printer POS Retail:', e)
      }
    }
    loadPrinterAndCompany()
  }, [deviceId])

  // Prefill support for Edit page: read data from global and hydrate UI state
  useEffect(() => {
    if (prefilledRef.current) return
    if (typeof window === 'undefined') return
    const g: any = (window as any)
    const tx = g.__POS_EDIT_TX
    if (!tx) return
    // Pastikan master products sudah ter-load agar satuan bisa dipetakan
    if (!products || products.length === 0) return

    try {
      // Set header fields
      setTanggalNota((tx.transaction_date || tx.created_at || new Date().toISOString()).slice(0, 10))
      setEditId(Number(tx.id) || null)
      // Kode Nota
      setGeneratedNotaNumber(String(tx.transaction_number || ''))
      // include tax & ppn percent: hanya override jika field tersedia di transaksi
      if (tx.price_include_tax !== undefined && tx.price_include_tax !== null) {
        setIncludeTax(Number(tx.price_include_tax) === 1)
      }
      setPpnPercent(Number(tx.ppn_percent || tx.tax_rate_percent || 10))

      // Customer
      if (Array.isArray(customers) && customers.length > 0) {
        const found = customers.find((c: any) => Number(c.id) === Number(tx.customer_id))
        if (found) setSelectedCustomer(found)
      }

      // Map items into detail rows (gunakan nilai dari DB apa adanya untuk tampilan awal)
      const mappedDetails = (tx.items || []).map((it: any) => {
        const qty = Number(it.quantity || 0)
        const unitPrice = Number(it.unit_price || 0)
        const pctDiscFromDb = Number(it.discount_percent ?? it.discon_percent ?? it.disc_percent ?? it.discPct ?? 0) || 0
        const perUnitDisc = qty > 0 ? Number(it.discon_total || it.discount_total || it.disc_total || 0) / qty : 0
        const product = products.find((p: any) => Number(p.id) === Number(it.barang_id))
        
        // Try find unit by name from product.units
        const wantedName = String(it.unit_name || 'pcs').trim().toLowerCase()
        let unit: any = null
        let unitId: number | null = null
        let unitName = String(it.unit_name || 'Pcs')
        let unitRatio = Number(it.unit_ratio || 1)
        
        if (product && product.units && product.units.length > 0) {
          // Cari unit berdasarkan nama
          unit = product.units.find((u: any) => String((u.name ?? u.unit_name) || '').trim().toLowerCase() === wantedName)
          if (!unit) {
            // fallback ke unit ratio=1 atau unit pertama
            unit = product.units.find((u: any) => Number(u.ratio ?? u.unit_ratio) === 1) || product.units[0]
          }
          if (unit) {
            unitId = Number(unit.id ?? unit.unit_id) || null
            unitName = String(unit.name ?? unit.unit_name ?? it.unit_name ?? 'Pcs')
            unitRatio = Number(unit.ratio ?? unit.unit_ratio ?? 1)
          }
        }
        
        // API transaksi saat ini hanya menyimpan diskon nominal (discon_total). Jika persen tidak tersedia,
        // turunkan persen dari diskon nominal dan unit price agar kolom Disc % tetap terisi saat edit.
        const derivedPct = (pctDiscFromDb <= 0 && unitPrice > 0 && perUnitDisc > 0)
          ? Math.max(0, Math.min(100, (perUnitDisc / unitPrice) * 100))
          : 0

        const usePct = pctDiscFromDb > 0 || derivedPct > 0
        const pct = usePct ? (pctDiscFromDb > 0 ? pctDiscFromDb : Number(derivedPct.toFixed(2))) : 0
        const { total, perUnitDiscount } = computeLine(unitPrice, qty, pct, usePct ? 0 : perUnitDisc)
        const subtotalFromDb = Number(it.total_price ?? total)
        return {
          tempId: `${Date.now()}-${Math.random()}`,
          barangId: product?.id ?? Number(it.barang_id) ?? null,
          barangName: product?.name || String(it.barang_name || ''),
          qty: qty || 1,
          unitId,
          unitName,
          unitRatio,
          hargaSatuan: unitPrice,
          diskonPersen: usePct ? pct : 0,
          diskon: perUnitDiscount,
          subtotal: subtotalFromDb,
        }
      })

      if (mappedDetails.length > 0) {
        setDetails(mappedDetails)
      } else {
        // Tidak ada detail yang berhasil dipetakan, tunda prefill
        return
      }

      // Clear the global once used
      g.__POS_EDIT_TX = undefined
      prefilledRef.current = true
    } catch (e) {
      console.error('Prefill edit POS Retail error:', e)
    }
  }, [customers, products])

  // Tax helpers and per-line compute mirroring server
  const r = Math.max(0, ppnPercent) / 100
  const roundRp = (n: number) => Math.round(n)
  const computeLine = (uiUnitPrice: number, qty: number, discPct: number, discAmtPerUnit: number) => {
    // Harga ex-tax untuk perhitungan DPP/PPN
    const unitPriceEx = includeTax ? roundRp(uiUnitPrice / (1 + r)) : uiUnitPrice
    // Diskon per-unit: jika persen, DIAMBIL dari harga tampilan (uiUnitPrice)
    const pct = Math.max(0, discPct) / 100
    const perUnitDiscount = discAmtPerUnit > 0 ? discAmtPerUnit : roundRp(uiUnitPrice * pct)
    // Total diskon baris: gunakan |qty| agar diskon tetap positif, tanda ditentukan oleh qty pada perhitungan total
    const discountAbs = roundRp(Math.max(0, perUnitDiscount) * Math.abs(qty))
    const isReturn = qty < 0
    if (includeTax) {
      const lineGrossInc = uiUnitPrice * qty // bisa negatif jika qty negatif
      const totalAfterDisc = isReturn ? (lineGrossInc - discountAbs) : Math.max(0, lineGrossInc - discountAbs)
      const dpp = roundRp(totalAfterDisc / (1 + r))
      const ppn = totalAfterDisc - dpp
      const total = totalAfterDisc
      return { unitPriceEx, dpp, ppn, total, discountCalc: isReturn ? -discountAbs : discountAbs, perUnitDiscount }
    } else {
      const lineGrossEx = unitPriceEx * qty // bisa negatif jika qty negatif
      const dppRaw = lineGrossEx - discountAbs
      const dpp = isReturn ? dppRaw : Math.max(0, dppRaw)
      const ppn = roundRp(dpp * r)
      const total = dpp + ppn
      return { unitPriceEx, dpp, ppn, total, discountCalc: isReturn ? -discountAbs : discountAbs, perUnitDiscount }
    }
  }

  // Derive header totals from cart state (assumes `cart` shape exists similarly)
  const { headerDPP, headerPPN, headerTotal } = useMemo(() => {
    if (!Array.isArray(details)) return { headerDPP: 0, headerPPN: 0, headerTotal: 0 }
    let dpp = 0, ppn = 0, ttl = 0
    for (const it of details) {
      const { dpp: ldpp, ppn: lppn, total: ltot } = computeLine(it.hargaSatuan, it.qty, it.diskonPersen, it.diskon)
      dpp += ldpp; ppn += lppn; ttl += ltot
    }
    return { headerDPP: dpp, headerPPN: ppn, headerTotal: ttl }
  }, [details, includeTax, ppnPercent])

  // Derived totals for UI compatibility
  const subtotal = headerDPP
  const ppnAmount = headerPPN
  const total = headerTotal

  // Keep totalDiskon for UI that references it (sum item discounts)
  const totalDiskon = useMemo(() => {
    if (!Array.isArray(details)) return 0
    return details.reduce((sum, d) => {
      const { discountCalc } = computeLine(d.hargaSatuan, d.qty, d.diskonPersen, d.diskon)
      return sum + discountCalc
    }, 0)
  }, [details, includeTax, ppnPercent])

  // Helper khusus STRUK: format rupiah aman untuk ESC/POS
  const formatReceiptCurrency = (value: number): string => {
    if (isNaN(value) || value === null || value === undefined) return 'Rp 0'
    const num = value.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    return `Rp ${num}`
  }

  // Utilitas teks untuk struk
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

  type ReceiptItem = { name: string; quantity: number; price: number; total: number }

  const buildReceipt = (
    trxNo: string,
    items: ReceiptItem[],
    totals: { subtotal: number; ppn: number; total: number; disc: number; paid: number; change: number },
    paymentMethod: 'cash' | 'transfer' | 'card' | 'multi',
    cashierName: string,
    freshLayout?: Record<string,string>
  ) => {
    const W = printerCfg.chars
    const L: string[] = []
    let layout: any = freshLayout && Object.keys(freshLayout).length ? freshLayout : { ...layoutCfg }
    const sep = String(layout.separator_char || '-').repeat(W)
    const centerLine = (line: string) => {
      if (layout.align_header !== 'center') return line
      const pad = Math.max(0, Math.floor((W - line.length) / 2))
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
    const valW = Math.max(10, Math.min(14, Math.round(W * 0.3)))
    const payLabel = paymentMethod === 'multi' ? 'Multi' : paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'transfer' ? 'Transfer' : 'Kartu'
    L.push(padRight('Metode', W - valW) + padLeft(payLabel, valW))
    const lblSubtotal = layout.label_subtotal || 'Subtotal'
    const lblTax = layout.label_tax || 'PPN'
    const lblTotal = layout.label_total || 'TOTAL'
    const lblPaid = layout.label_paid || 'Bayar'
    const lblChange = layout.label_change || 'Kembali'
    L.push(padRight(lblSubtotal, W - valW) + padLeft(formatReceiptCurrency(totals.subtotal), valW))
    if (totals.disc > 0) L.push(padRight('Diskon', W - valW) + padLeft('-' + formatReceiptCurrency(totals.disc), valW))
    if (totals.ppn > 0) L.push(padRight(lblTax, W - valW) + padLeft(formatReceiptCurrency(totals.ppn), valW))
    // Total font: bold + size
    const totBold = layout.total_font_bold === "1"
    const totScale = String(layout.total_font_scale || "0")
    if (totBold) L.push(escBoldOn)
    if (totScale !== "0") L.push(escSize(totScale))
    L.push(padRight(lblTotal, W - valW) + padLeft(formatReceiptCurrency(totals.total), valW))
    if (totBold) L.push(escBoldOff)
    if (totScale !== "0") L.push(escSizeNormal)
    L.push(padRight(lblPaid, W - valW) + padLeft(formatReceiptCurrency(totals.paid), valW))
    L.push(padRight(lblChange, W - valW) + padLeft(formatReceiptCurrency(totals.change), valW))
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

  const sendToPrinterBackend = async (
    backend: 'server' | 'local_helper' | 'local_helper_apk' | 'local_helper_offline',
    opts: { host?: string; port?: number; localHelperId?: string; localUsbName?: string },
    text: string,
    cut: boolean,
  ) => {
    if (!text.trim()) return
    if (backend === 'server') {
      const host = (opts.host || printerCfg.host || '').trim()
      const port = opts.port || printerCfg.port || 9100
      if (!host) return
      await fetch('/api/print/escpos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, host, port, cut }),
      })
    } else if (backend === 'local_helper') {
      const id = opts.localHelperId || ''
      const h = printerCfg.localHelperIp || '127.0.0.1'
      const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/,'') : `http://${h.trim()}:27128`
      await fetch(`${baseUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, cut, id }),
      })
    } else if (backend === 'local_helper_apk') {
      const id = opts.localHelperId || ''
      const h = printerCfg.localHelperIp || '127.0.0.1'
      const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/,'') : `http://${h.trim()}:27128`
      await fetch(`${baseUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, cut, id }),
      })
    } else if (backend === 'local_helper_offline') {
      const printerName = opts.localUsbName || ''
      if (!printerName) return
      await fetch('http://127.0.0.1:27128/print/usb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, cut, printerName }),
      })
    }
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
    items: ReceiptItem[],
    paid: number,
    change: number,
  ) => {
    try {
      if (!printerCfg.autoPrint) return
      // Refresh layout dari server agar selalu uptodate
      const freshLayout = await fetchLayout()
      // Tentukan label metode pembayaran dari payments[]
      const methodStr: 'cash' | 'transfer' | 'card' | 'multi' = (paymentsClean.length > 1)
        ? 'multi'
        : ((() => {
            const m = paymentsClean[0]?.method
            if (m === 'cash') return 'cash'
            if (m === 'transfer') return 'transfer'
            return 'card'
          })())
      const txt = buildReceipt(
        trxNo,
        items,
        { subtotal, ppn: ppnAmount, total, disc: totalDiskon, paid, change },
        methodStr,
        currentUser?.name || '',
        freshLayout,
      )
      const copies = Math.max(1, printerCfg.copies)
      if (printerCfg.backendMode === 'server') {
        if (!printerCfg.host) return
        for (let i = 0; i < copies; i++) {
          await fetch('/api/print/escpos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: txt, host: printerCfg.host, port: printerCfg.port, cut: printerCfg.cut && i === copies - 1 }),
          })
        }
      } else if (printerCfg.backendMode === 'local_helper') {
        const id = printerCfg.localHelperId
        const h = printerCfg.localHelperIp || '127.0.0.1'
        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/,'') : `http://${h.trim()}:27128`
        for (let i = 0; i < copies; i++) {
          await fetch(`${baseUrl}/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: txt, cut: printerCfg.cut && i === copies - 1, id }),
          })
        }
      } else if (printerCfg.backendMode === 'local_helper_apk') {
        const id = printerCfg.localHelperId
        const h = printerCfg.localHelperIp || '127.0.0.1'
        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/,'') : `http://${h.trim()}:27128`
        for (let i = 0; i < copies; i++) {
          await fetch(`${baseUrl}/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: txt, cut: printerCfg.cut && i === copies - 1, id }),
          })
        }
      } else if (printerCfg.backendMode === 'local_helper_offline') {
        const printerName = printerCfg.localUsbName
        for (let i = 0; i < copies; i++) {
          await fetch('http://127.0.0.1:27128/print/usb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: txt, cut: printerCfg.cut && i === copies - 1, printerName }),
          })
        }
      } else if (printerCfg.backendMode === 'mobile_rawbt') {
        try {
          const base64 = typeof window !== 'undefined' ? btoa(unescape(encodeURIComponent(txt))) : ''
          window.location.href = 'rawbt:base64,' + base64
        } catch {}
      } else if (printerCfg.backendMode === 'android_intent') {
        try {
          const cleanBody = txt.replace(/[\x00-\x1f]/g, "").replace(/\x7f/g, "")
          const encoded = typeof window !== 'undefined' ? encodeURIComponent(cleanBody) : ''
          window.location.href = 'posprint://print?text=' + encoded + '&printer=0'
        } catch {}
      } else if (printerCfg.backendMode === 'browser_print') {
        const cleanBody = txt.replace(/[\x00-\x1f]/g, "").replace(/\x7f/g, "")
        const w = window.open('', '_blank', 'width=480,height=640')
        if (w) {
          w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap">${cleanBody.replace(/</g, '&lt;')}</pre><script>window.focus();window.print();</script>`)
          w.document.close()
        }
      }
    } catch (e) {
      console.warn('Auto print POS Retail gagal:', e)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: Open search modal
      if (e.key === 'F1') {
        e.preventDefault()
        setShowSearchModal(true)
      }
      // F2: Save & Pay - trigger button click
      if (e.key === 'F2') {
        e.preventDefault()
        const saveButton = document.querySelector('button.bg-teal-primary') as HTMLButtonElement
        if (saveButton) saveButton.click()
      }
      // Escape: Close search modal
      if (e.key === 'Escape' && showSearchModal) {
        setShowSearchModal(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSearchModal])

  const addDetailRow = () => {
    setDetails(prev => [...prev, {
      tempId: Date.now().toString(),
      barangId: null,
      barangName: '',
      qty: 1,
      unitId: null,
      unitName: '',
      unitRatio: 1,
      hargaSatuan: 0,
      diskonPersen: 0,
      diskon: 0,
      subtotal: 0
    }])
  }

  const removeDetailRow = (tempId: string) => {
    if (details.length === 1) return
    setDetails(prev => prev.filter(d => d.tempId !== tempId))
  }

  const updateDetail = (tempId: string, field: keyof DetailItem, value: any) => {
    setDetails(prev => prev.map(d => {
      if (d.tempId !== tempId) return d
      const updated = { ...d }

      // Mutasi nilai dasar
      ;(updated as any)[field] = value

      // Sinkronisasi khusus antara Diskon % dan Diskon (Rp) per-unit
      if (field === 'diskonPersen') {
        // Saat persen berubah, paksa Rp dihitung ulang dari persen
        updated.diskon = 0
        const { total, perUnitDiscount } = computeLine(updated.hargaSatuan, updated.qty, updated.diskonPersen, updated.diskon)
        updated.subtotal = total
        updated.diskon = perUnitDiscount
      } else if (field === 'diskon') {
        // Saat Rp per-unit berubah, hitung ulang persen terhadap harga tampilan
        const uiUnitPrice = updated.hargaSatuan || 0
        const newPct = uiUnitPrice > 0 ? Math.max(0, Math.min(100, (Number(updated.diskon) / uiUnitPrice) * 100)) : 0
        updated.diskonPersen = Number(newPct.toFixed(2))
        const { total, perUnitDiscount } = computeLine(updated.hargaSatuan, updated.qty, updated.diskonPersen, updated.diskon)
        updated.subtotal = total
        updated.diskon = perUnitDiscount
      } else if (field === 'qty' || field === 'hargaSatuan') {
        // Perubahan qty/harga: pertahankan diskon per-unit & persen konsisten
        const { total, perUnitDiscount } = computeLine(updated.hargaSatuan, updated.qty, updated.diskonPersen, updated.diskon)
        updated.subtotal = total
        updated.diskon = perUnitDiscount
      }

      return updated
    }))
  }

  const selectBarang = (tempId: string, barang: Product) => {
    // Find unit with ratio = 1, or fallback to first unit
    const defaultUnit = barang.units?.find(u => u.ratio === 1) || barang.units?.[0]
    // Find price for default unit
    const unitPrice = barang.prices?.find((p: any) => p.unit_id === defaultUnit?.id)
    const basePrice = unitPrice?.price || barang.prices?.[0]?.price || 0
    
    setDetails(prev => prev.map(d => {
      if (d.tempId !== tempId) return d
      const { dpp, ppn, total, discountCalc, perUnitDiscount } = computeLine(basePrice, 1, 0, 0)
      return {
        ...d,
        barangId: barang.id,
        barangName: barang.name,
        unitId: defaultUnit?.id || null,
        unitName: defaultUnit?.name || '',
        unitRatio: defaultUnit?.ratio || 1,
        hargaSatuan: basePrice,
        diskonPersen: 0,
        diskon: 0,
        subtotal: total
      }
    }))
    
    // Setelah memilih barang, fokus ke kolom barang baris berikutnya
    setTimeout(() => {
      const idx = details.findIndex(d => d.tempId === tempId)
      const nextRow = details[idx + 1]
      if (nextRow) {
        const nextBarang = document.querySelector(`input[data-tempid="${nextRow.tempId}"][data-field="barang"]`) as HTMLInputElement
        if (nextBarang) {
          nextBarang.focus()
          nextBarang.select()
        }
      }
    }, 100)
  }

  const selectUnit = (tempId: string, unit: { id: number; name: string; ratio: number }) => {
    setDetails(prev => prev.map(d => {
      if (d.tempId !== tempId) return d
      
      // Find product to get price for this unit
      const product = products.find(p => p.id === d.barangId)
      if (!product) return d
      
      // Find price for this specific unit
      const unitPrice = product.prices?.find((p: any) => p.unit_id === unit.id)
      const newPrice = unitPrice?.price || product.prices?.[0]?.price || 0
      
      // Recalculate with new price
      const { dpp, ppn, total, perUnitDiscount } = computeLine(newPrice, d.qty, d.diskonPersen, d.diskon)
      return {
        ...d,
        unitId: unit.id,
        unitName: unit.name,
        unitRatio: unit.ratio,
        hargaSatuan: newPrice,
        subtotal: total,
        diskon: perUnitDiscount
      }
    }))
  }

  const addBarangByCode = (code: string) => {
    const barang = products.find(p => p.code.toUpperCase() === code.toUpperCase())
    if (!barang) {
      alert(`Barang dengan kode "${code}" tidak ditemukan`)
      setBarcodeInput('')
      return
    }

    const basePrice = barang.prices?.[0]?.price || 0
    const defaultUnit = barang.units?.find(u => u.ratio === 1) || barang.units?.[0]
    const { dpp, ppn, total, discountCalc, perUnitDiscount } = computeLine(basePrice, 1, 0, 0)
    
    // Check if barang already exists in details
    const existingIndex = details.findIndex(d => d.barangId === barang.id)
    
    if (existingIndex >= 0) {
      // Increment qty if exists
      const existingDetail = details[existingIndex]
      updateDetail(existingDetail.tempId, 'qty', existingDetail.qty + 1)
      
      // Auto focus to qty input
      setTimeout(() => {
        const qtyInput = document.querySelector(`input[data-tempid="${existingDetail.tempId}"][data-field="qty"]`) as HTMLInputElement
        if (qtyInput) {
          qtyInput.focus()
          qtyInput.select()
        }
      }, 50)
    } else {
      // Find first empty row
      const emptyRowIndex = details.findIndex(d => !d.barangId)
      
      if (emptyRowIndex >= 0) {
        // Fill the empty row
        const emptyRow = details[emptyRowIndex]
        const tempId = emptyRow.tempId
        const nextTempId = (Date.now() + 1).toString()
        
        setDetails(prev => {
          // isi baris kosong yang ditemukan
          const filled = prev.map(d => {
            if (d.tempId !== emptyRow.tempId) return d
            return {
              ...d,
              barangId: barang.id,
              barangName: barang.name,
              qty: 1,
              unitId: defaultUnit?.id || null,
              unitName: defaultUnit?.name || '',
              unitRatio: defaultUnit?.ratio || 1,
              hargaSatuan: basePrice,
              diskonPersen: 0,
              diskon: 0,
              subtotal: total
            }
          })
          // tambah baris kosong berikutnya
          return [
            ...filled,
            {
              tempId: nextTempId,
              barangId: null,
              barangName: '',
              qty: 1,
              unitId: null,
              unitName: '',
              unitRatio: 1,
              hargaSatuan: 0,
              diskonPersen: 0,
              diskon: 0,
              subtotal: 0
            }
          ]
        })
        
        // Fokus ke kolom barang pada baris kosong berikutnya
        setTimeout(() => {
          const nextBarang = document.querySelector(`input[data-tempid="${nextTempId}"][data-field="barang"]`) as HTMLInputElement
          if (nextBarang) {
            nextBarang.focus()
            nextBarang.select()
          }
        }, 100)
      } else {
        // No empty row, add new filled row + empty row
        const newTempId = Date.now().toString()
        
        setDetails(prev => [
          ...prev,
          {
            tempId: newTempId,
            barangId: barang.id,
            barangName: barang.name,
            qty: 1,
            unitId: defaultUnit?.id || null,
            unitName: defaultUnit?.name || '',
            unitRatio: defaultUnit?.ratio || 1,
            hargaSatuan: basePrice,
            diskonPersen: 0,
            diskon: 0,
            subtotal: total
          },
          {
            tempId: (Date.now() + 1).toString(),
            barangId: null,
            barangName: '',
            qty: 1,
            unitId: null,
            unitName: '',
            unitRatio: 1,
            hargaSatuan: 0,
            diskonPersen: 0,
            diskon: 0,
            subtotal: 0
          }
        ])
        
        // Fokus ke kolom barang baris berikutnya (baris baru)
        setTimeout(() => {
          const barangInput = document.querySelector(`input[data-tempid="${newTempId}"][data-field="barang"]`) as HTMLInputElement
          if (barangInput) barangInput.focus()
        }, 100)
      }
    }
    
    setBarcodeInput('')
  }

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      addBarangByCode(barcodeInput.trim())
    }
  }

  const handleSelectFromModal = (barang: Product) => {
    addBarangByCode(barang.code)
    setShowSearchModal(false)
    setSearchQuery('')
  }

  const handlePaymentMethodChange = (method: 'cash' | 'transfer' | 'card') => {
    // Reset all payment fields when changing method
    // Now using payments[]; this handler no longer controls state directly
    setPayments([{ method: method === 'card' ? 'Debit Card' : (method as any), amount: 0, amountDisplay: '', bankId: null, cardNumber: '' }])
  }

  // Penentuan metode pembayaran default: untuk saat ini sederhana -> cash
  const suggestPaymentMethod = (_amount: number): 'cash' | 'transfer' | 'card' => 'cash'

  const handleSaveAndPay = async () => {
    // Validation
    if (!selectedCustomer) {
      alert('Customer harus dipilih')
      return
    }
    const filledItems = details.filter(d => d.barangId)
    if (filledItems.length === 0) {
      alert('Minimal harus ada 1 item barang')
      return
    }
    if (filledItems.some(d => canQtyMinus ? d.qty === 0 : d.qty <= 0)) {
      alert('Qty harus lebih dari 0')
      return
    }

    // Prefill payments: start with cash row amount 0
    setPayments([{ method: 'cash', amount: 0, amountDisplay: '', bankId: null, cardNumber: '' }])
    setShowPaymentModal(true)
  }

  // Multi-payment derived values and validation (same as POS Resto)
  const paymentsClean = payments.filter(p => p.amount > 0)
  const totalPaid = paymentsClean.reduce((sum, p) => sum + p.amount, 0)
  const cashPaid = paymentsClean.filter(p => p.method === 'cash').reduce((sum, p) => sum + p.amount, 0)
  const nonCashPaid = totalPaid - cashPaid
  const changeAmount = Math.max(0, totalPaid - total)
  const multiPayValid = (() => {
    if (paymentsClean.length === 0) return false
    if (paymentsClean.length > 2) return false
    if (totalPaid < total) return false
    if (nonCashPaid > total) return false
    for (const p of paymentsClean) {
      if (p.method !== 'cash' && !p.bankId) return false
      if ((p.method === 'Debit Card' || p.method === 'Credit Card') && !p.cardNumber.trim()) return false
    }
    return true
  })()

  const handlePayment = async () => {
    if (!multiPayValid) {
      alert('Validasi pembayaran gagal. Periksa nominal, bank/kartu, dan total harus terpenuhi.')
      return
    }

    setIsPaying(true)
    try {
      // Jika dalam mode edit, lakukan PUT dan kembali ke list
      if (editId) {
        // Samakan payload dengan ADD (POST) untuk konsistensi penamaan field
        // Sertakan items agar API dapat mengganti transaction_items
        const items = details.filter(d => d.barangId).map(d => {
          const { dpp, ppn, total, discountCalc, unitPriceEx } = computeLine(d.hargaSatuan, d.qty, d.diskonPersen, d.diskon)
          const prod = products.find(p => Number(p.id) === Number(d.barangId))
          return {
            barangId: d.barangId!,
            barangCode: prod?.code || '',
            barangName: d.barangName,
            quantity: d.qty,
            unitName: d.unitName,
            unitRatio: d.unitRatio,
            unitPrice: unitPriceEx,
            unitPriceIncludeTax: includeTax ? Number(d.hargaSatuan) : roundRp(Number(d.hargaSatuan) * (1 + ppnPercent / 100)),
            discountPercent: d.diskonPersen,
            discountAmount: discountCalc,
            totalPrice: total,
          }
        })
        const payload: any = {
          customerId: selectedCustomer?.id ?? 1,
          jenisCustomerId: selectedCustomer?.jenisCustomerId ?? null,
          transactionDate: tanggalNota,
          subtotal,
          discountPercent: 0,
          discountAmount: totalDiskon,
          ppnPercent,
          ppnAmount,
          total,
          items,
        }
        const putRes = await fetch(`/api/transactions/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!putRes.ok) {
          const err = await putRes.json().catch(() => ({}))
          console.error('PUT /api/transactions failed', err)
          throw new Error(err?.error || err?.details || `Gagal menyimpan perubahan transaksi (HTTP ${putRes.status})`)
        }
        showSuccess('✅ Transaksi berhasil diperbarui')
        setShowPaymentModal(false)
        router.push('/sales')
        return
      }

      // Mode baru (bukan edit): tetap POST membuat nota baru
      const items = details.map(d => {
        const { total, discountCalc, unitPriceEx } = computeLine(d.hargaSatuan, d.qty, d.diskonPersen, d.diskon)
        return {
          barangId: d.barangId!,
          quantity: d.qty,
          unitName: d.unitName,
          unitRatio: d.unitRatio,
          unitPrice: unitPriceEx,
          unitPriceIncludeTax: includeTax ? Number(d.hargaSatuan) : roundRp(Number(d.hargaSatuan) * (1 + ppnPercent / 100)),
          discountPercent: d.diskonPersen,
          discountAmount: discountCalc,
          totalPrice: total, // sama dengan d.subtotal di UI
        }
      })

      // Build payments[] from UI rows
      const paymentsPayload = paymentsClean.map(p => ({
        method: p.method,
        amount: p.amount,
        bankId: p.bankId,
        cardNumber: p.cardNumber || null,
        notes: null as any,
      }))

      const body = {
        transactionType: 2,
        customerId: selectedCustomer?.id ?? 1,
        jenisCustomerId: selectedCustomer?.jenisCustomerId ?? null,
        transactionDate: getTodayDate(),
        items,
        subtotal,
        discountPercent: 0,
        discountAmount: totalDiskon,
        ppnPercent,
        ppnAmount,
        total,
        includeTax,
        price_include_tax: includeTax ? 1 : 0,
        // Retail tidak menggunakan service charge, kirim 0 agar total server = total UI
        serviceChargePercent: 0,
        // Header payment fields: isi ringkas agar laporan mudah dan validasi backend tidak gagal
        paymentMethod: paymentsClean.length > 1 ? 'multi' : (paymentsClean[0]?.method || 'cash'),
        paymentAmount: totalPaid,
        changeAmount: changeAmount,
        cardNumber: paymentsClean.find(p => p.method === 'Debit Card' || p.method === 'Credit Card')?.cardNumber?.trim() || null,
        bankId: paymentsClean.find(p => p.method !== 'cash')?.bankId || null,
        // Kirim daftar pembayaran
        payments: paymentsPayload,
      }

      const res = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        let msg = 'Failed to create transaction'
        try {
          const raw = await res.text()
          try {
            const err = JSON.parse(raw)
            msg = String(err?.error || err?.details || msg)
          } catch {
            if (raw && raw.trim()) msg = raw.trim()
          }
        } catch {}
        throw new Error(msg)
      }
      const out = await res.json()

      const trxNo = String(out?.transactionNumber || '')
      setGeneratedNotaNumber(trxNo)
      if (trxNo) {
        showSuccess(`Pembayaran berhasil. No. Transaksi: ${trxNo}`)
      } else {
        showSuccess('Pembayaran berhasil disimpan')
      }

      // Siapkan item untuk struk (gunakan snapshot agar sesuai dengan yang dibayar)
      const receiptItems: ReceiptItem[] = details
        .filter(d => d.barangId)
        .map(d => ({
          name: d.barangName,
          quantity: d.qty,
          price: d.hargaSatuan,
          total: d.subtotal,
        }))

      // Cetak otomatis nota jika diaktifkan pada Setting Nota POS
      const paidTotal = totalPaid
      const change = changeAmount
      await tryAutoPrint(
        trxNo,
        receiptItems,
        paidTotal,
        change,
      )

      // Reset setelah create baru
      setDetails([{
        tempId: Date.now().toString(),
        barangId: null,
        barangName: '',
        qty: 1,
        unitId: null,
        unitName: '',
        unitRatio: 1,
        hargaSatuan: 0,
        diskonPersen: 0,
        diskon: 0,
        subtotal: 0
      }])
      setPayments([{ method: 'cash', amount: 0, amountDisplay: '', bankId: null, cardNumber: '' }])
      setShowPaymentModal(false)
      setGeneratedNotaNumber('')
    } catch (e: any) {
      console.error('Payment error (retail):', e)
      showError(e?.message || 'Terjadi kesalahan saat memproses pembayaran')
    } finally {
      setIsPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-40px)] flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-800">POS Retail</h1>
          <LiveClock />
        </div>
      </div>

          <div className="bg-white rounded-lg shadow-md border border-teal-bg overflow-hidden flex-1 flex flex-col pb-28 md:pb-0">
        {/* Header Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 border-b border-teal-bg">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Kode Nota</label>
            <input
              type="text"
              value={generatedNotaNumber || ''}
              placeholder="(Auto Generate)"
              disabled
              className="w-full px-3 py-2 border border-teal-bg rounded-pill bg-teal-bg text-teal-dark/50 cursor-not-allowed text-xs h-8"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Tanggal Nota</label>
            <input
              type="date"
              value={tanggalNota}
              onChange={(e) => setTanggalNota(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs h-8 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Customer</label>
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const cust = customers.find(c => c.id === Number(e.target.value))
                setSelectedCustomer(cust || null)
              }}
              className="w-full px-3 py-2 border border-teal-bg rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-primary/30 focus:border-teal-primary text-xs h-8"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Detail Transaksi */}
        <div className="p-3 flex-1 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-800">Detail Transaksi</h2>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative w-full sm:w-auto">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  placeholder="Scan Barcode / Ketik Kode Barang..."
                  className="px-3 py-2 border border-teal-bg rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-primary/30 focus:border-teal-primary w-full sm:w-64 text-xs h-9"
                />
              </div>
              <button
                onClick={() => setShowSearchModal(true)}
                className="px-3 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors flex items-center justify-center gap-2 text-xs h-9 w-full sm:w-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Cari Barang
              </button>
            </div>
          </div>

          {/* Desktop/tablet: table view */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-teal-primary text-white rounded-t-xl">
                <tr>
                  <th className="px-2 py-1 text-left text-xs font-semibold w-[360px]">Barang</th>
                  <th className="px-2 py-1 text-center w-24 text-xs font-semibold">Qty</th>
                  <th className="px-2 py-1 text-left w-24 text-xs font-semibold">Satuan</th>
                  <th className="px-2 py-1 text-right w-36 text-xs font-semibold">Harga</th>
                  <th className="px-2 py-1 text-right w-20 text-xs font-semibold">Disc %</th>
                  <th className="px-2 py-1 text-right w-36 text-xs font-semibold">Disc (Rp)</th>
                  <th className="px-2 py-1 text-right w-28 text-xs font-semibold">Subtotal</th>
                  <th className="px-2 py-1 text-center w-12 text-xs font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-teal-bg">
                {details.map((detail, idx) => {
                  const selectedProduct = products.find(p => p.id === detail.barangId)
                  return (
                    <tr key={detail.tempId} className="hover:bg-teal-bg">
                      <td className="px-2 py-1 max-w-[360px]">
                        {detail.barangId ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={detail.barangName}
                              readOnly
                              className="w-full px-2 py-1 border rounded text-xs bg-teal-bg/50 text-slate-800 font-medium cursor-pointer truncate"
                              onClick={() => setShowSearchModal(true)}
                              title="Klik untuk ganti barang"
                            />
                            <button
                              onClick={() => setShowSearchModal(true)}
                              className="px-2 py-1 text-xs text-teal-primary hover:bg-teal-bg rounded flex items-center"
                              title="Cari barang"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="Scan / Ketik Kode Barang..."
                              data-tempid={detail.tempId}
                              data-field="barang"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                  addBarangByCode(e.currentTarget.value.trim())
                                  e.currentTarget.value = ''
                                }
                              }}
                              className="w-full px-2 py-1 border border-dashed border-teal-bg rounded text-xs text-slate-600 focus:border-teal-primary focus:outline-none"
                            />
                            <button
                              onClick={() => setShowSearchModal(true)}
                              className="px-2 py-1 text-xs text-teal-primary hover:bg-teal-bg rounded flex items-center"
                              title="Cari barang"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={canQtyMinus ? -99 : 1}
                          value={detail.qty}
                          onChange={(e) => updateDetail(detail.tempId, 'qty', Number(e.target.value))}
                          onFocus={(e) => e.currentTarget.select()}
                          data-tempid={detail.tempId}
                          data-field="qty"
                          className="w-full px-2 py-1 border rounded text-xs text-center"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={String(detail.unitId ?? '')}
                          onChange={(e) => {
                            const pickedId = Number(e.target.value)
                            const found = selectedProduct?.units?.find(u => Number((u as any).id ?? (u as any).unit_id) === pickedId)
                            if (found) {
                              const normalized = { id: Number((found as any).id ?? (found as any).unit_id), name: String((found as any).name ?? (found as any).unit_name), ratio: Number((found as any).ratio ?? (found as any).unit_ratio ?? 1) }
                              selectUnit(detail.tempId, normalized)
                            }
                          }}
                          disabled={!selectedProduct && !detail.unitName}
                          data-tempid={detail.tempId}
                          data-field="unit"
                          className="w-full px-2 py-1 border rounded text-xs"
                        >
                          {selectedProduct?.units && selectedProduct.units.length > 0 ? (
                            <>
                              <option value="">-</option>
                              {selectedProduct.units.map(u => (
                                <option key={String((u as any).id ?? (u as any).unit_id)} value={String((u as any).id ?? (u as any).unit_id)}>{String((u as any).name ?? (u as any).unit_name)}</option>
                              ))}
                            </>
                          ) : (
                            <option value={String(detail.unitId ?? '')}>{detail.unitName || 'Pcs'}</option>
                          )}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={detail.hargaSatuan ? detail.hargaSatuan.toLocaleString('id-ID') : '0'}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '')
                            updateDetail(detail.tempId, 'hargaSatuan', v === '' ? 0 : Number(v))
                          }}
                          onFocus={(e) => e.currentTarget.select()}
                          data-tempid={detail.tempId}
                          data-field="hargaSatuan"
                          className={`w-full px-2 py-1 border rounded text-xs text-right ${!canEditPrice ? 'bg-teal-bg text-teal-dark/50 cursor-not-allowed' : ''}`}
                          readOnly={!canEditPrice}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={detail.diskonPersen || 0}
                          onChange={(e) => {
                            updateDetail(detail.tempId, 'diskonPersen', e.target.value === '' ? 0 : Number(e.target.value))
                          }}
                          onFocus={(e) => e.currentTarget.select()}
                          data-tempid={detail.tempId}
                          data-field="diskonPersen"
                          className="w-full px-2 py-1 border rounded text-xs text-right"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={detail.diskon ? detail.diskon.toLocaleString('id-ID') : '0'}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '')
                            updateDetail(detail.tempId, 'diskon', v === '' ? 0 : Number(v))
                          }}
                          onFocus={(e) => e.currentTarget.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              // Move to next row or add new row
                              const currentIndex = details.findIndex(d => d.tempId === detail.tempId)
                              if (currentIndex < details.length - 1) {
                                // Focus to next row qty
                                const nextDetail = details[currentIndex + 1]
                                setTimeout(() => {
                                  const nextInput = document.querySelector(`input[data-tempid="${nextDetail.tempId}"][data-field="qty"]`) as HTMLInputElement
                                  if (nextInput) nextInput.focus()
                                }, 50)
                              } else {
                                // Last row, add new row and focus
                                addDetailRow()
                                setTimeout(() => {
                                  const inputs = document.querySelectorAll('input[data-field="qty"]')
                                  const lastInput = inputs[inputs.length - 1] as HTMLInputElement
                                  if (lastInput) lastInput.focus()
                                }, 100)
                              }
                            }
                          }}
                          data-tempid={detail.tempId}
                          data-field="diskon"
                          className="w-full px-2 py-1 border rounded text-xs text-right"
                        />
                      </td>
                      <td className="px-2 py-1 text-right font-semibold text-teal-primary tabular-nums">
                        {(Number(detail.subtotal) || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button
                          onClick={() => removeDetailRow(detail.tempId)}
                          disabled={details.length === 1}
                          className="px-2 py-1 bg-coral-bg text-coral-primary rounded hover:bg-coral-primary hover:text-white disabled:opacity-30 text-xs"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: card/list view (no horizontal scroll) */}
          <div className="sm:hidden space-y-2">
            {details.map((detail) => {
              const selectedProduct = products.find(p => p.id === detail.barangId)
              return (
                <div key={detail.tempId} className="border border-teal-bg rounded-lg p-2 bg-white">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="text-[11px] font-semibold text-slate-700">Barang</div>
                      {detail.barangId ? (
                        <button
                          type="button"
                          onClick={() => setShowSearchModal(true)}
                          className="w-full text-left mt-0.5 px-2 py-1.5 border rounded text-xs bg-teal-bg/50 text-slate-800 font-medium"
                          title="Klik untuk ganti barang"
                        >
                          {detail.barangName}
                        </button>
                      ) : (
                        <div className="mt-0.5 flex gap-2">
                          <input
                            type="text"
                            placeholder="Scan / Ketik Kode Barang..."
                            data-tempid={detail.tempId}
                            data-field="barang"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                addBarangByCode(e.currentTarget.value.trim())
                                e.currentTarget.value = ''
                              }
                            }}
                            className="flex-1 px-2 py-1.5 border border-dashed border-teal-bg rounded text-xs text-slate-600 focus:border-teal-primary focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSearchModal(true)}
                            className="px-3 py-1.5 text-xs bg-teal-primary text-white rounded-pill"
                          >
                            Cari
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeDetailRow(detail.tempId)}
                      disabled={details.length === 1}
                      className="px-2 py-1 bg-coral-bg text-coral-primary rounded hover:bg-coral-primary hover:text-white disabled:opacity-30 text-xs"
                      title="Hapus item"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700">Qty</div>
                      <input
                        type="number"
                        min={canQtyMinus ? -99 : 1}
                        value={detail.qty}
                        onChange={(e) => updateDetail(detail.tempId, 'qty', Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        data-tempid={detail.tempId}
                        data-field="qty"
                        className="w-full mt-0.5 px-2 py-1.5 border rounded text-xs text-center"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700">Satuan</div>
                      <select
                        value={String(detail.unitId ?? '')}
                        onChange={(e) => {
                          const pickedId = Number(e.target.value)
                          const found = selectedProduct?.units?.find(u => Number((u as any).id ?? (u as any).unit_id) === pickedId)
                          if (found) {
                            const normalized = { id: Number((found as any).id ?? (found as any).unit_id), name: String((found as any).name ?? (found as any).unit_name), ratio: Number((found as any).ratio ?? (found as any).unit_ratio ?? 1) }
                            selectUnit(detail.tempId, normalized)
                          }
                        }}
                        disabled={!selectedProduct && !detail.unitName}
                        data-tempid={detail.tempId}
                        data-field="unit"
                        className="w-full mt-0.5 px-2 py-1.5 border rounded text-xs"
                      >
                        {selectedProduct?.units && selectedProduct.units.length > 0 ? (
                          <>
                            <option value="">-</option>
                            {selectedProduct.units.map(u => (
                              <option key={String((u as any).id ?? (u as any).unit_id)} value={String((u as any).id ?? (u as any).unit_id)}>{String((u as any).name ?? (u as any).unit_name)}</option>
                            ))}
                          </>
                        ) : (
                          <option value={String(detail.unitId ?? '')}>{detail.unitName || 'Pcs'}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700">Harga</div>
                      <input
                        type="text"
                        value={detail.hargaSatuan ? detail.hargaSatuan.toLocaleString('id-ID') : '0'}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '')
                          updateDetail(detail.tempId, 'hargaSatuan', v === '' ? 0 : Number(v))
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        data-tempid={detail.tempId}
                        data-field="hargaSatuan"
                        className={`w-full mt-0.5 px-2 py-1.5 border rounded text-xs text-right ${!canEditPrice ? 'bg-teal-bg text-teal-dark/50 cursor-not-allowed' : ''}`}
                        readOnly={!canEditPrice}
                      />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700">Disc %</div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={detail.diskonPersen || 0}
                        onChange={(e) => updateDetail(detail.tempId, 'diskonPersen', e.target.value === '' ? 0 : Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        data-tempid={detail.tempId}
                        data-field="diskonPersen"
                        className="w-full mt-0.5 px-2 py-1.5 border rounded text-xs text-right"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="text-[11px] font-semibold text-slate-700">Disc (Rp)</div>
                      <input
                        type="text"
                        value={detail.diskon ? detail.diskon.toLocaleString('id-ID') : '0'}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '')
                          updateDetail(detail.tempId, 'diskon', v === '' ? 0 : Number(v))
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        data-tempid={detail.tempId}
                        data-field="diskon"
                        className="w-full mt-0.5 px-2 py-1.5 border rounded text-xs text-right"
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t pt-2">
                    <div className="text-xs text-slate-600">Subtotal</div>
                    <div className="text-sm font-bold text-teal-primary tabular-nums">{(Number(detail.subtotal) || 0).toLocaleString('id-ID')}</div>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Tambah Item Button */}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-slate-500 italic">
              💡 Scan barcode atau klik &ldquo;Cari Barang&rdquo; untuk menambah item.
            </div>
            <button
              onClick={addDetailRow}
              className="px-3 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-all active:scale-[0.97] flex items-center gap-2 text-xs font-semibold h-8 shadow-teal-glow"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Item
            </button>
          </div>
        </div>

        {/* Summary (desktop/tablet) */}
        <div className="hidden md:block bg-surface-base px-3 py-3 border-t border-teal-bg">
          <div className="max-w-md ml-auto space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Diskon:</span>
              <span className="font-semibold text-coral-primary">- {formatCurrency(totalDiskon)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">PPN ({ppnPercent}%):</span>
              <span className="font-semibold text-teal-primary">+ {formatCurrency(ppnAmount)}</span>
            </div>
            <div className="border-t pt-2 flex items-center justify-between">
              <span className="font-bold text-slate-800">TOTAL:</span>
              <span className="text-xl font-bold text-teal-primary">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Actions (desktop/tablet) */}
        <div className="hidden md:flex gap-2 justify-end px-3 py-3">
          <button
            onClick={() => {
              if (editId) {
                router.push('/sales')
                return
              }
              setDetails([{
                tempId: Date.now().toString(),
                barangId: null,
                barangName: '',
                qty: 1,
                unitId: null,
                unitName: '',
                unitRatio: 1,
                hargaSatuan: 0,
                diskonPersen: 0,
                diskon: 0,
                subtotal: 0
              }])
              setGeneratedNotaNumber('')
            }}
            className="px-4 py-2 border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg rounded-pill transition-colors text-xs h-8"
          >
            Batal
          </button>
          <button
            onClick={handleSaveAndPay}
            disabled={isPaying}
            className={`px-4 py-2 rounded-pill font-semibold text-xs h-8 ${isPaying ? 'bg-teal-bg/50 text-teal-dark/50 cursor-not-allowed' : 'bg-teal-primary text-white hover:bg-teal-dark transition-colors'}`}
          >
            {isPaying ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Memproses...
              </span>
            ) : 'Simpan & Bayar'}
          </button>
        </div>
      </div>

      {/* Mobile sticky footer: total + actions */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-teal-bg">
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-600">TOTAL</div>
            <div className="text-lg font-extrabold text-teal-primary">{formatCurrency(total)}</div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (editId) {
                  router.push('/sales')
                  return
                }
                setDetails([{
                  tempId: Date.now().toString(),
                  barangId: null,
                  barangName: '',
                  qty: 1,
                  unitId: null,
                  unitName: '',
                  unitRatio: 1,
                  hargaSatuan: 0,
                  diskonPersen: 0,
                  diskon: 0,
                  subtotal: 0
                }])
                setGeneratedNotaNumber('')
              }}
              className="px-4 py-2 border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg rounded-pill transition-colors text-sm"
            >
              Batal
            </button>
            <button
              onClick={handleSaveAndPay}
              disabled={isPaying}
              className={`px-4 py-2 rounded-pill font-semibold text-sm ${isPaying ? 'bg-teal-bg/50 text-teal-dark/50 cursor-not-allowed' : 'bg-teal-primary text-white hover:bg-teal-dark transition-colors'}`}
            >
              {isPaying ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memproses...
                </span>
              ) : 'Bayar'}
            </button>
          </div>
        </div>
      </div>

      {/* Search Barang Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-teal-bg/50 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b bg-teal-primary rounded-t-2xl flex items-center justify-between">
              <div className="text-white font-bold">Cari Barang</div>
              <button onClick={() => { setShowSearchModal(false); setSearchQuery('') }} className="text-white hover:bg-white/20 rounded px-2">✕</button>
            </div>
            <div className="p-4 border-b">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Cari nama barang atau kode..."
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 gap-2">
                {products
                  .filter(p => {
                    if (!searchQuery) return true
                    const q = searchQuery.toLowerCase()
                    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
                  })
                  .map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectFromModal(p)}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-teal-bg hover:border-teal-primary transition-colors text-left"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800 text-sm">{p.name}</div>
                        <div className="text-xs text-slate-500">Kode: {p.code}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-teal-primary">{formatCurrency(p.prices?.[0]?.price || 0)}</div>
                        <div className="text-xs text-slate-500">{p.units?.length || 0} satuan</div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal (multi-metode, seragam dengan POS Resto) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-2xl border border-teal-bg/50 flex flex-col">
            <div className="px-5 py-3 rounded-t-2xl bg-teal-primary text-white flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold">Pembayaran Multi Metode</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-white">✕</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-auto">
              <div className="space-y-2 text-sm md:col-span-3">
                <div className="flex items-center justify-between"><span>Subtotal</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
                <div className="flex items-center justify-between text-coral-primary"><span>Diskon</span><span>- {formatCurrency(totalDiskon)}</span></div>
                <div className="flex items-center justify-between text-teal-primary"><span>PPN</span><span>+ {formatCurrency(ppnAmount)}</span></div>
                <div className="flex items-center justify-between border-t pt-1"><span className="font-bold">Total Nota</span><span className="font-extrabold text-teal-primary">{formatCurrency(total)}</span></div>
                <div className="text-[11px] text-slate-500">Maks. 2 metode pembayaran.</div>
              </div>
              <div className="space-y-3 md:col-span-9">
                {/* Mobile: card layout */}
                <div className="md:hidden space-y-2">
                  {payments.map((row, idx) => (
                    <div key={idx} className="border border-teal-bg rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600">Metode</span>
                        {payments.length > 1 && (
                          <button type="button" onClick={() => setPayments(prev => prev.filter((_, i) => i !== idx))} className="text-coral-primary hover:text-coral-dark text-xs">✕ Hapus</button>
                        )}
                      </div>
                      <select
                        value={row.method}
                        onChange={(e) => {
                          const newMethod = e.target.value as PaymentRowType['method']
                          setPayments(prev => prev.map((p, i) => i === idx ? {
                            ...p,
                            method: newMethod,
                            bankId: newMethod === 'cash' ? null : p.bankId,
                            cardNumber: (newMethod === 'Debit Card' || newMethod === 'Credit Card') ? p.cardNumber : '',
                          } : p))
                        }}
                        className="w-full border border-teal-bg rounded px-2 py-1.5 text-xs"
                      >
                        <option value="cash">Cash</option>
                        <option value="transfer">Transfer</option>
                        <option value="Debit Card">Kartu Debit</option>
                        <option value="Credit Card">Kartu Kredit</option>
                      </select>
                      {row.method !== 'cash' && (
                        <div>
                          <span className="text-[11px] font-semibold text-slate-600">Bank</span>
                          <select
                            value={row.bankId || ''}
                            onChange={(e) => {
                              const val = Number(e.target.value) || null
                              setPayments(prev => prev.map((p, i) => i === idx ? { ...p, bankId: val } : p))
                            }}
                            className="w-full border border-teal-bg rounded px-2 py-1.5 text-xs mt-1"
                          >
                            <option value="">Pilih Bank...</option>
                            {banks.map((b:any) => (
                              <option key={(b.id ?? b.bank_id)} value={(b.id ?? b.bank_id)}>{b.name ?? b.bank_name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {(row.method === 'Debit Card' || row.method === 'Credit Card') && (
                        <div>
                          <span className="text-[11px] font-semibold text-slate-600">No Kartu</span>
                          <input
                            type="text"
                            value={row.cardNumber}
                            onChange={(e) => setPayments(prev => prev.map((p, i) => i === idx ? { ...p, cardNumber: e.target.value } : p))}
                            className="w-full border border-teal-bg rounded px-2 py-1.5 text-xs mt-1"
                            placeholder="No. Kartu"
                          />
                        </div>
                      )}
                      <div>
                        <span className="text-[11px] font-semibold text-slate-600">Nominal</span>
                        <input
                          type="text"
                          value={row.amountDisplay}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/[^0-9]/g, '')
                            const n = Number(clean) || 0
                            setPayments(prev => prev.map((p, i) => i === idx ? { ...p, amount: n, amountDisplay: n ? n.toLocaleString('id-ID') : '' } : p))
                          }}
                          onFocus={(e) => e.currentTarget.select()}
                          className="w-full border border-teal-bg rounded px-2 py-1.5 text-xs text-right mt-1"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: table layout */}
                <div className="hidden md:block border border-teal-bg rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-teal-bg">
                      <tr>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-600 w-[140px]">Metode</th>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-600 w-[160px]">Bank</th>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-600 w-[160px]">No Kartu</th>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-600 w-[140px]">Nominal</th>
                        <th className="w-[40px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((row, idx) => (
                        <tr key={idx} className="border-t border-teal-bg">
                          <td className="px-2 py-2">
                            <select
                              value={row.method}
                              onChange={(e) => {
                                const newMethod = e.target.value as PaymentRowType['method']
                                setPayments(prev => prev.map((p, i) => i === idx ? {
                                  ...p,
                                  method: newMethod,
                                  bankId: newMethod === 'cash' ? null : p.bankId,
                                  cardNumber: (newMethod === 'Debit Card' || newMethod === 'Credit Card') ? p.cardNumber : '',
                                } : p))
                              }}
                              className="w-full border border-teal-bg rounded px-2 py-1.5 text-xs"
                            >
                              <option value="cash">Cash</option>
                              <option value="transfer">Transfer</option>
                              <option value="Debit Card">Kartu Debit</option>
                              <option value="Credit Card">Kartu Kredit</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            {row.method !== 'cash' ? (
                              <select
                                value={row.bankId || ''}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || null
                                  setPayments(prev => prev.map((p, i) => i === idx ? { ...p, bankId: val } : p))
                                }}
                                className="w-full border border-teal-bg rounded px-2 py-1.5 text-xs"
                              >
                                <option value="">Pilih Bank...</option>
                                {banks.map((b:any) => (
                                  <option key={(b.id ?? b.bank_id)} value={(b.id ?? b.bank_id)}>{b.name ?? b.bank_name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {(row.method === 'Debit Card' || row.method === 'Credit Card') ? (
                              <input
                                type="text"
                                value={row.cardNumber}
                                onChange={(e) => setPayments(prev => prev.map((p, i) => i === idx ? { ...p, cardNumber: e.target.value } : p))}
                                className="w-full border border-teal-bg rounded px-2 py-1.5 text-xs"
                                placeholder="No. Kartu"
                              />
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={row.amountDisplay}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9]/g, '')
                                const n = Number(clean) || 0
                                setPayments(prev => prev.map((p, i) => i === idx ? { ...p, amount: n, amountDisplay: n? n.toLocaleString('id-ID') : '' } : p))
                              }}
                              onFocus={(e) => e.currentTarget.select()}
                              className="w-full border border-teal-bg rounded px-2 py-1.5 text-xs text-right"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            {payments.length > 1 && (
                              <button type="button" onClick={() => setPayments(prev => prev.filter((_, i) => i !== idx))} className="text-coral-primary hover:text-coral-dark text-xs" title="Hapus">✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {payments.length < 2 && (
                  <button onClick={()=> setPayments(prev=> [...prev, { method: 'transfer', amount: 0, amountDisplay: '', bankId: null, cardNumber: '' }])} className="text-[12px] text-teal-dark hover:underline">+ Tambah Cara Bayar</button>
                )}
                <div className="flex gap-2 flex-wrap">
                  {[90000, 95000, 100000, 150000].map(v=> (
                    <button key={v} onClick={()=> setPayments(prev=> prev.map((row,i)=> i===0? { ...row, amount: v, amountDisplay: v.toLocaleString('id-ID') } : row))} className="px-2.5 py-1.5 rounded-md bg-teal-bg text-xs hover:bg-teal-primary hover:text-white">{`Rp ${v.toLocaleString('id-ID')}`}</button>
                  ))}
                  <button onClick={()=> setPayments(prev=> prev.map((row,i)=> i===0? { ...row, amount: total, amountDisplay: total.toLocaleString('id-ID') } : row))} className="px-3 py-1.5 rounded-md bg-teal-bg text-teal-dark text-xs">Uang Pas</button>
                </div>
                <div className="text-xs bg-teal-bg p-2 rounded flex items-center justify-between">
                  <span className="text-slate-600">Kembalian</span>
                  <span className="font-semibold text-teal-primary">{formatCurrency(changeAmount)}</span>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t bg-surface-base rounded-b-2xl flex gap-2">
              <button onClick={()=>{ setShowPaymentModal(false); setPayments([{ method: 'cash', amount: 0, amountDisplay: '', bankId: null, cardNumber: '' }]) }} className="flex-1 bg-teal-bg hover:bg-teal-primary hover:text-white text-slate-700 py-2 rounded-pill">Batal</button>
              <button onClick={handlePayment} disabled={!multiPayValid || isPaying} className={`flex-1 py-2 rounded-pill font-semibold text-white ${(!multiPayValid || isPaying)?'bg-teal-bg/50 text-teal-dark/50 cursor-not-allowed':'bg-teal-primary hover:bg-teal-dark'}`}>{isPaying? <span className="flex items-center justify-center gap-1.5"><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Memproses...</span> : 'Bayar (RETAIL)'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
