"use client"
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { showError } from "@/lib/notification";
import PageLoading from "@/components/ui/PageLoading";
import PurchaseEntryForm, {
  type PurchaseEntryFormInitial,
} from "@/components/purchase/PurchaseEntryForm";

export default function ViewReturPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id)
    ? params.id[0]
    : String(params?.id || "");

  const [initial, setInitial] = useState<PurchaseEntryFormInitial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/purchases/${id}`);
        if (!res.ok) throw new Error("Gagal memuat retur");
        const data = await res.json();
        setInitial({
          purchaseNumber: data.purchase_number || "",
          purchaseDate:
            data.purchase_date || new Date().toISOString().split("T")[0],
          expectedDate: data.expected_date || "",
          invoiceNumber: data.invoice_number || "",
          fakturPajak: data.faktur_pajak || "",
          notes: data.notes || "",
          supplier: data.supplier_id
            ? {
                id: data.supplier_id,
                code: data.supplier_code || "",
                name: data.supplier_name || "",
                discountPercent: Number(data.discount_percent || 0),
                term: data.supplier_term,
              }
            : undefined,
          warehouse: data.warehouse_id
            ? {
                id: data.warehouse_id,
                code: data.warehouse_code || "",
                name: data.warehouse_name || "",
              }
            : undefined,
          discountPercent: Number(data.discount_percent || 0),
          ppnPercent: Number(data.ppn_percent || 11),
          poId: data.po_id || null,
          poNumber: data.po_number || "",
          pembelianId: data.pembelian_id || null,
          pembelianNumber: data.pembelian_number || "",
          items: Array.isArray(data.items)
            ? data.items.map((it: any) => ({
                productId: it.barang_id || it.product_id || 0,
                name: it.barang_name || it.name || "",
                quantity: Number(it.quantity || 0),
                unit: it.unit_name || it.unit || "",
                unitRatio: Number(it.unit_ratio || 1) || 1,
                price: Number(it.unit_price || 0),
                discountPercent: Number(it.discount_percent || 0),
                disc1Percent: Number(it.disc1_percent || 0),
                disc2Percent: Number(it.disc2_percent || 0),
                disc3Percent: Number(it.disc3_percent || 0),
                discNominal: Number(it.disc_nominal || 0),
                bonusProductId: it.bonus_barang_id ?? null,
                bonusName: it.bonus_name || "",
                bonusQty: Number(it.bonus_qty || 0),
                bonusUnit: it.bonus_unit || "",
                bonusUnitRatio: Number(it.bonus_unit_ratio || 1) || 1,
              }))
            : [],
        });
      } catch (e: any) {
        showError(e.message || "Gagal memuat retur");
        router.push("/pembelian/retur");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) {
    return <PageLoading />;
  }

  if (!initial) {
    return (
      <div className="p-6 text-center text-slate-600">
        Data retur tidak ditemukan
      </div>
    );
  }

  return (
    <PurchaseEntryForm
      title="Retur Pembelian"
      subtitle="Detail retur pembelian"
      backHref="/pembelian/retur"
      isReturn
      readonly
      initial={initial}
    />
  );
}
