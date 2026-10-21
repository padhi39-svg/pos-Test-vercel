"use client"
import SalesInvoiceForm from '@/components/sales-invoice/SalesInvoiceForm'

export default function NewInvoicePage() {
  return (
    <SalesInvoiceForm
      title="Buat Invoice Baru"
      subtitle="Buat faktur penjualan (invoice) baru"
      backHref="/penjualan-invoice"
    />
  )
}
