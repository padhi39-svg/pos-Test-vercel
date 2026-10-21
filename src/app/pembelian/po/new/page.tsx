"use client"
import { showSuccess, showError } from '@/lib/notification'
import PurchaseOrderForm from '@/components/purchase/PurchaseOrderForm'
import type { PurchaseOrderFormInitial } from '@/components/purchase/PurchaseOrderForm'

export default function NewPOPage() {
  return (
    <PurchaseOrderForm
      title="Purchase Order"
      subtitle="Buat purchase order baru"
      onSubmit={async (data) => {
        const res = await fetch('/api/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderDate: data.orderDate,
            expectedDate: data.expectedDate,
            supplierId: data.supplierId,
            discountPercent: data.discountPercent,
            ppnPercent: data.ppnPercent,
            poStatus: data.poStatus,
            notes: data.notes,
            items: data.items,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Gagal menyimpan PO')
        }
        const result = await res.json().catch(() => ({}))
        const no = result?.poNumber || result?.po_number || 'N/A'
        showSuccess(`PO berhasil disimpan! Nomor: ${no}`)
        return result
      }}
    />
  )
}
