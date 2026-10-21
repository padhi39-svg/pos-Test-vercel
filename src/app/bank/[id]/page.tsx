"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BankForm from '@/components/master/BankForm'

export default function BankDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [initial, setInitial] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/banks/${params.id}`)
        if (!res.ok) throw new Error('Not found')
        const data = await res.json()
        setInitial({
          bankName: data.bank_name,
          ownerName: data.owner_name,
          accountNumber: data.account_number,
        })
      } catch (e) {
        console.error(e)
        alert('Data tidak ditemukan')
        router.push('/bank?' + returnQuery)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id, router])

  if (loading) return <div className="p-4">Memuat...</div>
  if (!initial) return null

  return (
    <BankForm
      title="Detail Bank"
      basePath="/bank"
      initial={initial}
      onSubmit={() => {}}
      readonly
      currentId={Number(params.id)}
    />
  )
}
