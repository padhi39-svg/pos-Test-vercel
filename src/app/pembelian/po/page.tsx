"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PurchaseOrderList from '@/components/purchase/PurchaseOrderList'
import PageLoading from '@/components/ui/PageLoading'

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/purchase-orders')
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleVoid = async (id: number) => {
    if (!confirm('Yakin ingin void PO ini?')) return
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ void: 1 })
      })
      if (!res.ok) throw new Error('Gagal void PO')
      alert('PO berhasil di-void')
      load()
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
  }

  if (loading) {
    return <PageLoading />
  }

  return (
    <>
      <PurchaseOrderList items={data} onVoid={handleVoid} onRefresh={load} />
    </>
  )
}
