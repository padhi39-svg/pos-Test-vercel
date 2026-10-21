"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import FormHeader from '@/components/ui/FormHeader'
import { Customer } from '@/lib/customerStore'
import { smartTitleCase, onlyDigits } from '@/lib/textFormat'
import SearchableSelect from '@/components/ui/SearchableSelect'

type AccountOpt = { value: string | number; label: string; description?: string }

export type CustomerFormData = {
  code: string
  name: string
  address: string
  phone: string
  npwp: string
  discountPercent: number
  term: number
  accountId: number | null
  kodeInt: string
  salesId: number | null
  jenisCustomerId: number | null
}

export default function CustomerForm({
  title,
  basePath,
  initial,
  onSubmit,
  currentId,
  readonly,
}: {
  title: string
  basePath: string
  initial?: Partial<Customer>
  onSubmit: (data: CustomerFormData) => Promise<void>
  currentId?: number
  readonly?: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<CustomerFormData>({
    code: '',
    name: '',
    address: '',
    phone: '',
    npwp: '',
    discountPercent: 0,
    term: 0,
    accountId: null,
    kodeInt: '',
    salesId: null,
    jenisCustomerId: null,
  })
  const [accounts, setAccounts] = useState<AccountOpt[]>([])
  const [salesList, setSalesList] = useState<AccountOpt[]>([])
  const [jenisCustomerList, setJenisCustomerList] = useState<AccountOpt[]>([])
  const [saving, setSaving] = useState(false)

  const returnQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('return') || '' : ''

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
    fetch('/api/sales')
      .then(r => r.json())
      .then(list => {
        if (Array.isArray(list)) {
          setSalesList(list
            .filter((s: any) => (s.isdelete ?? 0) === 0 && (s.aktif ?? 1) === 1)
            .map((s: any) => ({ value: s.id, label: `${s.code || ''} - ${s.name}` })))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/jenis-customer')
      .then(r => r.json())
      .then(list => {
        if (Array.isArray(list)) {
          setJenisCustomerList(list
            .filter((j: any) => (j.isdelete ?? 0) === 0)
            .map((j: any) => ({ value: j.id, label: `${j.code} - ${j.name}` })))
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
        salesId: (initial as any).salesId ?? null,
        jenisCustomerId: (initial as any).jenisCustomerId ?? (initial as any).jenis_customer_id ?? null,
      })
    }
  }, [initial])

  const mode: 'create' | 'edit' | 'view' = useMemo(() => {
    if (readonly) return 'view'
    return currentId ? 'edit' : 'create'
  }, [readonly, currentId])

  const buildPayload = (): CustomerFormData => ({
    code: (form.code || '').toUpperCase(),
    name: smartTitleCase(form.name || ''),
    address: smartTitleCase(form.address || ''),
    phone: onlyDigits(form.phone || ''),
    npwp: onlyDigits(form.npwp || ''),
    discountPercent: Number(form.discountPercent) || 0,
    term: Number(form.term) || 0,
    accountId: form.accountId,
    kodeInt: form.kodeInt?.trim() || '',
    salesId: form.salesId,
    jenisCustomerId: form.jenisCustomerId,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || mode === 'view') return
    setSaving(true)
    try {
      await onSubmit(buildPayload())
      router.push(basePath + '?' + returnQuery)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <FormHeader title={title} subtitle="Master Customer" basePath={basePath + '?' + returnQuery} />
      {mode === 'view' && (
        <div className="flex gap-2">
          <Button onClick={() => router.push(`${basePath}/${currentId}/edit?return=${encodeURIComponent(returnQuery)}`)}>Edit</Button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="container-card p-3 text-xs space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Kode</span>
              <Input
                value={mode === 'create' ? '' : form.code}
                onChange={() => {}}
                placeholder={mode === 'create' ? 'Auto Generate' : ''}
                disabled
              />
            </label>
            {mode !== 'create' && (
              <p className="text-[11px] text-slate-500 ml-[124px] -mt-2">Kode customer bersifat tetap dan tidak dapat diubah.</p>
            )}
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Nama *</span>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: smartTitleCase(e.target.value) })}
                required
                disabled={mode === 'view'}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Kode Internal</span>
              <Input
                value={form.kodeInt}
                onChange={(e) => setForm({ ...form, kodeInt: e.target.value.toUpperCase() })}
                disabled={mode === 'view'}
                placeholder="Kode internal opsional"
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Alamat</span>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: smartTitleCase(e.target.value) })}
                disabled={mode === 'view'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary min-h-[56px] resize-none disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">No. Telp</span>
              <Input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: onlyDigits(e.target.value) })}
                disabled={mode === 'view'}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">NPWP</span>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.npwp}
                onChange={(e) => setForm({ ...form, npwp: onlyDigits(e.target.value) })}
                disabled={mode === 'view'}
                placeholder="00.000.000.0-000.000"
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Jenis Customer</span>
              <SearchableSelect
                options={jenisCustomerList}
                value={form.jenisCustomerId}
                onChange={(v) => setForm({ ...form, jenisCustomerId: v as number | null })}
                placeholder="Pilih jenis customer..."
                disabled={mode === 'view'}
                allowClear
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Diskon %</span>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={form.discountPercent}
                onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
                disabled={mode === 'view'}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Term (Hari)</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={form.term}
                onChange={(e) => setForm({ ...form, term: Number(e.target.value) })}
                disabled={mode === 'view'}
                placeholder="0 = Cash"
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Ikhtisar</span>
              <SearchableSelect
                options={accounts}
                value={form.accountId}
                onChange={(v) => setForm({ ...form, accountId: v as number | null })}
                placeholder="Pilih perkiraan..."
                disabled={mode === 'view'}
                allowClear
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Sales</span>
              <SearchableSelect
                options={salesList}
                value={form.salesId}
                onChange={(v) => setForm({ ...form, salesId: v as number | null })}
                placeholder="Pilih sales..."
                disabled={mode === 'view'}
                allowClear
              />
            </label>
          </div>
          {mode !== 'view' && (
            <div className="flex justify-end gap-2">
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
