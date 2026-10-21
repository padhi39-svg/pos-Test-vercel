"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import LantaiForm from '@/components/lantai/LantaiForm'

export default function ViewFloorPage() {
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

  if (loading) return <div className="text-slate-500">Memuat...</div>
  if (!item) return <div className="text-slate-500">Data tidak ditemukan</div>

  return (
    <LantaiForm
      title={'Detail Lantai ' + item.code}
      basePath="/lantai"
      currentId={id}
      initial={item}
      readonly
    />
  )
}
