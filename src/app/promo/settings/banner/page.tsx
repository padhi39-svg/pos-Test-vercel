'use client'

import { useEffect, useState } from 'react'
import { useAuthGuard } from '@/components/promo/useAuthGuard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Checkbox from '@/components/ui/Checkbox'
import FileUpload from '@/components/ui/FileUpload'
import type { BannerRow } from '@/lib/repositories/promoRepository'

type Form = {
  imageUrl: string
  title: string
  subtitle: string
  linkUrl: string
  urutan: string
  aktif: boolean
}

const emptyForm: Form = { imageUrl: '', title: '', subtitle: '', linkUrl: '', urutan: '0', aktif: true }

export default function BannerSettingsPage() {
  const ready = useAuthGuard()
  const [list, setList] = useState<BannerRow[]>([])
  const [form, setForm] = useState<Form>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/promo/banner', { cache: 'no-store' })
      const d = await res.json()
      setList(d.rows || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (ready) load() }, [ready])

  const reset = () => { setForm(emptyForm); setEditingId(null) }

  const onEdit = (b: BannerRow) => {
    setEditingId(b.id)
    setForm({
      imageUrl: b.imageUrl,
      title: b.title || '',
      subtitle: b.subtitle || '',
      linkUrl: b.linkUrl || '',
      urutan: String(b.urutan),
      aktif: b.aktif === 1,
    })
  }

  const onSave = async () => {
    if (!form.imageUrl) { alert('Upload gambar banner dulu'); return }
    if (saving) return
    setSaving(true)
    try {
      const payload = {
        imageUrl: form.imageUrl,
        title: form.title,
        subtitle: form.subtitle,
        linkUrl: form.linkUrl,
        urutan: Number(form.urutan) || 0,
        aktif: form.aktif ? 1 : 0,
      }
      const res = editingId
        ? await fetch(`/api/promo/banner/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/promo/banner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Gagal simpan') }
      reset()
      await load()
    } catch (e: any) {
      alert(e?.message || 'Gagal simpan')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Hapus banner ini?')) return
    await fetch(`/api/promo/banner/${id}`, { method: 'DELETE' })
    await load()
  }

  if (!ready) return <div className="p-4 text-center text-slate-400">Memuat...</div>

  return (
    <div className="min-h-screen w-full bg-surface-base">
      <div className="max-w-3xl mx-auto px-3 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Banner Promosi</h1>
            <p className="text-xs text-slate-500">Slide di header landing /promo (auto-play)</p>
          </div>
          <a href="/promo/settings" className="text-xs text-teal-primary hover:underline">← Setting</a>
        </div>

        <div className="container-card p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0 text-xs">Gambar</span>
              <div className="flex-1">
                <FileUpload value={form.imageUrl || null} onChange={(u) => setForm({ ...form, imageUrl: u || '' })} uploadEndpoint="/api/upload" />
              </div>
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0 text-xs">Judul</span>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Judul banner" />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0 text-xs">Subtitle</span>
              <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Subtitle" />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0 text-xs">Link</span>
              <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://... (opsional)" />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0 text-xs">Urutan</span>
              <Input type="number" value={form.urutan} onChange={(e) => setForm({ ...form, urutan: e.target.value })} className="w-24" />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0 text-xs">Aktif</span>
              <Checkbox checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            {editingId && <Button variant="outline" onClick={reset}>Batal</Button>}
            <Button onClick={onSave} disabled={saving}>{saving ? 'Menyimpan...' : editingId ? 'Update' : 'Tambah'}</Button>
          </div>
        </div>

        <div className="container-card p-2">
          {loading ? (
            <div className="p-4 text-center text-slate-400 text-sm">Memuat...</div>
          ) : list.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">Belum ada banner</div>
          ) : (
            <div className="divide-y">
              {list.map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.imageUrl} alt="" className="w-24 h-14 object-cover rounded-card border border-teal-bg" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{b.title || '(tanpa judul)'}</div>
                    <div className="text-[11px] text-slate-400">Urutan {b.urutan} • {b.aktif === 1 ? 'Aktif' : 'Nonaktif'}</div>
                  </div>
                  <button className="text-xs text-teal-primary hover:underline" onClick={() => onEdit(b)}>Edit</button>
                  <button className="text-xs text-coral-dark hover:underline" onClick={() => onDelete(b.id)}>Hapus</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
