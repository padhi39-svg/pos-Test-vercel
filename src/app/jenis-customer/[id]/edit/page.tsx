"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MasterForm from '@/components/master/MasterForm'
import { showSuccess, showError } from '@/lib/notification'

export default function EditJenisCustomerPage() {
  const params = useParams()
  const idParam = params?.id
  const id = typeof idParam === 'string' ? parseInt(idParam, 10) : NaN
  const basePath = '/jenis-customer'
  const router = useRouter()
  const [item, setItem] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || Number.isNaN(id)) return
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/jenis-customer/${id}`)
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

  const handleSubmit = async (data: { code: string; name: string }) => {
    try {
      const res = await fetch(`/api/jenis-customer/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showError(err?.error || 'Gagal mengubah jenis customer')
        return
      }
      showSuccess('Jenis customer berhasil diubah')
      router.push('/jenis-customer')
    } catch {
      showError('Gagal mengubah jenis customer')
    }
  }

  if (!id || Number.isNaN(id)) return <div className="p-3 text-sm text-red-600">ID tidak valid</div>
  if (loading) return <div className="p-3 text-center text-sm text-slate-600">Memuat data...</div>
  if (!item) return <div className="p-3 text-center text-sm text-red-600">Data tidak ditemukan</div>

  return (
    <MasterForm
      title={`Edit Jenis Customer - ${item.code}`}
      basePath={basePath}
      initial={{ code: item.code, name: item.name }}
      currentId={item.id}
      onSubmit={handleSubmit}
    />
  )
}
