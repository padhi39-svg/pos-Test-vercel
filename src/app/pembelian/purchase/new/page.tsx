"use client";
import PurchaseEntryForm from "@/components/purchase/PurchaseEntryForm"

export default function NewPurchasePage() {
  return (
    <PurchaseEntryForm
      title="Pembelian (Penerimaan Barang)"
      subtitle="Buat penerimaan barang baru"
      backHref="/pembelian/purchase"
      isReturn={false}
    />
  );
}
