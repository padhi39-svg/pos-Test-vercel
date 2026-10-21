"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SeasonDiscountForm from '@/components/season/SeasonDiscountForm'

export default function EditSeasonDiscountPage() {
  const params = useParams()
  const idParam = params?.id
  const id = typeof idParam === 'string' ? parseInt(idParam, 10) : Array.isArray(idParam) ? parseInt(idParam[0], 10) : NaN
  const basePath = '/season-discount'
  const [item, setItem] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || Number.isNaN(id)) return
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/season-discount/${id}`)
        if (res.ok) {
          const data = await res.json()
          setItem(data)
        } else {
          setItem(null)
        }
      } catch {
        setItem(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleSubmit = async (data: any) => {
    if (!id || Number.isNaN(id)) return
    const res = await fetch(`/api/season-discount/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || 'Gagal menyimpan perubahan season discount')
    }
    return res
  }

  if (!id || Number.isNaN(id)) return <div className="p-3 text-sm text-red-600">ID tidak valid</div>
  if (loading) return <div className="p-3 text-center text-sm text-slate-600">Memuat data...</div>
  if (!item) return <div className="p-3 text-center text-sm text-red-600">Data tidak ditemukan</div>

  return (
    <SeasonDiscountForm
      title={`Edit Season Discount - ${item.code}`}
      basePath={basePath}
      initial={item}
      currentId={id}
      onSubmit={handleSubmit}
    />
  )
}
