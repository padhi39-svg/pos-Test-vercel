"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BankForm, { BankFormData } from '@/components/master/BankForm'
import { showSuccess, showError, CrudMessages, CrudErrors } from '@/lib/notification'

export default function BankEditPage() {
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
        showError('Data tidak ditemukan')
        router.push('/bank?' + returnQuery)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id, router])

  const onSubmit = async (form: BankFormData) => {
    try {
      const res = await fetch('/api/banks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(params.id), ...form }),
      })
      if (!res.ok) {
        const err = await res.json().catch(()=>({}))
        showError(err?.error || CrudErrors.updateFailed('bank'))
        return
      }
      showSuccess(CrudMessages.updated('bank'))
      router.push('/bank?' + returnQuery)
    } catch (e) {
      console.error(e)
      showError(CrudErrors.updateFailed('bank'))
    }
  }

  if (loading) return <div className="p-4">Memuat...</div>
  if (!initial) return null

  return (
    <BankForm
      title="Edit Bank"
      basePath="/bank"
      initial={initial}
      onSubmit={onSubmit}
    />
  )
}
