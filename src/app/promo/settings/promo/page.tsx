'use client'

import { useEffect, useState } from 'react'
import { useAuthGuard } from '@/components/promo/useAuthGuard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Checkbox from '@/components/ui/Checkbox'
import FileUpload from '@/components/ui/FileUpload'
import SearchableSelect from '@/components/ui/SearchableSelect'
import type { PromoRow } from '@/lib/repositories/promoRepository'

type Form = {
  nama: string
  deskripsi: string
  tipeDiskon: string
  nilaiDiskon: string
  mulai: string
  selesai: string
  aktif: boolean
  bannerImage: string
}

const emptyForm: Form = { nama: '', deskripsi: '', tipeDiskon: 'persen', nilaiDiskon: '0', mulai: '', selesai: '', aktif: true, bannerImage: '' }

export default function PromoSettingsPage() {
  const ready = useAuthGuard()
  const [list, setList] = useState<PromoRow[]>([])
  const [options, setOptions] = useState<{ value: number; label: string; description?: string }[]>([])
  const [itemNames, setItemNames] = useState<Record<number, string>>({})
  const [form, setForm] = useState<Form>(emptyForm)
  const [items, setItems] = useState<number[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [p, o] = await Promise.all([
        fetch('/api/promo', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/promo/barang-options', { cache: 'no-store' }).then((r) => r.json()),
      ])
      setList(p.rows || [])
      setOptions(o.options || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (ready) load() }, [ready])

  const reset = () => { setForm(emptyForm); setItems([]); setItemNames({}); setEditingId(null) }

  const onEdit = async (p: PromoRow) => {
    setEditingId(p.id)
    setForm({
      nama: p.nama,
      deskripsi: p.deskripsi || '',
      tipeDiskon: p.tipeDiskon,
      nilaiDiskon: String(p.nilaiDiskon),
      mulai: p.mulai || '',
      selesai: p.selesai || '',
      aktif: p.aktif === 1,
      bannerImage: p.bannerImage || '',
    })
    const res = await fetch(`/api/promo/${p.id}/items`, { cache: 'no-store' })
    const d = await res.json()
    const ids: number[] = (d.rows || []).map((r: any) => Number(r.id))
    const names: Record<number, string> = {}
    for (const r of (d.rows || [])) names[Number(r.id)] = r.name
    setItems(ids)
    setItemNames(names)
  }

  const addItem = (v: string | number | null) => {
    if (v == null) return
    const id = Number(v)
    if (items.includes(id)) return
    setItems([...items, id])
    const opt = options.find((o) => o.value === id)
    if (opt) setItemNames((s) => ({ ...s, [id]: opt.label }))
  }

  const removeItem = (id: number) => {
    setItems(items.filter((x) => x !== id))
    setItemNames((s) => { const n = { ...s }; delete n[id]; return n })
  }

  const onSave = async () => {
    if (!form.nama) { alert('Nama promo wajib'); return }
    if (saving) return
    setSaving(true)
    try {
      const payload = {
        nama: form.nama,
        deskripsi: form.deskripsi,
        tipeDiskon: form.tipeDiskon,
        nilaiDiskon: Number(form.nilaiDiskon) || 0,
        mulai: form.mulai || null,
        selesai: form.selesai || null,
        aktif: form.aktif ? 1 : 0,
        bannerImage: form.bannerImage || null,
      }
      let id = editingId
      if (id == null) {
        const res = await fetch('/api/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Gagal simpan') }
        id = (await res.json()).row.id
      } else {
        const res = await fetch(`/api/promo/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Gagal simpan') }
      }
      const resItems = await fetch(`/api/promo/${id}/items`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ barangIds: items }) })
      if (!resItems.ok) throw new Error('Gagal simpan item promo')
      reset()
      await load()
    } catch (e: any) {
      alert(e?.message || 'Gagal simpan')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Hapus promo ini?')) return
    await fetch(`/api/promo/${id}`, { method: 'DELETE' })
    await load()
  }

  if (!ready) return <div className="p-4 text-center text-slate-400">Memuat...</div>

  return (
    <div className="min-h-screen w-full bg-surface-base">
      <div className="max-w-3xl mx-auto px-3 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Promo</h1>
            <p className="text-xs text-slate-500">Diskon per item barang jadi (persen / nominal)</p>
          </div>
          <a href="/promo/settings" className="text-xs text-teal-primary hover:underline">← Setting</a>
        </div>

        <div className="container-card p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0 text-xs">Nama Promo</span>
              <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama promo" />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0 text-xs">Deskripsi</span>
              <Input value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder="Deskripsi" />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0 text-xs">Banner</span>
              <div className="flex-1">
                <FileUpload value={form.bannerImage || null} onChange={(u) => setForm({ ...form, bannerImage: u || '' })} uploadEndpoint="/api/upload" />
              </div>
            </label>
            <div className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0 text-xs">Tipe Diskon</span>
              <select
                value={form.tipeDiskon}
                onChange={(e) => setForm({ ...form, tipeDiskon: e.target.value })}
                className="rounded-pill border border-slate-300 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-bg"
              >
                <option value="persen">Persen (%)</option>
                <option value="nominal">Nominal (Rp)</option>
              </select>
              <Input type="number" value={form.nilaiDiskon} onChange={(e) => setForm({ ...form, nilaiDiskon: e.target.value })} className="w-28" placeholder="0" />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0 text-xs">Periode</span>
              <Input type="date" value={form.mulai} onChange={(e) => setForm({ ...form, mulai: e.target.value })} className="w-auto" />
              <span className="text-slate-400 text-xs">s/d</span>
              <Input type="date" value={form.selesai} onChange={(e) => setForm({ ...form, selesai: e.target.value })} className="w-auto" />
            </div>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0 text-xs">Aktif</span>
              <Checkbox checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
            </label>

            <div className="border-t border-teal-bg pt-3">
              <div className="text-[10px] text-slate-600 mb-1">Item Barang Jadi dalam Promo</div>
              <SearchableSelect
                options={options.filter((o) => !items.includes(o.value))}
                value={null}
                onChange={addItem}
                placeholder="Tambah barang jadi ke promo..."
                showSearch
                allowClear
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {items.length === 0 && <span className="text-[11px] text-slate-400">Belum ada item</span>}
                {items.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-pill bg-teal-bg text-teal-dark text-[11px]">
                    {itemNames[id] || id}
                    <button type="button" className="text-teal-dark hover:text-coral-dark" onClick={() => removeItem(id)}>×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editingId && <Button variant="outline" onClick={reset}>Batal</Button>}
            <Button onClick={onSave} disabled={saving}>{saving ? 'Menyimpan...' : editingId ? 'Update' : 'Tambah Promo'}</Button>
          </div>
        </div>

        <div className="container-card p-2">
          {loading ? (
            <div className="p-4 text-center text-slate-400 text-sm">Memuat...</div>
          ) : list.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">Belum ada promo</div>
          ) : (
            <div className="divide-y">
              {list.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{p.nama}</div>
                    <div className="text-[11px] text-slate-400">
                      {p.tipeDiskon === 'persen' ? `Diskon ${p.nilaiDiskon}%` : `Diskon Rp ${p.nilaiDiskon}`}
                      {p.mulai || p.selesai ? ` • ${p.mulai || '...'} s/d ${p.selesai || '...'}` : ''} • {p.aktif === 1 ? 'Aktif' : 'Nonaktif'}
                    </div>
                  </div>
                  <button className="text-xs text-teal-primary hover:underline" onClick={() => onEdit(p)}>Edit</button>
                  <button className="text-xs text-coral-dark hover:underline" onClick={() => onDelete(p.id)}>Hapus</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
