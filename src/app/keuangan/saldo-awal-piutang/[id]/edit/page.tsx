"use client"
import { useEffect, useState } from 'react'
import ArOpeningBalanceForm from '@/components/keuangan/ArOpeningBalanceForm'
import PageLoading from '@/components/ui/PageLoading'

export default function ArOpeningEditPage({ params }: { params: { id: string } }) {
  const [initial, setInitial] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/ar-opening-balances/${params.id}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        setInitial(data)
      } catch {} finally { setLoading(false) }
    })()
  }, [params.id])

  if (loading) return <PageLoading />
  if (!initial) return <div className="p-3 text-slate-500">Data tidak ditemukan</div>

  return (
    <ArOpeningBalanceForm
      mode="edit"
      initial={initial}
      backHref="/keuangan/saldo-awal-piutang"
    />
  )
}
