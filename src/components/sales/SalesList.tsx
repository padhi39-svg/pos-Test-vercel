"use client"
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ActionIcons from '@/components/ActionIcons'
import { formatCurrency } from '@/lib/regionalNumber'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { useMemo, useState, useEffect } from 'react'
import { useAksesOverride, type OverrideAction } from '@/hooks/useAksesOverride'
import ModalAksesOverride from '@/components/ModalAksesOverride'
import SortIcon from '@/components/ui/SortIcon'

type Transaction = {
  id: number
  transaction_number: string
  customer_id: number | null
  customer_name: string | null
  customer_code: string | null
  subtotal: number
  discount_percent: number
  discount_amount: number
  ppn_percent: number
  ppn_amount: number
  total: number
  payment_method: string
  payment_amount: number
  change_amount: number
  card_number: string | null
  bank_id: number | null
  void: number
  status: string
  transaction_date?: string | null
  tgl_nota?: string | null
  transaction_type: number
  created_at: string
}

export default function SalesList({
  items,
  onVoid,
  onRefresh,
  canCreate,
  canEdit,
  canVoid,
  canPrint,
  canImport,
}: {
  items: Transaction[]
  onVoid: (id: number) => void | Promise<void>
  onRefresh?: () => void | Promise<void>
  canCreate?: boolean
  canEdit?: boolean
  canVoid?: boolean
  canPrint?: boolean
  canImport?: boolean
}) {
  const router = useRouter()
  const { override, setOverride, loading: aksesLoading, close: closeAkses, confirm: confirmAkses } = useAksesOverride()
  
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<
    'transaction_number' | 'customer_name' | 'subtotal' | 'discount_amount' | 'ppn_amount' | 'total' | 'payment_amount' | 'created_at'
  >('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [current, setCurrent] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [mounted, setMounted] = useState(false)
  const [deviceId, setDeviceId] = useState<string>('')
  // Configurable columns (visibility)
  const ALL_COLUMNS = [
    { key: 'transaction_number', label: 'No. Nota' },
    { key: 'created_at', label: 'Tanggal' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'discount_amount', label: 'Diskon' },
    { key: 'ppn_amount', label: 'PPN' },
    { key: 'total', label: 'Total' },
    { key: 'payment_amount', label: 'Pembayaran' },
  ] as const
  const DEFAULT_VISIBLE = ALL_COLUMNS.map(c => c.key)
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE)
  const [showColPicker, setShowColPicker] = useState(false)
  const [printerCfg, setPrinterCfg] = useState<{
    host: string
    port: number
    chars: number
    cut: boolean
    backendMode: 'server' | 'local_helper' | 'local_helper_apk' | 'browser_print'
    localHelperId?: string
  }>({
    host: '',
    port: 9100,
    chars: 48,
    cut: true,
    backendMode: 'server',
    localHelperId: '',
  })
  const [companyInfo, setCompanyInfo] = useState<{ name: string; address: string; city?: string; phone: string }>({
    name: '',
    address: '',
    city: '',
    phone: '',
  })
  const [layoutCfg, setLayoutCfg] = useState<{
    header_title: string
    show_company: '0' | '1'
    show_address: '0' | '1'
    show_phone: '0' | '1'
    show_invoice_code: '0' | '1'
    separator_char: '-' | '='
    thankyou_text: string
    align_header: 'left' | 'center'
    label_subtotal: string
    label_tax: string
    label_total: string
    label_paid: string
    label_change: string
  }>({
    header_title: '',
    show_company: '1',
    show_address: '1',
    show_phone: '1',
    show_invoice_code: '1',
    separator_char: '-',
    thankyou_text: 'Terima kasih',
    align_header: 'center',
    label_subtotal: 'Subtotal',
    label_tax: 'PPN',
    label_total: 'TOTAL',
    label_paid: 'Bayar',
    label_change: 'Kembali',
  })

  // Fix hydration error
  useEffect(() => {
    setMounted(true)
  }, [])

  // Ambil device_id dari cookie (selaras dengan halaman POS)
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

  // Load column visibility preferences
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const key = deviceId ? `sales_list.columns.visible.${deviceId}` : 'sales_list.columns.visible'
        const saved = window.localStorage.getItem(key)
        if (saved) {
          const arr = JSON.parse(saved)
          if (Array.isArray(arr) && arr.length) {
            const allowed = ['transaction_number','created_at','customer_name','subtotal','discount_amount','ppn_amount','total','payment_amount']
            const filtered = arr.filter((k: string) => allowed.includes(k))
            if (filtered.length) setVisibleCols(filtered)
          }
        }
      }
    } catch {}
  }, [deviceId])

  // Persist column visibility preferences
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const key = deviceId ? `sales_list.columns.visible.${deviceId}` : 'sales_list.columns.visible'
        window.localStorage.setItem(key, JSON.stringify(visibleCols))
      }
    } catch {}
  }, [visibleCols, deviceId])

  useEffect(() => {
    const loadPrinterAndCompany = async () => {
      try {
        const [resP, resC, resLayout] = await Promise.all([
          fetch('/api/settings?group=printer'),
          fetch('/api/settings?group=company'),
          fetch('/api/settings?group=printer_layout'),
        ])

        if (resP.ok) {
          const rows = await resP.json()
          const map: Record<string, string> = {}
          ;(rows || []).forEach((r: any) => { map[r.setting_key] = String(r.setting_value ?? '') })
          setPrinterCfg(prev => ({
            ...prev,
            host: String(map['printer_network_host'] || '').trim(),
            port: Math.max(1, Math.min(65535, parseInt(map['printer_network_port'] || '9100') || 9100)),
            chars: Math.max(24, Math.min(64, parseInt(map['printer_chars_per_line'] || '48') || 48)),
            cut: (map['printer_cut_paper'] || '1') !== '0',
            backendMode: ((): any => {
              const b = (map['printer_backend_mode'] || 'server').toString()
              if (b === 'local_helper' || b === 'local_helper_apk' || b === 'browser_print') return b as any
              return 'server'
            })(),
            localHelperId: String(map['printer_local_helper_id'] || ''),
          }))
        }

        if (resC.ok) {
          const rows = await resC.json()
          const map: Record<string, string> = {}
          ;(rows || []).forEach((r: any) => { map[r.setting_key] = String(r.setting_value ?? '') })
          setCompanyInfo({
            name: map['company_name'] || '',
            address: map['company_address'] || '',
            city: map['company_city'] || map['company_kota'] || '',
            phone: map['company_phone'] || map['company_mobile'] || '',
          })
        }

        if (resLayout.ok) {
          const data = await resLayout.json()
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
            label_subtotal: map.label_subtotal ?? prev.label_subtotal,
            label_tax: map.label_tax ?? prev.label_tax,
            label_total: map.label_total ?? prev.label_total,
            label_paid: map.label_paid ?? prev.label_paid,
            label_change: map.label_change ?? prev.label_change,
          }))
        }

        // Override dari client-settings per perangkat (jika tersedia)
        if (deviceId) {
          try {
            const resDev = await fetch(`/api/client-settings?device_id=${encodeURIComponent(deviceId)}&group=printer`)
            const data = await resDev.json().catch(() => ({}))
            if (resDev.ok && Array.isArray((data as any)?.settings)) {
              const map: Record<string,string> = {}
              ;((data as any).settings || []).forEach((row: any) => { map[row.setting_key] = String(row.setting_value ?? '') })
              const backend = String(map['printer_backend_mode'] || '').trim()
              setPrinterCfg(prev => ({
                ...prev,
                host: String(map['printer_network_host'] || prev.host || '').trim(),
                port: Math.max(1, Math.min(65535, parseInt(map['printer_network_port'] || String(prev.port || '9100')) || (prev.port || 9100))),
                chars: Math.max(24, Math.min(64, parseInt(map['printer_chars_per_line'] || String(prev.chars || '48')) || (prev.chars || 48))),
                cut: (map['printer_cut_paper'] || (prev.cut ? '1' : '0')) !== '0',
                backendMode: (backend === 'local_helper' || backend === 'local_helper_apk' || backend === 'browser_print') ? (backend as any) : prev.backendMode,
                localHelperId: String(map['printer_local_helper_id'] || prev.localHelperId || ''),
              }))
            }
          } catch {}
        }
      } catch (e) {
        console.warn('Gagal memuat konfigurasi printer POS dari list sales:', e)
      }
    }
    loadPrinterAndCompany()
  }, [deviceId])

  // filter states
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all')
  const [voidFilter, setVoidFilter] = useState<string>('all')
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    
    return items.filter(x => {
      if (q && !x.transaction_number.toLowerCase().includes(q) && 
          !(x.customer_name?.toLowerCase().includes(q)) &&
          !(x.customer_code?.toLowerCase().includes(q))) return false
      if (paymentMethodFilter !== 'all' && x.payment_method !== paymentMethodFilter) return false
      if (voidFilter !== 'all' && String(x.void) !== voidFilter) return false
      if (transactionTypeFilter !== 'all' && String(x.transaction_type || 1) !== transactionTypeFilter) return false
      return true
    })
  }, [items, query, paymentMethodFilter, voidFilter, transactionTypeFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: any = a[sortKey]
      let bVal: any = b[sortKey]
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  const total = sorted.length
  const totalPages = Math.ceil(total / pageSize) || 1
  const start = (current - 1) * pageSize
  const pageRows = sorted.slice(start, start + pageSize)

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const isVisible = (k: string) => visibleCols.includes(k)
  const toggleVisible = (k: string) => {
    setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  }
  const visibleCount = useMemo(() => visibleCols.length, [visibleCols])

  // Summary calculations
  const summary = useMemo(() => {
    const activeTransactions = items.filter(t => t.void === 0)
    return {
      totalTransactions: activeTransactions.length,
      totalSales: activeTransactions.reduce((sum, t) => sum + t.total, 0),
      totalDiscount: activeTransactions.reduce((sum, t) => sum + t.discount_amount, 0),
      voidCount: items.filter(t => t.void === 1).length,
    }
  }, [items])

  const formatReceiptCurrency = (value: number): string => {
    if (isNaN(value) || value === null || value === undefined) return 'Rp 0'
    const num = value.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    return `Rp ${num}`
  }

  type TxDetailForPrint = {
    id: number
    transaction_number: string
    created_at: string
    subtotal: number
    discount_amount: number
    ppn_amount: number
    service_charge_percent?: number
    service_charge_amount?: number
    total: number
    payment_amount: number
    change_amount: number
    payment_method?: string
    card_number?: string | null
    customer_name?: string | null
    cashier_name?: string | null
    table_id?: number | null
    notes?: string | null
    items: {
      barang_name: string
      quantity: number
      unit_price?: number
      total_price?: number
    }[]
  }

  // Unified builder: Resto layout (no Rp, '=' separators, aligned columns)
  const buildRestoReceiptText = (tx: TxDetailForPrint): string => {
    const W = printerCfg.chars
    const L: string[] = []
    const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(Math.round(Number(n) || 0))
    const center = (line: string) => {
      const pad = Math.max(0, Math.floor((W - line.length) / 2))
      return ' '.repeat(pad) + line
    }
    // Header
    if (companyInfo.name) L.push(center(String(companyInfo.name).toUpperCase()))
    if (companyInfo.address) L.push(center(String(companyInfo.address)))
    if (companyInfo.city) L.push(center(String(companyInfo.city)))
    if (companyInfo.phone) L.push(center(String(companyInfo.phone)))
    L.push(''.padEnd(W, '='))
    // Columns
    const QW = 4, SP = 1, PW = 10, TW = 12
    const NAME_W = Math.max(5, W - (QW + SP + 1 + PW + TW))
    const padLeft = (s: string, n: number) => (s.length >= n ? s.slice(-n) : ' '.repeat(n - s.length) + s)
    const padRight = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length))
    const wrap = (text: string, width: number) => {
      const words = String(text || '').split(/\s+/)
      const out: string[] = []
      let line = ''
      for (const w of words) {
        const cand = line ? line + ' ' + w : w
        if (cand.length <= width) line = cand
        else { if (line) out.push(line); line = w }
      }
      if (line) out.push(line)
      return out
    }
    const hQty = padRight('Qty', QW)
    const hName = padRight('Nama Barang', NAME_W)
    const hPrice = padLeft('Harga.Stn', PW)
    const hSub = padLeft('Total', TW)
    L.push(hQty + ' '.repeat(SP) + hName + ' ' + hPrice + hSub)
    L.push(''.padEnd(W, '='))
    let totalQty = 0
    for (const it of tx.items) {
      const qtyStr = padRight(String(it.quantity), QW)
      const unit = Number((it as any).unit_price ?? 0)
      const totalLine = Number((it as any).total_price ?? 0)
      const priceStr = fmt(unit)
      const subStr = fmt(totalLine)
      totalQty += Number(it.quantity) || 0
      const nameLines = wrap(it.barang_name, NAME_W)
      if (nameLines.length <= 1) {
        const nm = padRight(nameLines[0] || '', NAME_W)
        L.push(qtyStr + ' '.repeat(SP) + nm + ' ' + padLeft(priceStr, PW) + padLeft(subStr, TW))
      } else {
        L.push(qtyStr + ' '.repeat(SP) + nameLines[0])
        const name2 = padRight(nameLines[1], NAME_W)
        L.push(' '.repeat(QW + SP) + name2 + ' ' + padLeft(priceStr, PW) + padLeft(subStr, TW))
        for (let i = 2; i < nameLines.length; i++) L.push(' '.repeat(QW + SP) + nameLines[i])
      }
    }
    L.push(''.padEnd(W, '='))
    L.push(`Total Item  : ${fmt(totalQty)}`)
    // Totals block
    const VAL_W = 14
    const LAB_W = Math.max(10, W - VAL_W - 2)
    const lineKV = (label: string, val: string) => padLeft(label, LAB_W) + ' :' + padLeft(val, VAL_W)
    const methodName = (tx as any).payment_method ? String((tx as any).payment_method) : 'Cash'
    L.push(lineKV('Metode', methodName))
    L.push(lineKV('Subtotal', fmt(tx.subtotal)))
    L.push(lineKV('Diskon', fmt(tx.discount_amount || 0)))
    L.push(lineKV('Pb 1', fmt(tx.ppn_amount || 0)))
    // Estimasi service jika ingin ditampilkan 0
    L.push(lineKV('Service Charge', fmt(0)))
    L.push(lineKV('Total', fmt(tx.total)))
    L.push(lineKV('Bayar', fmt(tx.payment_amount)))
    L.push(lineKV('Kembali', fmt(tx.change_amount)))
    L.push(''.padEnd(W, '='))
    // Footer lengkap
    const d = new Date(tx.created_at)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth()+1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    L.push(`Tgl : ${dd}/${mm}/${yyyy}   Jam : ${hh}.${mi}`)
    if (tx.table_id != null) L.push(`Meja: ${tx.table_id}`)
    const cust = tx.customer_name || 'Umum'
    L.push(`Cust: ${cust}`)
    const waiter = tx.cashier_name || 'Umum'
    L.push(`Nama Waiter: ${waiter}`)
    if (tx.notes && String(tx.notes).trim()) L.push(`Keterangan: ${String(tx.notes)}`)
    return L.join('\n') + '\n\n\n\n\n\n'
  }

  const buildReceiptText = (tx: TxDetailForPrint): string => {
    const W = printerCfg.chars
    const lines: string[] = []
    const sep = String(layoutCfg.separator_char || '-').repeat(W)

    const wrap = (text: string, width: number) => {
      const words = String(text || '').split(/\s+/)
      const out: string[] = []
      let line = ''
      for (const w of words) {
        const cand = line ? line + ' ' + w : w
        if (cand.length <= width) line = cand
        else { if (line) out.push(line); line = w }
      }
      if (line) out.push(line)
      return out
    }

    const centerLine = (line: string) => {
      if (layoutCfg.align_header !== 'center') return line
      const pad = Math.max(0, Math.floor((W - line.length) / 2))
      return ' '.repeat(pad) + line
    }

    const pushWrapped = (text: string) => {
      const ws = wrap(text, W)
      for (const ln of ws) lines.push(centerLine(ln))
    }

    if (layoutCfg.show_company === '1' && companyInfo.name) pushWrapped(companyInfo.name.toUpperCase())
    if (layoutCfg.show_address === '1' && companyInfo.address) pushWrapped(companyInfo.address)
    if (layoutCfg.show_phone === '1' && companyInfo.phone) pushWrapped('Tel: ' + companyInfo.phone)
    lines.push(sep)

    const headerTitle = String(layoutCfg.header_title || 'NOTA PENJUALAN')
    pushWrapped(headerTitle.toUpperCase())
    if (layoutCfg.show_invoice_code === '1') pushWrapped('No: ' + (tx.transaction_number || '-'))
    pushWrapped(new Date(tx.created_at).toLocaleString('id-ID'))
    lines.push(sep)

    for (const it of tx.items) {
      const nameLines = wrap(it.barang_name, W)
      if (nameLines.length) lines.push(nameLines[0])
      const qty = it.quantity
      let unitPrice = Number((it as any).unit_price ?? 0)
      if (!unitPrice || unitPrice <= 0) {
        const q = Math.max(1, Number(it.quantity) || 1)
        const total = Number((it as any).total_price ?? 0)
        unitPrice = q > 0 ? Math.round(total / q) : total
      }
      const qtyPrice = `${qty} x ${formatReceiptCurrency(unitPrice)}`
      const totalStr = formatReceiptCurrency((it as any).total_price ?? 0)
      const left = Math.max(0, W - qtyPrice.length - totalStr.length)
      lines.push(qtyPrice + ' '.repeat(left) + totalStr)
      for (let i = 1; i < nameLines.length; i++) lines.push(nameLines[i])
    }

    lines.push(sep)

    const lblSubtotal = layoutCfg.label_subtotal || 'Subtotal'
    const lblTax = layoutCfg.label_tax || 'PPN'
    const lblTotal = layoutCfg.label_total || 'TOTAL'
    const lblPaid = layoutCfg.label_paid || 'Bayar'
    const lblChange = layoutCfg.label_change || 'Kembali'

    const paid = tx.payment_amount
    const change = tx.change_amount

    const padRight = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length))
    const padLeft = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s)

    lines.push(padRight(lblSubtotal, W - 12) + padLeft(formatReceiptCurrency(tx.subtotal), 12))
    if ((tx.discount_amount || 0) > 0) {
      lines.push(padRight('Diskon', W - 12) + padLeft('-' + formatReceiptCurrency(tx.discount_amount || 0), 12))
    }
    if ((tx.ppn_amount || 0) > 0) {
      lines.push(padRight(lblTax, W - 12) + padLeft(formatReceiptCurrency(tx.ppn_amount || 0), 12))
    }
    // Tampilkan service charge jika ada
    const svcAmt = Number((tx as any).service_charge_amount || 0)
    if (svcAmt > 0 || Number((tx as any).service_charge_percent || 0) > 0) {
      lines.push(padRight('Service Charge', W - 12) + padLeft(formatReceiptCurrency(svcAmt), 12))
    }
    lines.push(padRight(lblTotal, W - 12) + padLeft(formatReceiptCurrency(tx.total), 12))
    lines.push(padRight(lblPaid, W - 12) + padLeft(formatReceiptCurrency(paid), 12))
    lines.push(padRight(lblChange, W - 12) + padLeft(formatReceiptCurrency(change), 12))
    lines.push(sep)

    const rawFooter = String(layoutCfg.thankyou_text || 'Terima kasih')
    const footerLines = rawFooter.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    if (footerLines.length === 0) footerLines.push('Terima kasih')
    for (const fl of footerLines) {
      const ws = wrap(fl, W)
      for (const ln of ws) lines.push(centerLine(ln))
    }

    // Tambahkan footer tanggal & jam + info tambahan
    const d = new Date(tx.created_at)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth()+1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    lines.push(sep)
    lines.push(`Tgl : ${dd}/${mm}/${yyyy}   Jam : ${hh}.${mi}`)
    if ((tx as any).table_id != null) {
      lines.push(`Meja: ${(tx as any).table_id}`)
    }
    const cust = (tx as any).customer_name || 'Umum'
    lines.push(`Cust: ${cust}`)
    const waiter = (tx as any).cashier_name || 'Umum'
    lines.push(`Nama Waiter: ${waiter}`)
    const notes = (tx as any).notes
    if (notes && String(notes).trim()) {
      lines.push(`Keterangan: ${String(notes)}`)
    }
    lines.push('\n')
    return lines.join('\n')
  }

  // Builder khusus Retail: saat ini gunakan layout umum (POS Retail) yang sama dengan buildReceiptText
  // Agar mudah dikembangkan nanti (mis. penambahan label metode pembayaran), pisahkan fungsi ini.
  const buildRetailReceiptText = (tx: TxDetailForPrint): string => {
    return buildReceiptText(tx)
  }

  const handlePrintPos = async (row: Transaction) => {
    if (!printerCfg.host) {
      alert('Host printer POS belum diatur di pengaturan Printer')
      return
    }
    try {
      const res = await fetch(`/api/transactions/${row.id}`)
      if (!res.ok) {
        alert('Gagal mengambil detail transaksi untuk cetak POS')
        return
      }
      const tx = await res.json() as TxDetailForPrint
      let text = ''
      if (row.transaction_type === 1) {
        text = buildRestoReceiptText(tx)
      } else if (row.transaction_type === 2) {
        text = buildRetailReceiptText(tx)
      } else {
        text = buildReceiptText(tx)
      }
      if (!text.trim()) {
        alert('Teks struk kosong, tidak bisa mencetak')
        return
      }
      // Kirim sesuai backend mode
      let ok = true
      if (printerCfg.backendMode === 'server') {
        const printRes = await fetch('/api/print/escpos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, host: printerCfg.host, port: printerCfg.port, cut: printerCfg.cut }),
        })
        if (!printRes.ok) {
          ok = false
          let msg = 'Gagal mencetak struk POS'
          try {
            const raw = await printRes.text()
            try {
              const obj = JSON.parse(raw)
              // Tampilkan details terlebih dahulu jika ada, lebih informatif
              msg = String(obj?.details || obj?.error || msg)
              console.error('Print error response:', obj)
            } catch {
              if (raw && raw.trim()) msg = raw.trim()
              console.error('Print error raw response:', raw)
            }
          } catch (e) {
            console.error('Print error reading response:', e)
          }
          alert(msg)
        }
      } else if (printerCfg.backendMode === 'local_helper') {
        const resLH = await fetch('/api/local-helper/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, cut: printerCfg.cut, id: printerCfg.localHelperId || '' }),
        })
        ok = resLH.ok
        if (!ok) {
          const raw = await resLH.text().catch(()=>'')
          console.error('Local helper print failed:', raw)
          alert('Gagal mencetak via Local Helper')
        }
      } else if (printerCfg.backendMode === 'local_helper_apk') {
        const h = printerCfg.localHelperIp || '127.0.0.1'
        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/,'') : `http://${h.trim()}:27128`
        const apkRes = await fetch(`${baseUrl}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, cut: printerCfg.cut, id: printerCfg.localHelperId || '' }),
        })
        ok = apkRes.ok
      } else if (printerCfg.backendMode === 'browser_print') {
        ok = true
        const w = window.open('', '_blank', 'width=480,height=640')
        if (w) {
          w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap">${text.replace(/</g, '&lt;')}</pre><script>window.focus();window.print();</script>`) 
          w.document.close()
        }
      }
      if (!ok) {
        // Fallback: buka preview browser jika backend gagal
        const w = window.open('', '_blank', 'width=480,height=640')
        if (w) {
          w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap">${text.replace(/</g, '&lt;')}</pre><script>window.focus();window.print();</script>`)
          w.document.close()
        }
        return
      }
    } catch (e) {
      console.error('Gagal mencetak struk POS dari list sales:', e)
      alert('Gagal mencetak struk POS')
    }
  }

  if (!mounted) return null

  return (
    <div className="px-3 py-2 sm:px-4 sm:py-2 space-y-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">List Penjualan POS</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">Riwayat transaksi penjualan</p>
        </div>
        <div className="flex gap-2 relative md:ml-auto">
          <Link href="/pos" className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm">
            + Transaksi Baru
          </Link>
          <button
            onClick={() => window.open('/api/transactions/sales-template', '_blank')}
            className="px-3 md:px-4 py-2 bg-teal-bg text-teal-primary rounded-pill hover:bg-teal-bg transition-colors text-xs md:text-sm"
          >
            Download Template
          </button>
          <Link
            href="/transactions/import"
            className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm inline-flex items-center"
          >
            Import Excel
          </Link>
          <button onClick={() => setShowColPicker(v => !v)} className="px-3 md:px-4 py-2 border border-teal-primary text-teal-dark rounded-pill hover:bg-teal-bg transition-colors text-xs md:text-sm">
            Pilih Kolom
          </button>
          {showColPicker && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow p-2 z-10">
              <div className="text-[10px] font-bold text-slate-600 mb-2">Tampilkan Kolom</div>
              <div className="max-h-64 overflow-auto pr-1 space-y-1">
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" className="accent-teal-primary" checked={isVisible(col.key)} onChange={() => toggleVisible(col.key)} />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex justify-end">
                <button onClick={() => setShowColPicker(false)} className="text-xs px-2 py-1 rounded-pill border border-slate-300 hover:bg-slate-50">Tutup</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Transaksi</div>
          <div className="text-lg font-bold text-slate-800">{summary.totalTransactions}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Penjualan</div>
          <div className="text-sm font-bold text-teal-primary">{formatCurrency(summary.totalSales)}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Total Diskon</div>
          <div className="text-sm font-bold text-red-600">{formatCurrency(summary.totalDiscount)}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
          <div className="text-[10px] text-slate-600 mb-1 font-bold">Transaksi Void</div>
          <div className="text-lg font-bold text-slate-400">{summary.voidCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Cari</label>
            <Input
              type="text"
              placeholder="No. Nota, Customer..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-xs h-8"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Jenis POS</label>
            <Select value={transactionTypeFilter} onChange={(e) => setTransactionTypeFilter(e.target.value)} className="text-xs h-8">
              <option value="all">Semua</option>
              <option value="1">POS Resto</option>
              <option value="2">POS Retail</option>
            </Select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Metode</label>
            <Select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)} className="text-xs h-8">
              <option value="all">Semua</option>
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
              <option value="card">Kartu</option>
            </Select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Status</label>
            <Select value={voidFilter} onChange={(e) => setVoidFilter(e.target.value)} className="text-xs h-8">
              <option value="all">Semua</option>
              <option value="0">Selesai</option>
              <option value="1">Void</option>
            </Select>
          </div>
          <div className="md:col-span-1 flex flex-col md:items-end md:justify-self-end">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold text-right">Tampil</label>
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <select
                className="border border-slate-300 rounded px-2 py-1 text-xs h-8"
                value={pageSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  setPageSize(val)
                  setCurrent(1)
                }}
              >
                {[20,50,100,200].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="text-slate-600 whitespace-nowrap">per halaman</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-teal-primary text-white">
              <tr>
                {isVisible('transaction_number') && (
                <th onClick={() => toggleSort('transaction_number')} className="px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer select-none">
                  <div className="inline-flex items-center gap-1">
                    <span>No. Nota</span>
                    <SortIcon active={sortKey === 'transaction_number'} order={sortDir} className="w-3 h-3" />
                  </div>
                </th>
                )}
                {isVisible('created_at') && (
                <th onClick={() => toggleSort('created_at')} className="px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer select-none">
                  <div className="inline-flex items-center gap-1">
                    <span>Tanggal</span>
                    <SortIcon active={sortKey === 'created_at'} order={sortDir} className="w-3 h-3" />
                  </div>
                </th>
                )}
                {isVisible('customer_name') && (
                <th onClick={() => toggleSort('customer_name')} className="px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer select-none">
                  <div className="inline-flex items-center gap-1">
                    <span>Customer</span>
                    <SortIcon active={sortKey === 'customer_name'} order={sortDir} className="w-3 h-3" />
                  </div>
                </th>
                )}
                {isVisible('subtotal') && (
                <th onClick={() => toggleSort('subtotal')} className="px-3 py-2 text-right font-semibold whitespace-nowrap hidden md:table-cell cursor-pointer select-none">
                  <div className="inline-flex items-center gap-1 justify-end w-full">
                    <span>Subtotal</span>
                    <SortIcon active={sortKey === 'subtotal'} order={sortDir} className="w-3 h-3" />
                  </div>
                </th>
                )}
                {isVisible('discount_amount') && (
                <th onClick={() => toggleSort('discount_amount')} className="px-3 py-2 text-right font-semibold whitespace-nowrap hidden lg:table-cell cursor-pointer select-none">
                  <div className="inline-flex items-center gap-1 justify-end w-full">
                    <span>Diskon</span>
                    <SortIcon active={sortKey === 'discount_amount'} order={sortDir} className="w-3 h-3" />
                  </div>
                </th>
                )}
                {isVisible('ppn_amount') && (
                <th onClick={() => toggleSort('ppn_amount')} className="px-3 py-2 text-right font-semibold whitespace-nowrap hidden lg:table-cell cursor-pointer select-none">
                  <div className="inline-flex items-center gap-1 justify-end w-full">
                    <span>PPN</span>
                    <SortIcon active={sortKey === 'ppn_amount'} order={sortDir} className="w-3 h-3" />
                  </div>
                </th>
                )}
                {isVisible('total') && (
                <th onClick={() => toggleSort('total')} className="px-3 py-2 text-right font-semibold whitespace-nowrap cursor-pointer select-none">
                  <div className="inline-flex items-center gap-1 justify-end w-full">
                    <span>Total</span>
                    <SortIcon active={sortKey === 'total'} order={sortDir} className="w-3 h-3" />
                  </div>
                </th>
                )}
                {isVisible('payment_amount') && (
                <th onClick={() => toggleSort('payment_amount')} className="px-3 py-2 text-right font-semibold whitespace-nowrap hidden md:table-cell cursor-pointer select-none">
                  <div className="inline-flex items-center gap-1 justify-end w-full">
                    <span>Pembayaran</span>
                    <SortIcon active={sortKey === 'payment_amount'} order={sortDir} className="w-3 h-3" />
                  </div>
                </th>
                )}
                {/* Kolom Tipe & Status dihilangkan agar tabel lebih ringkas */}
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleCount + 1} className="px-3 py-8 text-center text-slate-500 text-sm">
                    Belum ada transaksi
                  </td>
                </tr>
              ) : (
                pageRows.map((transaction) => (
                  <tr key={transaction.id} className={`hover:bg-slate-50 ${transaction.void === 1 ? 'bg-red-50' : ''}`}>
                    {isVisible('transaction_number') && (
                      <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                        {transaction.transaction_number}
                      </td>
                    )}
                    {isVisible('created_at') && (
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {new Date(
                          (transaction.tgl_nota as string) ||
                          (transaction.transaction_date as string) ||
                          transaction.created_at,
                        ).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })} {new Date(transaction.created_at).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    )}
                    {isVisible('customer_name') && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {transaction.customer_name || 'Customer Umum'}
                        </div>
                      </td>
                    )}
                    {isVisible('subtotal') && (
                      <td className="px-3 py-2 text-right font-medium whitespace-nowrap hidden md:table-cell">{formatCurrency(transaction.subtotal)}</td>
                    )}
                    {isVisible('discount_amount') && (
                      <td className="px-3 py-2 text-right whitespace-nowrap hidden lg:table-cell">
                        <div className="text-red-600 font-medium">
                          - {formatCurrency(transaction.discount_amount)}
                        </div>
                      </td>
                    )}
                    {isVisible('ppn_amount') && (
                      <td className="px-3 py-2 text-right whitespace-nowrap hidden lg:table-cell">
                        <div className="text-teal-primary font-medium">
                          + {formatCurrency(transaction.ppn_amount)}
                        </div>
                      </td>
                    )}
                    {isVisible('total') && (
                      <td className="px-3 py-2 text-right font-bold text-teal-primary whitespace-nowrap">{formatCurrency(transaction.total)}</td>
                    )}
                    {isVisible('payment_amount') && (
                      <td className="px-3 py-2 text-right font-medium whitespace-nowrap hidden md:table-cell">{formatCurrency(transaction.payment_amount)}</td>
                    )}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <ActionIcons
                          viewHref={`/sales/${transaction.id}`}
                          showEdit={transaction.void === 0}
                          editHref={transaction.void === 0 ? `/pos/retail/${transaction.id}/edit` : undefined}
                          disabledEdit={Number((transaction as any).is_paid || 0) === 1}
                          onVoid={transaction.void === 0 ? () => onVoid(transaction.id) : undefined}
                          titleView="Lihat Detail"
                          titleEdit="Edit"
                          titleVoid="Batalkan Transaksi"
                          onPrint={() => handlePrintPos(transaction)}
                          showPrint={true}
                          titlePrint="Cetak Struk"
                          aksesOverride={{ menuCode: 'sales_list', canEdit: !!canEdit, canVoid: !!canVoid, canPrint: !!canPrint }}
                          onAksesOverride={(action) => {
                            const titles: Record<OverrideAction, string> = { edit: 'Edit', void: 'Void', print: 'Cetak' }
                            setOverride({ open: true, menuCode: 'sales_list', action, title: titles[action], onConfirmed: () => {
                              if (action === 'edit') router.push(`/pos/retail/${transaction.id}/edit`)
                              else if (action === 'void') onVoid(transaction.id)
                              else handlePrintPos(transaction)
                            }})
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-between px-3 py-2 text-xs md:text-sm gap-2">
          <div className="text-[12px] text-slate-600">
            Menampilkan {Math.min(total, start + 1)}–{Math.min(total, start + pageSize)} dari {total}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button disabled={current===1} onClick={() => setCurrent(1)} className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs">«</button>
            <button disabled={current===1} onClick={() => setCurrent(current-1)} className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs">‹</button>
            <span className="px-2 text-xs">{current} / {totalPages}</span>
            <button disabled={current===totalPages} onClick={() => setCurrent(current+1)} className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs">›</button>
            <button disabled={current===totalPages} onClick={() => setCurrent(totalPages)} className="px-2 py-1 rounded-pill border disabled:opacity-50 text-xs">»</button>
          </div>
        </div>
      </div>

      <ModalAksesOverride
        open={override?.open ?? false}
        onClose={closeAkses}
        onConfirm={confirmAkses}
        title={override?.title || ''}
        loading={aksesLoading}
      />
    </div>
  )
}
