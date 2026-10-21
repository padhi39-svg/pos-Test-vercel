"use client"

import SalesForm from '@/components/sales/SalesForm'
import { showSuccess, showError, CrudMessages, CrudErrors } from '@/lib/notification'

export default function NewSalesPage() {
  const basePath = '/sales-master'

  const handleSubmit = async (data: any) => {
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      showError(body?.error || CrudErrors.createFailed('sales'))
      throw new Error('Save failed')
    }
    showSuccess(CrudMessages.created('sales'))
  }

  return (
    <SalesForm
      title="Tambah Sales"
      basePath={basePath}
      onSubmit={handleSubmit}
    />
  )
}
