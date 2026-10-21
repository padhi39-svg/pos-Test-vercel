"use client"

import { useEffect, useState } from 'react'
import ArAdvanceForm from '@/components/arAdvance/ArAdvanceForm'
import PageLoading from '@/components/ui/PageLoading'

export default function ViewUangMukaCustomerPage({ params }: { params: { id: string } }) {
  const id = Number(params.id || 0) || 0
  const [loading, setLoading] = useState(true)
  const [initial, setInitial] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/ar-advances/${id}`, { cache: 'no-store' })
        if (!res.ok) { setInitial(null); return }
        const d = await res.json()
        setInitial({
          id: d.id,
          kode_nota: d.kode_nota,
          tanggal: d.tanggal ? String(d.tanggal).slice(0, 10) : '',
          customer_id: Number(d.customer_id || 0),
          customer_code: d.customer_code || '',
          customer_name: d.customer_name || '',
          notes: d.notes || '',
          status: d.status,
          detail: (Array.isArray(d.detail) ? d.detail : []).map((x: any) => ({
            temp_id: x.id ? String(x.id) : x.temp_id,
            account_id: Number(x.account_id || 0),
            account_code: x.account_code || '',
            account_name: x.account_name || '',
            notes: x.notes || '',
            amount: Number(x.amount || 0),
          })),
        })
      } catch { setInitial(null) } finally { setLoading(false) }
    }
    if (id) load()
  }, [id])

  if (loading) return <PageLoading />
  if (!initial) return <div className="container-card p-6 text-center text-slate-500">Data tidak ditemukan</div>

  return <ArAdvanceForm mode="view" initial={initial} />
}
