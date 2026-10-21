"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import TableCanvas from '@/components/RestoTableCanvas'
import ScanMejaModal from '@/components/ScanMejaModal'

type TableItem = {
  id: number
  code: string
  name: string
  floor_id?: number | null
  floor_name?: string | null
  floor_code?: string | null
  zone?: string | null
  capacity?: number | null
  pos_x?: number
  pos_y?: number
  width?: number
  height?: number
  shape?: string
}

type FloorItem = {
  id: number
  name: string
  levelNo?: number | null
}

export default function PosRestoTablePage() {
  const router = useRouter()
  const [tables, setTables] = useState<TableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [floors, setFloors] = useState<FloorItem[]>([])
  const [floorLoading, setFloorLoading] = useState(true)
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null)
  const initFloorRef = useRef(false)
  const [floorBgMap, setFloorBgMap] = useState<Record<number, string>>({})
  const [chairOpacity, setChairOpacity] = useState(40)
  const [showFloorBgPicker, setShowFloorBgPicker] = useState(false)
  const [floorBgPickerFloorId, setFloorBgPickerFloorId] = useState<number | null>(null)
  const [floorBgTempColor, setFloorBgTempColor] = useState('#EFF8F7')
  const [floorBgPickerTab, setFloorBgPickerTab] = useState<'warna' | 'gambar'>('warna')
  const [floorBgTempImage, setFloorBgTempImage] = useState<string>('')
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null)
  const [guestInfo, setGuestInfo] = useState<{
    customerId: number | null
    customerName: string
    waiterId: number | null
    waiterName: string
    guestCount: string
  }>({
    customerId: null,
    customerName: '',
    waiterId: null,
    waiterName: '',
    guestCount: '1',
  })

  // Hak akses: tampilkan/hilangkan sidebar tombol aksi meja
  const [canSidebarMeja, setCanSidebarMeja] = useState<boolean>(true)
  const [canAturLayout, setCanAturLayout] = useState<boolean>(false)

  const [deviceId, setDeviceId] = useState<string>('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerOptions, setCustomerOptions] = useState<any[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerFetchKey, setCustomerFetchKey] = useState(0)
  const [waiterQuery, setWaiterQuery] = useState('')
  const [waiterOptions, setWaiterOptions] = useState<any[]>([])
  const [waiterLoading, setWaiterLoading] = useState(false)
  const [showWaiterModal, setShowWaiterModal] = useState(false)
  const [waiterFetchKey, setWaiterFetchKey] = useState(0)
  const [openTempsByTable, setOpenTempsByTable] = useState<Record<number, any>>({})
  const [openTempsLoading, setOpenTempsLoading] = useState(true)
  const [navigatingTableId, setNavigatingTableId] = useState<number | null>(null)
  const [activeTableId, setActiveTableId] = useState<number | null>(null)
  const [layoutMode, setLayoutMode] = useState(false)
  const [showLayoutModal, setShowLayoutModal] = useState(false)
  const [saveCtr, setSaveCtr] = useState(0)
  const [viewResizeKey, setViewResizeKey] = useState(0)
  const [showAddMeja, setShowAddMeja] = useState(false)
  const [addMejaForm, setAddMejaForm] = useState({ code: '', name: '', floor_id: '', capacity: '4' })

  useEffect(() => {
    if (!layoutMode && showLayoutModal) {
      setShowLayoutModal(false)
    }
  }, [layoutMode, showLayoutModal])
  const prevModalRef = useRef(false)
  useEffect(() => {
    if (prevModalRef.current && !showLayoutModal) {
      setViewResizeKey(k => k + 1)
    }
    prevModalRef.current = showLayoutModal
  }, [showLayoutModal])
  const [cancelModal, setCancelModal] = useState<{ tableId: number; tempId: number } | null>(null)
  const [actionPopupTableId, setActionPopupTableId] = useState<number | null>(null)
  const [cancelReasonModal, setCancelReasonModal] = useState<{ tableId: number; tempId: number; reason: string } | null>(null)
  const [billConfirmModal, setBillConfirmModal] = useState<{ tableId: number; tempId: number } | null>(null)
  const [showScanModal, setShowScanModal] = useState(false)
  const [moveMode, setMoveMode] = useState<{ fromTableId: number; tempId: number } | null>(null)
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMoveMode(null); setMergeMode(null) } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [])
  const [mergeMode, setMergeMode] = useState<{ fromTableId: number; tempId: number } | null>(null)
  const [navigatedToMenu, setNavigatedToMenu] = useState(false)
  const [lockInfo, setLockInfo] = useState<{ tableId: number; userName: string } | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: number | null; name: string }>({ id: null, name: '' })
  const [billPrinting, setBillPrinting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [printerCfg, setPrinterCfg] = useState<{
    autoPrint: boolean
    copies: number
    cut: boolean
    chars: number
    backendMode: 'server' | 'local_helper' | 'local_helper_apk' | 'local_helper_offline' | 'mobile_rawbt' | 'browser_print' | 'android_intent'
    host: string
    port: number
    localHelperId: string
    localHelperIp: string
    localUsbName: string
  }>({
    autoPrint: true,
    copies: 1,
    cut: true,
    chars: 48,
    backendMode: 'server',
    host: '',
    port: 9100,
    localHelperId: '',
    localHelperIp: '',
    localUsbName: '',
  })
  const [companyInfo, setCompanyInfo] = useState<{ name: string; address: string; city?: string; phone: string }>({
    name: '',
    address: '',
    city: '',
    phone: '',
  })
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

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams()
        params.set('active', '1')
        if (selectedFloorId) {
          params.set('floor_id', String(selectedFloorId))
        }
        const res = await fetch(`/api/meja?${params.toString()}`, { cache: 'no-store' })
        if (res.status === 403) {
          setError('Anda tidak punya akses melihat Master Meja.')
          setTables([])
          return
        }
        if (!res.ok) {
          setError('Gagal memuat data meja')
          setTables([])
          return
        }
        const data = await res.json()
        setTables(Array.isArray(data) ? data : (Array.isArray(data?.rows) ? data.rows : []))
      } catch (e) {
        setError('Gagal memuat data meja')
        setTables([])
      } finally {
        setLoading(false)
      }
    }
    load()

    const es = new EventSource('/api/meja-stream')
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (!Array.isArray(data)) return
        setTables(data)
      } catch {}
    }
    es.onerror = () => {}

    return () => { es.close() }
  }, [selectedFloorId])

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

  // Load current user for lock attribution
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const d = await res.json().catch(() => ({}))
        const id = d?.user?.id ? Number(d.user.id) : null
        const name = String(d?.user?.name || d?.user?.email || '').trim()
        setCurrentUser({ id, name })
      } catch {}
    })()
  }, [])

  const acquireLock = async (tableId: number): Promise<boolean> => {
    try {
      if (!tableId || !deviceId) return true // allow if no device id yet
      const res = await fetch('/api/pos/resto-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, deviceId, userId: currentUser.id, userName: currentUser.name, ttl: 120 })
      })
      if (res.status === 423) {
        const d = await res.json().catch(() => ({}))
        const lockedBy = String(d?.locked_by?.user_name || d?.locked_by?.device_id || 'pengguna lain')
        setLockInfo({ tableId, userName: lockedBy })
        return false
      }
      if (!res.ok) return false
      return true
    } catch { return false }
  }

  const handleTableAction = async (tableId: number, action: string) => {
    if (moveMode || mergeMode) return
    const ok = await acquireLock(tableId)
    if (!ok) return
    const temp = openTempsByTable[tableId]
    if (action === 'open') {
      if (temp?.id) {
        setNavigatingTableId(tableId)
        setNavigatedToMenu(true)
        router.push(`/pos/resto?temp_id=${temp.id}&table_id=${tableId}`)
      } else {
        const t = sortedTables.find(t => t.id === tableId)
        if (t) {
          setSelectedTable(t)
          setGuestInfo((prev) => ({ ...prev, guestCount: prev.guestCount || '1' }))
          setCustomerQuery('')
          setWaiterQuery('')
          setCustomerOptions([])
          setWaiterOptions([])
          setShowCustomerModal(false)
          setShowWaiterModal(false)
        }
      }
      return
    }
    if (!temp?.id) { alert('Tidak ada order aktif'); return }
    switch (action) {
      case 'pay':
        setNavigatingTableId(tableId)
        setNavigatedToMenu(true)
        router.push(`/pos/resto?table_id=${tableId}&from=table&open_pay=1`)
        break
      case 'move':
        setMoveMode({ fromTableId: tableId, tempId: temp.id })
        break
      case 'merge':
        setMergeMode({ fromTableId: tableId, tempId: temp.id })
        break
      case 'print':
        setBillConfirmModal({ tableId, tempId: temp.id })
        break
      case 'cancel':
        setCancelModal({ tableId, tempId: temp.id })
        break
    }
  }

  const handleScanResult = (raw: string) => {
    let code = (raw || '').trim()
    const m = code.match(/\/q\/([^/?#]+)/)
    if (m) code = decodeURIComponent(m[1])
    code = code.toUpperCase()
    const t = sortedTables.find((x) => String(x.code || '').toUpperCase() === code)
    if (!t) {
      alert(`Meja tidak ditemukan: ${code}`)
      return
    }
    setShowScanModal(false)
    setActiveTableId(t.id)
    const temp = openTempsByTable[t.id]
    if (temp?.id) {
      setActionPopupTableId(t.id)
    } else {
      setSelectedTable(t)
      setGuestInfo((prev) => ({ ...prev, guestCount: prev.guestCount || '1' }))
      setCustomerQuery('')
      setWaiterQuery('')
      setCustomerOptions([])
      setWaiterOptions([])
      setShowCustomerModal(false)
      setShowWaiterModal(false)
    }
  }

  useEffect(() => {
    const loadFloors = async () => {
      try {
        setFloorLoading(true)
        const res = await fetch('/api/floors?active=1&sort_by=levelNo&sort_dir=asc', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        let floorList: any[] = []
        if (Array.isArray(data)) {
          floorList = data
        } else if (data && Array.isArray(data.rows)) {
          floorList = data.rows
        }
        floorList.sort((a, b) => (a.levelNo ?? 999) - (b.levelNo ?? 999))
        setFloors(floorList)
      } finally {
        setFloorLoading(false)
      }
    }
    loadFloors()
  }, [])

  const sortedFloors = useMemo(() => {
    return [...floors].sort((a, b) => (a.levelNo ?? 999) - (b.levelNo ?? 999))
  }, [floors])

  useEffect(() => {
    if (sortedFloors.length > 0 && !initFloorRef.current) {
      initFloorRef.current = true
      setSelectedFloorId(sortedFloors[0].id)
    }
  }, [sortedFloors])

  const sortedTables = useMemo(() => {
    return [...tables].sort((a, b) => a.code.localeCompare(b.code))
  }, [tables])

  // Load dynamic permission untuk sidebar meja & atur layout (menu: pos_resto_table)
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const d = await res.json().catch(() => ({}))
        const dyn = Array.isArray(d?.user?.dynamicPermissions) ? (d.user.dynamicPermissions as any[]) : []
        const hasSidebar = dyn.some((p: any) =>
          String(p.menuCode || p.menu_code || '').toLowerCase().trim() === 'pos_resto_table' &&
          String(p.permissionCode || p.permission_code || '').toUpperCase() === 'SIDEBAR_MEJA' &&
          Number(p.allowed) === 1,
        )
        const hasLayout = dyn.some((p: any) =>
          String(p.menuCode || p.menu_code || '').toLowerCase().trim() === 'pos_resto_table' &&
          String(p.permissionCode || p.permission_code || '').toUpperCase() === 'ATUR_LAYOUT' &&
          Number(p.allowed) === 1,
        )
        setCanSidebarMeja(hasSidebar)
        setCanAturLayout(hasLayout)
      } catch {
        setCanSidebarMeja(true)
        setCanAturLayout(false)
      }
    })()
  }, [])

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        if (!guestInfo.customerId && !guestInfo.customerName) {
          const res = await fetch('/api/customer/1')
          if (res.ok) {
            const c = await res.json()
            if (c && c.id) {
              setGuestInfo((prev) => ({
                ...prev,
                customerId: Number(c.id),
                customerName: String(c.name || c.code || '').trim(),
              }))
            }
          }
        }
      } catch {}
      try {
        if (!guestInfo.waiterId && !guestInfo.waiterName) {
          const res = await fetch('/api/sales/1')
          if (res.ok) {
            const s = await res.json()
            if (s && s.id) {
              setGuestInfo((prev) => ({
                ...prev,
                waiterId: Number(s.id),
                waiterName: String(s.name || s.code || '').trim(),
              }))
            }
          }
        }
      } catch {}
    }
    loadDefaults()
  }, [])

  // Muat daftar temp order open untuk menandai meja yang sedang dipakai
  useEffect(() => {
    const loadOpenTemps = async () => {
      try {
        setOpenTempsLoading(true)
        const res = await fetch('/api/pos/resto-temp', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!Array.isArray(data)) return
        const map: Record<number, any> = {}
        data.forEach((row: any) => {
          const tid = Number(row.table_id || 0)
          if (!tid) return
          map[tid] = row
        })
        setOpenTempsByTable(map)
      } catch {
      } finally {
        setOpenTempsLoading(false)
      }
    }
    loadOpenTemps()

    const es = new EventSource('/api/pos/resto-temp-stream')
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (!Array.isArray(data)) return
        const map: Record<number, any> = {}
        data.forEach((row: any) => {
          const tid = Number(row.table_id || 0)
          if (!tid) return
          map[tid] = row
        })
        setOpenTempsByTable(map)
      } catch {
      }
    }
    es.onerror = () => {}

    return () => { es.close() }
  }, [])

  // Fungsi refresh manual untuk memperbarui data meja dan status order
  const handleRefresh = async () => {
    if (refreshing) return
    try {
      setRefreshing(true)
      // Refresh meja
      const params = new URLSearchParams()
      params.set('active', '1')
      if (selectedFloorId) {
        params.set('floor_id', String(selectedFloorId))
      }
      const [mejaRes, tempRes] = await Promise.all([
        fetch(`/api/meja?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/pos/resto-temp', { cache: 'no-store' }),
      ])
      if (mejaRes.ok) {
        const data = await mejaRes.json()
        setTables(Array.isArray(data) ? data : (Array.isArray(data?.rows) ? data.rows : []))
      }
      if (tempRes.ok) {
        const data = await tempRes.json()
        if (Array.isArray(data)) {
          const map: Record<number, any> = {}
          data.forEach((row: any) => {
            const tid = Number(row.table_id || 0)
            if (!tid) return
            map[tid] = row
          })
          setOpenTempsByTable(map)
        }
      }
      // Bersihkan lock yang nyantol: jika ada lock tapi tidak ada temp order aktif untuk meja tsb
      try {
        const locksRes = await fetch('/api/pos/resto-locks-list', { cache: 'no-store' })
        if (locksRes.ok) {
          const locks = await locksRes.json()
          if (Array.isArray(locks)) {
            for (const l of locks) {
              const tid = Number(l.table_id || 0)
              if (!tid) continue
              const hasTemp = !!openTempsByTable[tid]
              if (!hasTemp) {
                const url = `/api/pos/resto-lock?table_id=${encodeURIComponent(String(tid))}&device_id=${encodeURIComponent(String(l.device_id || ''))}`
                await fetch(url, { method: 'DELETE' })
              }
            }
          }
        }
      } catch {}
    } catch {
      // abaikan error
    } finally {
      setRefreshing(false)
    }
  }

  // Prefetch data untuk POS Resto agar saat klik "Lanjut ke POS" menu bisa muncul lebih cepat
  useEffect(() => {
    const prefetchPosRestoData = async () => {
      try {
        const [barangResponse, customerResponse, kategoriResponse, banksResponse, settingsResponse, mejaResponse] = await Promise.all([
          fetch('/api/barang'),
          fetch('/api/customer'),
          fetch('/api/kategori'),
          fetch('/api/banks'),
          fetch('/api/settings?group=penjualan'),
          fetch('/api/meja?active=1'),
        ])
        if (!barangResponse.ok || !customerResponse.ok || !kategoriResponse.ok || !banksResponse.ok || !settingsResponse.ok || !mejaResponse.ok) {
          return
        }
        const barangData = await barangResponse.json()
        const customerData = await customerResponse.json()
        const kategoriData = await kategoriResponse.json()
        const banksData = await banksResponse.json()
        const settingsRows = await settingsResponse.json()
        const mejaData = await mejaResponse.json()

        if (typeof window !== 'undefined') {
          try {
            const payload = {
              barangData,
              customerData,
              kategoriData,
              banksData,
              settingsRows,
              mejaData,
            }
            window.localStorage.setItem('pos_resto_initial_data', JSON.stringify(payload))
          } catch {}
        }
      } catch {
        // prefetch gagal tidak apa-apa, hanya fitur percepatan
      }
    }
    prefetchPosRestoData()
  }, [])

  useEffect(() => {
    const load = async () => {
      const q = customerQuery.trim()
      try {
        setCustomerLoading(true)
        const res = await fetch(`/api/customer?q=${encodeURIComponent(q)}`)
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data?.rows || [])
        setCustomerOptions(list.slice(0, 20))
      } catch {
        setCustomerOptions([])
      } finally {
        setCustomerLoading(false)
      }
    }
    const handle = setTimeout(load, 250)
    return () => clearTimeout(handle)
  }, [customerQuery, customerFetchKey])

  useEffect(() => {
    const load = async () => {
      const q = waiterQuery.trim()
      try {
        setWaiterLoading(true)
        const res = await fetch(`/api/sales?q=${encodeURIComponent(q)}`)
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data?.rows || [])
        setWaiterOptions(list.slice(0, 20))
      } catch {
        setWaiterOptions([])
      } finally {
        setWaiterLoading(false)
      }
    }
    const handle = setTimeout(load, 250)
    return () => clearTimeout(handle)
  }, [waiterQuery, waiterFetchKey])

  const wrap = (text: string, width: number) => {
    const words = String(text || '').split(/\s+/)
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const cand = line ? line + ' ' + w : w
      if (cand.length <= width) line = cand
      else {
        if (line) lines.push(line)
        line = w
      }
    }
    if (line) lines.push(line)
    return lines
  }

  const padRight = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length))
  const padLeft = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s)

  const formatReceiptCurrency = (value: number): string => {
    if (isNaN(value) || value === null || value === undefined) return 'Rp 0'
    const num = value.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    return `Rp ${num}`
  }

  useEffect(() => {
    const loadPrinter = async () => {
      try {
        const [resCompany, resLayout] = await Promise.all([
          fetch('/api/settings?group=company'),
          fetch('/api/settings?group=printer_layout'),
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
              setPrinterCfg((prev) => ({
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
                localHelperIp: String(map['printer_local_helper_ip'] || ''),
                localUsbName: String(map['printer_local_usb_name'] || ''),
              }))
            }
          } catch {}
        }

        if (resCompany.ok) {
          const rows = await resCompany.json()
          const map: Record<string, string> = {}
          ;(rows || []).forEach((r: any) => {
            map[r.setting_key] = String(r.setting_value ?? '')
          })
          setCompanyInfo({
            name: map['company_name'] || '',
            address: map['company_address'] || '',
            city: map['company_city'] || map['company_kota'] || '',
            phone: map['company_phone'] || map['company_mobile'] || '',
          })
        }

        if (resLayout.ok) {
          const rows = await resLayout.json()
          const map: Record<string, string> = {}
          ;(rows || []).forEach((r: any) => {
            map[r.setting_key] = String(r.setting_value ?? '')
          })
          setLayoutCfg((prev) => ({
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
      } catch {
        // abaikan error, hanya untuk printing bill sementara
      }
    }
    loadPrinter()
  }, [deviceId])

  useEffect(() => {
    const loadFloorBg = async () => {
      try {
        const res = await fetch('/api/settings?group=floor_bg', { cache: 'no-store' })
        if (!res.ok) return
        const rows: any[] = await res.json()
        const map: Record<number, string> = {}
        for (const r of rows) {
          const key = String(r.setting_key || '')
          const val = String(r.setting_value || '')
          const match = key.match(/^floor_bg_(\d+)$/)
          if (match) map[Number(match[1])] = val
        }
        setFloorBgMap(map)
      } catch {}
    }
    loadFloorBg()

    const loadChairOpacity = async () => {
      try {
        const res = await fetch('/api/settings?group=resto_layout', { cache: 'no-store' })
        if (!res.ok) return
        const rows: any[] = await res.json()
        const row = rows.find((r: any) => r.setting_key === 'resto_chair_opacity')
        if (row) setChairOpacity(Number(row.setting_value) || 40)
      } catch {}
    }
    loadChairOpacity()
  }, [])

  const counts = useMemo(() => {
    const filtered = selectedFloorId
      ? sortedTables.filter(t => (t.floor_id ?? 0) === selectedFloorId)
      : sortedTables
    let avail = 0, inuse = 0, bill = 0
    for (const t of filtered) {
      const temp = openTempsByTable[t.id]
      if (!temp) { avail++; continue }
      if (temp.status === 'bill') bill++
      else inuse++
    }
    return { avail, inuse, bill }
  }, [sortedTables, openTempsByTable, selectedFloorId])

  const pageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = pageRef.current
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
    <div ref={pageRef} className="relative space-y-3 p-2 md:p-3 overflow-hidden flex flex-col" style={{ background: '#EFF8F7' }}>

      <div className="flex items-center justify-between gap-2 flex-wrap px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-green-50 rounded-xl border border-green-200 px-3 py-1.5 shadow-[0_4px_20px_rgba(43,168,162,0.08)]">
            <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 2v4M16 2v4"/><path d="M3 10h18"/></svg>
            <span className="text-base font-bold text-green-700">{counts.avail}</span>
            <span className="text-[11px] text-green-600">Available</span>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 rounded-xl border border-amber-200 px-3 py-1.5 shadow-[0_4px_20px_rgba(43,168,162,0.08)]">
            <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="text-base font-bold text-amber-700">{counts.inuse}</span>
            <span className="text-[11px] text-amber-600">In Use</span>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 rounded-xl border border-blue-200 px-3 py-1.5 shadow-[0_4px_20px_rgba(43,168,162,0.08)]">
            <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span className="text-base font-bold text-blue-700">{counts.bill}</span>
            <span className="text-[11px] text-blue-600">Bill</span>
          </div>
        </div>
        {(() => {
        const step = (n: number, label: string) => {
          const on = n === 1 ? !!activeTableId : n === 2 ? (!!selectedTable && !!guestInfo.customerId) || navigatedToMenu : navigatedToMenu
          return (
            <span className={`flex items-center gap-1.5 transition-colors ${on ? 'text-teal-primary font-semibold' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${on ? 'bg-teal-primary text-white' : 'bg-slate-200 text-slate-500'}`}>{n}</span>
              {label}
            </span>
          )
        }
        return (
        <div className="flex items-center gap-3 text-xs md:text-sm text-slate-500">
          <span className="font-semibold text-teal-primary">Alur:</span>
          {step(1, 'Pilih Meja')}
          <span className="text-slate-300">→</span>
          {step(2, 'Pilih Customer')}
          <span className="text-slate-300">→</span>
          {step(3, 'Pilih Menu')}
        </div>
        )
      })()}
        <div className="flex items-center gap-4 px-4 py-2 bg-white/90 backdrop-blur rounded-full shadow-card border border-teal-bg text-sm text-slate-600 w-fit">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10B981' }} /> Available</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F59E0B' }} /> In Use</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#5DADE2' }} /> Bill</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-start md:items-center gap-1 md:gap-2 flex-wrap">
        <div className="flex items-center gap-1 md:gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-[10px] md:text-[11px] text-slate-600">
            <span className="hidden md:inline">Lantai</span>
            <select
              className="border-2 border-teal-primary rounded-full px-3 py-1.5 text-[11px] md:text-xs text-teal-primary font-semibold bg-white min-w-[140px] md:min-w-[180px] cursor-pointer"
              value={String(selectedFloorId ?? '')}
              onChange={(e) => {
                const v = e.target.value
                setSelectedFloorId(v ? Number(v) : (sortedFloors[0]?.id ?? null))
              }}
              disabled={floorLoading}
            >
              {floorLoading ? <option value="">Memuat...</option> : sortedFloors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          {canAturLayout && (
          <button
            onClick={() => { if (moveMode || mergeMode) return; setSaveCtr(0); setLayoutMode(true); setShowLayoutModal(true) }}
            className={`inline-flex items-center gap-1 rounded-full text-[10px] md:text-xs font-semibold px-3 md:px-4 py-1.5 transition-all active:scale-95 ${moveMode || mergeMode ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none' : 'bg-white text-teal-primary border-2 border-teal-primary hover:bg-teal-bg shadow-teal-glow'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            Atur Layout
          </button>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || !!moveMode || !!mergeMode}
            className="inline-flex items-center gap-1 rounded-full bg-[#5DADE2] hover:bg-[#4A9FD1] disabled:bg-[#9CC9E8] text-white text-[10px] md:text-xs font-semibold px-3 md:px-4 py-1.5 transition-all active:scale-95 shadow-[0_4px_16px_rgba(93,173,226,0.4)]"
            title="Refresh status meja"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? 'Memuat...' : 'Refresh'}
          </button>
          <button
            type="button"
            className={`inline-flex items-center rounded-full text-[10px] md:text-xs font-semibold px-3 md:px-4 py-1.5 transition-all active:scale-95 shadow-teal-glow ${moveMode || mergeMode ? 'bg-teal-primary/40 text-white cursor-not-allowed shadow-none' : 'bg-teal-primary hover:bg-teal-dark text-white'}`}
            onClick={() => {
              if (moveMode || mergeMode) return
              setNavigatedToMenu(true)
              router.push('/pos/resto?from=takeaway')
            }}
          >
            TAKE AWAY
          </button>
          <button
            type="button"
            onClick={() => setShowScanModal(true)}
            disabled={!!moveMode || !!mergeMode}
            className={`inline-flex items-center gap-1 rounded-full text-[10px] md:text-xs font-semibold px-3 md:px-4 py-1.5 transition-all active:scale-95 ${moveMode || mergeMode ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none' : 'bg-white text-teal-primary border-2 border-teal-primary hover:bg-teal-bg shadow-teal-glow'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18v14H3zM3 9h18M7 5v14" /></svg>
            Scan Meja
          </button>
          {(moveMode || mergeMode) ? (
            <span className="px-2 md:px-3 py-1.5 rounded-pill border border-slate-200 text-[10px] md:text-xs text-slate-400 bg-slate-50 cursor-not-allowed whitespace-nowrap">
              Kelola Master Meja
            </span>
          ) : (
          <Link
            href="/meja"
            className="px-2 md:px-3 py-1.5 rounded-pill border border-slate-300 text-[10px] md:text-xs text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Kelola Master Meja
          </Link>
          )}
        </div>
      </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 md:p-4 flex-1 min-h-0 overflow-auto flex flex-col">
      {lockInfo && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-lg shadow-xl w-full md:max-w-sm md:mx-4 mt-20 md:mt-0">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800">Meja Terkunci</h2>
            </div>
            <div className="px-4 py-3 text-xs text-slate-700">
              Meja {tables.find((x)=>x.id===lockInfo.tableId)?.code || lockInfo.tableId} sedang dibuka oleh <span className="font-semibold">{lockInfo.userName}</span>.
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                className="px-3 py-1.5 rounded-md bg-slate-700 text-white text-xs"
                onClick={() => setLockInfo(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 flex-1 min-h-0 overflow-auto pb-28 md:pb-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            {moveMode && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-pill text-xs text-teal-700">
                <span className="font-semibold">Mode Pindah Meja</span>
                <span className="text-teal-500">—</span>
                <span>Klik meja <span className="font-semibold">Available</span> di lantai yang sama untuk memindahkan order dari <span className="font-semibold">{tables.find(t => t.id === moveMode.fromTableId)?.code || 'meja asal'}</span></span>
                <button type="button" onClick={() => setMoveMode(null)} className="ml-auto text-teal-600 hover:text-teal-800 font-semibold underline">Batal</button>
              </div>
            )}
            {mergeMode && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-pill text-xs text-indigo-700">
                <span className="font-semibold">Mode Gabung Meja</span>
                <span className="text-indigo-500">—</span>
                <span>Klik meja tujuan di lantai yang sama untuk menggabungkan order dari <span className="font-semibold">{tables.find(t => t.id === mergeMode.fromTableId)?.code || 'meja asal'}</span></span>
                <button type="button" onClick={() => setMergeMode(null)} className="ml-auto text-indigo-600 hover:text-indigo-800 font-semibold underline">Batal</button>
              </div>
            )}
            {error ? (
              <div className="py-4 text-center text-xs text-red-600">{error}</div>
            ) : loading && sortedTables.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-6 w-6 border-2 border-slate-300 border-t-[#2BA8A2] rounded-full animate-spin"></div>
                  <span className="text-xs text-slate-500">Memuat data meja...</span>
                </div>
              </div>
            ) : sortedTables.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Belum ada data meja aktif pada filter ini. Tambahkan meja di menu <span className="font-semibold">Master Meja</span> terlebih dahulu.
              </div>
            ) : (
              <div className="relative flex-1 min-h-0">
                {loading && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/60 rounded-lg">
                    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow border border-slate-200">
                      <div className="h-4 w-4 border-2 border-slate-300 border-t-[#2BA8A2] rounded-full animate-spin"></div>
                      <span className="text-xs text-slate-500">Memuat...</span>
                    </div>
          </div>
          )}
                <TableCanvas key={'view-table-' + viewResizeKey}
                  tables={sortedTables}
                  openTempsByTable={openTempsByTable}
                  activeTableId={activeTableId}
                  moveMode={moveMode}
                  mergeMode={mergeMode}
                  floorBgMap={floorBgMap}
                  editing={false}
                  onTableClick={(t) => {
                    if (moveMode) {
                      if (!t) { setMoveMode(null); return }
                      if (t.id === moveMode.fromTableId) return
                      const sourceTable = sortedTables.find(s => s.id === moveMode.fromTableId)
                      if (!sourceTable) { setMoveMode(null); return }
                      if (sourceTable.floor_id !== t.floor_id) { alert('Pindah meja hanya bisa dilakukan di lantai yang sama.'); return }
                      const temp = openTempsByTable[t.id]
                      const isBill = temp?.status === 'bill'
                      const isOccupied = !!temp && !isBill
                      if (isOccupied || isBill) return
                      const sourceTemp = openTempsByTable[moveMode.fromTableId]
                      if (!sourceTemp || !sourceTemp.id) { setMoveMode(null); alert('Order asal tidak ditemukan.'); return }
                      ;(async () => {
                        try {
                          const res = await fetch('/api/pos/resto-temp', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: sourceTemp.id, newTableId: t.id }),
                          })
                          const data = await res.json().catch(() => null)
                          if (!res.ok) { throw new Error(data?.error || 'Gagal memindahkan order ke meja tujuan') }
                          setOpenTempsByTable((prev) => {
                            const copy = { ...prev }; const origin = copy[moveMode.fromTableId]; delete copy[moveMode.fromTableId]; copy[t.id] = { ...(origin || {}), table_id: t.id }; return copy
                          })
                          setActiveTableId(t.id)
                          setMoveMode(null)
                        } catch (e: any) { alert(e?.message || 'Terjadi kesalahan saat pindah meja'); setMoveMode(null) }
                      })()
                      return
                    }
                    if (mergeMode) {
                      if (!t) { setMergeMode(null); return }
                      if (t.id === mergeMode.fromTableId) return
                      const sourceTable = sortedTables.find(s => s.id === mergeMode.fromTableId)
                      if (!sourceTable) { setMergeMode(null); return }
                      if (sourceTable.floor_id !== t.floor_id) { alert('Gabung meja hanya bisa dilakukan di lantai yang sama.'); return }
                      const sourceTemp = openTempsByTable[mergeMode.fromTableId]
                      if (!sourceTemp || !sourceTemp.id) { setMergeMode(null); alert('Order asal tidak ditemukan.'); return }
                      ;(async () => {
                        try {
                          const res = await fetch('/api/pos/resto-merge', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sourceTableId: mergeMode.fromTableId, targetTableId: t.id }),
                          })
                          const data = await res.json().catch(() => null)
                          if (!res.ok) { throw new Error(data?.error || 'Gagal menggabungkan order ke meja tujuan') }
                          setMergeMode(null)
                          await handleRefresh()
                          setActiveTableId(t.id)
                        } catch (e: any) { alert(e?.message || 'Terjadi kesalahan saat gabung meja'); setMergeMode(null) }
                      })()
                      return
                    }
                    if (t?.id) {
                      setActiveTableId(t.id)
                      setActionPopupTableId(t.id)
                    } else {
                      setActiveTableId(null)
                    }
                  }}
                  onTableDoubleClick={async (t) => {
                    const ok = await acquireLock(t.id)
                    if (!ok) return
                    const targetTemp = openTempsByTable[t.id]
                    const occupiedNow = !!targetTemp
                    if (occupiedNow && targetTemp?.id) {
                      setNavigatingTableId(t.id)
                      setNavigatedToMenu(true)
                      router.push(`/pos/resto?temp_id=${targetTemp.id}&table_id=${t.id}`)
                      return
                    }
                    setSelectedTable(t)
                    setGuestInfo((prev) => ({ ...prev, guestCount: prev.guestCount || '1' }))
                    setCustomerQuery('')
                    setWaiterQuery('')
                    setCustomerOptions([])
                    setWaiterOptions([])
                    setShowCustomerModal(false)
                    setShowWaiterModal(false)
                  }}
                  onSave={async () => {}}
                  selectedFloorId={selectedFloorId}
                  floors={floors}
                  navigatingTableId={navigatingTableId}
                  chairOpacity={chairOpacity}
                />
              </div>
            )}
          </div>
        </div>

      {actionPopupTableId && (() => {
        const t = sortedTables.find(t => t.id === actionPopupTableId)
        if (!t) return null
        const hasTemp = !!openTempsByTable[actionPopupTableId]
        return (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50" onClick={() => setActionPopupTableId(null)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-xs mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="font-semibold text-base text-slate-800">{t.code} — {t.name}</span>
                <button type="button" onClick={() => setActionPopupTableId(null)} className="text-slate-400 hover:text-slate-600 p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-3 space-y-2">
                <button type="button"
                  onClick={() => { setActionPopupTableId(null); handleTableAction(actionPopupTableId, 'open') }}
                  className="w-full px-4 py-3 rounded-full text-sm font-semibold text-white bg-teal-primary hover:bg-teal-dark active:scale-95 transition-all text-center shadow-[0_4px_20px_rgba(43,168,162,0.4)]"
                >
                  Buka Meja
                </button>
                {hasTemp && <>
                  <button type="button"
                    onClick={() => { setActionPopupTableId(null); handleTableAction(actionPopupTableId, 'pay') }}
                    className="w-full px-4 py-3 rounded-full text-sm font-semibold text-white bg-[#FFD23F] hover:bg-[#E6B800] active:scale-95 transition-all text-center shadow-[0_4px_20px_rgba(255,210,63,0.45)] text-slate-900"
                  >
                    Bayar
                  </button>
                  <button type="button"
                    onClick={() => { setActionPopupTableId(null); handleTableAction(actionPopupTableId, 'move') }}
                    className="w-full px-4 py-3 rounded-full text-sm font-semibold text-white bg-teal-primary hover:bg-teal-dark active:scale-95 transition-all text-center shadow-[0_4px_20px_rgba(43,168,162,0.4)]"
                  >
                    Pindah Meja
                  </button>
                  <button type="button"
                    onClick={() => { setActionPopupTableId(null); handleTableAction(actionPopupTableId, 'merge') }}
                    className="w-full px-4 py-3 rounded-full text-sm font-semibold text-white active:scale-95 transition-all text-center shadow-[0_4px_20px_rgba(255,162,108,0.4)]"
                    style={{ backgroundColor: '#2BA8A2' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1E8C86')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#2BA8A2')}
                  >
                    Gabung Meja
                  </button>
                  <button type="button"
                    onClick={() => { setActionPopupTableId(null); handleTableAction(actionPopupTableId, 'print') }}
                    className="w-full px-4 py-3 rounded-full text-sm font-semibold text-white bg-[#5DADE2] hover:bg-[#4A9FD1] active:scale-95 transition-all text-center shadow-[0_4px_16px_rgba(93,173,226,0.4)]"
                  >
                    Cetak Struk
                  </button>
                  <button type="button"
                    onClick={() => { setActionPopupTableId(null); handleTableAction(actionPopupTableId, 'cancel') }}
                    className="w-full px-4 py-3 rounded-full text-sm font-semibold text-white bg-teal-primary hover:bg-teal-dark active:scale-95 transition-all text-center shadow-teal-glow"
                  >
                    Cancel
                  </button>
                </>}
              </div>
            </div>
          </div>
        )
      })()}

      {showLayoutModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full md:max-w-[90vw] md:max-h-[90vh] mx-2 md:mx-4 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
            <button type="button" onClick={() => { setLayoutMode(false) }}
              className="text-slate-500 hover:text-slate-700 p-1.5">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <span className="font-semibold text-base text-slate-800">Atur Layout</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-500">Lantai</span>
              <select
                className="border-2 border-teal-primary rounded-full px-3 py-1.5 text-xs text-teal-primary font-semibold bg-white min-w-[140px] cursor-pointer"
                value={String(selectedFloorId ?? '')}
                onChange={(e) => {
                  const v = e.target.value
                  setSelectedFloorId(v ? Number(v) : (sortedFloors[0]?.id ?? null))
                }}
              disabled={floorLoading || !!moveMode || !!mergeMode}
              >
                {sortedFloors.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => {
                const fid = selectedFloorId || (sortedFloors.length > 0 ? sortedFloors[0].id : 0)
                setFloorBgPickerFloorId(fid)
                const cur = floorBgMap[fid] || ''
                if (cur.startsWith('url(')) {
                  setFloorBgPickerTab('gambar')
                  const dataUrl = cur.slice(4, -1)
                  setFloorBgTempImage(dataUrl)
                  setFloorBgTempColor('#EFF8F7')
                } else {
                  setFloorBgPickerTab('warna')
                  setFloorBgTempColor(cur || '#EFF8F7')
                  setFloorBgTempImage('')
                }
                setShowFloorBgPicker(true)
              }}
                className="px-3 py-2 rounded-full text-sm font-semibold border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 transition-all flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Background
              </button>
              <button type="button" onClick={async () => {
                setSaveCtr(c => c + 1)
                try {
                  await fetch('/api/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: [{ key: 'resto_chair_opacity', value: String(chairOpacity), group: 'resto_layout' }] }),
                  })
                } catch {}
                setTimeout(() => setLayoutMode(false), 0)
              }}
                className="bg-[#FFD23F] hover:bg-[#E6B800] text-slate-900 rounded-full px-5 py-2 text-sm font-semibold active:scale-95 transition-all shadow-[0_4px_20px_rgba(255,210,63,0.4)]">
                Simpan
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
            <span className="text-xs text-slate-500">Transparansi Kursi</span>
            <input type="range" min="0" max="100" value={chairOpacity}
              onChange={(e) => setChairOpacity(Number(e.target.value))}
              className="w-32 h-1.5 appearance-none bg-slate-200 rounded-full cursor-pointer accent-teal-primary"
            />
            <span className="text-xs font-semibold text-slate-700 w-8">{chairOpacity}%</span>
          </div>
          <div className="flex-1 p-4 overflow-auto min-h-0">
            <TableCanvas
              tables={sortedTables}
              openTempsByTable={openTempsByTable}
              activeTableId={activeTableId}
              moveMode={moveMode}
              mergeMode={mergeMode}
              floorBgMap={floorBgMap}
              editing={layoutMode}
              onTableClick={(t) => setActiveTableId(t?.id ?? null)}
              onTableDoubleClick={async () => {}}
              chairOpacity={chairOpacity}
              saveTrigger={saveCtr}
              onSave={async (layouts) => {
                setTables(prev => prev.map(t => {
                  const l = layouts.find((x: any) => x.id === t.id)
                  return l ? { ...t, pos_x: l.pos_x, pos_y: l.pos_y, width: l.width, height: l.height, shape: l.shape } : t
                }))
                try {
                  const res = await fetch('/api/meja/layout', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ layouts }),
                  })
                  if (!res.ok) { const errBody = await res.json().catch(() => ({})); throw new Error(errBody.error || `HTTP ${res.status}`) }
                } catch (e: any) {
                  alert('Gagal menyimpan layout: ' + (e.message || ''))
                }
              }}
              selectedFloorId={selectedFloorId}
              floors={floors}
              navigatingTableId={navigatingTableId}
            />
          </div>
          </div>
        </div>
      )}

      {showFloorBgPicker && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[60]" onClick={() => setShowFloorBgPicker(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-slate-800 mb-3">
              Background {sortedFloors.find(f => f.id === floorBgPickerFloorId)?.name || 'Lantai'}
            </div>
            <div className="flex gap-1 mb-3 bg-slate-100 rounded-pill p-0.5">
              <button type="button" onClick={() => setFloorBgPickerTab('warna')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-pill transition-all ${floorBgPickerTab === 'warna' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Warna
              </button>
              <button type="button" onClick={() => setFloorBgPickerTab('gambar')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-pill transition-all ${floorBgPickerTab === 'gambar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Gambar
              </button>
            </div>
            {floorBgPickerTab === 'warna' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input type="color" value={floorBgTempColor}
                    onChange={(e) => setFloorBgTempColor(e.target.value)}
                    className="w-12 h-12 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                  />
                  <input type="text" value={floorBgTempColor}
                    onChange={(e) => setFloorBgTempColor(e.target.value)}
                    className="flex-1 border border-slate-300 rounded-pill px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['#EFF8F7', '#FFF8E7', '#FFF0F0', '#F0F4FF', '#F5F0FF', '#F0FFF4', '#FFF5EB', '#F0FAFF', '#FAFAFA', '#FFFFFF'].map(c => (
                    <button key={c} type="button" onClick={() => setFloorBgTempColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${floorBgTempColor === c ? 'border-teal-primary scale-110' : 'border-slate-200 hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:border-teal-primary hover:bg-teal-bg/30 transition-colors">
                  <svg className="w-8 h-8 text-slate-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span className="text-xs text-slate-500">Klik untuk upload gambar</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 2 * 1024 * 1024) { alert('Maksimal 2MB'); return }
                      const reader = new FileReader()
                      reader.onload = () => setFloorBgTempImage(String(reader.result || ''))
                      reader.readAsDataURL(file)
                    }}
                  />
                </label>
                {floorBgTempImage && (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 h-32">
                    <img src={floorBgTempImage} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setFloorBgTempImage('')}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/50 text-white flex items-center justify-center hover:bg-slate-900/70 text-xs">
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => {
                if (!floorBgPickerFloorId) return
                const fid = floorBgPickerFloorId
                setFloorBgMap(prev => ({ ...prev, [fid]: '' }))
                setFloorBgTempImage('')
                fetch('/api/settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ settings: [{ key: `floor_bg_${fid}`, value: '', group: 'floor_bg' }] }),
                }).catch(() => {})
                setShowFloorBgPicker(false)
              }}
                className="px-3 py-1.5 rounded-pill text-xs font-medium text-slate-500 hover:bg-slate-100 border border-slate-200">
                Reset
              </button>
              <button type="button" onClick={() => setShowFloorBgPicker(false)}
                className="px-3 py-1.5 rounded-pill text-xs font-medium border border-slate-300 text-slate-600 hover:bg-slate-50">
                Batal
              </button>
              <button type="button" onClick={async () => {
                if (!floorBgPickerFloorId) return
                const fid = floorBgPickerFloorId
                const val = floorBgPickerTab === 'gambar' && floorBgTempImage
                  ? `url(${floorBgTempImage})`
                  : floorBgTempColor
                setFloorBgMap(prev => ({ ...prev, [fid]: val }))
                try {
                  await fetch('/api/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: [{ key: `floor_bg_${fid}`, value: val, group: 'floor_bg' }] }),
                  })
                } catch {}
                setShowFloorBgPicker(false)
              }}
                className="px-3 py-1.5 rounded-pill text-xs font-medium text-white bg-teal-primary hover:bg-teal-dark">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddMeja && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Tambah Meja</h2>
              <button type="button" onClick={() => setShowAddMeja(false)}
                className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const f = addMejaForm
              if (!f.code.trim()) return alert('Kode meja wajib diisi')
              if (!f.name.trim()) return alert('Nama meja wajib diisi')
              try {
                const res = await fetch('/api/meja', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    code: f.code.trim().toUpperCase(),
                    name: f.name.trim(),
                    floor_id: f.floor_id ? Number(f.floor_id) : null,
                    capacity: Number(f.capacity) || 4,
                    is_active: 1,
                    is_mergeable: 1,
                    is_smoking: 0,
                  }),
                })
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}))
                  return alert(err?.error || 'Gagal menyimpan')
                }
                const created = await res.json()
                setTables(prev => [...prev, created])
                setShowAddMeja(false)
                setAddMejaForm({ code: '', name: '', floor_id: '', capacity: '4' })
              } catch {
                alert('Gagal menyimpan meja')
              }
            }}>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Kode Meja</label>
                  <input required
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    value={addMejaForm.code}
                    onChange={e => setAddMejaForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="Cth: L1_16"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Nama Meja</label>
                  <input required
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    value={addMejaForm.name}
                    onChange={e => setAddMejaForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Cth: L1_16"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Lantai</label>
                  <select
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
                    value={addMejaForm.floor_id}
                    onChange={e => setAddMejaForm(p => ({ ...p, floor_id: e.target.value }))}
                  >
                    <option value="">Pilih Lantai</option>
                    {sortedFloors.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Jumlah Kursi</label>
                  <select
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
                    value={addMejaForm.capacity}
                    onChange={e => setAddMejaForm(p => ({ ...p, capacity: e.target.value }))}
                  >
                    {[2, 4, 6, 8, 10].map(n => (
                      <option key={n} value={n}>{n} Kursi</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddMeja(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800">
                  Batal
                </button>
                <button type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-teal-primary hover:bg-teal-dark rounded-md">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile bottom action bar */}
      {canSidebarMeja && (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(43,168,162,0.1)] px-3 py-2.5 pb-5">
        {activeTableId ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-slate-800 truncate">
                {tables.find(t => t.id === activeTableId)?.code || `Meja #${activeTableId}`}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {tables.find(t => t.id === activeTableId)?.floor_name || ''}
                {openTempsByTable[activeTableId] ? ' • In Use' : ' • Available'}
              </div>
            </div>
            {openTempsByTable[activeTableId] ? (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={`px-3 py-2 rounded-full text-white text-[12px] font-semibold whitespace-nowrap active:scale-95 transition-all shadow-[0_4px_16px_rgba(255,210,63,0.35)] ${moveMode || mergeMode ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-[#FFD23F] text-slate-900'}`}
                  disabled={!!moveMode || !!mergeMode}
                  onClick={() => {
                    if (moveMode || mergeMode) return
                    setActionPopupTableId(activeTableId)
                  }}
                >
                  Bayar
                </button>
                <button
                  type="button"
                  className={`px-3 py-2 rounded-full text-white text-[12px] font-semibold whitespace-nowrap active:scale-95 transition-all shadow-[0_4px_16px_rgba(43,168,162,0.3)] ${moveMode || mergeMode ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-teal-primary'}`}
                  disabled={!!moveMode || !!mergeMode}
                  onClick={() => {
                    if (moveMode || mergeMode) return
                    setActionPopupTableId(activeTableId)
                  }}
                >
                  Buka
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="px-3 py-2 rounded-full text-white text-[12px] font-semibold whitespace-nowrap active:scale-95 transition-all bg-teal-primary hover:bg-teal-dark shadow-teal-glow"
                disabled={navigatingTableId === activeTableId}
                onClick={() => {
                  const t = tables.find(x => x.id === activeTableId)
                  if (t) {
                    setSelectedTable(t)
                    setGuestInfo(prev => ({ ...prev, guestCount: prev.guestCount || '1' }))
                    setCustomerQuery('')
                    setWaiterQuery('')
                    setCustomerOptions([])
                    setWaiterOptions([])
                    setShowCustomerModal(false)
                    setShowWaiterModal(false)
                  }
                }}
              >
                Buka Meja
              </button>
            )}
          </div>
        ) : (
          <div className="text-center text-[12px] text-slate-500 py-1">
            Ketuk meja untuk memilih
          </div>
        )}
      </div>
      )}

      {billConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-lg shadow-xl w-full md:max-w-sm md:mx-4 mt-20 md:mt-0">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Cetak Struk Sementara</h2>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-700"
                onClick={() => setBillConfirmModal(null)}
              >
                Tutup
              </button>
            </div>
            <div className="px-4 py-3 text-xs text-slate-700 space-y-2">
              <p className="text-[11px] text-slate-600">
                Apakah Anda yakin ingin mencetak struk sementara (bill) untuk meja ini?
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                Struk ini hanya sebagai bill sementara untuk customer dan <span className="font-semibold">tidak akan membuat transaksi penjualan</span>.
              </p>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-md border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => setBillConfirmModal(null)}
              >
                Tidak
              </button>
              <button
                type="button"
                disabled={billPrinting}
                className={`px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-700 text-xs font-semibold text-white ${billPrinting ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={() => {
                  const target = billConfirmModal
                  if (!target) return
                  if (billPrinting) return
                  setBillPrinting(true)
                  ;(async () => {
                    try {
                      const res = await fetch(`/api/pos/resto-temp?table_id=${encodeURIComponent(String(target.tableId))}`)
                      if (!res.ok) {
                        throw new Error('Gagal mengambil data order sementara untuk bill')
                      }
                      const temp = await res.json()
                      if (!temp || !temp.id || !Array.isArray(temp.items) || temp.items.length === 0) {
                        throw new Error('Data order sementara tidak valid atau kosong')
                      }

                      const items = temp.items.map((it: any) => ({
                        name: String(it.barang_name || it.name || ''),
                        quantity: Number(it.quantity || 0) || 0,
                        price: Number(it.unit_price || it.unitPrice || 0) || 0,
                        total: Number(it.total_price || it.totalPrice || 0) || 0,
                      })).filter((it: any) => it.name && it.quantity > 0)

                      if (!items.length) {
                        throw new Error('Tidak ada item valid untuk dicetak')
                      }

                      // Ambil pengaturan penjualan untuk menyamakan perhitungan dengan POS
                      let ppnPercent = 11
                      let serviceChargePercent = 0
                      let includeTax = true
                      try {
                        const setRes = await fetch('/api/settings?group=penjualan', { cache: 'no-store' })
                        if (setRes.ok) {
                          const rows = await setRes.json()
                          const map: Record<string,string> = {}
                          ;(rows||[]).forEach((r:any)=>{ map[r.setting_key]=String(r.setting_value ?? '') })
                          includeTax = map['sales_include_tax'] === '1'
                          ppnPercent = Math.max(0, parseInt(map['sales_default_ppn_percent']||map['sales_ppn_percent']||'11')||11)
                          serviceChargePercent = Math.max(0, parseInt(map['sales_default_service_percent']||map['sales_service_percent']||'0')||0)
                        }
                      } catch {}

                      // Hitung subtotal (DPP), PB1, Service Charge, Total mirip POST /api/transactions
                      const r = Math.max(0, ppnPercent) / 100
                      let subtotal = 0
                      for (const it of items) {
                        const grossEx = Number(it.price) * Number(it.quantity)
                        // Di POS kita pakai harga ex-tax; jika includeTax aktif, treat sama karena temp tidak menyimpan include flag per item
                        subtotal += Math.max(0, grossEx)
                      }
                      const discountAmount = 0
                      const dppAfterDisc = Math.max(0, subtotal - discountAmount)
                      const serviceChargeAmt = Math.round(dppAfterDisc * (Math.max(0, serviceChargePercent) / 100))
                      const ppnAmount = Math.round(dppAfterDisc * r)
                      const total = dppAfterDisc + serviceChargeAmt + ppnAmount
                      const paid = total
                      const change = 0

                      const W = printerCfg.chars || 48
                      const L: string[] = []
                      const isNarrow = W < 40
                      // local currency formatter tanpa prefix 'Rp '
                      const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(Math.round(Number(n) || 0))
                      const center = (line: string) => {
                        const pad = Math.max(0, Math.floor((W - line.length) / 2))
                        return ' '.repeat(pad) + line
                      }
                      // Header perusahaan
                      if (companyInfo.name) L.push(center(String(companyInfo.name).toUpperCase()))
                      if (companyInfo.address) L.push(center(String(companyInfo.address)))
                      const cityStr = (companyInfo as any).city || (companyInfo as any).kota || ''
                      if (cityStr) L.push(center(String(cityStr)))
                      const phoneStr = (companyInfo as any).phone || (companyInfo as any).telepon || (companyInfo as any).no_telp || (companyInfo as any).no_hp || ''
                      if (phoneStr) L.push(center(String(phoneStr)))
                      const mejaCode = tables.find((t) => t.id === target.tableId)?.code || String(target.tableId)
                      const now = new Date()
                      const d = now.toLocaleDateString('id-ID')
                      L.push(''.padEnd(W, '='))

                      let totalQty = 0
                      if (isNarrow) {
                        for (const it of items) {
                          totalQty += Number(it.quantity) || 0
                          const nameLines = wrap(it.name, W)
                          if (nameLines.length) L.push(nameLines[0])
                          for (let i = 1; i < nameLines.length; i++) L.push(nameLines[i])
                          const qtyPrice = `${it.quantity} x ${fmt(Number(it.price))}`
                          const totStr = fmt(Number(it.total))
                          const left = Math.max(0, W - qtyPrice.length - totStr.length)
                          L.push(qtyPrice + ' '.repeat(left) + totStr)
                        }
                      } else {
                        const QW = 4, SP = 1, PW = 10, TW = 12
                        const NAME_W = Math.max(5, W - (QW + SP + 1 + PW + TW))
                        const hQty = padRight('Qty', QW)
                        const hName = padRight('Nama Barang', NAME_W)
                        const hPrice = padLeft('Harga.Stn', PW)
                        const hSub = padLeft('Subtotal', TW)
                        L.push(hQty + ' '.repeat(SP) + hName + ' ' + hPrice + hSub)
                        L.push(''.padEnd(W, '='))
                        for (const it of items) {
                          const priceStr = fmt(Number(it.price))
                          const subStr = fmt(Number(it.total))
                          const qtyStr = padRight(String(it.quantity), QW)
                          const nameLines = wrap(it.name, NAME_W)
                          totalQty += Number(it.quantity) || 0
                          if (nameLines.length <= 1) {
                            const namePart = padRight(nameLines[0] || '', NAME_W)
                            const line = qtyStr + ' '.repeat(SP) + namePart + ' ' + padLeft(priceStr, PW) + padLeft(subStr, TW)
                            L.push(line)
                          } else {
                            L.push(qtyStr + ' '.repeat(SP) + nameLines[0])
                            const name2 = padRight(nameLines[1], NAME_W)
                            L.push(' '.repeat(QW + SP) + name2 + ' ' + padLeft(priceStr, PW) + padLeft(subStr, TW))
                            for (let i = 2; i < nameLines.length; i++) {
                              L.push(' '.repeat(QW + SP) + nameLines[i])
                            }
                          }
                        }
                      }
                      L.push(''.padEnd(W, '='))
                      // Total Item (jumlah qty)
                      L.push(`Total Item  : ${fmt(totalQty)}`)

                      // Totals block sesuai mockup (label rata kanan dgn titik dua sejajar)
                      const VAL_W = isNarrow ? 12 : 14
                      const LAB_W = Math.max(8, W - VAL_W - 2) // 2 untuk ' :'
                      const lineKV = (label: string, val: string) => padLeft(label, LAB_W) + ' :' + padLeft(val, VAL_W)
                      L.push(lineKV('Subtotal', fmt(subtotal)))
                      L.push(lineKV('Diskon', fmt(discountAmount)))
                      L.push(lineKV('Pb 1', fmt(ppnAmount)))
                      L.push(lineKV('Service Charge', fmt(serviceChargeAmt)))
                      L.push(lineKV('Total', fmt(total)))
                      L.push(lineKV('Bayar', fmt(paid)))
                      L.push(lineKV('Kembali', fmt(change)))

                      // Footer: info meja/customer/waiter
                      L.push(''.padEnd(W, '='))
                      const t = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                      // Footer rata kiri, langsung mepet setelah ':'
                      L.push(`Tgl: ${d}   Jam : ${t}`)
                      L.push(`Meja: ${mejaCode}`)
                      const custName = temp?.customer_name ? String(temp.customer_name) : 'Umum'
                      L.push(`Cust: ${custName}`)
                      if (temp?.waiter_name) L.push(`Nama Waiter: ${String(temp.waiter_name)}`)
                      L.push(`Keterangan: ${custName}`)

                      // Feed lines
                      for (let i = 0; i < 5; i++) L.push('')
                      L.push('\n')

                      // Font sesuai setting (A/B) dan bold di header, normal di body
                      const fontCmd = printerCfg.font === 'A' ? '\x1B\x4D\x00' : '\x1B\x4D\x01'
                      L.unshift(fontCmd)
                      L.unshift('\x1B\x45\x01')
                      L.push('\x1B\x45\x00')
                      L.push(fontCmd)
                      const text = L.join('\n')

                      if (printerCfg.backendMode === 'server') {
                        if (!printerCfg.host) {
                          throw new Error('Host printer belum diset di pengaturan printer')
                        }
                        const copies = Math.max(1, printerCfg.copies)
                        for (let i = 0; i < copies; i++) {
                          await fetch('/api/print/escpos', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              text,
                              host: printerCfg.host,
                              port: printerCfg.port,
                              cut: printerCfg.cut && i === copies - 1,
                            }),
                          })
                        }
                      } else if (printerCfg.backendMode === 'local_helper') {
                        const id = printerCfg.localHelperId
                        const copies = Math.max(1, printerCfg.copies)
                        for (let i = 0; i < copies; i++) {
                          await fetch('/api/local-helper/print', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              text,
                              cut: printerCfg.cut && i === copies - 1,
                              id,
                            }),
                          })
                        }
                      } else if (printerCfg.backendMode === 'local_helper_apk') {
                        const id = printerCfg.localHelperId
                        const copies = Math.max(1, printerCfg.copies)
                        const h = printerCfg.localHelperIp || ''
                        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
                        for (let i = 0; i < copies; i++) {
                          await fetch(`${baseUrl}/print`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              text,
                              cut: printerCfg.cut && i === copies - 1,
                              id,
                            }),
                          })
                        }
                      } else if (printerCfg.backendMode === 'local_helper_offline') {
                        const printerName = printerCfg.localUsbName
                        const copies = Math.max(1, printerCfg.copies)
                        for (let i = 0; i < copies; i++) {
                          await fetch('http://127.0.0.1:27128/print/usb', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              text,
                              cut: printerCfg.cut && i === copies - 1,
                              printerName,
                            }),
                          })
                        }
                      } else if (printerCfg.backendMode === 'mobile_rawbt') {
                        try {
                          const base64 = typeof window !== 'undefined' ? btoa(unescape(encodeURIComponent(text))) : ''
                          if (typeof window !== 'undefined') {
                            window.location.href = 'rawbt:base64,' + base64
                          }
                        } catch {}
                      } else if (printerCfg.backendMode === 'android_intent') {
                        try {
                          const encoded = typeof window !== 'undefined' ? encodeURIComponent(text) : ''
                          if (typeof window !== 'undefined') {
                            window.location.href = 'posprint://print?text=' + encoded + '&printer=0'
                          }
                        } catch {}
                      } else if (printerCfg.backendMode === 'browser_print') {
                        if (typeof window !== 'undefined') {
                          const w = window.open('', '_blank', 'width=480,height=640')
                          if (w) {
                            w.document.write(
                              `<pre style="font-family:monospace;white-space:pre-wrap">${text.replace(/</g, '&lt;')}</pre><script>window.focus();window.print();</script>`,
                            )
                            w.document.close()
                          }
                        }
                      }

                      try {
                        await fetch('/api/pos/resto-temp', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: temp.id, status: 'bill' }),
                        })
                      } catch {}

                      setOpenTempsByTable((prev) => ({
                        ...prev,
                        [target.tableId]: { ...prev[target.tableId], status: 'bill' },
                      }))

                      setBillConfirmModal(null)
                    } catch (e: any) {
                      alert(e?.message || 'Gagal mencetak struk sementara')
                    } finally {
                      setBillPrinting(false)
                    }
                  })()
                }}
              >
                Ya, Cetak
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTable && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-lg shadow-xl w-full md:max-w-md md:mx-4 mt-20 md:mt-0">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Informasi Tamu</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Meja: <span className="font-semibold text-slate-800">{selectedTable.code}</span>{' '}
                  {selectedTable.name && <span className="text-slate-600">- {selectedTable.name}</span>}
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-700"
                onClick={() => setSelectedTable(null)}
              >
                Tutup
              </button>
            </div>

            <div className="px-4 py-3 space-y-3 text-xs">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                Data Customer & Waiter
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-800">Customer</label>
                <button
                  type="button"
                  className="w-full text-left border border-slate-300 rounded-md px-2 py-1.5 text-xs text-slate-900 font-semibold bg-white hover:bg-slate-50 flex items-center justify-between"
                  onClick={() => { setCustomerLoading(true); setCustomerQuery(''); setCustomerOptions([]); setCustomerFetchKey(k => k + 1); setShowCustomerModal(true) }}
                >
                  <span className="truncate">{guestInfo.customerName || 'Pilih customer...'}</span>
                  <svg className="w-3 h-3 text-slate-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-800">Waiter</label>
                <button
                  type="button"
                  className="w-full text-left border border-slate-300 rounded-md px-2 py-1.5 text-xs text-slate-900 font-semibold bg-white hover:bg-slate-50 flex items-center justify-between"
                  onClick={() => { setWaiterLoading(true); setWaiterQuery(''); setWaiterOptions([]); setWaiterFetchKey(k => k + 1); setShowWaiterModal(true) }}
                >
                  <span className="truncate">{guestInfo.waiterName || 'Pilih waiter...'}</span>
                  <svg className="w-3 h-3 text-slate-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-800">Jumlah Tamu</label>
                <input
                  type="number"
                  min={1}
                  className="w-24 border border-slate-300 rounded-md px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary"
                  value={guestInfo.guestCount}
                  onChange={(e) =>
                    setGuestInfo((prev) => ({ ...prev, guestCount: e.target.value || '1' }))
                  }
                />
              </div>

              <div className="pt-1 border-t border-dashed border-slate-200 mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                {guestInfo.customerName && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-teal-bg text-teal-dark border border-teal-bg">
                    Customer: <span className="ml-1 font-semibold">{guestInfo.customerName}</span>
                  </span>
                )}
                {guestInfo.waiterName && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                    Waiter: <span className="ml-1 font-semibold">{guestInfo.waiterName}</span>
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200">
                  Tamu: <span className="ml-1 font-semibold">{guestInfo.guestCount || '1'}</span>
                </span>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-md border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => setSelectedTable(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md bg-teal-primary hover:bg-teal-dark text-xs font-semibold text-white"
                onClick={() => {
                  if (!guestInfo.customerId || !guestInfo.waiterId) {
                    alert('Customer dan Waiter wajib dipilih sebelum melanjutkan ke POS.')
                    return
                  }
                  if (selectedTable) setNavigatingTableId(selectedTable.id)
                  ;(async () => {
                    try {
                      const res = await fetch('/api/pos/resto-temp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tableId: selectedTable?.id,
                          customerId: guestInfo.customerId,
                          customerName: guestInfo.customerName,
                          waiterId: guestInfo.waiterId,
                          waiterName: guestInfo.waiterName,
                          guestCount: Number(guestInfo.guestCount || '1') || 1,
                        }),
                      })
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}))
                        throw new Error(data?.error || 'Gagal menyimpan order sementara')
                      }
                      const temp = await res.json()
                      setSelectedTable(null)
                      if (temp && temp.id && selectedTable) {
                        setNavigatingTableId(selectedTable.id)
                        setNavigatedToMenu(true)
                        router.push(`/pos/resto?temp_id=${temp.id}&table_id=${selectedTable.id}`)
                      }
                    } catch (e: any) {
                      alert(e?.message || 'Gagal melanjutkan ke POS')
                    }
                  })()
                }}
              >
                Lanjut ke POS
              </button>
            </div>
          </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={() => setShowCustomerModal(false)}>
          <div className="bg-white rounded-modal shadow-2xl w-[500px] max-w-[95vw] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b flex items-center justify-between shrink-0">
              <div className="font-medium text-sm">Pilih Customer</div>
              <button onClick={() => setShowCustomerModal(false)} className="text-sm text-slate-500 hover:text-slate-700">Tutup</button>
            </div>
            <div className="p-3 border-b shrink-0">
              <input
                type="text"
                className="w-full rounded-pill border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
                placeholder="Ketik nama / kode customer..."
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {customerLoading ? (
                <div className="text-center text-xs text-slate-500 py-4">Memuat customer...</div>
              ) : customerOptions.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-4">Ketik untuk mencari customer</div>
              ) : (
                customerOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left p-3 rounded-pill hover:bg-teal-bg border border-transparent hover:border-teal-primary transition-colors"
                    onClick={() => {
                      setGuestInfo((prev) => ({
                        ...prev,
                        customerId: Number(c.id),
                        customerName: String(c.name || c.code || '').trim(),
                      }))
                      setShowCustomerModal(false)
                    }}
                  >
                    <div className="font-semibold text-sm text-slate-900">{c.code} - {c.name}</div>
                    {c.phone && <div className="text-xs text-slate-500">Telp: {c.phone}</div>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showWaiterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={() => setShowWaiterModal(false)}>
          <div className="bg-white rounded-modal shadow-2xl w-[500px] max-w-[95vw] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b flex items-center justify-between shrink-0">
              <div className="font-medium text-sm">Pilih Waiter</div>
              <button onClick={() => setShowWaiterModal(false)} className="text-sm text-slate-500 hover:text-slate-700">Tutup</button>
            </div>
            <div className="p-3 border-b shrink-0">
              <input
                type="text"
                className="w-full rounded-pill border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
                placeholder="Ketik nama / kode waiter..."
                value={waiterQuery}
                onChange={(e) => setWaiterQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {waiterLoading ? (
                <div className="text-center text-xs text-slate-500 py-4">Memuat waiter...</div>
              ) : waiterOptions.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-4">Ketik untuk mencari waiter</div>
              ) : (
                waiterOptions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left p-3 rounded-pill hover:bg-teal-bg border border-transparent hover:border-teal-primary transition-colors"
                    onClick={() => {
                      setGuestInfo((prev) => ({
                        ...prev,
                        waiterId: Number(s.id),
                        waiterName: String(s.name || s.code || '').trim(),
                      }))
                      setShowWaiterModal(false)
                    }}
                  >
                    <div className="font-semibold text-sm text-slate-900">{s.code} - {s.name}</div>
                    {s.phone && <div className="text-xs text-slate-500">Telp: {s.phone}</div>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {cancelReasonModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-lg shadow-xl w-full md:max-w-sm md:mx-4 mt-20 md:mt-0">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Masukan alasan</h2>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-700"
                onClick={() => setCancelReasonModal(null)}
              >
                Tutup
              </button>
            </div>
            <div className="px-4 py-3 text-xs text-slate-700 space-y-2">
              <p className="text-[11px] text-slate-500">
                Opsional: Anda dapat mengisi alasan kenapa order meja ini dibatalkan.
              </p>
              <textarea
                rows={3}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                placeholder="Contoh: Customer pindah meja, input salah, dll."
                value={cancelReasonModal.reason}
                onChange={(e) =>
                  setCancelReasonModal((prev) =>
                    prev ? { ...prev, reason: e.target.value } : prev,
                  )
                }
              />
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-md border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => setCancelReasonModal(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white"
                onClick={() => {
                  const target = cancelReasonModal
                  if (!target) return
                  ;(async () => {
                    try {
                      const res = await fetch('/api/pos/resto-temp', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: target.tempId, status: 'canceled', reason: target.reason || undefined }),
                      })
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}))
                        throw new Error(data?.error || 'Gagal membatalkan order sementara')
                      }
                      setOpenTempsByTable((prev) => {
                        const copy = { ...prev }
                        delete copy[target.tableId]
                        return copy
                      })
                      setCancelReasonModal(null)
                    } catch (e: any) {
                      alert(e?.message || 'Terjadi kesalahan saat membatalkan order')
                    }
                  })()
                }}
              >
                Simpan & Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-lg shadow-xl w-full md:max-w-sm md:mx-4 mt-20 md:mt-0">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Batalkan Order Meja</h2>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-700"
                onClick={() => setCancelModal(null)}
              >
                Tutup
              </button>
            </div>
            <div className="px-4 py-3 text-xs text-slate-700 space-y-2">
              <p>
                Apakah Anda yakin ingin membatalkan order untuk meja
                {" "}
                <span className="font-semibold text-slate-900">
                  {tables.find((t) => t.id === cancelModal.tableId)?.code || `ID ${cancelModal.tableId}`}
                </span>
                ?
              </p>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-md border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => setCancelModal(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white"
                onClick={() => {
                  const target = cancelModal
                  if (!target) return
                  // Tutup modal konfirmasi pertama, lanjut ke modal alasan
                  setCancelModal(null)
                  setCancelReasonModal({ tableId: target.tableId, tempId: target.tempId, reason: '' })
                }}
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}
      {navigatingTableId !== null && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[80]">
          <div className="flex flex-col items-center gap-3 bg-white rounded-xl px-6 py-5 shadow-2xl">
            <div className="h-8 w-8 border-2 border-slate-300 border-t-[#2BA8A2] rounded-full animate-spin" />
            <span className="text-sm text-slate-600">Membuka POS...</span>
          </div>
        </div>
      )}
      {showScanModal && (
        <ScanMejaModal
          onResult={handleScanResult}
          onClose={() => setShowScanModal(false)}
        />
      )}
      </div>
    </div>
  )
}
