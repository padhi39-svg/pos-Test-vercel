"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import CustomerForm, { CustomerFormData } from '@/components/customer/CustomerForm'
import PageLoading from '@/components/ui/PageLoading'
import { showSuccess, showError, CrudMessages, CrudErrors } from '@/lib/notification'

export default function EditCustomerPage() {
  const params = useParams()
  const id = Number(params?.id)
  const [item, setItem] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!Number.isFinite(id)) return

    const loadCustomer = async () => {
      try {
        const response = await fetch(`/api/customer/${id}`)
        if (response.ok) {
          const customer = await response.json()
          setItem(customer || null)
        }
      } catch (error) {
        console.error('Error loading customer:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCustomer()
  }, [id])

  const onSubmit = async (data: CustomerFormData) => {
    const response = await fetch(`/api/customer/${id}`, {
      method: 'PUT',
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
        salesId: data.salesId,
        jenisCustomerId: data.jenisCustomerId,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      showError(err?.error || CrudErrors.updateFailed('customer'))
      throw new Error('Save failed')
    }

    showSuccess(CrudMessages.updated('customer'))
  }

  if (loading) return <PageLoading />
  if (!item) return <div className="text-slate-500">Data tidak ditemukan</div>

  return (
    <CustomerForm
      title={`Edit Customer ${item.code}`}
      basePath="/customer"
      initial={item}
      currentId={item.id}
      onSubmit={onSubmit}
    />
  )
}
