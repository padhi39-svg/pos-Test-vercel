"use client"
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function SpesifikasiEditPage() {
  const router = useRouter()
  const params = useParams()
  const id = Number(params.id)
  const [form, setForm] = useState({ code: '', name: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const returnQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('return') || '' : ''

  useEffect(() => {
    fetch(`/api/spesifikasi/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setForm({ code: data.code || '', name: data.name || '' })
      })
      .finally(() => setLoading(false))
  }, [id])

  const onSubmit = async () => {
    if (saving) return
    if (!form.name.trim()) { alert('Nama wajib diisi'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/spesifikasi/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.code, name: form.name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err?.error || 'Gagal menyimpan')
        return
      }
      router.push('/barang/spesifikasi?' + returnQuery)
    } catch {
      alert('Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Memuat...</div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ubah Spesifikasi</h1>
        <p className="text-slate-500 text-xs mt-1">Ubah data spesifikasi</p>
      </div>
      <div className="container-card p-3 text-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-3">
            <span className="w-20 text-slate-600 shrink-0">Kode</span>
            <Input value={form.code} disabled className="bg-slate-100" />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-20 text-slate-600 shrink-0">Nama</span>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="cth: Pedas" />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push('/barang/spesifikasi?' + returnQuery)}>Batal</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </div>
    </div>
  )
}
