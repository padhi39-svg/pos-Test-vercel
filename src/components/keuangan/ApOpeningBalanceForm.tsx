"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { showSuccess } from '@/lib/notification'
import FormHeader from '@/components/ui/FormHeader'
import FormField from '@/components/ui/FormField'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import SupplierPickerModal from '@/components/purchase/SupplierPickerModal'
import type { Supplier } from '@/components/purchase/SupplierPickerModal'

export type ApOpeningBalanceFormProps = {
  mode: 'new' | 'edit' | 'view'
  initial?: any
  backHref: string
}

export default function ApOpeningBalanceForm({ mode, initial, backHref }: ApOpeningBalanceFormProps) {
  const router = useRouter()
  const isView = mode === 'view'
  const isNew = mode === 'new'
  const isVoided = initial?.status === 'void'
  const readOnly = isView || isVoided

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [tanggal, setTanggal] = useState('')
  const [nominal, setNominal] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const numKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
    if (!/^\d$/.test(e.key)) e.preventDefault()
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/supplier')
        if (res.ok) {
          const data = await res.json()
          const list = Array.isArray(data) ? data : (data?.rows || [])
          setSuppliers(list.filter((c: any) => !c.isdelete))
        }
      } catch {}
    })()
  }, [])

  // Always use tanggal from period 1, never editable
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/periode/1', { cache: 'no-store' })
        if (res.ok) {
          const p = await res.json()
          if (p?.start_date) setTanggal(String(p.start_date).slice(0, 10))
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    if (initial) {
      setNominal(Number(initial.nominal) || 0)
      setNotes(String(initial.notes || initial.catatan || ''))
      if (initial.supplier_id || initial.supplier_code) {
        setSelectedSupplier({
          id: initial.supplier_id,
          code: initial.supplier_code || '',
          name: initial.supplier_name || '',
          discountPercent: initial.supplier_discount_percent || 0,
        })
      }
    }
  }, [initial])

  const handleSave = async () => {
    if (saving || readOnly) return
    if (!selectedSupplier) { alert('Supplier wajib dipilih'); return }
    setSaving(true)
    try {
      const payload = { tanggal, partnerId: selectedSupplier.id, nominal: Number(nominal) || 0, notes }
      const url = isNew
        ? '/api/ap-opening-balances'
        : `/api/ap-opening-balances/${initial?.id}`
      const method = isNew ? 'POST' : 'PUT'

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e?.error || 'Gagal menyimpan'); return }
      showSuccess(isNew ? 'Saldo awal hutang berhasil disimpan' : 'Saldo awal hutang berhasil diubah')
      router.push(backHref)
    } catch { setSaving(false) }
  }

  const title = isNew ? 'Saldo Awal Hutang - Baru' : isView ? 'Detail Saldo Awal Hutang' : 'Edit Saldo Awal Hutang'
  const subtitle = isNew ? 'Buat saldo awal hutang baru' : isView ? 'Informasi saldo awal hutang' : 'Ubah saldo awal hutang'

  return (
    <div className="space-y-4">
      <FormHeader title={title} subtitle={subtitle} backHref={backHref} basePath={backHref} />

      {isVoided && (
        <div className="inline-flex items-center px-2 py-0.5 text-[11px] rounded bg-rose-100 text-rose-700 border border-rose-200">
          VOID
        </div>
      )}

      <div className="container-card p-3 text-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FormField label="Kode Nota">
            <Input disabled value={initial?.kode_nota || ''} placeholder="Auto Generate" />
          </FormField>

          <FormField label="Tanggal">
            <input
              type="date"
              value={tanggal}
              disabled
              className="w-full rounded-pill border px-3 py-2 text-sm outline-none transition-colors border-slate-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </FormField>

          <FormField label="Supplier">
            {readOnly || !isNew ? (
              <Input disabled value={selectedSupplier ? `${selectedSupplier.code} - ${selectedSupplier.name}` : ''} />
            ) : (
              <>
                <input
                  value={selectedSupplier ? `${selectedSupplier.code} - ${selectedSupplier.name}` : ''}
                  placeholder="Klik untuk cari supplier..."
                  onFocus={() => setShowSupplierModal(true)}
                  onClick={() => setShowSupplierModal(true)}
                  readOnly
                  className="w-full rounded-pill border px-3 py-2 text-sm outline-none transition-colors border-slate-300 bg-white hover:border-slate-400 focus:ring-2 focus:ring-[#E8F6F5] focus:border-[#2BA8A2] cursor-pointer"
                />
                <SupplierPickerModal
                  open={showSupplierModal}
                  supplierList={suppliers}
                  onSelect={(s) => { setSelectedSupplier(s); setShowSupplierModal(false) }}
                  onClose={() => setShowSupplierModal(false)}
                />
              </>
            )}
          </FormField>

          <FormField label="Nominal">
            <input
              value={Number.isFinite(nominal) ? nominal.toLocaleString('id-ID') : ''}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9]/g, '')
                setNominal(raw ? Number(raw) : NaN)
              }}
              onKeyDown={numKeyDown}
              onFocus={e => { if (nominal === 0) setNominal(NaN) }}
              onBlur={e => { if (Number.isFinite(nominal)) setNominal(nominal) }}
              inputMode="numeric"
              disabled={readOnly}
              className="w-full rounded-pill border px-3 py-2 text-sm outline-none transition-colors border-slate-300 bg-white hover:border-slate-400 focus:ring-2 focus:ring-[#E8F6F5] focus:border-[#2BA8A2] text-right disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </FormField>
        </div>

        <FormField label="Catatan">
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={readOnly}
            rows={3}
          />
        </FormField>

        {!readOnly && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push(backHref)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving || !selectedSupplier || !Number.isFinite(nominal) || nominal <= 0}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        )}

        {isView && !isVoided && (
          <div className="flex justify-end gap-2">
            {mode === 'view' && (
              <Button onClick={() => router.push(`${backHref}/${initial?.id}/edit`)}>
                Edit
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
