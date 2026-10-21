"use client"
import { HomeIcon, Squares2X2Icon, CurrencyDollarIcon, ClipboardDocumentListIcon, ShoppingCartIcon, Cog6ToothIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { SYSTEM_MENUS, MENU_GROUPS } from '@/lib/menus'
import { Plus_Jakarta_Sans } from 'next/font/google'

const erpFont = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700'] })

type NavChild = { label: string; href: string }
type NavItem = { label: string; icon: React.ComponentType<any>; href: string; children?: NavChild[] }

const GROUP_ICONS: Record<string, React.ComponentType<any>> = {
  Dashboard: HomeIcon,
  Reservasi: CalendarDaysIcon,
  Pembelian: ShoppingCartIcon,
  Penjualan: ShoppingCartIcon,
  Barang: Squares2X2Icon,
  Stok: ClipboardDocumentListIcon,
  Keuangan: CurrencyDollarIcon,
  Setting: Cog6ToothIcon,
  Security: Cog6ToothIcon,
}

type SidebarProps = {
  mobileOpen?: boolean
  onClose?: () => void
  logoUrl?: string
}

export default function Sidebar({ mobileOpen = false, onClose, logoUrl: initialLogoUrl }: SidebarProps) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [userName, setUserName] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [userLoaded, setUserLoaded] = useState(false)
  const [allowedPaths, setAllowedPaths] = useState<string[] | null>(null)
  const [isAuth, setIsAuth] = useState(false)
  const [permList, setPermList] = useState<any[] | null>(null)
  const [appTitle, setAppTitle] = useState<string>("Magnus")
  const [logoUrl, setLogoUrl] = useState<string>(initialLogoUrl || '')
  const applyDesignVars = (kv: Record<string, string>) => {
    try {
      const root = document.documentElement
      if (kv.design_sidebar_bg) root.style.setProperty('--sidebar-bg', kv.design_sidebar_bg)
      if (kv.design_sidebar_text) root.style.setProperty('--sidebar-text', kv.design_sidebar_text)
      if (kv.design_sidebar_hover_bg) root.style.setProperty('--sidebar-hover-bg', kv.design_sidebar_hover_bg)
      if (kv.design_sidebar_active_bg) root.style.setProperty('--sidebar-active-bg', kv.design_sidebar_active_bg)
      if (kv.design_sidebar_active_text) root.style.setProperty('--sidebar-active-text', kv.design_sidebar_active_text)
    } catch {}
  }

  useEffect(() => {
    try {
      const savedGroups = localStorage.getItem('sidebar_open_groups')
      if (savedGroups) {
        const parsed = JSON.parse(savedGroups)
        if (parsed && typeof parsed === 'object') {
          // Hanya restore satu group — ambil yang pertama
          const keys = Object.keys(parsed).filter((k) => parsed[k])
          const next = keys.length > 0 ? { [keys[0]]: true } : {}
          setOpenGroups(next)
        }
      }
    } catch {}
    // load current user info
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (data?.user) {
          setUserName(data.user.name || '')
          setUserEmail(data.user.email || '')
          if (Array.isArray(data.user.allowedPaths)) {
            setAllowedPaths(data.user.allowedPaths as string[])
          } else {
            setAllowedPaths(null)
          }
          if (Array.isArray(data.user.permissions)) {
            setPermList(data.user.permissions as any[])
          } else {
            setPermList(null)
          }
          if (data.user.id) setIsAuth(true)
        }
      } catch {}
      finally {
        setUserLoaded(true)
      }
    })()
  }, [])

  // Auto-scroll to expanded submenu so it stays visible (especially for bottom groups)
  useEffect(() => {
    const label = Object.keys(openGroups)[0]
    if (label) {
      const el = document.getElementById(`submenu-${label.toLowerCase()}`)
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
      }
    }
  }, [openGroups])

  // Load design settings and apply CSS variables
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/settings?group=design', { cache: 'no-store' })
        const rows = await res.json().catch(() => [])
        const defaults: Record<string, string> = {
          design_sidebar_bg: '#FFFFFF',
          design_sidebar_text: '#969BA0',
          design_sidebar_hover_bg: '#E8F6F5',
          design_sidebar_active_bg: '#E8F6F5',
          design_sidebar_active_text: '#2BA8A2',
        }
        const map: Record<string, string> = { ...defaults }
        if (Array.isArray(rows)) {
          for (const r of rows) {
            if (r && r.setting_key) map[String(r.setting_key)] = String(r.setting_value ?? '')
          }
        }
        applyDesignVars(map)
      } catch {}
    })()
  }, [])

  // Load company settings for app title & logo (only if not provided via props)
  useEffect(() => {
    if (initialLogoUrl) return
    ;(async () => {
      try {
        const res = await fetch('/api/settings?group=company', { cache: 'no-store' })
        const rows = await res.json().catch(() => [])
        if (Array.isArray(rows)) {
          const map: Record<string, string> = {}
          for (const r of rows) {
            if (r && r.setting_key) map[String(r.setting_key)] = String(r.setting_value ?? '')
          }
          const l = map['company_logo_url']?.trim()
          if (l) setLogoUrl(l)
        }
      } catch {}
    })()
  }, [initialLogoUrl])

  // Hard guard: if user info not present after loaded, redirect to login
  useEffect(() => {
    const isMobileRoute = (pathname || '/').startsWith('/m/')
    if (userLoaded && !isAuth && !isMobileRoute) {
      try { window.location.href = '/login' } catch {}
      return
    }
    // Jika root ('/') diizinkan, anggap semua path diizinkan → tidak perlu redirect
    const rootAllowed = !!(allowedPaths && allowedPaths.includes('/'))
    // Redirect ringan ke halaman pertama yang diizinkan jika berada di halaman yang tidak diizinkan
    if (!isMobileRoute && userLoaded && isAuth && allowedPaths && allowedPaths.length > 0 && !rootAllowed) {
      const current = pathname || '/'
      // Do not redirect away from the welcome page
      if (current === '/') return
      const isAllowed = pathAllowed(current)
      if (!isAllowed && current !== '/login') {
        try { window.location.href = allowedPaths[0] } catch {}
      }
    }
  }, [userLoaded, isAuth, allowedPaths, pathname])

  const pathAllowed = (p: string) => {
    // Always allow root welcome page
    if (p === '/') return true
    // Primary: explicit allowed paths from server
    if (!allowedPaths) return false
    if (allowedPaths.includes('/')) return true
    // Special-case: POS Resto detail page
    // Treat '/pos/resto' as allowed if either '/pos' or '/pos/resto' is allowed,
    // or if user has can_view on 'pos_resto' or 'pos_resto_table'
    if (p === '/pos/resto') {
      if (allowedPaths.includes('/pos') || allowedPaths.includes('/pos/resto')) return true
      if (
        permList && permList.some(
          (per: any) =>
            (String(per.menu_code) === 'pos_resto' || String(per.menu_code) === 'pos_resto_table') &&
            Number(per.can_view) === 1,
        )
      ) {
        return true
      }
    }
    if (allowedPaths.includes(p)) return true
    // If base path is allowed, allow all its subpaths (e.g. /customer/new, /customer/1/edit)
    if (allowedPaths.some((base) => base !== '/' && (p === base || p.startsWith(base + '/')))) return true
    // Allow import penjualan page if List Penjualan is allowed
    if (p === '/transactions/import') {
      if (allowedPaths.includes('/sales')) return true
      if (
        permList &&
        permList.some(
          (per: any) => String(per.menu_code) === 'sales_list' && Number(per.can_view) === 1,
        )
      ) {
        return true
      }
    }
    // Fallback A: check permissions against menu code mapped by SYSTEM_MENUS
    // Support both legacy shape (can_view) and new dynamic shape (permission_code='VIEW', allowed)
    const menu = SYSTEM_MENUS.find((m) => m.path === p)
    // Allow alias codes for backward compatibility (e.g., sales_by_specification)
    const aliasCodes: string[] = []
    if (p === '/reports/sales-by-specification') {
      aliasCodes.push('sales_by_specification')
    }
    if (
      menu && permList && permList.some((per: any) => {
        const code = String(per.menu_code)
        if (!(code === menu.code || aliasCodes.includes(code))) return false
        // Legacy format
        if (per.can_view !== undefined) return Number(per.can_view) === 1
        // New dynamic format
        const isView = String(per.permission_code || '').toUpperCase() === 'VIEW'
        const allowed = per.allowed === true || Number(per.allowed) === 1
        return isView && allowed
      })
    ) {
      return true
    }
    // Fallback B: legacy parent codes that imply multiple child paths
    const hasLegacyReservasi = !!(permList && permList.some((per: any) => String(per.menu_code) === 'reservasi' && Number(per.can_view) === 1))
    if (hasLegacyReservasi && ['/reservasi/booking', '/lantai', '/meja', '/reports/reservation-recap'].includes(p)) return true
    const hasLegacyStock = !!(permList && permList.some((per: any) => String(per.menu_code) === 'stock' && Number(per.can_view) === 1))
    if (hasLegacyStock && ['/stock', '/stock/transfer', '/stock/usage', '/stock/draftopname', '/stock/opname', '/gudang', '/ingredient', '/persediaan/manufaktur'].includes(p)) return true
    return false
  }

  // Build sidebar nav from SYSTEM_MENUS (same source as HeaderMenu)
  const sidebarNav = useMemo(() => {
    const normalizeGroup = (g?: string) => {
      if (!g) return 'Lainnya'
      if (g === 'Security') return 'Setting'
      if (g === 'Stok & Laporan') return 'Stok'
      return g
    }
    const grouped: Record<string, { code: string; name: string; path: string }[]> = {}
    for (const m of SYSTEM_MENUS) {
      const group = normalizeGroup(m.group)
      if (!grouped[group]) grouped[group] = []
      grouped[group].push(m)
    }
    const order = MENU_GROUPS.map((g) => g.code)
    const result: NavItem[] = []
    for (const g of order) {
      const items = grouped[g]
      if (!items || items.length === 0) continue
      const icon = GROUP_ICONS[g] || HomeIcon
      if (g === 'Dashboard') {
        // Dashboard sebagai link langsung, bukan accordion
        result.push({ label: 'Dashboard', icon, href: '/dashboard' })
      } else {
        // Hapus Dashboard dari children saat masuk group lain
        const children = items.filter((i) => i.code !== 'dashboard').map((i) => ({ label: i.name, href: i.path }))
        if (children.length === 0) continue
        result.push({ label: g, icon, href: children[0].href, children })
      }
    }
    return result
  }, [])

  // Auto-open parent group when current path matches a child
  useEffect(() => {
    for (const item of sidebarNav) {
      if (item.children) {
        const match = item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))
        if (match) {
          setOpenGroups((prev) => {
            const next = { [item.label]: true }
            try { localStorage.setItem('sidebar_open_groups', JSON.stringify(next)) } catch {}
            return next
          })
          return
        }
      }
    }
  }, [pathname, sidebarNav])

  const persistOpenGroups = (next: Record<string, boolean>) => {
    setOpenGroups(next)
    try { localStorage.setItem('sidebar_open_groups', JSON.stringify(next)) } catch {}
  }

  const handleSignout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <>
    {/* Mobile Sidebar (Overlay) — only on mobile */}
    {(!pathname.startsWith('/m/')) && mobileOpen && (
      <div className="md:hidden fixed inset-0 z-40">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className={clsx('absolute inset-y-0 left-0 w-72 max-w-[80%] text-[var(--sidebar-text)] shadow-xl border-r border-slate-200', erpFont.className)} style={{ background: 'var(--sidebar-bg)' }}>
          <div className="h-12 flex items-center px-3 gap-2 border-b border-slate-200">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-slate-200 grid place-items-center">🍽️</div>
            )}
            <div className="font-semibold text-sm flex-1 whitespace-nowrap text-[var(--sidebar-text)]" title={appTitle}>{appTitle}</div>
            <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-[var(--sidebar-hover-bg)]" aria-label="Tutup sidebar">✕</button>
          </div>
          <nav className="mt-2 px-2 pb-2 max-h-[calc(100vh-48px)] overflow-y-auto">
            {sidebarNav.map((item, idx) => {
              // Terapkan filter allowedPaths juga pada mobile
              const isAllowedParent = pathAllowed(item.href)
              const childrenAllowed = (item.children || []).filter(c => pathAllowed(c.href))
              if (!isAllowedParent && childrenAllowed.length === 0) return null
              const hasChildren = !!item.children
              const parentActive = pathname === item.href
              const groupOpen = !!openGroups[item.label]
              return (
                <div key={idx} className="mb-1">
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => {
                        const isOpen = !!openGroups[item.label]
                        const next = isOpen ? {} : { [item.label]: true }
                        persistOpenGroups(next)
                      }}
                      className={clsx(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded-pill transition-colors text-[13px] text-left font-semibold',
                        parentActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'hover:bg-blue-50 hover:text-blue-700 text-slate-800'
                      )}
                    >
                      <item.icon className={clsx('h-4 w-4', parentActive ? 'text-blue-600' : 'text-slate-700 group-hover:text-blue-600')} />
                      <span className="truncate text-[13px] flex-1 font-semibold">{item.label}</span>
                      {groupOpen ? <span className="opacity-80">▾</span> : <span className="opacity-80">▸</span>}
                    </button>
                  ) : (
                    <Link
                      href={item.href as any}
                      onClick={onClose}
                      className={clsx(
                        'flex items-center gap-2 px-2 py-1.5 rounded-pill transition-colors text-[13px] font-semibold',
                        parentActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'hover:bg-blue-50 hover:text-blue-700 text-slate-800'
                      )}
                    >
                      <item.icon className={clsx('h-4 w-4', parentActive ? 'text-blue-600' : 'text-slate-700 group-hover:text-blue-600')} />
                      <span className="truncate text-[13px]">{item.label}</span>
                    </Link>
                  )}
                  {hasChildren && groupOpen && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {childrenAllowed.map((c, i) => {
                        const targetHref = c.href === '/penjualan-sales-order' ? '/m/penjualan-sales-order' : c.href
                        return (
                        <Link
                          key={i}
                          href={targetHref as any}
                          onClick={() => { onClose?.() }}
                          className={clsx(
                            'block text-[12px] px-3 py-1 rounded opacity-90 font-medium hover:bg-blue-50 hover:text-blue-700',
                            pathname === targetHref && 'bg-blue-50 text-blue-700'
                          )}
                        >
                          {c.label}
                        </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </div>
      </div>
    )}
    </>
  )
}
