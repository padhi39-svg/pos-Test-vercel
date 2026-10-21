"use client"
import { useEffect, useState } from 'react'
import PeriodeForm, { PeriodeFormData } from '@/components/periode/PeriodeForm'
import { useParams, useRouter } from 'next/navigation'

export default function EditPeriodePage() {
  const params = useParams()
  const id = Number(params?.id)
  const router = useRouter()
  const [item, setItem] = useState<any | null>(null)

  useEffect(() => {
    if (!Number.isFinite(id)) return
    let destroyed = false
    ;(async () => {
      try {
        const res = await fetch(`/api/periode/${id}`, { cache: 'no-store' })
        const d = await res.json().catch(()=>({}))
        if (!destroyed) {
          if (res.ok && d?.id) {
            setItem({
              id: d.id,
              code: d.code,
              name: d.name,
              startDate: d.start_date,
              endDate: d.end_date,
              isActive: !!d.is_active,
              status_buku: d.status_buku,
            })
          } else {
            setItem(null)
          }
        }
      } catch {
        if (!destroyed) setItem(null)
      }
    })()
    return () => { destroyed = true }
  }, [id])

  if (!item) return <div className="text-slate-500">Data tidak ditemukan</div>

  const onSubmit = async (data: PeriodeFormData) => {
    try {
      const res = await fetch(`/api/periode/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          isActive: data.isActive,
          status_buku: item?.status_buku || 'OPEN',
        }),
      })
      const d = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(d?.error || 'Gagal menyimpan perubahan')
      router.push('/periode')
    } catch (e:any) {
      alert(e?.message || 'Gagal menyimpan perubahan')
    }
  }

  return (
    <PeriodeForm
      title={`Edit Periode ${item.code}`}
      basePath="/periode"
      initial={item}
      currentId={item.id}
      onSubmit={onSubmit}
    />
  )
}
