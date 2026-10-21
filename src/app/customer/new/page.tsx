"use client"
import CustomerForm, { CustomerFormData } from '@/components/customer/CustomerForm'
import { showSuccess, showError, CrudMessages, CrudErrors } from '@/lib/notification'

export default function NewCustomerPage() {
  const onSubmit = async (data: CustomerFormData) => {
    const response = await fetch('/api/customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: data.code,
        name: data.name,
        address: data.address,
        phone: data.phone,
        npwp: data.npwp,
        discountPercent: data.discountPercent,
        term: data.term,
        accountId: data.accountId,
        kodeInt: data.kodeInt,
        salesId: data.salesId,
        jenisCustomerId: data.jenisCustomerId,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      showError(err?.error || CrudErrors.createFailed('customer'))
      throw new Error('Save failed')
    }

    showSuccess(CrudMessages.created('customer'))
  }

  return (
    <CustomerForm
      title="Tambah Customer"
      basePath="/customer"
      onSubmit={onSubmit}
    />
  )
}
