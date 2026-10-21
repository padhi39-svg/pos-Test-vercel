"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SupplierForm, { SupplierFormData } from '@/components/supplier/SupplierForm'
import { Supplier } from '@/lib/supplierStore'
import PageLoading from '@/components/ui/PageLoading'

export default function EditSupplierPage() {
  const params = useParams()
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSupplier = async () => {
      try {
        const response = await fetch(`/api/supplier/${params.id}`)
        if (!response.ok) throw new Error('Failed to load supplier')
        const data = await response.json()
        setSupplier(data)
      } catch {
        alert('Gagal memuat data supplier')
      } finally {
        setLoading(false)
      }
    }
    loadSupplier()
  }, [params.id])

  const handleSubmit = async (data: SupplierFormData) => {
    try {
      const response = await fetch(`/api/supplier/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to update supplier')
      router.push('/supplier?' + returnQuery)
    } catch {
      alert('Gagal mengupdate supplier')
    }
  }

  if (loading) return <PageLoading />
  if (!supplier) return <div className="text-sm text-slate-500 p-4">Supplier tidak ditemukan</div>

  return (
    <SupplierForm
      title="Edit Supplier"
      basePath="/supplier"
      initial={supplier}
      currentId={supplier.id}
      onSubmit={handleSubmit}
    />
  )
}
