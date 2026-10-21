"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import CustomerForm from '@/components/customer/CustomerForm'
import PageLoading from '@/components/ui/PageLoading'

export default function ViewCustomerPage() {
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

  if (loading) return <PageLoading />
  if (!item) return <div className="text-slate-500">Data tidak ditemukan</div>

  return (
    <CustomerForm
      title={`Customer ${item.code}`}
      basePath="/customer"
      initial={item}
      currentId={item.id}
      readonly
      onSubmit={async () => {}}
    />
  )
}
