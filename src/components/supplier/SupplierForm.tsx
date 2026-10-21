"use client"
import { useEffect, useMemo, useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import FormHeader from '@/components/ui/FormHeader'
import { useRouter } from 'next/navigation'
import { Supplier } from '@/lib/supplierStore'
import { smartTitleCase, onlyDigits } from '@/lib/textFormat'
import SearchableSelect from '@/components/ui/SearchableSelect'

type AccountOpt = { value: string | number; label: string; description?: string }

export type SupplierFormData = {
  code: string
  name: string
  address: string
  phone: string
  npwp: string
  discountPercent: number
  term: number
  accountId: number | null
  kodeInt: string
}

export default function SupplierForm({
  title,
  basePath,
  initial,
  onSubmit,
  currentId,
  readonly,
}: {
  title: string
  basePath: string
  initial?: Partial<Supplier>
  onSubmit: (data: SupplierFormData) => void
  currentId?: number
  readonly?: boolean
}) {
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''
  const [form, setForm] = useState<SupplierFormData>({
    code: '',
    name: '',
    address: '',
    phone: '',
    npwp: '',
    discountPercent: 0,
    term: 0,
    accountId: null,
    kodeInt: '',
  })
  const [accounts, setAccounts] = useState<AccountOpt[]>([])

  useEffect(() => {
    fetch('/api/keuangan/perkiraan?tree=1')
      .then(r => r.json())
      .then(list => {
        if (Array.isArray(list)) {
          const flatten = (nodes: any[]): any[] =>
            nodes.flatMap(n => [n, ...(n.children ? flatten(n.children) : [])])
          setAccounts(flatten(list)
            .filter((a: any) => {
              if (a.isHeader) return false
              return a.postingAllowed === undefined || Number(a.postingAllowed) === 1
            })
            .map((a: any) => ({ value: a.id, label: `${a.code} - ${a.name}` })))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (initial) {
      setForm({
        code: initial.code ?? '',
        name: initial.name ?? '',
        address: initial.address ?? '',
        phone: initial.phone ?? '',
        npwp: initial.npwp ?? '',
        discountPercent: initial.discountPercent ?? 0,
        term: initial.term ?? 0,
        accountId: (initial as any).accountId ?? null,
        kodeInt: (initial as any).kodeInt ?? '',
      })
    }
  }, [initial])

  const mode: 'create' | 'edit' | 'view' = useMemo(() => {
    if (readonly) return 'view'
    return currentId ? 'edit' : 'create'
  }, [readonly, currentId])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (readonly) return
    if (!form.name.trim()) { alert('Nama supplier wajib diisi'); return }
    const payload: SupplierFormData = {
      code: (form.code || '').toUpperCase(),
      name: smartTitleCase(form.name || ''),
      address: smartTitleCase(form.address || ''),
      phone: onlyDigits(form.phone || ''),
      npwp: onlyDigits(form.npwp || ''),
      discountPercent: Number(form.discountPercent) || 0,
      term: Number(form.term) || 0,
      accountId: form.accountId,
      kodeInt: form.kodeInt?.trim() || '',
    }
    onSubmit(payload)
  }

  return (
    <div className="space-y-4">
      <FormHeader title={title} subtitle="Master Supplier" basePath={basePath + '?' + returnQuery} />
      {mode === 'view' && (
        <div className="flex gap-2">
          <Button onClick={() => router.push(`${basePath}/${currentId}/edit?return=${encodeURIComponent(returnQuery)}`)}>Edit</Button>
        </div>
      )}
      <div className="container-card p-3 text-xs space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Kode Supplier</span>
            <Input
              value={mode === 'create' ? '' : form.code}
              onChange={() => {}}
              placeholder={mode === 'create' ? 'Auto Generate' : ''}
              disabled
            />
          </label>
          <div className="text-[11px] text-slate-500 -mt-2">
            {mode === 'create' ? 'Kode akan dibuat otomatis saat disimpan.' : 'Kode supplier bersifat tetap dan tidak dapat diubah.'}
          </div>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Nama <span className="text-red-500">*</span></span>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: smartTitleCase(e.target.value) })} required disabled={mode==='view'} />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Kode Internal</span>
            <Input value={form.kodeInt} onChange={(e) => setForm({ ...form, kodeInt: e.target.value.toUpperCase() })} disabled={mode==='view'} placeholder="Opsional" />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Alamat</span>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: smartTitleCase(e.target.value) })}
              disabled={mode==='view'}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary min-h-[56px] resize-none disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">No. Telp</span>
            <Input type="tel" inputMode="numeric" pattern="[0-9]*" value={form.phone} onChange={(e) => setForm({ ...form, phone: onlyDigits(e.target.value) })} disabled={mode==='view'} />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">NPWP</span>
            <Input inputMode="numeric" pattern="[0-9]*" value={form.npwp} onChange={(e) => setForm({ ...form, npwp: onlyDigits(e.target.value) })} disabled={mode==='view'} placeholder="00.000.000.0-000.000" />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Diskon</span>
            <Input type="number" min={0} max={100} step={0.01} value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })} disabled={mode==='view'} />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Term</span>
            <Input type="number" min={0} step={1} value={form.term} onChange={(e) => setForm({ ...form, term: Number(e.target.value) })} disabled={mode==='view'} placeholder="0 = Cash" />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Perkiraan</span>
            <SearchableSelect
              options={accounts}
              value={form.accountId}
              onChange={(v) => setForm({ ...form, accountId: v as number | null })}
              placeholder="Pilih perkiraan..."
              disabled={mode==='view'}
              allowClear
            />
          </label>
        </div>
        {mode !== 'view' && (
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={submit} disabled={readonly}>Simpan</Button>
          </div>
        )}
      </div>
    </div>
  )
}
