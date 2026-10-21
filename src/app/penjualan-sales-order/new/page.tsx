"use client"

import SalesOrderForm from "@/components/sales/SalesOrderForm"

export default function NewSalesOrderPage() {
  return (
    <SalesOrderForm
      title="Sales Order"
      subtitle="Buat sales order baru"
      backHref="/penjualan-sales-order"
    />
  )
}
