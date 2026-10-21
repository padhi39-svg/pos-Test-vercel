"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import LevelForm from '../../LevelForm'
import { showError, showSuccess } from '@/lib/notification'

export default function LevelManagerEditPage() {
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
      } catch (e: any) {
        console.error(e)
        showError(e.message || 'Gagal memuat data level')
        router.push('/level-manager')
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id, router])

  const onSubmit = async (payload: any) => {
    const res = await fetch(`/api/level-manager/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: payload.name, permissions: payload.permissions })
    })
    if (!res.ok) {
      const d = await res.json().catch(()=>({}))
      showError(d?.details ? `${d.error}: ${d.details}` : (d?.error || 'Gagal menyimpan perubahan'))
      return res
    }
    showSuccess('Level berhasil diperbarui')
    router.push('/level-manager')
    return res
  }

  if (loading) return <div className="p-4">Memuat...</div>
  if (!initial) return <div className="p-4">Data tidak ditemukan</div>

  return (
    <LevelForm
      title={`Edit Level Manager: ${initial.name || initial.code}`}
      basePath="/level-manager"
      initial={initial}
      onSubmit={onSubmit}
      currentId={id}
    />
  )
}
