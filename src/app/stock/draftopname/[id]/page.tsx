"use client"

import { useEffect, useState } from 'react'
import DraftOpnameForm from '@/components/stock/DraftOpnameForm'
import PageLoading from '@/components/ui/PageLoading'

export default function DraftOpnameDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id || 0) || 0
  const [loading, setLoading] = useState(true)
  const [initial, setInitial] = useState<any>(null)
  const [viewMode, setViewMode] = useState(false)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    setViewMode(sp.get('mode') === 'view')
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/stock-opname/${id}?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) { setInitial(null); return }
        const d = await res.json()
        const h = d?.header || {}
        setInitial({
          id: Number(h.id || id),
          number: h.number || '',
          tdate: String(h.tdate || '').slice(0, 10),
          warehouse_id: Number(h.warehouse_id || 0),
          notes: String(h.notes || ''),
          status: String(h.status || 'draft'),
          assignees: h.assignees ?? null,
          void: Number(h.void || 0),
          items: (Array.isArray(d?.items) ? d.items : []).map((it: any) => ({
            id: it.id,
            barang_id: Number(it.barang_id || 0),
            barang_code: it.barang_code || '',
            barang_name: it.barang_name || '',
            system_qty: Number(it.system_qty || 0),
            count_qty: it.count_qty == null ? null : Number(it.count_qty),
            variance_qty: it.variance_qty == null ? null : Number(it.variance_qty),
          })),
        })
      } catch { setInitial(null) } finally { setLoading(false) }
    }
    if (id) load()
  }, [id])

  if (loading) return <PageLoading />
  if (!initial) return <div className="container-card p-6 text-center text-slate-500">Data tidak ditemukan</div>

  return <DraftOpnameForm mode={viewMode ? 'view' : 'edit'} initial={initial} opnameId={id} />
}