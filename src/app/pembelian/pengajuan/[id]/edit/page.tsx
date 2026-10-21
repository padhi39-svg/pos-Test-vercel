"use client"
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import PurchaseRequestForm from '@/components/purchase/PurchaseRequestForm'
import { showSuccess, showError, CrudErrors, CrudMessages } from '@/lib/notification'
import PageLoading from '@/components/ui/PageLoading'

export default function PurchaseRequestEditPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/purchase-requests/${id}`, { cache: 'no-store' })
        const d = await res.json().catch(() => null)
        setData(d)
      } finally { setLoading(false) }
    })()
  }, [id])

  const onSubmit = async (formData: any) => {
    const res = await fetch(`/api/purchase-requests/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_date: formData.requestDate,
        expected_date: formData.expectedDate,
        requester_name: formData.requesterName,
        items: formData.items,
      }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      showError(d?.error || CrudErrors.updateFailed('pengajuan'))
      throw new Error('Save failed')
    }
    showSuccess(CrudMessages.updated('pengajuan'))
  }

  if (loading) return <PageLoading />
  if (!data) return <div className="p-4">Data tidak ditemukan</div>

  const items = Array.isArray(data.items) ? data.items.map((it: any) => ({
    id: it.id,
    barang_id: it.barang_id,
    barang_code: it.barang_code,
    barang_name: it.barang_name,
    quantity: it.quantity,
    unit_name: it.unit_name,
    unit_ratio: it.unit_ratio,
  })) : []

  return (
    <PurchaseRequestForm
      title="Edit Pengajuan Pembelian"
      subtitle={`No. ${data.request_number}`}
      backHref="/pembelian/pengajuan"
      initial={{
        request_number: data.request_number,
        request_date: data.request_date,
        expected_date: data.expected_date,
        requester_name: data.requester_name,
        items,
      }}
      onSubmit={onSubmit}
    />
  )
}
