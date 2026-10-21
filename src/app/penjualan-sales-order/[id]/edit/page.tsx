"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import PageLoading from '@/components/ui/PageLoading'
import SalesOrderForm, { mapSalesOrderToInitial } from '@/components/sales/SalesOrderForm'

export default function EditSalesOrderPage() {
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : String(params?.id || '')
  const [initial, setInitial] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const res = await fetch(`/api/sales-orders/${id}`)
        if (!res.ok) throw new Error('Gagal memuat Sales Order')
        const data = await res.json()
        setInitial(mapSalesOrderToInitial(data))
      } catch (e: any) {
        setError(e.message || 'Gagal memuat data')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) return <PageLoading />
  if (error) return <div className="p-6 text-center text-coral-dark">{error}</div>
  if (!initial) return <div className="p-6 text-center text-slate-600">Data tidak ditemukan</div>

  return (
    <SalesOrderForm
      title="Edit Sales Order"
      subtitle="Ubah data sales order"
      backHref="/penjualan-sales-order"
      initial={initial}
    />
  )
}
