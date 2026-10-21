"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import GudangForm from '@/components/gudang/GudangForm'

export default function GudangDetailPage() {
  const params = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [params.id])

  const loadData = async () => {
    try {
      const res = await fetch(`/api/gudang/${params.id}`)
      if (res.ok) {
        const result = await res.json()
        setData(result)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-center">Memuat data...</div>
  if (!data) return <div className="p-8 text-center">Data tidak ditemukan</div>

  return (
    <GudangForm 
      title="Detail Gudang" 
      basePath="/gudang" 
      initial={data}
      currentId={data.id}
      readonly
    />
  )
}
