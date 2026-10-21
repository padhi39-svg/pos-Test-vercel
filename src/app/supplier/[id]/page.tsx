"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SupplierForm from '@/components/supplier/SupplierForm'
import { Supplier } from '@/lib/supplierStore'
import PageLoading from '@/components/ui/PageLoading'

export default function ViewSupplierPage() {
  const params = useParams()
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

  if (loading) return <PageLoading />
  if (!supplier) return <div className="text-sm text-slate-500 p-4">Supplier tidak ditemukan</div>

  return (
    <SupplierForm
      title="Detail Supplier"
      basePath="/supplier"
      initial={supplier}
      currentId={supplier.id}
      readonly
      onSubmit={() => {}}
    />
  )
}
