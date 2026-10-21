"use client"

import { useCallback, useEffect, useState } from 'react'
import { showError, showSuccess } from '@/lib/notification'

type DesignKV = Record<string, string>

const defaultDesign: DesignKV = {
  design_login_bg_type: 'color',
  design_login_bg_color: '#0ea5e9',
  design_login_bg_url: '',
  design_login_overlay_color: '#000000',
  design_login_overlay_opacity: '0.35',
  design_login_hero_title: 'Welcome Back',
  design_login_hero_subtitle: 'Silakan login untuk melanjutkan',
  design_login_bg_mobile_type: 'color',
  design_login_bg_mobile_color: '#1B8A7A',
  design_login_bg_mobile_url: '',
}

export default function LoginClient({ initialDesign }: { initialDesign: DesignKV }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(true)

  const [design, setDesign] = useState<DesignKV>({ ...defaultDesign, ...(initialDesign || {}) })

  useEffect(() => {
    try {
      if (typeof document === 'undefined') return
      const hasSession = document.cookie.split(';').some((c) => c.trim().startsWith('session_token='))
      if (!hasSession) return
      const sp = new URLSearchParams(window.location.search)
      let next = sp.get('next') || ''
      if (!next.startsWith('/') || next.startsWith('/login')) next = '/dashboard'
      window.location.replace(next)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/settings?group=design', { cache: 'no-store' })
        if (!res.ok) return
        const rows = await res.json().catch(() => [])
        const map: DesignKV = { ...defaultDesign, ...(initialDesign || {}) }
        if (Array.isArray(rows)) {
          for (const r of rows) {
            if (r && r.setting_key) map[String(r.setting_key)] = String(r.setting_value ?? '')
          }
        }
        setDesign(map)
      } catch { /* ignore */ }
    })()
  }, [])

  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  useEffect(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [checkMobile])

  const mobileIsImage = (design.design_login_bg_mobile_type || 'color') === 'image'
  const mobileBgColor = design.design_login_bg_mobile_color || '#1B8A7A'
  const mobileBgUrl = design.design_login_bg_mobile_url || ''
  const desktopIsImage = (design.design_login_bg_type || 'color') === 'image'
  const desktopBgColor = design.design_login_bg_color || '#0ea5e9'
  const desktopBgUrl = design.design_login_bg_url || ''

  const heroTitle = (design.design_login_hero_title || 'Welcome Back').trim() || 'Welcome Back'
  const heroSubtitle = String(design.design_login_hero_subtitle || '').trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      showError('Email dan Password wajib diisi')
      return
    }
    try {
      setLoading(true)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showError(data?.error || 'Gagal login')
        return
      }
      showSuccess('Login berhasil')
      await new Promise((resolve) => setTimeout(resolve, 100))
      const sp = new URLSearchParams(window.location.search)
      let next = sp.get('next') || ''
      if (!next.startsWith('/') || next.startsWith('/login')) next = '/dashboard'
      window.location.href = next
    } catch {
      showError('Gagal login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative">
      {/* Mobile background */}
      <div className="absolute inset-0 block md:hidden" style={{ backgroundColor: mobileBgColor }} />
      {mobileIsImage && mobileBgUrl && (
        <div className="absolute inset-0 block md:hidden" style={{
          backgroundImage: `url(${mobileBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
      )}
      {/* Desktop background */}
      <div className="absolute inset-0 hidden md:block" style={{ backgroundColor: desktopBgColor }} />
      {desktopIsImage && desktopBgUrl && (
        <div className="absolute inset-0 hidden md:block" style={{
          backgroundImage: `url(${desktopBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
      )}
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: design.design_login_overlay_color || '#000',
          opacity: Number(design.design_login_overlay_opacity || '0.35'),
        }}
      />

      <div className="relative min-h-screen grid grid-cols-1 md:grid-cols-2">
        <div className="hidden md:flex items-center justify-center p-8">
          <div className="text-white">
            <div className="text-4xl font-extrabold tracking-tight drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]">
              {heroTitle}
            </div>
            {heroSubtitle ? (
              <div className="mt-2 text-sm opacity-90 drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)]">{heroSubtitle}</div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-center p-4">
          <div
            className={
              'w-full max-w-sm rounded-modal p-6 ' +
              ((mobileIsImage && mobileBgUrl) || (desktopIsImage && desktopBgUrl)
                ? 'bg-white/35 backdrop-blur-xl shadow-2xl shadow-black/25 border border-white/30 ring-1 ring-white/20'
                : 'bg-[#FFF8E7] shadow-card border border-teal-bg')
            }
          >
            <h1 className="text-xl font-extrabold tracking-wide text-teal-dark text-center">Magnus System</h1>
            <p className="text-xs text-[#8E8E8E] text-center mt-1">Silakan login untuk melanjutkan</p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#3C3C3C] mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={
                    'w-full px-3 py-2 rounded-pill text-sm outline-none transition-colors ' +
                    ((mobileIsImage && mobileBgUrl) || (desktopIsImage && desktopBgUrl)
                      ? 'bg-white/60 border border-white/40 focus:border-white/70 focus:ring-2 focus:ring-white/30'
                      : 'border border-slate-300 bg-[#FFF8E7] hover:border-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-bg focus:border-teal-primary')
                  }
                  placeholder="admin@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#3C3C3C] mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={
                    'w-full px-3 py-2 rounded-pill text-sm outline-none transition-colors ' +
                    ((mobileIsImage && mobileBgUrl) || (desktopIsImage && desktopBgUrl)
                      ? 'bg-white/60 border border-white/40 focus:border-white/70 focus:ring-2 focus:ring-white/30'
                      : 'border border-slate-300 bg-[#FFF8E7] hover:border-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-bg focus:border-teal-primary')
                  }
                  placeholder="••••••"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#8E8E8E]">
                <input id="remember" type="checkbox" className="h-3.5 w-3.5 accent-[#2BA8A2]" />
                <label htmlFor="remember">Ingat saya</label>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-pill text-sm font-bold text-white bg-teal-primary hover:bg-teal-dark disabled:opacity-50 transition-all active:scale-[0.97] shadow-teal-glow"
              >
                {loading ? 'Memproses...' : 'Masuk'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
