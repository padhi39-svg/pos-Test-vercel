"use client"

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import FormHeader from '@/components/ui/FormHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { showError, showSuccess } from '@/lib/notification'

type Header = {
  id: number
  number: string
  tdate: string
  warehouse_id: number
  notes?: string | null
  status: string
}

type Item = {
  id: number
  opname_id: number
  barang_id: number
  barang_code?: string
  barang_name?: string
  system_qty: number
  count_qty?: number | null
  variance_qty?: number | null
}

type Session = {
  id: number
  opname_id: number
  token: string
  assignee?: string | null
  status: string
  created_at?: string
}

type CountSummary = { session_id: number; lines: number; qty_base: number }

function statusBadgeClass(status: string) {
  const s = String(status || '').toLowerCase()
  if (s === 'draft') return 'bg-slate-100 text-slate-900'
  if (s === 'counting') return 'bg-blue-100 text-blue-900'
  if (s === 'submitted') return 'bg-amber-100 text-amber-900'
  if (s === 'approved') return 'bg-teal-bg text-teal-dark'
  if (s === 'posted') return 'bg-purple-100 text-purple-900'
  return 'bg-slate-100 text-slate-900'
}

export default function StockOpnameDetailPage() {
  const params = useParams() as { id?: string }
  const id = Number(params?.id || 0)

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'items' | 'sessions'>('items')
  const [header, setHeader] = useState<Header | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [counts, setCounts] = useState<CountSummary[]>([])
  const [assignee, setAssignee] = useState('')
  const [creatingSession, setCreatingSession] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<'recalc' | 'approve' | 'post' | null>(null)

  async function reloadDetail() {
    const r2 = await fetch(`/api/stock-opname/${id}?t=${Date.now()}`, { cache: 'no-store' })
    const d2 = r2.ok ? await r2.json() : null
    if (d2?.header) {
      setHeader(d2.header)
      setItems(Array.isArray(d2.items) ? d2.items : [])
      setSessions(Array.isArray(d2.sessions) ? d2.sessions : [])
      setCounts(Array.isArray(d2.counts) ? d2.counts : [])
    }
  }

  async function doRecalc() {
    try {
      setBusy('recalc')
      const res = await fetch(`/api/stock-opname/${id}/recalc`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showError(data?.error || 'Gagal recalc'); return }
      showSuccess(`Recalc berhasil (${data?.affected || 0} item)`)
      await reloadDetail()
    } catch (e: any) {
      showError(e?.message || 'Gagal recalc')
    } finally {
      setBusy(null)
    }
  }

  async function doApprove() {
    try {
      setBusy('approve')
      const res = await fetch(`/api/stock-opname/${id}/approve`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showError(data?.error || 'Gagal approve'); return }
      showSuccess('Dokumen di-approve')
      await reloadDetail()
    } catch (e: any) {
      showError(e?.message || 'Gagal approve')
    } finally {
      setBusy(null)
    }
  }

  async function doPost() {
    try {
      if (!confirm('Posting akan menyesuaikan stok sesuai variance. Lanjutkan?')) return
      setBusy('post')
      const res = await fetch(`/api/stock-opname/${id}/post`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showError(data?.error || 'Gagal posting'); return }
      showSuccess(`Posted. IN=${data?.inTotal || 0}, OUT=${data?.outTotal || 0}`)
      await reloadDetail()
    } catch (e: any) {
      showError(e?.message || 'Gagal posting')
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    if (!id) return
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/stock-opname/${id}`)
        const data = res.ok ? await res.json() : null
        if (!alive) return
        if (!data || data?.error) {
          showError(data?.error || 'Gagal memuat dokumen')
          return
        }
        setHeader(data.header)
        setItems(Array.isArray(data.items) ? data.items : [])
        setSessions(Array.isArray(data.sessions) ? data.sessions : [])
        setCounts(Array.isArray(data.counts) ? data.counts : [])
      } catch (e) {
        console.error(e)
        showError('Gagal memuat dokumen')
      } finally {
        setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id])

  const filteredItems = useMemo(() => {
    const s = q.trim().toLowerCase()
    return !s ? items : items.filter(it => `${it.barang_code || ''} ${it.barang_name || ''}`.toLowerCase().includes(s))
  }, [items, q])

  async function createSession() {
    try {
      setCreatingSession(true)
      const res = await fetch(`/api/stock-opname/${id}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee: assignee || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showError(data?.error || 'Gagal membuat session'); return }
      showSuccess('Session dibuat')
      await reloadDetail()
    } catch (e: any) {
      showError(e?.message || 'Gagal membuat session')
    } finally {
      setCreatingSession(false)
      setAssignee('')
      setTab('sessions')
    }
  }

  const statusText = String(header?.status || '-')

  return (
    <div className="space-y-4">
      <FormHeader
        title={header?.number || 'Stok Opname'}
        subtitle={`Tanggal: ${header?.tdate || '-'} · Status: ${statusText}`}
        backHref="/stock/opname"
        basePath="/stock/opname"
      />

      {/* Status card */}
      <div className="container-card p-3 text-xs space-y-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 text-xs">Status:</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${statusBadgeClass(statusText)}`}>{statusText}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" disabled={busy === 'recalc'} onClick={doRecalc} className="text-xs px-3 py-1.5 whitespace-nowrap" title="Recalc">
              {busy === 'recalc' ? 'Recalc...' : 'Recalc'}
            </Button>
            <Button type="button" variant="outline" disabled={busy === 'approve'} onClick={doApprove} className="text-xs px-3 py-1.5 whitespace-nowrap" title="Approve">
              {busy === 'approve' ? 'Approve...' : 'Approve'}
            </Button>
            <Button type="button" disabled={busy === 'post'} onClick={doPost} className="text-xs px-3 py-1.5 whitespace-nowrap" title="Post">
              {busy === 'post' ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
        <div className="text-xs text-slate-600">
          Gudang: #{header?.warehouse_id} {header?.notes ? `· Catatan: ${header.notes}` : ''}
        </div>
      </div>

      {/* Tabs */}
      <div className="container-card p-2 text-xs">
        <div className="flex items-center gap-2 p-1">
          <button
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${tab === 'items' ? 'bg-teal-primary text-white' : 'hover:bg-teal-bg text-slate-700'}`}
            onClick={() => setTab('items')}
          >
            Items
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${tab === 'sessions' ? 'bg-teal-primary text-white' : 'hover:bg-teal-bg text-slate-700'}`}
            onClick={() => setTab('sessions')}
          >
            Sessions
          </button>
        </div>
      </div>

      {tab === 'items' && (
        <div className="container-card p-3 text-xs space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm font-medium">Detail Item</div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode/nama..." className="text-xs w-48" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">Kode</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">Nama</th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">System Qty</th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">Count Qty</th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading && (
                  <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-500">Memuat...</td></tr>
                )}
                {!loading && filteredItems.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-500">Tidak ada item</td></tr>
                )}
                {filteredItems.map(it => (
                  <tr key={it.id} className="hover:bg-teal-bg/50">
                    <td className="px-2 py-1.5 font-mono text-slate-600">{it.barang_code}</td>
                    <td className="px-2 py-1.5 font-medium text-slate-800">{it.barang_name}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{Number(it.system_qty || 0).toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1.5 text-right">{it.count_qty == null ? '-' : Number(it.count_qty).toLocaleString('id-ID')}</td>
                    <td className={`px-2 py-1.5 text-right ${Number(it.variance_qty || 0) === 0 ? 'text-slate-600' : 'font-semibold text-amber-700'}`}>{it.variance_qty == null ? '-' : Number(it.variance_qty).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="container-card p-3 text-xs space-y-3">
          <div className="bg-teal-bg/40 border border-teal-bg rounded p-2 flex flex-col md:flex-row md:items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">Nama Petugas (opsional)</label>
              <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Isi nama petugas untuk label" className="text-xs" />
            </div>
            <Button type="button" disabled={creatingSession} onClick={createSession} className="text-xs px-3 py-1.5 whitespace-nowrap">
              {creatingSession ? 'Membuat...' : 'Buat Session'}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">Token</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">Petugas</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold">Status</th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">Baris</th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">Qty Base</th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sessions.length === 0 && (
                  <tr><td colSpan={6} className="px-2 py-6 text-center text-slate-500">Belum ada session</td></tr>
                )}
                {sessions.map(s => {
                  const sum = counts.find(c => Number(c.session_id) === Number(s.id))
                  return (
                    <tr key={s.id} className="hover:bg-teal-bg/50">
                      <td className="px-2 py-1.5 font-mono">{s.token}</td>
                      <td className="px-2 py-1.5">{s.assignee || '-'}</td>
                      <td className="px-2 py-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${s.status === 'open' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-800'}`}>{s.status}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right">{sum?.lines || 0}</td>
                      <td className="px-2 py-1.5 text-right">{Number(sum?.qty_base || 0).toLocaleString('id-ID')}</td>
                      <td className="px-2 py-1.5 text-right">
                        <a className="text-teal-primary hover:text-teal-dark font-medium" href={`/m/opname/${s.token}`} target="_blank" rel="noreferrer">Buka</a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sticky bottom action bar (mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t">
        <div className="max-w-3xl mx-auto px-3 py-2 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-600">Status: <span className="font-semibold">{statusText}</span></div>
          <div className="flex items-center gap-2">
            <button disabled={busy === 'recalc'} onClick={doRecalc} className="px-3 py-2 rounded-pill border text-sm disabled:opacity-50">{busy === 'recalc' ? 'Recalc...' : 'Recalc'}</button>
            <button disabled={busy === 'approve'} onClick={doApprove} className="px-3 py-2 rounded bg-teal-primary hover:bg-teal-dark text-white text-sm disabled:opacity-50">{busy === 'approve' ? 'Approve...' : 'Approve'}</button>
            <button disabled={busy === 'post'} onClick={doPost} className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm disabled:opacity-50">{busy === 'post' ? 'Posting...' : 'Post'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}