"use client"
import { Barang, BarangUnit, JenisBarang } from '@/lib/barangStore'
import { parseInputNumber, formatInputNumber, formatInputOnChange } from '@/lib/regionalNumber'
import Button from '@/components/ui/Button'
import FormHeader from '@/components/ui/FormHeader'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import SearchableSelect from '@/components/ui/SearchableSelect'
import Textarea from '@/components/ui/Textarea'
import Checkbox from '@/components/ui/Checkbox'
import EditableTable from '@/components/ui/EditableTable'
import FileUpload from '@/components/ui/FileUpload'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { smartTitleCase } from '@/lib/textFormat'
import { showError } from '@/lib/notification'

type AccountOpt = { value: string | number; label: string; description?: string }

export type RecipeItem = {
  ingredientId: number | null
  ingredientCode: string
  ingredientName: string
  quantity: number
  unit: string
}

export type BarangFormData = {
  code: string
  name: string
  kategoriId: number | null
  spesifikasiId: number | null
  merkId: number | null
  hpp: number
  jenis: JenisBarang
  aktif: boolean
  tampilMenu: boolean
  photoUrl?: string | null
  accountId: number | null
  units: BarangUnit[]
  price: number
  effectiveDate: string
  notes?: string
  recipes?: RecipeItem[]
}

const defaultUnits: BarangUnit[] = [
  { name: 'pcs', ratio: 1 },
]

export default function BarangForm({
  title,
  basePath,
  initial,
  onSubmit,
  currentId,
  readonly = false,
}: {
  title: string
  basePath: string
  initial?: Partial<Barang> & { price?: number; effectiveDate?: string }
  onSubmit: (data: BarangFormData) => Promise<void>
  currentId?: number
  readonly?: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<BarangFormData>({
    code: initial?.code ?? '',
    name: initial?.name ?? '',
    kategoriId: initial?.kategoriId ?? null,
    spesifikasiId: initial?.spesifikasiId ?? null,
    merkId: (initial as any)?.merkId ?? null,
    hpp: initial?.hpp ?? 0,
    jenis: (initial?.jenis as JenisBarang) ?? 1,
    aktif: initial?.aktif ?? true,
    tampilMenu: initial?.tampilMenu ?? true,
    accountId: (initial as any)?.accountId ?? null,
    units: initial?.units ?? defaultUnits,
    price: initial?.prices?.[0]?.price ?? initial?.price ?? 0,
    effectiveDate: initial?.prices?.[0]?.effectiveDate ?? initial?.effectiveDate ?? new Date().toISOString().slice(0, 10),
    notes: '',
    photoUrl: (initial as any)?.photoUrl ?? null,
  })
  const [errors, setErrors] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [kategoriOptions, setKategoriOptions] = useState<any[]>([])
  const [spesifikasiOptions, setSpesifikasiOptions] = useState<any[]>([])
  const [merkOptions, setMerkOptions] = useState<any[]>([])
  const [bahanBakuOptions, setBahanBakuOptions] = useState<any[]>([])
  const [recipes, setRecipes] = useState<RecipeItem[]>([])
  const [photoUrl, setPhotoUrl] = useState<string | null>((initial as any)?.photoUrl ?? null)
  const [accountOptions, setAccountOptions] = useState<AccountOpt[]>([])

  const initialHpp = Number(initial?.hpp ?? 0)
  const initialPrice = Number(initial?.prices?.[0]?.price ?? initial?.price ?? 0)
  const [hppInput, setHppInput] = useState<string>(initialHpp > 0 ? formatInputNumber(initialHpp) : '')
  const [priceInput, setPriceInput] = useState<string>(initialPrice > 0 ? formatInputNumber(initialPrice) : '')

  const returnQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('return') || '' : ''

  const mode: 'create' | 'edit' | 'view' = useMemo(() => {
    if (readonly) return 'view'
    return currentId ? 'edit' : 'create'
  }, [readonly, currentId])

  // Sync form when initial changes (view/edit after async fetch) - robust
  useEffect(() => {
    if (!initial || !currentId) return
    setForm({
      code: initial.code ?? '',
      name: initial.name ?? '',
      kategoriId: (initial as any).kategoriId ?? null,
      spesifikasiId: (initial as any).spesifikasiId ?? null,
      merkId: (initial as any).merkId ?? null,
      hpp: initial.hpp ?? 0,
      jenis: (initial.jenis as JenisBarang) ?? 1,
      aktif: initial.aktif ?? true,
      tampilMenu: (initial as any).tampilMenu ?? true,
      accountId: (initial as any).accountId ?? null,
      units: (initial as any).units ?? defaultUnits,
      price: (initial as any).prices?.[0]?.price ?? (initial as any).price ?? 0,
      effectiveDate: (initial as any).prices?.[0]?.effectiveDate ?? (initial as any).effectiveDate ?? new Date().toISOString().slice(0, 10),
      notes: '',
      photoUrl: (initial as any).photoUrl ?? null,
    })
    setPhotoUrl((initial as any).photoUrl ?? null)
    const hppVal = Number(initial.hpp ?? 0)
    const priceVal = Number((initial as any).prices?.[0]?.price ?? (initial as any).price ?? 0)
    setHppInput(hppVal > 0 ? formatInputNumber(hppVal) : '')
    setPriceInput(priceVal > 0 ? formatInputNumber(priceVal) : '')
  }, [currentId, JSON.stringify(initial)])

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [rk, rs, rm, rb] = await Promise.all([
          fetch('/api/kategori'),
          fetch('/api/spesifikasi'),
          fetch('/api/merk'),
          fetch('/api/barang'),
        ])
        const [dk, ds, dm, db] = await Promise.all([rk.json(), rs.json(), rm.json(), rb.json()])
        const toRows = (v: any) => Array.isArray(v) ? v : (v?.rows || [])
        setKategoriOptions(toRows(dk))
        setSpesifikasiOptions(toRows(ds))
        setMerkOptions(toRows(dm))
        setBahanBakuOptions(toRows(db).filter((b: any) => b.jenis === 2 && b.aktif && !b.isdelete))
        try {
          const rac = await fetch('/api/keuangan/perkiraan?tree=1')
          const dac = await rac.json()
          if (Array.isArray(dac)) {
            const flatten = (nodes: any[]): any[] =>
              nodes.flatMap(n => [n, ...(n.children ? flatten(n.children) : [])])
            setAccountOptions(flatten(dac).filter((a: any) => {
              if (a.isHeader) return false
              return a.postingAllowed === undefined || Number(a.postingAllowed) === 1
            }).map((a: any) => ({ value: a.id, label: `${a.code} - ${a.name}` })))
          }
        } catch {}
      } catch (e) {
        console.error('Gagal memuat master options:', e)
        setKategoriOptions([]); setSpesifikasiOptions([]); setMerkOptions([]); setBahanBakuOptions([])
      }
    }
    loadMasters()
  }, [])

  const addUnit = () => {
    setForm((f) => ({ ...f, units: [...f.units, { name: '', ratio: 1 }] }))
  }

  const updateUnit = (idx: number, patch: Partial<BarangUnit>) => {
    setForm((f) => ({
      ...f,
      units: f.units.map((u, i) => (i === idx ? { ...u, ...patch } : u)),
    }))
  }

  const removeUnit = (idx: number) => {
    setForm((f) => ({ ...f, units: f.units.filter((_, i) => i !== idx) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || mode === 'view') return

    const msgs: string[] = []
    if (!form.code.trim()) msgs.push('Kode wajib diisi')
    if (!form.name.trim()) msgs.push('Nama wajib diisi')
    if (form.units.length === 0) msgs.push('Minimal 1 satuan')
    if (form.units.some((u) => !u.name.trim())) msgs.push('Nama satuan tidak boleh kosong')
    if (form.units.some((u) => !u.ratio || u.ratio < 1)) msgs.push('Rasio satuan minimal 1')

    if (!currentId) {
      try {
        const res = await fetch('/api/barang')
        if (res.ok) {
          const list = await res.json()
          const dup = (list || []).find((b: any) => String(b.code || '').toLowerCase() === form.code.trim().toLowerCase())
          if (dup) msgs.push('Kode barang sudah digunakan')
        }
      } catch (err) {
        console.warn('Skip duplicate check due to API error', err)
      }
    }

    if (msgs.length) {
      setErrors(msgs.join('\n'))
      return
    }

    setSaving(true)
    try {
      await onSubmit({ ...form, photoUrl, recipes: (form.jenis === 1 || form.jenis === 3) ? recipes : [] })
      router.push(basePath + '?' + returnQuery)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <FormHeader title={title} subtitle="Master Barang" basePath={basePath + '?' + returnQuery} />
      {mode === 'view' && (
        <div className="flex gap-2">
          <Button onClick={() => router.push(`${basePath}/${currentId}/edit?return=${encodeURIComponent(returnQuery)}`)}>Edit</Button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="container-card p-3 text-xs space-y-3">
          {errors && (
            <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{errors.split('\n').map((m,i)=>(<div key={i}>{m}</div>))}</div>
          )}
          <div className="grid grid-cols-1 gap-3">
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Kode *</span>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Kode barang" disabled={readonly || !!currentId} />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Nama *</span>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: smartTitleCase(e.target.value) })} placeholder="Nama barang" disabled={readonly} />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Kategori</span>
              <SearchableSelect
                options={kategoriOptions.map(k => ({ value: k.id, label: k.name, description: k.code }))}
                value={form.kategoriId}
                onChange={(value) => setForm({ ...form, kategoriId: value as number | null })}
                placeholder="Pilih kategori..."
                disabled={readonly}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Spesifikasi</span>
              <SearchableSelect
                options={spesifikasiOptions.map(s => ({ value: s.id, label: s.name, description: s.code }))}
                value={form.spesifikasiId}
                onChange={(value) => setForm({ ...form, spesifikasiId: value as number | null })}
                placeholder="Pilih spesifikasi..."
                disabled={readonly}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Merk</span>
              <SearchableSelect
                options={merkOptions.map(m => ({ value: m.id, label: m.name, description: m.code }))}
                value={form.merkId}
                onChange={(value) => setForm({ ...form, merkId: value as number | null })}
                placeholder="Pilih merk..."
                disabled={readonly}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Ikhtisar</span>
              <SearchableSelect
                options={accountOptions}
                value={form.accountId}
                onChange={(value) => setForm({ ...form, accountId: value as number | null })}
                placeholder="Pilih akun..."
                disabled={readonly}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">HPP (Rp)</span>
              <Input
                type="text"
                value={readonly ? formatInputNumber(form.hpp) : hppInput}
                onChange={(e) => {
                  if (readonly) return
                  const formatted = formatInputOnChange(e.target.value)
                  setHppInput(formatted)
                  setForm({ ...form, hpp: parseInputNumber(formatted) })
                }}
                onBlur={() => {
                  if (readonly) return
                  setHppInput(form.hpp > 0 ? formatInputNumber(form.hpp) : '')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    ;(e.target as HTMLInputElement).blur()
                    setHppInput(form.hpp > 0 ? formatInputNumber(form.hpp) : '')
                  }
                }}
                placeholder="0"
                disabled={readonly}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Jenis</span>
              <Select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: Number(e.target.value) as JenisBarang })} disabled={readonly}>
                <option value={1}>Barang Jadi</option>
                <option value={3}>Barang Setengah Jadi</option>
                <option value={2}>Bahan Baku</option>
              </Select>
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Aktif</span>
              <Checkbox checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} disabled={readonly} />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Tampil Menu</span>
              <Checkbox checked={form.tampilMenu} onChange={(e) => setForm({ ...form, tampilMenu: e.target.checked })} disabled={readonly} />
            </label>
          </div>

          <EditableTable
            title="Satuan"
            columns={[
              { key: 'name', label: 'Nama', placeholder: 'Nama satuan' },
              { key: 'ratio', label: 'Rasio', placeholder: 'Rasio', type: 'number' },
            ]}
            items={form.units}
            onUpdate={(idx, key, value) => updateUnit(idx, { [key]: key === 'name' ? smartTitleCase(value) : value })}
            onRemove={(idx) => removeUnit(idx)}
            onAdd={addUnit}
            addLabel="+ Tambah Satuan"
            hint="Contoh: pcs=1, lsn=12 pcs, dus=48 pcs"
            readonly={readonly}
          />

          <div className="border-t border-teal-bg pt-3">
            <div className="font-medium text-xs mb-2">Harga Jual</div>
            {currentId ? (
              <div className="p-2 rounded bg-teal-bg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-slate-600 mb-1">Harga (Rp)</div>
                    <Input type="text" value={formatInputNumber(form.price)} disabled className="bg-white" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-600 mb-1">Tanggal Berlaku</div>
                    <Input type="date" value={form.effectiveDate} disabled className="bg-white" />
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 mt-2">Untuk mengubah harga, gunakan menu Riwayat Harga di halaman edit.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-slate-600 mb-1">Harga (Rp)</div>
                  <Input
                    type="text"
                    value={readonly ? formatInputNumber(form.price) : priceInput}
                    onChange={(e) => {
                      if (readonly) return
                      const formatted = formatInputOnChange(e.target.value)
                      setPriceInput(formatted)
                      setForm({ ...form, price: parseInputNumber(formatted) })
                    }}
                    onBlur={() => {
                      if (readonly) return
                      setPriceInput(form.price > 0 ? formatInputNumber(form.price) : '')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        ;(e.target as HTMLInputElement).blur()
                        setPriceInput(form.price > 0 ? formatInputNumber(form.price) : '')
                      }
                    }}
                    placeholder="0"
                    disabled={readonly}
                  />
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 mb-1">Tanggal Berlaku</div>
                  <Input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} disabled={readonly} />
                </div>
              </div>
            )}
          </div>

          <FileUpload
            title="Foto Produk (opsional)"
            value={photoUrl}
            onChange={(url) => setPhotoUrl(url)}
            readonly={readonly}
            emptyText="Belum ada foto"
          />

          <label className="flex items-start gap-3 pt-2 border-t border-teal-bg">
            <span className="w-28 text-slate-600 shrink-0 mt-1">Catatan</span>
            <Textarea placeholder="Catatan tambahan (opsional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={readonly} />
          </label>

          {mode !== 'view' && (
            <div className="flex justify-end gap-2 pt-2">
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
