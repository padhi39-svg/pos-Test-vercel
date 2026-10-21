"use client"
import BarangPembantuForm, { BarangPembantuFormData } from '@/components/barang-pembantu/BarangPembantuForm'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import PageLoading from '@/components/ui/PageLoading'
import { showSuccess, showError, CrudMessages, CrudErrors } from '@/lib/notification'

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

  const onSubmit = async (data: BarangPembantuFormData) => {
    const res = await fetch(`/api/barang/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, jenis: 3 }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showError(err?.error || CrudErrors.updateFailed('barang pembantu'))
      throw new Error('Save failed')
    }
    showSuccess(CrudMessages.updated('barang pembantu'))
  }

  if (loading) return <PageLoading />
  if (!item || item.jenis !== 3) return <div className="text-slate-500">Data tidak ditemukan atau bukan Barang Setengah Jadi.</div>

  return (
    <BarangPembantuForm
      title="Edit Barang Setengah Jadi"
      basePath="/master/barang-pembantu"
      initial={item}
      currentId={Number(params.id)}
      onSubmit={onSubmit}
    />
  )
}
