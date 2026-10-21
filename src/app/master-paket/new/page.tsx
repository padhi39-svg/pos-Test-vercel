"use client"
import PaketForm from '@/components/master-paket/PaketForm'
import { useRouter } from 'next/navigation'

export default function NewPaketPage() {
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''

  return (
    <PaketForm
      title="Tambah Paket"
      onSubmit={async (data) => {
        const res = await fetch('/api/master-paket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || 'Gagal menyimpan')
        }
        router.push('/master-paket?' + returnQuery)
      }}
    />
  )
}
