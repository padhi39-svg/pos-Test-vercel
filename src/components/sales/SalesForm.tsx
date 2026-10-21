"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import FormHeader from '@/components/ui/FormHeader'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { showError } from '@/lib/notification'

export type SalesFormProps = {
  title: string
  basePath: string
  initial?: any
  onSubmit: (data: any) => Promise<void>
  currentId?: number
  readonly?: boolean
}

export default function SalesForm({ title, basePath, initial, onSubmit, currentId, readonly }: SalesFormProps) {
  const router = useRouter()
  const [code, setCode] = useState(initial?.code || '')
  const [name, setName] = useState(initial?.name || '')
  const [userId, setUserId] = useState<number | null>(initial?.user_id ?? null)
  const [phone, setPhone] = useState(initial?.phone || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [ktp, setKtp] = useState(initial?.ktp || '')
  const [aktif, setAktif] = useState(initial?.aktif !== 0)
  const [users, setUsers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const returnQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('return') || '' : ''

  const mode: 'create' | 'edit' | 'view' = useMemo(() => {
    if (readonly) return 'view'
    return currentId ? 'edit' : 'create'
  }, [readonly, currentId])

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users')
        if (res.ok) {
          const data = await res.json()
          const list = Array.isArray(data) ? data : []
          setUsers(list.filter((u: any) => (u.isdelete ?? 0) === 0 && (u.aktif ?? 1) === 1))
        }
      } catch (e) {
        console.error('Load users failed', e)
      }
    }
    loadUsers()
  }, [])

  useEffect(() => {
    if (initial) {
      setCode(initial.code || '')
      setName(initial.name || '')
      setUserId(initial.user_id ?? null)
      setPhone(initial.phone || '')
      setEmail(initial.email || '')
      setKtp(initial.ktp || '')
      setAktif(initial.aktif !== 0)
    }
  }, [initial])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || mode === 'view') return

    if (!name.trim()) {
      showError('Nama sales wajib diisi')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        name: name.trim(),
        user_id: userId ? Number(userId) : null,
        phone: phone.trim(),
        email: email.trim(),
        ktp: ktp.trim(),
        aktif: aktif ? 1 : 0,
      }
      await onSubmit(payload)
      router.push(basePath + '?' + returnQuery)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <FormHeader title={title} subtitle="Master Sales" basePath={basePath + '?' + returnQuery} />
      {mode === 'view' && (
        <div className="flex gap-2">
          <Button onClick={() => router.push(`${basePath}/${currentId}/edit?return=${encodeURIComponent(returnQuery)}`)}>Edit</Button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="container-card p-3 text-xs space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Kode</span>
              <Input
                value={code}
                onChange={() => {}}
                placeholder="Auto-generate saat simpan"
                disabled
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Nama *</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={mode === 'view'}
                required
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">User</span>
              <SearchableSelect
                options={users.map((u: any) => ({ value: u.id, label: `${u.code} - ${u.name}` }))}
                value={userId || null}
                onChange={(v) => setUserId(v !== null ? Number(v) : null)}
                placeholder="Pilih User..."
                disabled={mode === 'view'}
                allowClear
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">No. Telp</span>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={mode === 'view'}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Email</span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={mode === 'view'}
                placeholder="sales@example.com"
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">No. KTP</span>
              <Input
                value={ktp}
                onChange={(e) => setKtp(e.target.value)}
                disabled={mode === 'view'}
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Status</span>
              <Checkbox
                checked={aktif}
                onChange={(e) => setAktif(e.target.checked)}
                disabled={mode === 'view'}
              />
              <span className="text-xs text-slate-600">Aktif</span>
            </label>
          </div>
          {mode !== 'view' && (
            <div className="flex justify-end gap-2">
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
