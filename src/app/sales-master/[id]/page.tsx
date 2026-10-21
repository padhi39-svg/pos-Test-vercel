"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SalesForm from '@/components/sales/SalesForm'
import PageLoading from '@/components/ui/PageLoading'

export default function SalesDetailPage() {
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

  if (!id || Number.isNaN(id)) {
    return <div className="text-red-600 text-sm">ID tidak valid</div>
  }

  if (loading) return <PageLoading />
  if (!item) return <div className="text-slate-500">Data tidak ditemukan</div>

  return (
    <SalesForm
      title="Detail Sales"
      basePath={basePath}
      initial={item}
      currentId={id}
      readonly
      onSubmit={async () => {}}
    />
  )
}
