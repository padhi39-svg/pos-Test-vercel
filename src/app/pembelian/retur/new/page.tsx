"use client"
import PurchaseEntryForm from "@/components/purchase/PurchaseEntryForm"

export default function NewPurchaseReturnPage() {
  return (
    <PurchaseEntryForm
      title="Retur Pembelian"
      subtitle="Buat retur pembelian baru"
      backHref="/pembelian/retur"
      isReturn
    />
  )
}
