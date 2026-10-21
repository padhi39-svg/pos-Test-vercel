"use client"
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function MasterForm({
  title,
  basePath,
  initial,
  onSubmit,
  currentId,
  readonly = false,
  codeAutoGenerate = false,
  nextCodeUrl,
}: {
  title: string
  basePath: string
  initial?: { code: string; name: string }
  onSubmit: (data: { code: string; name: string }) => void
  currentId?: number
  readonly?: boolean
  codeAutoGenerate?: boolean
  nextCodeUrl?: string
}) {
  const [form, setForm] = useState({ code: initial?.code ?? '', name: initial?.name ?? '' })
  const [error, setError] = useState<string | null>(null)
  const [loadingCode, setLoadingCode] = useState(false)

  useEffect(() => {
    if (!codeAutoGenerate || !nextCodeUrl || readonly) return
    setLoadingCode(true)
    fetch(nextCodeUrl)
      .then((r) => r.json())
      .then((d) => setForm((f) => ({ ...f, code: d.code || '' })))
      .catch(() => {})
      .finally(() => setLoadingCode(false))
  }, [codeAutoGenerate, nextCodeUrl, readonly])

  const isCodeDisabled = readonly || !!currentId || codeAutoGenerate

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const msgs: string[] = []
    if (!codeAutoGenerate && !form.code.trim()) msgs.push('Kode wajib diisi')
    if (!form.name.trim()) msgs.push('Nama wajib diisi')
    // Duplicate code check only for create (skip when codeAutoGenerate — backend handles uniqueness)
    if (!currentId && !codeAutoGenerate) {
      try {
        const resource = (basePath.split('/').pop() || '').toLowerCase()
        if (resource) {
          const res = await fetch(`/api/${resource}`)
          if (res.ok) {
            const data = await res.json()
            const dup = (data || []).find((x: any) => (x.code || '').toLowerCase() === form.code.trim().toLowerCase())
            if (dup) msgs.push('Kode sudah digunakan')
          }
        }
      } catch (err) {
        console.warn('Duplicate check skipped due to API error', err)
      }
    }
    if (msgs.length) {
      setError(msgs.join('\n'))
      return
    }
    setError(null)
    const submitData = codeAutoGenerate ? { code: '', name: form.name } : form
    onSubmit(submitData)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-slate-500 text-[10px] mt-1">{readonly ? 'Detail data master.' : 'Lengkapi data master lalu simpan.'}</p>
        </div>
        <div className="flex gap-2">
          <Link href={basePath} className="inline-flex items-center px-3 py-1.5 rounded-pill border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">{readonly ? 'Kembali' : 'Batal'}</Link>
          {!readonly && (
            <Button form="master-form" type="submit">Simpan</Button>
          )}
        </div>
      </div>

      <form id="master-form" onSubmit={handleSubmit} className="container-card p-4 space-y-4">
        {error && (
          <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{error.split('\n').map((m,i)=>(<div key={i}>{m}</div>))}</div>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1">Kode</label>
            <Input 
              value={form.code} 
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} 
              placeholder={codeAutoGenerate ? (loadingCode ? 'Memuat kode...' : 'Auto (akan digenerate)') : 'cth: CTG-001'} 
              disabled={isCodeDisabled}
              required={!codeAutoGenerate}
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1">Nama</label>
            <Input
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value
                    .toLowerCase()
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' '),
                })
              }
              placeholder="cth: Kategori Makanan"
              disabled={readonly}
              required
            />
          </div>
        </div>
      </form>
    </div>
  )
}
