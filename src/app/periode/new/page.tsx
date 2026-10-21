"use client"
import { useRouter } from 'next/navigation'
import PeriodeForm, { PeriodeFormData } from '@/components/periode/PeriodeForm'

export default function NewPeriodePage() {
  const router = useRouter()

  const onSubmit = async (data: PeriodeFormData) => {
    try {
      const response = await fetch('/api/periode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: data.code,
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          isActive: data.isActive,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create periode')
      }

      const result = await response.json()
      console.log('Periode created in SQLite:', result)
      router.push('/periode')
    } catch (error) {
      console.error('Error creating periode:', error)
      alert('Gagal menambah periode ke database')
    }
  }

  return (
    <PeriodeForm
      title="Tambah Periode"
      basePath="/periode"
      onSubmit={onSubmit}
    />
  )
}
