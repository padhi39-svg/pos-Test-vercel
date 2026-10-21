"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ManufakturForm, { FormData } from '@/components/manufaktur/ManufakturForm'
import PageLoading from '@/components/ui/PageLoading'
import { showSuccess, showError } from '@/lib/notification'

type ManufakturData = {
  id: number
  nomor: string
  barang_id: number
  barang_code?: string
  barang_name?: string
  quantity: number
  tanggal: string
  notes: string
  warehouse_id: number
  status: string
  details: {
    barang_id: number
    barang_code: string
    barang_name: string
    quantity: number
    hpp_satuan: number
    total_hpp: number
  }[]
  biaya: {
    account_id: number
    account_code: string
    account_name: string
    notes: string
    debit: number
    credit: number
  }[]
}

export default function ManufakturEditPage({ params }: { params: { id: string } }) {
  const id = Number(params.id)
  const router = useRouter()
  const [initialData, setInitialData] = useState<ManufakturData | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/manufaktur/${id}?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) {
          showError('Data tidak ditemukan')
          router.push('/persediaan/manufaktur')
          return
        }
        const data: ManufakturData = await res.json()
        if (data.status !== 'draft') {
          showError('Cannot edit approved/void manufaktur')
          router.push(`/persediaan/manufaktur/${id}`)
          return
        }
        setInitialData(data)
      } catch {
        showError('Gagal memuat data')
        router.push('/persediaan/manufaktur')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const handleSubmit = async (formData: FormData) => {
    try {
      setSaving(true)
      const res = await fetch(`/api/manufaktur/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        showError(result?.error || 'Gagal mengubah manufaktur')
        return
      }
      alert('✅ Manufaktur berhasil diubah')
      router.push('/persediaan/manufaktur')
    } catch {
      showError('Gagal mengubah manufaktur')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoading />

  return (
    <ManufakturForm
      mode="edit"
      initialData={initialData}
      onSubmit={handleSubmit}
      loading={saving}
    />
  )
}