"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PaketForm from '@/components/master-paket/PaketForm'

export default function EditPaketPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''

  useEffect(() => {
    if (!id) return
    fetch(`/api/master-paket/${id}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-6 text-center text-slate-500">Memuat...</div>
  if (!data) return <div className="p-6 text-center text-slate-500">Data tidak ditemukan</div>

  return (
    <PaketForm
      title={`Edit Paket - ${data.nama}`}
      currentId={Number(id)}
      initial={{
        kode: data.kode,
        nama: data.nama,
        hargaJual: data.hargaJual,
        aktif: data.aktif,
        items: data.items,
      }}
      onSubmit={async (formData) => {
        const res = await fetch(`/api/master-paket/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
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
