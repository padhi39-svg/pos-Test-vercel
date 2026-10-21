"use client"
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

// Import langsung komponen POS Retail agar mengurangi risiko chunk load/hydration error
import POSRetailPage from '@/app/pos/retail/page'

export default function POSRetailEditPage() {
  const params = useParams() as { id?: string }
  const id = params?.id
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const loadTx = async () => {
      if (!id) { setError('ID transaksi tidak valid'); setLoading(false); return }
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/transactions/${id}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || 'Gagal mengambil data transaksi')
        }
        const data = await res.json()
        // Simpan ke global agar diproses oleh POSRetailPage
        if (typeof window !== 'undefined') {
          ;(window as any).__POS_EDIT_TX = data
        }
        // beri sedikit jeda supaya POSRetailPage bisa membaca global saat mount
        setReady(true)
      } catch (e: any) {
        console.error('Load transaksi gagal:', e)
        setError(e?.message || 'Gagal memuat transaksi')
      } finally {
        setLoading(false)
      }
    }
    loadTx()
  }, [id])

  if (loading) {
    return (
      <div className="space-y-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Edit POS Retail</h1>
          {id ? (<p className="text-xs text-slate-500 mt-1">Mengambil transaksi #{id}...</p>) : null}
        </div>
        <div className="container-card p-4 text-sm text-slate-600">Memuat data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Edit POS Retail</h1>
          {id ? (<p className="text-xs text-red-600 mt-1">Gagal memuat transaksi #{id}: {error}</p>) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Render UI POS Retail. Data akan otomatis diprefill oleh halaman POS melalui global __POS_EDIT_TX */}
      {ready && <POSRetailPage />}
    </div>
  )
}
