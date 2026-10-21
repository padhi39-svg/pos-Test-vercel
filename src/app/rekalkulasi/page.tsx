"use client"

import { useEffect, useState } from 'react'

type Periode = {
  id: number
  name: string
  code?: string
  start_date: string
  end_date: string
  is_active?: number | boolean
  status_buku?: string
}

export default function RekalkulasiPage() {
  const [periodes, setPeriodes] = useState<Periode[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | ''>('' as any)
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    async function loadPeriodes() {
      try {
        const res = await fetch('/api/periode', { cache: 'no-store' })
        const data = await res.json()
        const list: Periode[] = Array.isArray(data) ? data : []
        const openOnly = list.filter(p => String(p.status_buku || 'OPEN').toUpperCase() === 'OPEN' || Number(p.is_active || 0) === 1)
        // Sort latest first by start_date
        openOnly.sort((a,b) => (a.start_date < b.start_date ? 1 : -1))
        setPeriodes(openOnly)
      } catch (e: any) {
        setError('Gagal memuat periode')
      }
    }
    loadPeriodes()
  }, [])

  async function handleRecalc() {
    setMessage('')
    setError('')
    if (!selectedId) {
      setError('Pilih periode terlebih dahulu')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/recalc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId: selectedId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Gagal rekalkulasi')
      setMessage(data?.message || 'Rekalkulasi selesai')
    } catch (e: any) {
      setError(e?.message || 'Gagal rekalkulasi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">Rekalkulasi Stok & HPP</h1>
      <p className="text-sm text-gray-600 mb-6">Pilih periode yang <b>OPEN/aktif</b> untuk dihitung ulang stok dan HPP Moving Average.</p>

      <div className="mb-4">
        <label className="block mb-2 text-sm font-medium">Periode</label>
        <select
          className="border rounded px-3 py-2 w-full"
          value={selectedId as any}
          onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : ('' as any))}
          disabled={loading}
        >
          <option value="">-- Pilih Periode (OPEN/aktif) --</option>
          {periodes.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.start_date} s/d {p.end_date})
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleRecalc}
        disabled={loading || !selectedId}
        className={`px-4 py-2 rounded text-white ${loading || !selectedId ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? 'Memproses...' : 'Proses Rekalkulasi'}
      </button>

      {message && (
        <div className="mt-4 p-3 rounded bg-green-100 text-green-800 text-sm">{message}</div>
      )}
      {error && (
        <div className="mt-4 p-3 rounded bg-red-100 text-red-800 text-sm">{error}</div>
      )}
    </div>
  )
}
