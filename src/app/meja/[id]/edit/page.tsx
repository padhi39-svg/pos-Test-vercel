"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import PageLoading from '@/components/ui/PageLoading'
import MejaForm from '@/components/meja/MejaForm'

export default function EditTablePage() {
  const params = useParams()
  const id = Number(params?.id)
  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/meja/${id}`)
        const found = res.ok ? await res.json() : null
        if (found) setItem(found)
      } catch {
        setItem(null)
      } finally {
        setLoading(false)
      }
    }
    if (Number.isFinite(id)) load()
  }, [id])

  if (loading) return <PageLoading />
  if (!item) return <div className="text-slate-500 p-4">Data tidak ditemukan</div>

  return (
    <MejaForm
      title={'Edit Meja ' + item.code}
      basePath="/meja"
      currentId={id}
      initial={item}
    />
  )
}
