"use client"
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import BarangPembantuForm from '@/components/barang-pembantu/BarangPembantuForm'
import PageLoading from '@/components/ui/PageLoading'

export default function Page() {
  const params = useParams<{ id: string }>()
  const [item, setItem] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/barang/${params.id}`)
        const data = await res.json()
        setItem(data)
      } catch (e) {
        console.error('Load error:', e)
        setItem(null)
      } finally {
        setLoading(false)
      }
    }
    if (params.id) load()
  }, [params.id])

  if (loading) return <PageLoading />
  if (!item || item.jenis !== 3) return <div className="text-slate-500">Data tidak ditemukan atau bukan Barang Setengah Jadi.</div>

  return (
    <BarangPembantuForm
      title="Detail Barang Setengah Jadi"
      basePath="/master/barang-pembantu"
      initial={item}
      currentId={item.id}
      readonly
      onSubmit={async () => {}}
    />
  )
}
