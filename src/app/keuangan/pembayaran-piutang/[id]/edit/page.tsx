"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PageLoading from '@/components/ui/PageLoading'
import PaymentEntryForm, { type PaymentFormInitial, type MethodPickFull, type ExtraLine } from '@/components/payment/PaymentEntryForm'
import type { InvoicePick } from '@/components/payment/InvoicePickerModal'
import { showError } from '@/lib/notification'

export default function EditPembayaranPiutangPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id)
  const [initial, setInitial] = useState<PaymentFormInitial | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!Number.isFinite(id)) return
    let destroyed = false
    ;(async () => {
      try {
        const res = await fetch(`/api/ar-payments/${id}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Gagal memuat pembayaran')
        const d = await res.json()
        if (destroyed) return
        if (d.auto_created === 1) {
          router.replace(`/keuangan/pembayaran-piutang/${id}`)
          return
        }
        const detail: InvoicePick[] = Array.isArray(d.detail) ? d.detail.map((it: any) => {
          const st = String(it.source_type || 'transaction')
          const due = Number(it.due_amount || 0)
          const sign = st === 'sales_return' ? -1 : 1
          return {
            id: `${st}-${it.source_id || it.id}`,
            source_type: st,
            source_id: it.source_id || it.id,
            invoice_number: it.invoice_number || '',
            invoice_date: (it.invoice_date || '').slice(0, 10),
            total_amount: sign * (Number(it.total_amount || due || 0)),
            due_amount: sign * due,
            pay_amount: Number(it.pay_amount || 0),
            remarks: it.remarks || '',
          }
        }) : []
        const methods: MethodPickFull[] = Array.isArray(d.methods) ? d.methods.map((m: any) => ({
          temp_id: m.temp_id || String(m.account_id),
          account_id: m.account_id,
          account_code: m.account_code,
          account_name: m.account_name,
          amount: Number(m.amount || 0),
          notes: m.notes || '',
        })) : []
        const extras: ExtraLine[] = Array.isArray(d.extras) ? d.extras.map((e: any) => ({
          temp_id: e.temp_id || Math.random().toString(36).slice(2),
          account_id: e.account_id,
          account_code: e.account_code,
          account_name: e.account_name,
          notes: e.notes || '',
          debit: Number(e.debit || 0),
          credit: Number(e.credit || 0),
        })) : []
        setInitial({
          paymentNumber: d.payment_number || '',
          paymentDate: (d.payment_date || new Date().toISOString()).slice(0, 10),
          partyId: d.customer_id || '',
          partyName: d.customer_name || '',
          notes: d.notes || '',
          status: d.status || '',
          detail, methods, extras,
        })
      } catch (e: any) {
        showError(e.message || 'Gagal memuat pembayaran')
        router.push('/keuangan/pembayaran-piutang')
      } finally {
        if (!destroyed) setLoading(false)
      }
    })()
    return () => { destroyed = true }
  }, [id, router])

  if (loading) return <PageLoading />
  if (!initial) return <div className="p-6 text-center text-slate-600">Data tidak ditemukan</div>
  return <PaymentEntryForm type="ar" mode="edit" paymentId={id} initial={initial} />
}
