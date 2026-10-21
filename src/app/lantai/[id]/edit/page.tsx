"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import PageLoading from '@/components/ui/PageLoading'
import LantaiForm from '@/components/lantai/LantaiForm'

export default function EditFloorPage() {
  const params = useParams()
  const id = Number(params?.id)
  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/floors/${id}`)
        const found = res.ok ? await res.json() : null
        setItem(found)
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
    <LantaiForm
      title={'Edit Lantai ' + item.code}
      basePath="/lantai"
      currentId={id}
      initial={item}
    />
  )
}
