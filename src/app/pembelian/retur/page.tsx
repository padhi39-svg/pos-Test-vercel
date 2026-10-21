"use client"
import { useEffect, useState } from 'react'
import PurchaseList from '@/components/purchase/PurchaseList'
import PageLoading from '@/components/ui/PageLoading'

export default function PurchaseReturnListPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/purchases?is_return=1')
      const json = await res.json()
      setItems(Array.isArray(json) ? json : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleVoid = async (id: number) => {
    if (!confirm('Yakin ingin membatalkan (void) retur ini?')) return
    try {
      const res = await fetch(`/api/purchases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ void: 1 })
      })
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Gagal void retur')
      }
      alert('Retur berhasil di-void')
      load()
    } catch (e: any) {
      alert('Error: ' + (e?.message || 'Unknown error'))
    }
  }

  if (loading) {
    return <PageLoading />
  }

  return (
    <PurchaseList items={items} onVoid={handleVoid} onRefresh={load} isReturn />
  )
}
