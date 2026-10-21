"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApOpeningBalanceForm from '@/components/keuangan/ApOpeningBalanceForm'
import PageLoading from '@/components/ui/PageLoading'

export default function ApOpeningEditPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [row, setRow] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/ap-opening-balances/${params.id}`, { cache: 'no-store' })
        if (!res.ok) { router.push('/keuangan/saldo-awal-hutang'); return }
        setRow(await res.json())
      } finally { setLoading(false) }
    })()
  }, [params.id])

  if (loading) return <PageLoading />
  if (!row) return <div className="p-3">Data tidak ditemukan</div>

  return (
    <ApOpeningBalanceForm
      mode="edit"
      initial={row}
      backHref="/keuangan/saldo-awal-hutang"
    />
  )
}
