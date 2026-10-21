"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

type Invoice = {
  id: number
  transactionNumber: string
  customerName: string | null
  total: number
  createdAt: string
  fakturPajak: string | null
}

export default function GenerateFakturPajakPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ id: number; nomor: string }[]>([])

  const returnQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('return') || '' : ''

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/faktur-pajak/invoices')
      if (!res.ok) { setError('Gagal memuat data'); return }
      const data = await res.json()
      setInvoices(data)
    } catch {
      setError('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === invoices.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(invoices.map(i => i.id)))
    }
  }

  const handleGenerate = useCallback(async () => {
    if (generating || selected.size === 0) return
    setGenerating(true)
    setError('')
    setSuccess([])
    try {
      const res = await fetch('/api/faktur-pajak/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: [...selected] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err?.error || 'Gagal generate')
        return
      }
      const data = await res.json()
      setSuccess(data.results || [])
      setSelected(new Set())
      loadInvoices()
    } catch {
      setError('Gagal generate nomor faktur')
    } finally {
      setGenerating(false)
    }
  }, [generating, selected, loadInvoices])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-slate-800">Generate Faktur Pajak</h1>
        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={generating || selected.size === 0}
          >
            {generating ? 'Menggenerate...' : `Generate (${selected.size})`}
          </Button>
          <Button variant="outline" onClick={() => router.push('/penjualan?' + returnQuery)}>Kembali</Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-pill text-sm">{error}</div>
      )}

      {success.length > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-pill text-sm">
          {success.length} nomor faktur berhasil digenerate:
          <ul className="mt-1 list-disc list-inside">
            {success.map(s => (
              <li key={s.id}>Invoice #{s.id} → <strong>{s.nomor}</strong></li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="px-3 py-2 text-left w-8">
                <input type="checkbox" onChange={selectAll} checked={selected.size === invoices.length && invoices.length > 0} />
              </th>
              <th className="px-3 py-2 text-left">No. Transaksi</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Memuat...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Semua invoice sudah memiliki nomor faktur</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggle(inv.id)} />
                </td>
                <td className="px-3 py-2 font-medium">{inv.transactionNumber}</td>
                <td className="px-3 py-2 text-slate-600">{inv.customerName || '-'}</td>
                <td className="px-3 py-2 text-right">{inv.total.toLocaleString()}</td>
                <td className="px-3 py-2 text-slate-500 text-xs">{inv.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
