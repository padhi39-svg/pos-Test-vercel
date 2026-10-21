"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SalesInvoiceForm, { type SalesInvoiceFormInitial } from '@/components/sales-invoice/SalesInvoiceForm'
import PageLoading from '@/components/ui/PageLoading'

export default function ViewInvoicePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [initial, setInitial] = useState<SalesInvoiceFormInitial | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params.id) return
    let destroyed = false
    ;(async () => {
      try {
        const res = await fetch(`/api/transactions/${params.id}`)
        if (!res.ok) { if (!destroyed) { setInitial(null); setLoading(false) } return }
        const d = await res.json()
        if (destroyed) return

        const incFromTx = Number(d.price_include_tax) === 1
        const taxPct = Number(d.tax_rate_percent ?? d.ppn_percent ?? 11) || 11

        setInitial({
          invoiceNumber: d.transaction_number || '',
          invoiceDate: (d.tgl_nota || d.transaction_date || d.created_at || '').slice(0, 10),
          dueDate: (d.due_date || '').slice(0, 10),
          fakturPajak: d.faktur_pajak || '',
          notes: d.notes || '',
          customer: d.customer_id ? {
            id: Number(d.customer_id),
            code: d.customer_code || '',
            name: d.customer_name || '',
            discountPercent: d.discount_percent || 0,
          } : undefined,
          warehouse: d.warehouse_id ? { id: Number(d.warehouse_id), code: d.warehouse_code || '', name: d.warehouse_name || '' } : undefined,
          sales: d.sales_id ? { id: Number(d.sales_id), code: d.sales_code || '', name: d.sales_name || '' } : null,
          soId: d.so_id ?? null, soNumber: d.so_number || '',
          discountPercent: d.discount_percent || 0,
          ppnPercent: taxPct,
          includeTax: incFromTx,
          items: Array.isArray(d.items) ? d.items.map((item: any) => ({
            productId: item.barang_id,
            name: item.barang_name || '',
            quantity: Number(item.quantity) || 0,
            unit: item.unit_name || '',
            unitRatio: Number(item.unit_ratio || 1) || 1,
            price: incFromTx
              ? (Number(item.unit_price_include_tax) || 0) > 0
                ? Number(item.unit_price_include_tax)
                : Math.round(Number(item.unit_price || 0) * (1 + taxPct / 100))
              : Number(item.unit_price || 0),
            discountPercent: Number(item.discount_percent ?? 0) || 0,
            disc1Percent: Number(item.disc1_percent ?? 0) || 0,
            disc2Percent: Number(item.disc2_percent ?? 0) || 0,
            disc3Percent: Number(item.disc3_percent ?? 0) || 0,
            discNominal: Number(item.disc_nominal ?? 0) || 0,
            bonusProductId: item.bonus_barang_id ? Number(item.bonus_barang_id) : null,
            bonusName: item.bonus_name || '',
            bonusQty: Number(item.bonus_qty ?? 0) || 0,
            bonusUnit: item.bonus_unit || '',
            bonusUnitRatio: Number(item.bonus_unit_ratio ?? 1) || 1,
          })) : [],
        })
      } catch {
        if (!destroyed) setInitial(null)
      } finally {
        if (!destroyed) setLoading(false)
      }
    })()
    return () => { destroyed = true }
  }, [params.id])

  if (loading) return <PageLoading />
  if (!initial) return <div className="p-6 text-center text-slate-600">Data tidak ditemukan</div>

  return (
    <SalesInvoiceForm
      title="Detail Invoice"
      subtitle={`Invoice ${initial.invoiceNumber}`}
      backHref="/penjualan-invoice"
      readonly
      initial={initial}
    />
  )
}
