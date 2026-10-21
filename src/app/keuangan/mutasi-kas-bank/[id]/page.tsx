"use client"

import { useEffect, useState } from 'react'
import CashMutationForm from '@/components/cashbank/CashMutationForm'
import PageLoading from '@/components/ui/PageLoading'

export default function ViewMutasiKasBankPage({ params }: { params: { id: string } }) {
  const id = Number(params.id || 0) || 0
  const [loading, setLoading] = useState(true)
  const [initial, setInitial] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/cash-mutations/${id}`, { cache: 'no-store' })
        if (!res.ok) { setInitial(null); return }
        const d = await res.json()
        setInitial({
          id: d.id,
          mutation_number: d.mutation_number,
          mutation_date: d.mutation_date,
          cash_account_id: d.cash_account_id,
          cash_account_code: d.cash_account_code,
          cash_account_name: d.cash_account_name,
          mutation_type: d.mutation_type,
          notes: d.notes,
          status: d.status,
          detail: (Array.isArray(d.detail) ? d.detail : []).map((x: any) => ({
            temp_id: x.id ? String(x.id) : x.temp_id,
            account_id: x.account_id,
            account_code: x.account_code,
            account_name: x.account_name,
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

  return <CashMutationForm mode="view" initial={initial} />
}