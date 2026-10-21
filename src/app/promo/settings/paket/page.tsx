'use client'

import { useEffect, useState } from 'react'
import { useAuthGuard } from '@/components/promo/useAuthGuard'
import Button from '@/components/ui/Button'
import SearchableSelect from '@/components/ui/SearchableSelect'
import FileUpload from '@/components/ui/FileUpload'

type PaketRow = {
  id: number
  barangId: number
  kode: string
  nama: string
  photoUrl: string | null
  kategori: string | null
  urutan: number
  aktif: number
  deskripsi: string | null
  mediaCategory: string | null
  isRecommended: number
  isNew: number
  diskon: number
  photos?: { id: number; imageUrl: string; urutan: number }[]
}

export default function PaketSettingsPage() {
  const ready = useAuthGuard()
  const [list, setList] = useState<PaketRow[]>([])
  const [options, setOptions] = useState<{ value: number; label: string; description?: string }[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingDesc, setSavingDesc] = useState<number | null>(null)
  const [savingDiskon, setSavingDiskon] = useState<number | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [m, o] = await Promise.all([
        fetch('/api/menu-item?paket=1', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/promo/barang-options', { cache: 'no-store' }).then((r) => r.json()),
      ])
      const rows: PaketRow[] = m.rows || []
      // fetch photos per paket
      const withPhotos = await Promise.all(rows.map(async (r) => {
        try {
          const pr = await fetch(`/api/menu-item/${r.id}/photos`, { cache: 'no-store' }).then((x) => x.json())
          return { ...r, photos: pr.rows || [] }
        } catch { return { ...r, photos: [] } }
      }))
      setList(withPhotos)
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
      // create as paket: after create, force media_category to Paket
      const res = await fetch('/api/menu-item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ barangId: selected }) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Gagal tambah') }
      const data = await res.json()
      const newId = data.row?.id
      if (newId) {
        await fetch(`/api/menu-item/${newId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaCategory: 'Paket' }) })
      }
      setSelected(null)
      await load()
    } catch (e: any) { alert(e?.message || 'Gagal tambah') } finally { setSaving(false) }
  }

  const onToggle = async (it: PaketRow) => {
    await fetch(`/api/menu-item/${it.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktif: it.aktif === 1 ? 0 : 1 }) })
    await load()
  }

  const onDelete = async (id: number) => {
    if (!confirm('Hapus paket ini?')) return
    await fetch(`/api/menu-item/${id}`, { method: 'DELETE' })
    await load()
  }

  const onSaveDeskripsi = async (it: PaketRow) => {
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

  const onSaveDiskon = async (it: PaketRow) => {
    const el = document.getElementById(`diskon-paket-${it.id}`) as HTMLInputElement | null
    const val = el ? Number(el.value) : 0
    if (savingDiskon === it.id) return
    setSavingDiskon(it.id)
    try {
      const res = await fetch(`/api/menu-item/${it.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ diskon: val }) })
      if (!res.ok) throw new Error('Gagal simpan diskon')
      setList((l) => l.map((x) => x.id === it.id ? { ...x, diskon: Math.max(0, Math.min(100, Math.round(val))) } : x))
    } catch (e: any) { alert(e?.message || 'Gagal simpan diskon') } finally { setSavingDiskon(null) }
  }

  const move = (idx: number, dir: number) => {
    if (idx + dir < 0 || idx + dir >= list.length) return
    const next = [...list]
    const [a] = next.splice(idx, 1)
    next.splice(idx + dir, 0, a)
    setList(next)
    const ids = next.map((x) => x.id)
    fetch('/api/menu-item/reorder', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }).catch(() => load())
  }

  const onAddPhoto = async (menuItemId: number, url: string | null) => {
    if (!url) return
    setUploadingPhoto(menuItemId)
    try {
      const res = await fetch(`/api/menu-item/${menuItemId}/photos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: url }) })
      if (!res.ok) throw new Error('Gagal tambah foto')
      await load()
    } catch (e: any) { alert(e?.message || 'Gagal tambah foto') } finally { setUploadingPhoto(null) }
  }

  const onDeletePhoto = async (photoId: number) => {
    if (!confirm('Hapus foto ini?')) return
    await fetch(`/api/menu-item/photos/${photoId}`, { method: 'DELETE' })
    await load()
  }

  const movePhoto = async (paket: PaketRow, idx: number, dir: number) => {
    if (!paket.photos) return
    if (idx + dir < 0 || idx + dir >= paket.photos.length) return
    const next = [...paket.photos]
    const [a] = next.splice(idx, 1)
    next.splice(idx + dir, 0, a)
    // optimistic
    setList((l) => l.map((x) => x.id === paket.id ? { ...x, photos: next } : x))
    const ids = next.map((x) => x.id)
    await fetch(`/api/menu-item/${paket.id}/photos/reorder`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }).catch(() => load())
  }

  if (!ready) return <div className="p-4 text-center text-slate-400">Memuat...</div>

  return (
    <div className="min-h-screen w-full bg-surface-base">
      <div className="max-w-3xl mx-auto px-3 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Paket Landing</h1>
            <p className="text-xs text-slate-500">Kelola paket banner — 1 paket bisa beberapa foto (carousel)</p>
          </div>
          <a href="/promo/settings" className="text-xs text-teal-primary hover:underline">← Setting</a>
        </div>

        <div className="flex gap-2 text-xs">
          <a href="/promo/paket" target="_blank" className="px-3 py-1.5 rounded-pill border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg">Lihat Halaman Paket</a>
        </div>

        <div className="container-card p-3 space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <div className="text-[10px] text-slate-600 mb-1">Tambah barang jadi sebagai paket</div>
              <SearchableSelect
                options={options}
                value={selected}
                onChange={(v) => setSelected(v != null ? Number(v) : null)}
                placeholder="Cari barang jadi..."
                showSearch
                allowClear
              />
            </div>
            <Button onClick={onAdd} disabled={saving || selected == null}>{saving ? 'Menyimpan...' : 'Tambah Paket'}</Button>
          </div>
          <div className="text-[10px] text-slate-400">Setelah tambah, otomatis kategori Paket. Bedakan tegas dari menu biasa.</div>
        </div>

        <div className="container-card p-2">
          {loading ? (
            <div className="p-4 text-center text-slate-400 text-sm">Memuat...</div>
          ) : list.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">Belum ada paket. Tambah barang jadi di atas.</div>
          ) : (
            <div className="divide-y">
              {list.map((it, idx) => (
                <div key={it.id} className="p-2 space-y-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.photos?.[0]?.imageUrl || it.photoUrl || '/icon.svg'} alt="" className="w-14 h-14 object-cover rounded-card border border-teal-bg bg-teal-bg shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{it.nama}</div>
                      <div className="text-[11px] text-slate-400">{it.kode}{it.kategori ? ' • ' + it.kategori : ''} • {it.photos?.length || 0} foto</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button type="button" className="w-7 h-6 text-xs rounded-pill border border-slate-300 text-slate-500 disabled:opacity-30" disabled={idx === 0} onClick={() => move(idx, -1)}>↑</button>
                      <button type="button" className="w-7 h-6 text-xs rounded-pill border border-slate-300 text-slate-500 disabled:opacity-30" disabled={idx === list.length - 1} onClick={() => move(idx, 1)}>↓</button>
                    </div>
                    <button className={`text-[11px] px-2 py-1 rounded-pill border ${it.aktif === 1 ? 'border-teal-primary text-teal-primary' : 'border-slate-300 text-slate-400'}`} onClick={() => onToggle(it)}>{it.aktif === 1 ? 'Aktif' : 'Nonaktif'}</button>
                    <button className="text-xs text-coral-dark hover:underline" onClick={() => onDelete(it.id)}>Hapus</button>
                  </div>

                  <div className="space-y-2 pl-1">
                    <div className="text-[10px] text-slate-600 font-medium">Foto paket (multi-foto, carousel di card banner) — upload manual</div>
                    {(it.photos && it.photos.length > 0) && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {it.photos.map((ph, pIdx) => (
                          <div key={ph.id} className="relative group border border-slate-200 rounded-card overflow-hidden bg-slate-50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ph.imageUrl} alt="" className="w-full h-20 object-cover" />
                            <div className="absolute top-1 right-1 flex gap-1 opacity-90">
                              <button type="button" onClick={() => movePhoto(it, pIdx, -1)} disabled={pIdx === 0} className="w-6 h-6 text-[10px] bg-white/90 rounded-full border border-slate-300 disabled:opacity-30">‹</button>
                              <button type="button" onClick={() => movePhoto(it, pIdx, 1)} disabled={pIdx === (it.photos?.length || 0) - 1} className="w-6 h-6 text-[10px] bg-white/90 rounded-full border border-slate-300 disabled:opacity-30">›</button>
                            </div>
                            <button type="button" onClick={() => onDeletePhoto(ph.id)} className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded-pill bg-coral-dark text-white hover:bg-red-600">Hapus</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <FileUpload value={null} onChange={(u) => onAddPhoto(it.id, u)} uploadEndpoint="/api/upload" />
                      </div>
                      {uploadingPhoto === it.id && <span className="text-xs text-slate-400">Upload...</span>}
                    </div>
                    <div className="text-[10px] text-slate-400">Bisa tambah beberapa foto per paket. Urutkan dengan ‹ ›. Foto pertama jadi cover.</div>
                  </div>

                  <div className="space-y-1 pl-1">
                    <div className="text-[10px] text-slate-600">Diskon % (0 = tanpa diskon)</div>
                    <div className="flex items-center gap-2">
                      <input id={`diskon-paket-${it.id}`} type="number" min={0} max={100} defaultValue={it.diskon || 0} placeholder="0" className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
                      <span className="text-xs text-slate-500">%</span>
                      <Button variant="outline" className="text-xs !py-1" onClick={() => onSaveDiskon(it)} disabled={savingDiskon === it.id}>{savingDiskon === it.id ? 'Menyimpan...' : 'Simpan diskon'}</Button>
                    </div>
                  </div>
                  <div className="space-y-1 pl-1">
                    <div className="text-[10px] text-slate-600">Deskripsi paket (tampil di card & modal, wrap otomatis)</div>
                    <textarea
                      id={`desc-${it.id}`}
                      defaultValue={it.deskripsi || ''}
                      placeholder="Contoh: Ayam Bakar + Nasi + Es Teh + Sambal..."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary min-h-[56px] resize-none"
                    />
                    <div className="flex justify-end">
                      <Button variant="outline" className="text-xs !py-1" onClick={() => onSaveDeskripsi(it)} disabled={savingDesc === it.id}>{savingDesc === it.id ? 'Menyimpan...' : 'Simpan deskripsi'}</Button>
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
