"use client"

import { useEffect, useState } from 'react'
import { showError, showSuccess } from '@/lib/notification'

export type UserFormProps = {
  title: string
  basePath: string
  initial?: any
  onSubmit?: (data: any) => Promise<any> | void
  currentId?: number
  readonly?: boolean
}

export default function UserForm({ title, basePath, initial, onSubmit, currentId, readonly }: UserFormProps) {
  const [code, setCode] = useState(initial?.code || '')
  const [name, setName] = useState(initial?.name || '')
  const [levelId, setLevelId] = useState<number | ''>(initial?.level_id || '')
  const [email, setEmail] = useState<string>(initial?.email || '')
  const [password, setPassword] = useState<string>('')
  const [aktif, setAktif] = useState<boolean>(initial?.aktif !== 0)
  const [levels, setLevels] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [allowedJenis, setAllowedJenis] = useState<number[]>(Array.isArray(initial?.allowedJenis) ? initial.allowedJenis : [1,2,3])

  useEffect(() => {
    const loadLevels = async () => {
      try {
        const res = await fetch('/api/level-manager')
        if (res.ok) {
          const data = await res.json()
          setLevels(Array.isArray(data) ? data.filter((x:any)=>!x.isdelete) : [])
        }
      } catch (e) {
        console.error('Load levels failed', e)
      }
    }
    loadLevels()
  }, [])

  useEffect(() => {
    if (initial) {
      setCode(initial.code || '')
      setName(initial.name || '')
      setLevelId(initial.level_id || '')
      setAktif(initial.aktif !== 0)
      setEmail(initial.email || '')
      setPassword('')
      setAllowedJenis(Array.isArray(initial.allowedJenis) ? initial.allowedJenis : [1,2,3])
    }
  }, [initial])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (readonly) return

    if (!name.trim()) return showError('Nama wajib diisi')
    if (!levelId) return showError('Level wajib dipilih')

    const payload: any = { name: name.trim(), level_id: Number(levelId), aktif }
    if (email?.trim()) payload.email = email.trim().toLowerCase()
    payload.allowedJenis = allowedJenis
    if (!currentId) {
      // create mode: password wajib
      payload.password = password
    } else if (password && !readonly) {
      // edit mode: hanya kirim jika diisi
      payload.password = password
    }

    try {
      setSaving(true)
      const res = onSubmit ? await onSubmit(payload) : null
      if (!res || (res && res.ok !== false)) {
        showSuccess(currentId ? 'User berhasil diperbarui' : 'User berhasil ditambahkan')
        window.location.href = basePath
      }
    } catch (e: any) {
      showError(e?.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-3">
      <div className="mb-2">
        <h1 className="text-lg font-bold text-slate-800">{title}</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Kode</label>
          <input
            type="text"
            value={code}
            disabled
            placeholder="Auto-generate saat simpan"
            className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">Jenis Barang yang Diizinkan</label>
          <div className="flex flex-wrap gap-4 text-xs">
            {[{id:1,label:'Barang Jadi'},{id:2,label:'Bahan Baku'},{id:3,label:'Barang Pembantu'}].map(opt => (
              <label key={opt.id} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled={!!readonly}
                  checked={allowedJenis.includes(opt.id)}
                  onChange={(e)=>{
                    if (e.target.checked) setAllowedJenis(prev => Array.from(new Set([...prev, opt.id])).sort())
                    else setAllowedJenis(prev => prev.filter(x => x !== opt.id))
                  }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Nama *</label>
          <input
            type="text"
            value={name}
            onChange={(e)=>setName(e.target.value)}
            disabled={!!readonly}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            disabled={!!readonly}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
            placeholder="user@example.com"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Level *</label>
          <select
            value={levelId}
            onChange={(e)=>setLevelId(e.target.value ? Number(e.target.value) : '')}
            disabled={!!readonly}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
            required
          >
            <option value="">Pilih Level...</option>
            {levels.map((lv:any)=>(
              <option key={lv.id} value={lv.id}>{lv.name}</option>
            ))}
          </select>
        </div>
        {!readonly && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
              placeholder={currentId ? 'Minimal 6 karakter (wajib isi saat simpan)' : 'Minimal 6 karakter'}
              required={!currentId}
              minLength={6}
            />
          </div>
        )}
        <div className="flex items-center gap-2 mt-6">
          <input type="checkbox" checked={aktif} onChange={(e)=>setAktif(e.target.checked)} disabled={!!readonly} />
          <span className="text-xs">Aktif</span>
        </div>

        <div className="md:col-span-2 flex justify-end gap-2 mt-2">
          {readonly ? (
            <>
              <a href={`${basePath}/${currentId}/edit`} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm">Edit</a>
              <a href={basePath} className="px-3 py-1.5 bg-slate-600 text-white rounded text-sm">Kembali</a>
            </>
          ) : (
            <>
              <a href={basePath} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-sm border">Batal</a>
              <button type="submit" disabled={saving} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm">
                {currentId ? 'Simpan' : 'Tambah'}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
