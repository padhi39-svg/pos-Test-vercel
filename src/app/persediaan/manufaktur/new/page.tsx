"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ManufakturForm, { FormData } from '@/components/manufaktur/ManufakturForm'
import { showError } from '@/lib/notification'

export default function ManufakturNewPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: FormData) => {
    try {
      setLoading(true)
      const res = await fetch('/api/manufaktur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        showError(result?.error || 'Gagal menyimpan manufaktur')
        return
      }
      alert(`✅ Manufaktur berhasil disimpan: ${result.nomor || ''}`)
      router.push('/persediaan/manufaktur')
    } catch {
      showError('Gagal menyimpan manufaktur')
    } finally {
      setLoading(false)
    }
  }

  return <ManufakturForm mode="new" onSubmit={handleSubmit} loading={loading} />
}