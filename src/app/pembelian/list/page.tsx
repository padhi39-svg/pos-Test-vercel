"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PurchaseList from '@/components/purchase/PurchaseList'

export default function PembelianListPage() {
  const router = useRouter()
  const [purchases, setPurchases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/purchases?is_return=0')
      const json = await res.json()
      setPurchases(Array.isArray(json) ? json : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleVoid = async (id: number) => {
    if (!confirm('Yakin ingin membatalkan (void) pembelian ini?')) return
    try {
      const res = await fetch(`/api/purchases/${id}?void=1`, { method: 'PUT' })
      if (!res.ok) {
        const t = await res.text().catch(()=>'')
        throw new Error(t || 'Gagal void pembelian')
      }
      alert('Pembelian berhasil di-void')
      load()
    } catch (e: any) {
      alert('Error: ' + (e?.message || 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-primary mx-auto mb-3"></div>
        <p className="text-slate-600 text-sm">Memuat data...</p>
      </div>
    )
  }

  return (
    <>
      <PurchaseList items={purchases} onVoid={handleVoid} onRefresh={load} />
    </>
  )
}
