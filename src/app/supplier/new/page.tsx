"use client"
import { useRouter } from 'next/navigation'
import SupplierForm, { SupplierFormData } from '@/components/supplier/SupplierForm'

export default function NewSupplierPage() {
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''

  const handleSubmit = async (data: SupplierFormData) => {
    try {
      const response = await fetch('/api/supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to create supplier')
      router.push('/supplier?' + returnQuery)
    } catch {
      alert('Gagal menambahkan supplier')
    }
  }

  return <SupplierForm title="Tambah Supplier" basePath="/supplier" onSubmit={handleSubmit} />
}
