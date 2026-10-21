"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SalesForm from '@/components/sales/SalesForm'
import PageLoading from '@/components/ui/PageLoading'
import { showSuccess, showError, CrudMessages, CrudErrors } from '@/lib/notification'

export default function EditSalesPage() {
  const params = useParams()
  const idParam = params?.id
  const id = typeof idParam === 'string' ? parseInt(idParam, 10) : Array.isArray(idParam) ? parseInt(idParam[0], 10) : NaN
  const basePath = '/sales-master'
  const [item, setItem] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || Number.isNaN(id)) return
    const load = async () => {
      try {
        const res = await fetch(`/api/sales/${id}`)
        if (res.ok) {
          const data = await res.json()
          setItem(data)
        } else {
          setItem(null)
        }
      } catch (e) {
        console.error('Load sales failed', e)
        setItem(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleSubmit = async (data: any) => {
    if (!id || Number.isNaN(id)) throw new Error('ID tidak valid')

    const res = await fetch(`/api/sales/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      showError(body?.error || CrudErrors.updateFailed('sales'))
      throw new Error('Save failed')
    }
    showSuccess(CrudMessages.updated('sales'))
  }

  if (!id || Number.isNaN(id)) {
    return <div className="text-red-600 text-sm">ID tidak valid</div>
  }

  if (loading) return <PageLoading />
  if (!item) return <div className="text-slate-500">Data tidak ditemukan</div>

  return (
    <SalesForm
      title="Edit Sales"
      basePath={basePath}
      initial={item}
      currentId={id}
      onSubmit={handleSubmit}
    />
  )
}
