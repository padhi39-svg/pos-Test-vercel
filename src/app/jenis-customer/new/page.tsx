"use client"

import { useRouter } from 'next/navigation'
import MasterForm from '@/components/master/MasterForm'
import { showSuccess, showError } from '@/lib/notification'

export default function NewJenisCustomerPage() {
  const router = useRouter()

  const handleSubmit = async (data: { code: string; name: string }) => {
    try {
      const res = await fetch('/api/jenis-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showError(err?.error || 'Gagal menambah jenis customer')
        return
      }
      showSuccess('Jenis customer berhasil ditambahkan')
      router.push('/jenis-customer')
    } catch {
      showError('Gagal menambah jenis customer')
    }
  }

  return (
    <MasterForm
      title="Tambah Jenis Customer"
      basePath="/jenis-customer"
      onSubmit={handleSubmit}
      codeAutoGenerate
      nextCodeUrl="/api/jenis-customer/next-code"
    />
  )
}
