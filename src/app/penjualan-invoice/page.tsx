"use client"
import { useEffect, useState, useCallback } from 'react'
import SalesInvoiceList from '@/components/sales-invoice/SalesInvoiceList'
import PageLoading from '@/components/ui/PageLoading'
import type { SalesInvoice } from '@/components/sales-invoice/SalesInvoiceList'

export default function PenjualanInvoicePage() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([])
  const [loading, setLoading] = useState(true)

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/transactions')
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.filter((t: any) => t.transaction_type === 3))
      }
    } catch (error) {
      console.error('Error loading invoices:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  const handleVoid = async (id: number) => {
    if (!confirm('Yakin ingin membatalkan invoice ini?')) return
    try {
      const res = await fetch(`/api/transactions/${id}/void`, { method: 'PUT' })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || 'Gagal void invoice')
      }
      alert('Invoice berhasil dibatalkan')
      loadInvoices()
    } catch (e: any) {
      alert('Error: ' + (e?.message || 'Unknown error'))
    }
  }

  if (loading) return <PageLoading />

  return <SalesInvoiceList items={invoices} onVoid={handleVoid} onRefresh={loadInvoices} />
}
