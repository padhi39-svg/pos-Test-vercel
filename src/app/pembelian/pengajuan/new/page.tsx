"use client"
import { showSuccess, showError, CrudErrors } from '@/lib/notification'
import PurchaseRequestForm from '@/components/purchase/PurchaseRequestForm'

export default function PurchaseRequestNewPage() {
  const onSubmit = async (data: any) => {
    const res = await fetch('/api/purchase-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      showError(d?.error || CrudErrors.createFailed('pengajuan'))
      throw new Error('Save failed')
    }
    showSuccess(`Pengajuan dibuat: ${d?.requestNumber || ''}`)
  }

  return (
    <PurchaseRequestForm
      title="Pengajuan Pembelian"
      subtitle="Buat pengajuan pembelian baru"
      onSubmit={onSubmit}
    />
  )
}
