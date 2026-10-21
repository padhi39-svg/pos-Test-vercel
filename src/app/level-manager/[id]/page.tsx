"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import LevelForm from '../LevelForm'

export default function LevelManagerViewPage() {
  const params = useParams()
  const router = useRouter()
  const idStr = Array.isArray(params?.id) ? params.id[0] : params?.id
  const id = Number(idStr)

  const [initial, setInitial] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/level-manager/${id}`)
        if (!res.ok) throw new Error('Gagal memuat level')
        const data = await res.json()
        setInitial(data)
      } catch (e) {
        console.error(e)
        alert('Gagal memuat data level')
        router.push('/level-manager')
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id, router])

  if (loading) return <div className="p-4">Memuat...</div>
  if (!initial) return <div className="p-4">Data tidak ditemukan</div>

  return (
    <LevelForm
      title={`Level Manager: ${initial.name || initial.code}`}
      basePath="/level-manager"
      initial={initial}
      currentId={id}
      readonly
    />
  )
}
