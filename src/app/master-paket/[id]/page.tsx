"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import PaketForm from '@/components/master-paket/PaketForm'

export default function ViewPaketPage() {
  const params = useParams()
  const id = params.id as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
      title={`Detail Paket - ${data.nama}`}
      readonly
      currentId={Number(id)}
      initial={{
        kode: data.kode,
        nama: data.nama,
        hargaJual: data.hargaJual,
        aktif: data.aktif,
        items: data.items,
      }}
      onSubmit={async () => {}}
    />
  )
}
