"use client"

import { useEffect, useState } from 'react'
import MemorialJournalForm from '@/components/memorial/MemorialJournalForm'
import PageLoading from '@/components/ui/PageLoading'

export default function EditJurnalMemorialPage({ params }: { params: { id: string } }) {
  const id = Number(params.id || 0) || 0
  const [loading, setLoading] = useState(true)
  const [initial, setInitial] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/memorial-journals/${id}`, { cache: 'no-store' })
        if (!res.ok) { setInitial(null); return }
        const d = await res.json()
        setInitial({
          id: d.id,
          journal_number: d.journal_number,
          journal_date: d.journal_date,
          notes: d.notes,
          status: d.status,
          detail: (Array.isArray(d.detail) ? d.detail : []).map((x: any) => ({
            temp_id: x.id ? String(x.id) : x.temp_id,
            account_id: x.account_id,
            account_code: x.account_code,
            account_name: x.account_name,
            notes: x.notes || '',
            debit: Number(x.debit || 0),
            credit: Number(x.credit || 0),
          })),
        })
      } catch { setInitial(null) } finally { setLoading(false) }
    }
    if (id) load()
  }, [id])

  if (loading) return <PageLoading />
  if (!initial) return <div className="container-card p-6 text-center text-slate-500">Data tidak ditemukan</div>

  return <MemorialJournalForm mode="edit" initial={initial} journalId={id} />
}