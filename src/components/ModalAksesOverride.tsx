"use client"

import { useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (username: string, password: string) => Promise<boolean>
  title: string
  loading: boolean
}

export default function ModalAksesOverride({ open, onClose, onConfirm, title, loading: externalLoading }: Props) {
  const [step, setStep] = useState<'confirm' | 'login'>('confirm')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleConfirm = () => {
    setStep('login')
    setError('')
  }

  const handleClose = () => {
    setStep('confirm')
    setUsername('')
    setPassword('')
    setError('')
    onClose()
  }

  const handleVerify = async () => {
    if (!username || !password) {
      setError('Username dan Password wajib diisi')
      return
    }
    setLoading(true)
    setError('')
    try {
      const ok = await onConfirm(username, password)
      if (!ok) {
        setError('Verifikasi gagal, coba lagi')
      }
    } catch {
      setError('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-modal shadow-2xl w-[420px] max-w-[95vw] flex flex-col p-6">
        {step === 'confirm' ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-800">Anda tidak mempunyai akses untuk {title}.</div>
                <div className="text-xs text-slate-500 mt-0.5">Lanjutkan dengan verifikasi supervisor?</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={handleClose} className="text-xs">Tidak</Button>
              <Button onClick={handleConfirm} className="text-xs">Ya, Lanjutkan</Button>
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold text-sm text-slate-800 mb-1">Verifikasi Supervisor</div>
            <div className="text-xs text-slate-500 mb-4">Masukkan kredensial supervisor yang memiliki akses {title}.</div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Username (Email)</label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin@yopmail.com"
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleVerify() }}
                  placeholder="••••••"
                  className="text-xs"
                />
              </div>
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-pill px-3 py-2">{error}</div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={handleClose} className="text-xs" disabled={loading}>Batal</Button>
              <Button onClick={handleVerify} className="text-xs" disabled={loading}>
                {loading ? 'Memverifikasi...' : 'Verifikasi'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
