"use client"
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import PurchaseOrderForm from '@/components/purchase/PurchaseOrderForm'
import type { PurchaseOrderFormInitial } from '@/components/purchase/PurchaseOrderForm'

export default function ViewPOPage() {
  const router = useRouter()
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id
  const [initial, setInitial] = useState<PurchaseOrderFormInitial | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const res = await fetch(`/api/purchase-orders/${id}`)
        if (!res.ok) throw new Error('PO tidak ditemukan')
        const data = await res.json()
        setInitial({
          poNumber: data.po_number || data.poNumber || '',
          orderDate: data.order_date || data.orderDate || new Date().toISOString().split('T')[0],
          expectedDate: data.expected_date || data.expectedDate || '',
          notes: data.notes || '',
          supplierId: data.supplier_id || data.supplierId || null,
          supplierName: data.supplier_name || data.supplierName || null,
          supplierCode: data.supplier_code || null,
          discountPercent: Number(data.discount_percent || 0),
          ppnPercent: Number(data.ppn_percent || 11),
          poStatus: data.po_status === 'realisasi' ? 'realisasi' : 'outstanding',
          isVoid: data.void || data.is_void || 0,
          items: Array.isArray(data.items) ? data.items.map((it: any) => ({
            productId: it.barang_id || it.product_id || it.barangId || it.productId || null,
            name: it.barang_name || it.name || it.barangName || '',
            quantity: Number(it.quantity || it.qty || 0),
            unit: it.unit_name || it.unit || it.unitName || '',
            unitRatio: Number(it.unit_ratio || it.unitRatio || 1),
            price: Number(it.unit_price || it.price || it.unitPrice || 0),
            discountPercent: Number(it.discount_percent || it.discountPercent || 0),
            discountAmount: Number(it.discount_amount || it.discountAmount || 0),
          })) : [],
        })
      } catch (e: any) {
        alert(e.message)
        router.push('/pembelian/po')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-primary mx-auto mb-2"></div>
          <p className="text-slate-600">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (!initial) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-600">PO tidak ditemukan</p>
        <button onClick={() => router.push('/pembelian/po')} className="mt-4 px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark">Kembali</button>
      </div>
    )
  }

  return (
    <PurchaseOrderForm
      title="Detail Purchase Order"
      subtitle={initial.poNumber || ''}
      backHref="/pembelian/po"
      readonly
      initial={initial}
    />
  )
}
