"use client"
import { useEffect, useState, useMemo } from 'react'
import Input from '@/components/ui/Input'
import Link from 'next/link'
import { Periode } from '@/lib/periodeStore'
import { smartTitleCase } from '@/lib/textFormat'

export type PeriodeFormData = {
  code: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
}

export default function PeriodeForm({
  title,
  basePath,
  initial,
  onSubmit,
  currentId,
  readonly,
}: {
  title: string
  basePath: string
  initial?: Partial<Periode>
  onSubmit: (data: PeriodeFormData) => void
  currentId?: number
  readonly?: boolean
}) {
  const [form, setForm] = useState<PeriodeFormData>({
    code: '',
    name: '',
    startDate: '',
    endDate: '',
    isActive: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initial) {
      setForm((prev) => ({
        code: (initial.code ?? '').toUpperCase(),
        name: initial.name ?? '',
        startDate: initial.startDate ?? '',
        endDate: initial.endDate ?? '',
        isActive: initial.isActive ?? true,
      }))
    }
  }, [initial])

  const mode: 'create' | 'edit' | 'view' = useMemo(() => {
    if (readonly) return 'view'
    return currentId ? 'edit' : 'create'
  }, [readonly, currentId])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.code.trim()) e.code = 'Kode wajib diisi'
    if (!form.name.trim()) e.name = 'Nama wajib diisi'
    if (!form.startDate) e.startDate = 'Tanggal awal wajib diisi'
    if (!form.endDate) e.endDate = 'Tanggal akhir wajib diisi'
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      e.endDate = 'Tanggal akhir harus >= tanggal awal'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      code: form.code.trim().toUpperCase(),
      name: smartTitleCase(form.name),
      startDate: form.startDate,
      endDate: form.endDate,
      isActive: !!form.isActive,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-slate-500 text-xs mt-1">Master Periode</p>
        </div>
        <div className="flex gap-2">
          <Link href={`${basePath}`} className="px-3 py-1.5 rounded-pill bg-slate-100 hover:bg-slate-200">
            {mode === 'view' ? 'Kembali' : 'Batal'}
          </Link>
          {mode === 'view' ? (
            <Link href={`${basePath}/${currentId}/edit`} className="px-3 py-1.5 rounded-pill bg-blue-600 hover:bg-blue-700 text-white">
              Edit
            </Link>
          ) : (
            <button onClick={handleSubmit} className="px-3 py-1.5 rounded-pill bg-blue-600 hover:bg-blue-700 text-white">
              Simpan
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs text-slate-600 mb-1">Kode Periode</label>
          <Input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="PER-2025-01"
            disabled={mode === 'edit' || mode === 'view'}
          />
          {errors.code && <div className="text-red-600 text-xs mt-1">{errors.code}</div>}
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Nama Periode</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: smartTitleCase(e.target.value) })}
            placeholder="Periode Januari 2025"
            disabled={mode === 'view'}
          />
          {errors.name && <div className="text-red-600 text-xs mt-1">{errors.name}</div>}
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Tanggal Awal</label>
          <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} disabled={mode === 'view'} />
          {errors.startDate && <div className="text-red-600 text-xs mt-1">{errors.startDate}</div>}
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Tanggal Akhir</label>
          <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} disabled={mode === 'view'} />
          {errors.endDate && <div className="text-red-600 text-xs mt-1">{errors.endDate}</div>}
        </div>
        <div className="col-span-full">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} disabled={mode === 'view'} />
            Buka
          </label>
        </div>
      </form>
    </div>
  )
}
