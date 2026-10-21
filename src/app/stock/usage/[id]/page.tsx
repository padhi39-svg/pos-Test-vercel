"use client"

import { useEffect, useState } from 'react'
import StockUsageForm from '@/components/stock/StockUsageForm'
import PageLoading from '@/components/ui/PageLoading'

export default function UsageViewPage({ params }: { params: { id: string } }) {
  const id = Number(params.id || 0) || 0
  const [loading, setLoading] = useState(true)
  const [initial, setInitial] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/stock-usage/${id}?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) { setInitial(null); return }
        const d = await res.json()
        setInitial({
          id: d?.header?.id,
          number: d?.header?.number || '',
          tdate: String(d?.header?.tdate || '').slice(0, 10),
          warehouse_id: Number(d?.header?.warehouse_id || 0),
          warehouse: d?.header?.warehouse || '',
          notes: String(d?.header?.notes || ''),
          void: Number(d?.header?.void || 0),
          status: String(d?.header?.status || 'draft'),
          items: (Array.isArray(d?.items) ? d.items : []).map((it: any) => ({
            id: it.id,
            barang_id: Number(it.barang_id || 0),
            barang_code: it.barang_code || '',
            barang_name: it.barang_name || '',
            qty: Number(it.qty || 0),
            unit_id: Number(it.unit_id || 0) || undefined,
            unit_name: it.unit_name || '',
            unit_ratio: Number(it.unit_ratio || 1) || 1,
          })),
        })
      } catch { setInitial(null) } finally { setLoading(false) }
    }
    if (id) load()
  }, [id])

  if (loading) return <PageLoading />
  if (!initial) return <div className="container-card p-6 text-center text-slate-500">Data tidak ditemukan</div>

  return <StockUsageForm mode="view" initial={initial} />
}