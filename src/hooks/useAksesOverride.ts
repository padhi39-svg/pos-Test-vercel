"use client"

import { useState, useCallback } from 'react'

export type OverrideAction = 'edit' | 'void' | 'print'

export type OverrideState = {
  open: boolean
  menuCode: string
  action: OverrideAction
  title: string
  onConfirmed: () => void
}

export function useAksesOverride() {
  const [override, setOverride] = useState<OverrideState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const close = useCallback(() => {
    setOverride(null)
    setLoading(false)
    setError('')
  }, [])

  const confirm = useCallback(async (username: string, password: string): Promise<boolean> => {
    if (!override) return false
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-akses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          menuCode: override.menuCode,
          action: override.action,
        }),
      })
      const data = await res.json()
      if (data.success) {
        override.onConfirmed()
        close()
        return true
      } else {
        setError(data.message || 'Verifikasi gagal')
        return false
      }
    } catch {
      setError('Terjadi kesalahan, coba lagi')
      return false
    } finally {
      setLoading(false)
    }
  }, [override, close])

  return { override, setOverride, loading, error, close, confirm }
}
