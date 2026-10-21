"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Checkbox from '@/components/ui/Checkbox'
import Button from '@/components/ui/Button'
import FormHeader from '@/components/ui/FormHeader'

type LantaiFormProps = {
  title: string
  basePath: string
  initial?: { id?: number; code?: string; name?: string; levelNo?: number | null; isActive?: number }
  currentId?: number
  readonly?: boolean
}

export default function LantaiForm({ title, basePath, initial, currentId, readonly }: LantaiFormProps) {
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''
  const [code, setCode] = useState(initial?.code || '')
  const [name, setName] = useState(initial?.name || '')
  const [levelNo, setLevelNo] = useState(initial?.levelNo != null ? String(initial.levelNo) : '')
  const [isActive, setIsActive] = useState(initial?.isActive ?? 1)
  const [saving, setSaving] = useState(false)

  const isEdit = !!currentId

  const onSubmit = async () => {
    if (saving) return
    setSaving(true)
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const body = isEdit
        ? { id: currentId, code: code.toUpperCase(), name, level_no: levelNo ? Number(levelNo) : null, is_active: isActive ? 1 : 0 }
        : { code: code.toUpperCase(), name, level_no: levelNo ? Number(levelNo) : null, is_active: isActive ? 1 : 0 }

      const res = await fetch('/api/floors', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err?.error || 'Gagal menyimpan')
        return
      }
      router.push(basePath + '?' + returnQuery)
    } catch {
      alert('Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <FormHeader title={title} subtitle={readonly ? 'Detail lantai' : isEdit ? 'Ubah data lantai' : 'Isi data lantai'} backHref={basePath + '?' + returnQuery} />

      {readonly ? (
        <>
          <div className="flex gap-2">
            {currentId && <Button onClick={() => router.push(`${basePath}/${currentId}/edit?return=${encodeURIComponent(returnQuery)}`)}>Edit</Button>}
          </div>
          <div className="container-card p-3 text-xs space-y-2">
            <div className="grid grid-cols-1 gap-2">
              <label className="flex items-center gap-3">
                <span className="w-20 text-slate-600 shrink-0">Kode</span>
                <input value={initial?.code || ''} disabled className="w-full border border-slate-300 rounded-pill px-3 py-1.5 bg-slate-100 text-slate-500" />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-20 text-slate-600 shrink-0">Nama</span>
                <input value={initial?.name || ''} disabled className="w-full border border-slate-300 rounded-pill px-3 py-1.5 bg-slate-100 text-slate-500" />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-20 text-slate-600 shrink-0">Urutan</span>
                <input value={initial?.levelNo ?? '-'} disabled className="w-full border border-slate-300 rounded-pill px-3 py-1.5 bg-slate-100 text-slate-500" />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-20 text-slate-600 shrink-0">Aktif</span>
                <span className={`inline-block px-2 py-1 text-xs rounded ${initial?.isActive ? 'bg-teal-bg text-teal-dark' : 'bg-coral-bg text-coral-dark'}`}>
                  {initial?.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </label>
            </div>
          </div>
        </>
      ) : (
        <div className="container-card p-3 text-xs space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="flex items-center gap-3">
              <span className="w-20 text-slate-600 shrink-0">Kode</span>
              <Input value={code} onChange={e => setCode(e.target.value)} disabled={isEdit} />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-20 text-slate-600 shrink-0">Nama</span>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-20 text-slate-600 shrink-0">Urutan</span>
              <Input type="number" min={0} value={levelNo} onChange={e => setLevelNo(e.target.value)} placeholder="0" />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-20 text-slate-600 shrink-0">Aktif</span>
              <Checkbox checked={isActive === 1} onChange={e => setIsActive(e.target.checked ? 1 : 0)} />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={onSubmit} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
