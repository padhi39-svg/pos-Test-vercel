"use client"
import { useEffect, useState } from 'react'
import PeriodeForm from '@/components/periode/PeriodeForm'
import { useParams } from 'next/navigation'

export default function ViewPeriodePage() {
  const params = useParams()
  const id = Number(params?.id)
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

  return (
    <PeriodeForm
      title={`Periode ${item.code}`}
      basePath="/periode"
      initial={item}
      currentId={item.id}
      readonly
      onSubmit={() => {}}
    />
  )
}
