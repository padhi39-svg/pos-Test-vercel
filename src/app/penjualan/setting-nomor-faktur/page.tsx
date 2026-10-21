"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function SettingNomorFakturPage() {
  const router = useRouter()
  const [prefix, setPrefix] = useState('010.000-24.')
  const [padding, setPadding] = useState('5')
  const [nextNumber, setNextNumber] = useState('1')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const returnQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('return') || '' : ''

  useEffect(() => {
    fetch('/api/faktur-pajak/settings')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setPrefix(data.faktur_pajak_prefix || '010.000-24.')
        setPadding(data.faktur_pajak_padding || '5')
        setNextNumber(data.faktur_pajak_next_number || '1')
      })
      .catch(() => setError('Gagal memuat pengaturan'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/faktur-pajak/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'faktur_pajak_prefix', value: prefix },
            { key: 'faktur_pajak_padding', value: padding },
            { key: 'faktur_pajak_next_number', value: nextNumber },
          ],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err?.error || 'Gagal menyimpan')
        return
      }
      router.push('/penjualan?' + returnQuery)
    } catch {
      setError('Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }, [saving, prefix, padding, nextNumber, router, returnQuery])

  if (loading) {
    return <div className="p-6 text-slate-500">Memuat...</div>
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-lg font-semibold text-slate-800 mb-4">Setting Nomor Faktur Pajak</h1>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-pill text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 gap-4">
        <label className="flex items-center gap-3">
          <span className="w-28 text-slate-600 shrink-0 text-sm">Prefix</span>
          <Input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="010.000-24." />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-28 text-slate-600 shrink-0 text-sm">Padding</span>
          <Input value={padding} onChange={e => setPadding(e.target.value)} placeholder="5" />
          <span className="text-xs text-slate-400">(jumlah digit nomor urut, misal 5 → 00001)</span>
        </label>
        <label className="flex items-center gap-3">
          <span className="w-28 text-slate-600 shrink-0 text-sm">Nomor Urut</span>
          <Input value={nextNumber} onChange={e => setNextNumber(e.target.value)} placeholder="1" />
          <span className="text-xs text-slate-400">(nomor urut berikutnya)</span>
        </label>
      </div>
      <div className="flex gap-3 mt-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Menyimpan...' : 'Simpan'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/penjualan?' + returnQuery)}>Batal</Button>
      </div>
    </div>
  )
}
