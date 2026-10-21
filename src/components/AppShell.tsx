"use client"

import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import LocalStorageProtection from '@/components/LocalStorageProtection'
import FullscreenToggle from '@/components/FullscreenToggle'
import { ReactNode, useEffect, useState } from 'react'

export default function AppShell({ children, logoUrl }: { children: ReactNode; logoUrl?: string }) {
  const pathname = usePathname()
  const isAuthPage = pathname === '/login'
  const isCustomerDisplay = pathname === '/pos/customer-display'
  const isSelfOrder = pathname === '/self-order' || pathname.startsWith('/self-order/')
  const isPromoPage = pathname === '/promo' || pathname.startsWith('/promo/')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navbarVisible, setNavbarVisible] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('ui_navbar_visible')
    if (stored !== null) setNavbarVisible(stored === '1')
  }, [])

  useEffect(() => {
    localStorage.setItem('ui_navbar_visible', navbarVisible ? '1' : '0')
  }, [navbarVisible])

    // Cross-tab/session expiration guard
    useEffect(() => {
      if (isAuthPage || isPromoPage || isSelfOrder) return // jangan cek saat di halaman login / landing promo publik / self-order
    let destroyed = false
    let lastCheck = 0
    const throttleMs = 5000
    async function checkAuth(force = false){
      const now = Date.now()
      if (!force && now - lastCheck < throttleMs) return
      lastCheck = now
      try{
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const d = await res.json().catch(()=>({}))
        if (!d?.user?.id && !destroyed){
          window.location.href = '/login?next=/dashboard'
        }
      }catch{
        if (!destroyed){ window.location.href = '/login?next=/dashboard' }
      }
    }

    // check on focus/visibility change and first interaction
    const onFocus = () => checkAuth(true)
    const onVis = () => { if (document.visibilityState === 'visible') checkAuth(true) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)

    // BroadcastChannel to sync explicit logout across tabs
    let bc: BroadcastChannel | null = null
    try { bc = new BroadcastChannel('auth'); bc.onmessage = (e) => { if (e?.data === 'logout') { window.location.href = '/login?next=/dashboard' } } } catch {}

    // initial check
    checkAuth(true)
    return () => {
      destroyed = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      try{ bc?.close() }catch{}
    }
  }, [isAuthPage, isPromoPage, isSelfOrder])

  if (isAuthPage || isCustomerDisplay || isPromoPage || isSelfOrder) {
    // Minimal layout: login & customer display tanpa sidebar/header
    return (
      <>
        <LocalStorageProtection />
        {children}
      </>
    )
  }

  return (
    <>
      <LocalStorageProtection />
      <FullscreenToggle />
      <div className="min-h-screen flex">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} logoUrl={logoUrl} />

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {navbarVisible ? (
            <Header onMenuToggle={() => setMobileOpen((v) => !v)} onToggleNavbar={() => setNavbarVisible(false)} logoUrl={logoUrl} />
          ) : (
            <button onClick={() => setNavbarVisible(true)} className="fixed top-1 left-1/2 -translate-x-1/2 z-50 px-2 py-0.5 text-[10px] text-slate-300 hover:text-slate-600 bg-white/60 hover:bg-white rounded-full border border-transparent hover:border-slate-200 transition-all opacity-0 hover:opacity-100" title="Tampilkan navbar">
              ▼
            </button>
          )}

          <main className="flex-1 p-2 md:p-3 w-full">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
