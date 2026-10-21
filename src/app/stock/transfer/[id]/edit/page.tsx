"use client"

import { useEffect, useState } from 'react'
import StockTransferForm from '@/components/stock/StockTransferForm'
import PageLoading from '@/components/ui/PageLoading'

export default function TransferEditPage({ params }: { params: { id: string } }) {
  const id = Number(params.id || 0) || 0
  const [loading, setLoading] = useState(true)
  const [initial, setInitial] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/stock-transfers/${id}`, { cache: 'no-store' })
        if (!res.ok) { setInitial(null); return }
        const d = await res.json()
        setInitial({
          id: d?.header?.id,
          number: d?.header?.number || '',
          tdate: String(d?.header?.tdate || '').slice(0, 10),
          from_warehouse_id: Number(d?.header?.from_warehouse_id || 0),
          to_warehouse_id: Number(d?.header?.to_warehouse_id || 0),
          from_warehouse: d?.header?.from_warehouse || '',
          to_warehouse: d?.header?.to_warehouse || '',
          notes: String(d?.header?.notes || ''),
          void: Number(d?.header?.void || 0),
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

  return <StockTransferForm mode="edit" initial={initial} transferId={id} />
}