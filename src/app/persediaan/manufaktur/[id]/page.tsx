"use client"

import { useEffect, useState } from 'react'
import ManufakturForm, { ManufakturFormInitial } from '@/components/manufaktur/ManufakturForm'
import PageLoading from '@/components/ui/PageLoading'

export default function ManufakturViewPage({ params }: { params: { id: string } }) {
  const id = Number(params.id)
  const [loading, setLoading] = useState(true)
  const [initial, setInitial] = useState<ManufakturFormInitial | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/manufaktur/${id}?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) { setInitial(null); return }
        const d = await res.json()
        setInitial({
          id: Number(d?.id || 0),
          nomor: d?.nomor || '',
          barang_id: Number(d?.barang_id || 0),
          barang_code: d?.barang_code || '',
          barang_name: d?.barang_name || '',
          quantity: Number(d?.quantity || 0),
          tanggal: String(d?.tanggal || '').slice(0, 10),
          notes: String(d?.notes || ''),
          warehouse_id: Number(d?.warehouse_id || 0),
          warehouse_name: d?.warehouse_name || '',
          status: String(d?.status || ''),
          details: (Array.isArray(d?.details) ? d.details : []).map((it: any) => ({
            barang_id: Number(it.barang_id || 0),
            barang_code: it.barang_code || '',
            barang_name: it.barang_name || '',
            quantity: Number(it.quantity || 0),
            hpp_satuan: Number(it.hpp_satuan || 0),
            total_hpp: Number(it.total_hpp || 0),
          })),
          biaya: (Array.isArray(d?.biaya) ? d.biaya : []).map((b: any) => ({
            account_id: Number(b.account_id || 0),
            account_code: b.account_code || '',
            account_name: b.account_name || '',
            notes: String(b.notes || ''),
            debit: Number(b.debit || 0),
            credit: Number(b.credit || 0),
          })),
          hpp_sebelum: d?.hpp_sebelum != null ? Number(d.hpp_sebelum) : null,
          hpp_sesudah: d?.hpp_sesudah != null ? Number(d.hpp_sesudah) : null,
          total_biaya_bahan: Number(d?.total_biaya_bahan || 0),
          total_biaya_lain: Number(d?.total_biaya_lain || 0),
          total_biaya: Number(d?.total_biaya || 0),
          created_at: d?.created_at,
          updated_at: d?.updated_at,
          user_create: d?.user_create,
          user_edit: d?.user_edit,
          user_approve: d?.user_approve,
          approved_at: d?.approved_at,
        })
      } catch { setInitial(null) } finally { setLoading(false) }
    })()
  }, [id])

  if (loading) return <PageLoading />
  if (!initial) return <div className="container-card p-6 text-center text-slate-500">Data tidak ditemukan</div>

  return <ManufakturForm mode="view" initialData={initial} />
}