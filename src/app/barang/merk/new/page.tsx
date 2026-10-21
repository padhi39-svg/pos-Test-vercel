"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function MerkNewPage() {
  const router = useRouter()
  const [form, setForm] = useState({ code: '', name: '' })
  const [saving, setSaving] = useState(false)

  const returnQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('return') || '' : ''

  const onSubmit = async () => {
    if (saving) return
    if (!form.code.trim() || !form.name.trim()) { alert('Kode dan Nama wajib diisi'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/merk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.code, name: form.name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err?.error || 'Gagal menyimpan')
        return
      }
      router.push('/barang/merk?' + returnQuery)
    } catch {
      alert('Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Tambah Merk</h1>
        <p className="text-slate-500 text-xs mt-1">Isi data merk</p>
      </div>
      <div className="container-card p-3 text-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-3">
            <span className="w-20 text-slate-600 shrink-0">Kode</span>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="cth: MRK-001" />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-20 text-slate-600 shrink-0">Nama</span>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="cth: Merek A" />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push('/barang/merk?' + returnQuery)}>Batal</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </div>
    </div>
  )
}
