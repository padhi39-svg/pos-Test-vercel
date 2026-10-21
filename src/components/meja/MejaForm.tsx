"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import SearchableSelect from '@/components/ui/SearchableSelect'
import Checkbox from '@/components/ui/Checkbox'
import Button from '@/components/ui/Button'
import FormHeader from '@/components/ui/FormHeader'

type MejaFormProps = {
  title: string
  basePath: string
  initial?: {
    id?: number
    code?: string
    name?: string
    floor_id?: number | null
    zone?: string
    is_smoking?: number
    is_mergeable?: number
    capacity?: number
    is_active?: number
    notes?: string | null
  }
  currentId?: number
  readonly?: boolean
}

export default function MejaForm({ title, basePath, initial, currentId, readonly }: MejaFormProps) {
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''
  const [floors, setFloors] = useState<any[]>([])
  const [code, setCode] = useState(initial?.code || '')
  const [floorId, setFloorId] = useState<number | null>(initial?.floor_id ?? null)
  const [zone, setZone] = useState<string>(initial?.zone || 'Indoor')
  const [isSmoking, setIsSmoking] = useState<boolean>(Boolean(initial?.is_smoking))
  const [isMergeable, setIsMergeable] = useState<boolean>(initial?.is_mergeable !== 0)
  const [capacity, setCapacity] = useState<number>(initial?.capacity || 2)
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active !== 0)
  const [notes, setNotes] = useState<string>(initial?.notes || '')
  const [saving, setSaving] = useState(false)
  const isEdit = !!currentId

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/floors')
      const data = res.ok ? await res.json() : []
      setFloors(Array.isArray(data) ? data : (data?.rows || []))
    }
    load()
  }, [])

  const onSubmit = async () => {
    if (saving) return
    if (!code.trim()) { alert('Kode meja wajib diisi'); return }
    if (!floorId && !readonly) { alert('Lantai wajib dipilih'); return }
    if (!capacity || capacity < 1) { alert('Jumlah kursi minimal 1'); return }
    setSaving(true)
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const body: any = {
        code: code.toUpperCase(),
        name: code.trim(),
        floor_id: floorId,
        zone,
        is_smoking: isSmoking ? 1 : 0,
        is_mergeable: isMergeable ? 1 : 0,
        capacity: Number(capacity),
        notes: notes || null,
        is_active: isActive ? 1 : 0,
      }
      if (isEdit) body.id = currentId

      const res = await fetch('/api/meja', {
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

  const zoneOptions = ['Indoor', 'Outdoor'].map(z => ({ value: z, label: z }))
  const capacityOptions = [2, 4, 6, 8, 10].map(n => ({ value: n, label: `${n} Kursi` }))

  return (
    <div className="space-y-4">
      <FormHeader
        title={title}
        subtitle={readonly ? 'Informasi meja' : isEdit ? 'Ubah data meja' : 'Isi data meja'}
        backHref={basePath + '?' + returnQuery}
      />

      {readonly ? (
        <>
          <div className="flex gap-2">
            {currentId && <Button onClick={() => router.push(`${basePath}/${currentId}/edit?return=${encodeURIComponent(returnQuery)}`)}>Edit</Button>}
          </div>
          <div className="container-card p-3 text-xs space-y-2">
            <div className="grid grid-cols-1 gap-2">
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Kode Meja</span>
                <input value={initial?.code || ''} disabled className="w-full border border-slate-300 rounded-pill px-3 py-1.5 bg-slate-100 text-slate-500" />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Nama</span>
                <input value={initial?.name || ''} disabled className="w-full border border-slate-300 rounded-pill px-3 py-1.5 bg-slate-100 text-slate-500" />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Lantai</span>
                <input value={floors.find(f => f.id === initial?.floor_id)?.name || '-'} disabled className="w-full border border-slate-300 rounded-pill px-3 py-1.5 bg-slate-100 text-slate-500" />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Zona</span>
                <input value={initial?.zone || '-'} disabled className="w-full border border-slate-300 rounded-pill px-3 py-1.5 bg-slate-100 text-slate-500" />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Smoking</span>
                <span className={`inline-block px-2 py-1 text-xs rounded ${initial?.is_smoking ? 'bg-coral-bg text-coral-dark' : 'bg-teal-bg text-teal-dark'}`}>
                  {initial?.is_smoking ? 'Ya' : 'Tidak'}
                </span>
              </label>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Bisa digabung</span>
                <span className={`inline-block px-2 py-1 text-xs rounded ${initial?.is_mergeable !== 0 ? 'bg-teal-bg text-teal-dark' : 'bg-coral-bg text-coral-dark'}`}>
                  {initial?.is_mergeable !== 0 ? 'Ya' : 'Tidak'}
                </span>
              </label>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Kursi</span>
                <input value={initial?.capacity ?? '-'} disabled className="w-full border border-slate-300 rounded-pill px-3 py-1.5 bg-slate-100 text-slate-500" />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Aktif</span>
                <span className={`inline-block px-2 py-1 text-xs rounded ${initial?.is_active !== 0 ? 'bg-teal-bg text-teal-dark' : 'bg-coral-bg text-coral-dark'}`}>
                  {initial?.is_active !== 0 ? 'Aktif' : 'Nonaktif'}
                </span>
              </label>
              <label className="flex items-start gap-3">
                <span className="w-28 text-slate-600 shrink-0 mt-1.5">Keterangan</span>
                <textarea value={initial?.notes || '-'} disabled className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-100 text-slate-500 min-h-[56px] resize-none" />
              </label>
            </div>
          </div>
        </>
      ) : (
        <div className="container-card p-3 text-xs space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Kode Meja</span>
              <Input value={code} onChange={e => setCode(e.target.value)} />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Lantai</span>
              <SearchableSelect
                options={floors.map((f: any) => ({ value: f.id, label: `${f.code} - ${f.name}` }))}
                value={floorId}
                onChange={(v) => setFloorId(v)}
                placeholder="Pilih Lantai"
                allowClear={false}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Zona</span>
              <SearchableSelect
                options={zoneOptions}
                value={zone}
                onChange={(v) => setZone(v as string)}
                allowClear={false}
                showSearch={false}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Kursi</span>
              <SearchableSelect
                options={capacityOptions}
                value={capacity}
                onChange={(v) => setCapacity(v as number)}
                allowClear={false}
                showSearch={false}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Smoking</span>
              <Checkbox checked={isSmoking} onChange={e => setIsSmoking(e.target.checked)} />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Bisa digabung</span>
              <Checkbox checked={isMergeable} onChange={e => setIsMergeable(e.target.checked)} />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Aktif</span>
              <Checkbox checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            </label>
            <label className="flex items-start gap-3">
              <span className="w-28 text-slate-600 shrink-0 mt-1.5">Keterangan</span>
              <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary min-h-[56px] resize-none" value={notes} onChange={e => setNotes(e.target.value)} />
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
