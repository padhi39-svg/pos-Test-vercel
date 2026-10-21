'use client'

import { useEffect, useState, type ReactNode } from 'react'

export default function PinGuard({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [needPin, setNeedPin] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('promo_settings_unlocked') === '1') {
      setUnlocked(true)
      setLoading(false)
      return
    }
    fetch('/api/promo/pin', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!d.set) {
          sessionStorage.setItem('promo_settings_unlocked', '1')
          setUnlocked(true)
        } else {
          setNeedPin(true)
        }
      })
      .catch(() => setNeedPin(true))
      .finally(() => setLoading(false))
  }, [])

  const submit = async () => {
    setError('')
    try {
      const res = await fetch('/api/promo/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (res.ok) {
        sessionStorage.setItem('promo_settings_unlocked', '1')
        setUnlocked(true)
      } else {
        setError('PIN salah')
      }
    } catch {
      setError('Gagal verifikasi')
    }
  }

  if (loading) return <div className="p-4 text-center text-slate-400">Memuat...</div>
  if (unlocked) return <>{children}</>

  return (
    <div className="min-h-screen w-full bg-surface-base flex items-center justify-center p-4">
      <div className="container-card p-5 w-full max-w-xs space-y-3 text-center">
        <div className="font-semibold text-slate-800">Setting Promo & Media</div>
        <div className="text-xs text-slate-500">Masukkan PIN untuk mengakses</div>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="PIN"
          className="w-full text-center rounded-pill border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-bg"
        />
        {error && <div className="text-[11px] text-coral-dark">{error}</div>}
        <Button onClick={submit}>Buka</Button>
      </div>
    </div>
  )
}

function Button({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2 rounded-pill bg-teal-primary hover:bg-teal-dark text-white text-sm font-medium"
    >
      {children}
    </button>
  )
}
