"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { smartTitleCase } from '@/lib/textFormat'

type GudangFormProps = {
  title: string
  basePath: string
  initial?: {
    id?: number
    code?: string
    name?: string
    is_active?: number
  }
  currentId?: number
  readonly?: boolean
}

export default function GudangForm({ title, basePath, initial, currentId, readonly }: GudangFormProps) {
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''
  const [code, setCode] = useState(initial?.code || '')
  const [name, setName] = useState(initial?.name || '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? 1)
  const [loading, setLoading] = useState(false)

  const isEdit = !!currentId
  const isCreate = !currentId && !readonly

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!code.trim() || !name.trim()) {
      alert('Kode dan Nama harus diisi')
      return
    }

    setLoading(true)
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const body = isEdit
        ? { id: currentId, name: name.trim(), is_active: isActive }
        : { code: code.trim().toUpperCase(), name: name.trim(), is_active: isActive }

      const res = await fetch('/api/gudang', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (res.ok) {
        router.push(basePath + '?' + returnQuery)
        router.refresh()
      } else {
        alert(data.error || 'Gagal menyimpan data')
      }
    } catch (e) {
      console.error(e)
      alert('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-slate-500 text-xs mt-1">
          {readonly ? 'Detail gudang' : isEdit ? 'Edit data gudang' : 'Tambah gudang baru'}
        </p>
      </div>

      <div className="container-card p-3 text-xs space-y-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="flex items-center gap-3">
              <span className="w-20 text-slate-600 shrink-0">Kode</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={readonly || isEdit}
                placeholder="GDG-001"
                className="w-full border border-slate-300 rounded-pill px-3 py-1.5 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary disabled:bg-slate-100 disabled:text-slate-500"
                required
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-20 text-slate-600 shrink-0">Nama</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(smartTitleCase(e.target.value))}
                disabled={readonly}
                placeholder="Gudang Utama"
                className="w-full border border-slate-300 rounded-pill px-3 py-1.5 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary disabled:bg-slate-100 disabled:text-slate-500"
                required
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-20 text-slate-600 shrink-0">Status</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    value={1}
                    checked={isActive === 1}
                    onChange={() => setIsActive(1)}
                    disabled={readonly}
                    className="text-teal-primary focus:ring-teal-bg"
                  />
                  <span className="text-xs">Aktif</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    value={0}
                    checked={isActive === 0}
                    onChange={() => setIsActive(0)}
                    disabled={readonly}
                    className="text-teal-primary focus:ring-teal-bg"
                  />
                  <span className="text-xs">Nonaktif</span>
                </label>
              </div>
            </label>
          </div>
        </form>

        <div className="flex justify-end gap-2">
          {readonly ? (
            <>
              <Button variant="outline" onClick={() => router.push(basePath + '?' + returnQuery)}>Kembali</Button>
              {currentId && <Button onClick={() => router.push(`${basePath}/${currentId}/edit?return=${encodeURIComponent(returnQuery)}`)}>Edit</Button>}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => router.push(basePath + '?' + returnQuery)}>Batal</Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Menyimpan...' : isEdit ? 'Simpan' : 'Tambah'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
