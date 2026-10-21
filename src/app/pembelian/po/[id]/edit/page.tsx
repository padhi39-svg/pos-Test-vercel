"use client"
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { showSuccess, showError } from '@/lib/notification'
import PurchaseOrderForm from '@/components/purchase/PurchaseOrderForm'
import type { PurchaseOrderFormInitial } from '@/components/purchase/PurchaseOrderForm'

export default function EditPOPage() {
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id
  const [initial, setInitial] = useState<PurchaseOrderFormInitial | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const res = await fetch(`/api/purchase-orders/${id}`)
        if (!res.ok) throw new Error('Gagal memuat PO')
        const data = await res.json()
        setInitial({
          poNumber: data.po_number || data.poNumber || '',
          orderDate: data.order_date || data.orderDate || new Date().toISOString().split('T')[0],
          expectedDate: data.expected_date || data.expectedDate || '',
          notes: data.notes || data.note || '',
          supplierId: data.supplier_id || data.supplierId || data.supplier?.id || null,
          supplierName: data.supplier_name || data.supplierName || data.supplier?.name || null,
          supplierCode: data.supplier_code || null,
          discountPercent: Number(data.discount_percent || 0),
          ppnPercent: Number(data.ppn_percent || 11),
          poStatus: data.po_status === 'realisasi' ? 'realisasi' : 'outstanding',
          isVoid: data.void || data.is_void || 0,
          items: Array.isArray(data.items) ? data.items.map((it: any) => ({
            productId: it.barang_id || it.product_id || it.barangId || it.productId || null,
            name: it.barang_name || it.name || it.barangName || it.product_name || '',
            quantity: Number(it.quantity || it.qty || 0),
            unit: it.unit_name || it.unit || it.unitName || '',
            unitRatio: Number(it.unit_ratio || it.unitRatio || 1),
            price: Number(it.unit_price || it.price || it.unitPrice || 0),
            discountPercent: Number(it.discount_percent || it.discountPercent || 0),
            discountAmount: Number(it.discount_amount || it.discountAmount || 0),
          })) : [],
        })
      } catch (e: any) {
        showError(e.message || 'Gagal memuat data PO')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-primary mx-auto mb-2" />
          <p className="text-slate-600">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (!initial) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-600">Data PO tidak ditemukan</p>
      </div>
    )
  }

  return (
    <PurchaseOrderForm
      title="Edit Purchase Order"
      subtitle="Ubah data purchase order"
      initial={initial}
      onSubmit={async (data) => {
        const res = await fetch(`/api/purchase-orders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_date: data.orderDate,
            expected_date: data.expectedDate,
            supplier_id: data.supplierId,
            supplier_name: data.supplierName,
            discount_percent: data.discountPercent,
            discount_amount: data.discountPercent > 0 ? Math.round(data.items.reduce((s, i) => s + i.totalPrice, 0) * (data.discountPercent / 100)) : 0,
            ppn_percent: data.ppnPercent,
            ppn_amount: Math.round((data.items.reduce((s, i) => s + i.totalPrice, 0) - (data.discountPercent > 0 ? Math.round(data.items.reduce((s, i) => s + i.totalPrice, 0) * (data.discountPercent / 100)) : 0)) * (data.ppnPercent / 100)),
            subtotal: data.items.reduce((s, i) => s + i.totalPrice, 0),
            total: data.items.reduce((s, i) => s + i.totalPrice, 0) - (data.discountPercent > 0 ? Math.round(data.items.reduce((s, i) => s + i.totalPrice, 0) * (data.discountPercent / 100)) : 0) + Math.round((data.items.reduce((s, i) => s + i.totalPrice, 0) - (data.discountPercent > 0 ? Math.round(data.items.reduce((s, i) => s + i.totalPrice, 0) * (data.discountPercent / 100)) : 0)) * (data.ppnPercent / 100)),
            po_status: data.poStatus,
            notes: data.notes,
            items: data.items.map(item => ({
              barangId: item.barangId,
              barangCode: '',
              barangName: item.barangName,
              quantity: item.quantity,
              unitName: item.unitName,
              unitRatio: item.unitRatio,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent,
              discountAmount: item.discountAmount,
              totalPrice: item.totalPrice,
            })),
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Gagal menyimpan perubahan PO')
        }
        const result = await res.json().catch(() => ({}))
        showSuccess('✅ Purchase Order berhasil diperbarui!')
        return result
      }}
    />
  )
}
