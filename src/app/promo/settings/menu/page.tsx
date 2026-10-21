'use client'

import { useEffect, useState } from 'react'
import { useAuthGuard } from '@/components/promo/useAuthGuard'
import Button from '@/components/ui/Button'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { formatCurrency } from '@/lib/regionalNumber'
import FileUpload from '@/components/ui/FileUpload'
import type { MenuItemRow } from '@/lib/repositories/promoRepository'
import Select from '@/components/ui/Select'

const MEDIA_CATEGORIES = ['Makanan', 'Minuman', 'Paket', 'Snack', 'Dessert']

export default function MenuSettingsPage() {
  const ready = useAuthGuard()
  const [list, setList] = useState<MenuItemRow[]>([])
  const [options, setOptions] = useState<{ value: number; label: string; description?: string }[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingDesc, setSavingDesc] = useState<number | null>(null)
  const [savingMedia, setSavingMedia] = useState<number | null>(null)
  const [savingDiskon, setSavingDiskon] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [m, o] = await Promise.all([
        fetch('/api/menu-item?paket=0', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/promo/barang-options', { cache: 'no-store' }).then((r) => r.json()),
      ])
      setList(m.rows || [])
      setOptions(o.options || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (ready) load() }, [ready])

  const onAdd = async () => {
    if (selected == null) return
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/menu-item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ barangId: selected }) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Gagal tambah') }
      setSelected(null)
      await load()
    } catch (e: any) { alert(e?.message || 'Gagal tambah') } finally { setSaving(false) }
  }

  const onToggle = async (it: MenuItemRow) => {
    await fetch(`/api/menu-item/${it.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktif: it.aktif === 1 ? 0 : 1 }) })
    await load()
  }

  const onDelete = async (id: number) => {
    if (!confirm('Hapus item menu ini?')) return
    await fetch(`/api/menu-item/${id}`, { method: 'DELETE' })
    await load()
  }

  const onSaveDeskripsi = async (it: MenuItemRow) => {
    const el = document.getElementById(`desc-${it.id}`) as HTMLTextAreaElement | null
    const val = el ? el.value : it.deskripsi || ''
    if (savingDesc) return
    setSavingDesc(it.id)
    try {
      const res = await fetch(`/api/menu-item/${it.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deskripsi: val }) })
      if (!res.ok) throw new Error('Gagal simpan deskripsi')
      await load()
    } catch (e: any) { alert(e?.message || 'Gagal simpan deskripsi') } finally { setSavingDesc(null) }
  }

  const move = (idx: number, dir: number) => {
    if (idx + dir < 0 || idx + dir >= list.length) return
    const next = [...list]
    const [a] = next.splice(idx, 1)
    next.splice(idx + dir, 0, a)
    setList(next)
    const ids = next.map((x) => x.id)
    fetch('/api/menu-item/reorder', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
      .catch(() => load())
  }

  const onSavePhoto = async (it: MenuItemRow, u: string | null) => {
    try {
      await fetch(`/api/menu-item/${it.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoUrl: u || null }) })
      setList((l) => l.map((x) => (x.id === it.id ? { ...x, photoUrl: u || null } : x)))
    } catch {
      alert('Gagal upload foto')
    }
  }

  const onSaveDiskon = async (it: MenuItemRow) => {
    const el = document.getElementById(`diskon-${it.id}`) as HTMLInputElement | null
    const val = el ? Number(el.value) : 0
    if (savingDiskon === it.id) return
    setSavingDiskon(it.id)
    try {
      const res = await fetch(`/api/menu-item/${it.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ diskon: val }) })
      if (!res.ok) throw new Error('Gagal simpan diskon')
      setList((l) => l.map((x) => x.id === it.id ? { ...x, diskon: Math.max(0, Math.min(100, Math.round(val))) } : x))
    } catch (e: any) { alert(e?.message || 'Gagal simpan diskon') } finally { setSavingDiskon(null) }
  }

  const onSaveMedia = async (it: MenuItemRow, patch: Partial<Pick<MenuItemRow, 'mediaCategory' | 'isRecommended' | 'isNew'>>) => {
    if (savingMedia === it.id) return
    const next = {
      mediaCategory: patch.mediaCategory !== undefined ? patch.mediaCategory : it.mediaCategory,
      isRecommended: patch.isRecommended !== undefined ? patch.isRecommended : it.isRecommended,
      isNew: patch.isNew !== undefined ? patch.isNew : it.isNew,
    }
    setSavingMedia(it.id)
    try {
      const res = await fetch(`/api/menu-item/${it.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
      if (!res.ok) throw new Error('Gagal simpan kategori media promo')
      setList((l) => l.map((x) => x.id === it.id ? { ...x, ...next } : x))
    } catch (e: any) {
      alert(e?.message || 'Gagal simpan kategori media promo')
    } finally {
      setSavingMedia(null)
    }
  }

  if (!ready) return <div className="p-4 text-center text-slate-400">Memuat...</div>

  return (
    <div className="min-h-screen w-full bg-surface-base">
      <div className="max-w-3xl mx-auto px-3 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Menu Landing</h1>
            <p className="text-xs text-slate-500">Pilih barang jadi yang tampil di section Menu</p>
          </div>
          <a href="/promo/settings" className="text-xs text-teal-primary hover:underline">← Setting</a>
        </div>

        <div className="container-card p-3 space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <div className="text-[10px] text-slate-600 mb-1">Tambah barang jadi</div>
              <SearchableSelect
                options={options}
                value={selected}
                onChange={(v) => setSelected(v != null ? Number(v) : null)}
                placeholder="Cari barang jadi..."
                showSearch
                allowClear
              />
            </div>
            <Button onClick={onAdd} disabled={saving || selected == null}>{saving ? 'Menyimpan...' : 'Tambah'}</Button>
          </div>
        </div>

        <div className="container-card p-2">
          {loading ? (
            <div className="p-4 text-center text-slate-400 text-sm">Memuat...</div>
          ) : list.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">Belum ada menu</div>
          ) : (
            <div className="divide-y">
              {list.map((it, idx) => (
                <div key={it.id} className="p-2 space-y-2">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.photoUrl || '/icon.svg'} alt="" className="w-12 h-12 object-cover rounded-card border border-teal-bg bg-teal-bg" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{it.nama}</div>
                      <div className="text-[11px] text-slate-400">{it.kode}{it.kategori ? ' • ' + it.kategori : ''}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button type="button" className="w-7 h-6 text-xs rounded-pill border border-slate-300 text-slate-500 disabled:opacity-30" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="Naik">↑</button>
                      <button type="button" className="w-7 h-6 text-xs rounded-pill border border-slate-300 text-slate-500 disabled:opacity-30" disabled={idx === list.length - 1} onClick={() => move(idx, 1)} aria-label="Turun">↓</button>
                    </div>
                    <button
                      className={`text-[11px] px-2 py-1 rounded-pill border ${it.aktif === 1 ? 'border-teal-primary text-teal-primary' : 'border-slate-300 text-slate-400'}`}
                      onClick={() => onToggle(it)}
                    >
                      {it.aktif === 1 ? 'Aktif' : 'Nonaktif'}
                    </button>
                    <button className="text-xs text-coral-dark hover:underline" onClick={() => onDelete(it.id)}>Hapus</button>
                  </div>
                  <div className="space-y-1 pl-[60px]">
                    <div className="text-[10px] text-slate-600">Foto menu (upload terpisah dari master)</div>
                    <FileUpload value={it.photoUrl || null} onChange={(u) => onSavePhoto(it, u)} uploadEndpoint="/api/upload" />
                  </div>
                  <div className="space-y-1 pl-[60px]">
                    <div className="text-[10px] text-slate-600">Kategori Media Promo</div>
                    <Select
                      value={it.mediaCategory || ''}
                      onChange={(e) => onSaveMedia(it, { mediaCategory: e.target.value || null })}
                      disabled={savingMedia === it.id}
                    >
                      <option value="">Pilih kategori media promo</option>
                      {MEDIA_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </Select>
                    <div className="flex flex-wrap gap-4 pt-1 text-xs text-slate-600">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={it.isRecommended === 1} onChange={(e) => onSaveMedia(it, { isRecommended: e.target.checked ? 1 : 0 })} disabled={savingMedia === it.id} />
                        Rekomendasi Untukmu
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={it.isNew === 1} onChange={(e) => onSaveMedia(it, { isNew: e.target.checked ? 1 : 0 })} disabled={savingMedia === it.id} />
                        Tampilkan di Baru
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1 pl-[60px]">
                    <div className="text-[10px] text-slate-600">Diskon % (0 = tanpa diskon, visual tetap seperti sekarang)</div>
                    <div className="flex items-center gap-2">
                      <input
                        id={`diskon-${it.id}`}
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={it.diskon || 0}
                        placeholder="0"
                        className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
                      />
                      <span className="text-xs text-slate-500">%</span>
                      <Button variant="outline" className="text-xs !py-1" onClick={() => onSaveDiskon(it)} disabled={savingDiskon === it.id}>
                        {savingDiskon === it.id ? 'Menyimpan...' : 'Simpan diskon'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1 pl-[60px]">
                    <div className="text-[10px] text-slate-600">Deskripsi (tampil di detail modal)</div>
                    <textarea
                      id={`desc-${it.id}`}
                      defaultValue={it.deskripsi || ''}
                      placeholder="Tulis deskripsi menu..."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary min-h-[56px] resize-none"
                    />
                    <div className="flex justify-end">
                      <Button variant="outline" className="text-xs !py-1" onClick={() => onSaveDeskripsi(it)} disabled={savingDesc === it.id}>
                        {savingDesc === it.id ? 'Menyimpan...' : 'Simpan deskripsi'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
