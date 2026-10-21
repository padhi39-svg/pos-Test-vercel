"use client"
import { BarangUnit } from '@/lib/barangStore'
import { parseInputNumber, formatInputNumber, formatInputOnChange } from '@/lib/regionalNumber'
import Button from '@/components/ui/Button'
import FormHeader from '@/components/ui/FormHeader'
import Input from '@/components/ui/Input'
import SearchableSelect from '@/components/ui/SearchableSelect'
import Textarea from '@/components/ui/Textarea'
import Checkbox from '@/components/ui/Checkbox'
import EditableTable from '@/components/ui/EditableTable'
import FileUpload from '@/components/ui/FileUpload'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { smartTitleCase } from '@/lib/textFormat'

export type BarangPembantuFormData = {
  code: string
  name: string
  kategoriId: number | null
  spesifikasiId: number | null
  merkId: number | null
  hpp: number
  jenis: number
  aktif: boolean
  tampilMenu: boolean
  photoUrl?: string | null
  units: BarangUnit[]
  price: number
  effectiveDate: string
  notes?: string
}

const defaultUnits: BarangUnit[] = [{ name: 'pcs', ratio: 1 }]

export default function BarangPembantuForm({
  title,
  basePath,
  initial,
  onSubmit,
  currentId,
  readonly = false,
}: {
  title: string
  basePath: string
  initial?: Partial<any> & { price?: number; effectiveDate?: string }
  onSubmit: (data: BarangPembantuFormData) => Promise<void>
  currentId?: number
  readonly?: boolean
}) {
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('return') || '' : ''

  const [form, setForm] = useState<BarangPembantuFormData>({
    code: initial?.code ?? '',
    name: initial?.name ?? '',
    kategoriId: initial?.kategoriId ?? null,
    spesifikasiId: initial?.spesifikasiId ?? null,
    merkId: (initial as any)?.merkId ?? null,
    hpp: initial?.hpp ?? 0,
    jenis: 3,
    aktif: initial?.aktif ?? true,
    tampilMenu: initial?.tampilMenu ?? false,
    units: initial?.units ?? defaultUnits,
    price: initial?.prices?.[0]?.price ?? initial?.price ?? 0,
    effectiveDate: initial?.prices?.[0]?.effectiveDate ?? initial?.effectiveDate ?? new Date().toISOString().slice(0, 10),
    notes: initial?.notes ?? '',
    photoUrl: (initial as any)?.photoUrl ?? null,
  })
  const [errors, setErrors] = useState<string | null>(null)
  const [kategoriOptions, setKategoriOptions] = useState<any[]>([])
  const [spesifikasiOptions, setSpesifikasiOptions] = useState<any[]>([])
  const [merkOptions, setMerkOptions] = useState<any[]>([])
  const [photoUrl, setPhotoUrl] = useState<string | null>((initial as any)?.photoUrl ?? null)
  const [saving, setSaving] = useState(false)

  const initialHpp = Number(initial?.hpp ?? 0)
  const initialPrice = Number(initial?.prices?.[0]?.price ?? initial?.price ?? 0)
  const [hppInput, setHppInput] = useState<string>(initialHpp > 0 ? formatInputNumber(initialHpp) : '')
  const [priceInput, setPriceInput] = useState<string>(initialPrice > 0 ? formatInputNumber(initialPrice) : '')

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [rk, rs, rm] = await Promise.all([
          fetch('/api/kategori'),
          fetch('/api/spesifikasi'),
          fetch('/api/merk'),
        ])
        const [dk, ds, dm] = await Promise.all([rk.json(), rs.json(), rm.json()])
        setKategoriOptions(Array.isArray(dk) ? dk : [])
        setSpesifikasiOptions(Array.isArray(ds) ? ds : [])
        setMerkOptions(Array.isArray(dm) ? dm : [])
      } catch (e) {
        console.error('Gagal memuat master options:', e)
        setKategoriOptions([]); setSpesifikasiOptions([]); setMerkOptions([])
      }
    }
    loadMasters()
  }, [])

  const addUnit = () => setForm((f) => ({ ...f, units: [...f.units, { name: '', ratio: 1 }] }))
  const updateUnit = (idx: number, patch: Partial<BarangUnit>) => setForm((f) => ({ ...f, units: f.units.map((u, i) => (i === idx ? { ...u, ...patch } : u)) }))
  const removeUnit = (idx: number) => setForm((f) => ({ ...f, units: f.units.filter((_, i) => i !== idx) }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setErrors(null)

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
          const dup = (list?.rows || list || []).find((b: any) => String(b.code || '').toLowerCase() === form.code.trim().toLowerCase())
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
      await onSubmit({ ...form, jenis: 3, photoUrl })
      router.push(`${basePath}?${returnQuery}`)
    } catch {
      // error already handled by caller via showError
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <FormHeader title={title} subtitle="Master Barang Setengah Jadi" basePath={basePath + '?' + returnQuery} />
      {readonly && currentId && (
        <div className="flex gap-2">
          <Button onClick={() => router.push(`${basePath}/${currentId}/edit?return=${encodeURIComponent(returnQuery)}`)}>Edit</Button>
        </div>
      )}

      <form onSubmit={readonly ? (e) => e.preventDefault() : handleSubmit} className="container-card p-3 text-xs space-y-3">
        {errors && (
          <div className="p-2 rounded border border-red-200 bg-red-50 text-red-700 text-xs">{errors.split('\n').map((m, i) => (<div key={i}>{m}</div>))}</div>
        )}

        <div className="grid grid-cols-1 gap-3">
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Kode</span>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Kode barang" disabled={readonly || !!currentId} />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Nama</span>
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
              placeholder="0"
              disabled={readonly}
            />
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
          readonly={readonly}
        />

        <div className="pt-2 border-t border-teal-bg">
          {currentId ? (
            <div className="space-y-2">
              <div className="font-medium text-xs">Harga Jual Terakhir</div>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Harga (Rp)</span>
                <Input type="text" value={formatInputNumber(form.price)} disabled className="bg-slate-100" />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Tgl Berlaku</span>
                <Input type="date" value={form.effectiveDate} disabled className="bg-slate-100" />
              </label>
              <p className="text-[10px] text-slate-500 ml-28">Untuk mengubah harga, gunakan menu Riwayat Harga</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="font-medium text-xs">Harga Jual</div>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Harga (Rp)</span>
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
                  placeholder="0"
                  disabled={readonly}
                />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Tgl Berlaku</span>
                <Input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} disabled={readonly} />
              </label>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-teal-bg">
          <label className="flex items-start gap-3">
            <span className="w-28 text-slate-600 shrink-0 mt-1">Foto</span>
            <FileUpload
              value={photoUrl}
              onChange={(url) => setPhotoUrl(url)}
              readonly={readonly}
              emptyText="Belum ada foto"
            />
          </label>
        </div>

        <div className="pt-2 border-t border-teal-bg">
          <label className="flex items-start gap-3">
            <span className="w-28 text-slate-600 shrink-0 mt-1">Catatan</span>
            <Textarea placeholder="Catatan tambahan (opsional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={readonly} />
          </label>
        </div>

        {!readonly && (
          <div className="flex justify-end gap-2 pt-2 border-t border-teal-bg">
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        )}
      </form>
    </div>
  )
}
