"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Input from '@/components/ui/Input'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { showError, showSuccess } from '@/lib/notification'

type ItemRow = {
  barangId: number | null
  barangName: string
  discountType: string
  discountValue: number
}

export default function SeasonDiscountForm({
  title,
  basePath,
  initial,
  onSubmit,
  currentId,
  readonly,
}: {
  title: string
  basePath: string
  initial?: any
  onSubmit?: (data: any) => Promise<any> | void
  currentId?: number
  readonly?: boolean
}) {
  const [name, setName] = useState(initial?.name || '')
  const [jenisCustomerId, setJenisCustomerId] = useState<number | null>(initial?.jenis_customer_id || null)
  const [startDate, setStartDate] = useState(initial?.start_date || '')
  const [endDate, setEndDate] = useState(initial?.end_date || '')
  const [isActive, setIsActive] = useState(initial?.is_active !== 0)
  const [items, setItems] = useState<ItemRow[]>([])
  const [jenisOptions, setJenisOptions] = useState<{ value: string | number; label: string }[]>([])
  const [barangOptions, setBarangOptions] = useState<{ value: string | number; label: string }[]>([])
  const [saving, setSaving] = useState(false)

  const mode: 'create' | 'edit' | 'view' = useMemo(() => {
    if (readonly) return 'view'
    return currentId ? 'edit' : 'create'
  }, [readonly, currentId])

  useEffect(() => {
    fetch('/api/jenis-customer').then(r => r.json()).then(list => {
      if (Array.isArray(list)) {
        setJenisOptions(list.map((j: any) => ({ value: j.id, label: `${j.code} - ${j.name}` })))
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/barang').then(r => r.json()).then(list => {
      if (Array.isArray(list)) {
        setBarangOptions([
          { value: -1, label: 'ALL - Semua Barang' },
          ...list.filter((b: any) => (b.isdelete ?? 0) === 0).map((b: any) => ({
            value: b.id,
            label: `${b.code} - ${b.name}`,
          })),
        ])
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (initial) {
      setName(initial.name || '')
      setJenisCustomerId(initial.jenis_customer_id || null)
      setStartDate(initial.start_date || '')
      setEndDate(initial.end_date || '')
      setIsActive(initial.is_active !== 0)
      if (Array.isArray(initial.items)) {
        setItems(initial.items.map((it: any) => ({
          barangId: it.barang_id || null,
          barangName: it.barang_name || (it.barang_id ? '' : 'ALL - Semua Barang'),
          discountType: it.discount_type || 'disc1',
          discountValue: Number(it.discount_value) || 0,
        })))
      }
    }
  }, [initial])

  const addItem = () => {
    setItems([...items, { barangId: null, barangName: '', discountType: 'disc1', discountValue: 0 }])
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx: number, field: keyof ItemRow, value: any) => {
    const updated = items.map((it, i) => {
      if (i !== idx) return it
      if (field === 'barangId') {
        const opt = barangOptions.find(o => o.value === value)
        return { ...it, barangId: value === -1 ? null : (value as number), barangName: opt?.label || '' }
      }
      return { ...it, [field]: value }
    })
    setItems(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (readonly) return

    if (!name.trim()) return showError('Nama season wajib diisi')
    if (!jenisCustomerId) return showError('Jenis customer wajib dipilih')
    if (!startDate) return showError('Tanggal mulai wajib diisi')
    if (!endDate) return showError('Tanggal akhir wajib diisi')
    if (items.length === 0) return showError('Minimal 1 item barang')

    const payload = {
      name: name.trim(),
      jenis_customer_id: jenisCustomerId,
      start_date: startDate,
      end_date: endDate,
      is_active: isActive ? 1 : 0,
      items: items.map(it => ({
        barang_id: it.barangId,
        discount_type: it.discountType,
        discount_value: it.discountValue,
      })),
    }

    try {
      setSaving(true)
      const res = onSubmit ? await onSubmit(payload) : null
      if (!res || (res && res.ok !== false)) {
        showSuccess(currentId ? 'Season discount berhasil diperbarui' : 'Season discount berhasil ditambahkan')
        window.location.href = basePath
      }
    } catch (e: any) {
      showError(e?.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const discountTypeOptions = [
    { value: 'disc_percent', label: 'Disc %' },
    { value: 'disc1', label: 'Disc 1' },
    { value: 'disc2', label: 'Disc 2' },
    { value: 'disc3', label: 'Disc 3' },
    { value: 'disc_rp', label: 'Disc Rp (Nominal)' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-slate-500 text-xs mt-1">Master Season Discount</p>
        </div>
        <div className="flex gap-2">
          <Link href={basePath} className="px-3 py-1.5 rounded-pill bg-slate-100 hover:bg-slate-200">Kembali</Link>
          {mode === 'view' ? (
            <Link href={`${basePath}/${currentId}/edit`} className="px-3 py-1.5 rounded-pill bg-blue-600 hover:bg-blue-700 text-white">Edit</Link>
          ) : (
            <button form="season-form" type="submit" disabled={saving} className="px-3 py-1.5 rounded-pill bg-blue-600 hover:bg-blue-700 text-white">
              {mode === 'create' ? 'Tambah' : 'Simpan'}
            </button>
          )}
        </div>
      </div>

      <form id="season-form" onSubmit={handleSubmit} className="container-card p-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs text-slate-600 mb-1">Nama Season *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={mode === 'view'} required />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Jenis Customer *</label>
          <SearchableSelect
            options={jenisOptions}
            value={jenisCustomerId}
            onChange={(v) => setJenisCustomerId(v as number | null)}
            placeholder="Pilih jenis customer..."
            disabled={mode === 'view'}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Tanggal Mulai *</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={mode === 'view'} required />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Tanggal Akhir *</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={mode === 'view'} required />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={mode === 'view'} />
          <span className="text-sm">Aktif</span>
        </div>
      </form>

      <div className="container-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Daftar Barang</h2>
          {mode !== 'view' && (
            <button type="button" onClick={addItem} className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700">
              + Tambah Barang
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">Belum ada barang. Klik "Tambah Barang" untuk menambahkan.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-600 border-b">
                  <th className="px-2 py-1">Barang</th>
                  <th className="px-2 py-1">Tipe Diskon</th>
                  <th className="px-2 py-1">Nilai Diskon</th>
                  {mode !== 'view' && <th className="px-2 py-1 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className="border-b last:border-b-0">
                    <td className="px-2 py-1">
                      {mode === 'view' ? (
                        <span>{it.barangName || 'ALL - Semua Barang'}</span>
                      ) : (
                        <SearchableSelect
                          options={barangOptions}
                          value={it.barangId === null ? -1 : it.barangId}
                          onChange={(v) => updateItem(idx, 'barangId', v)}
                          placeholder="Pilih barang / ALL..."
                          allowClear={false}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {mode === 'view' ? (
                        <span>{discountTypeOptions.find(o => o.value === it.discountType)?.label || it.discountType}</span>
                      ) : (
                        <select
                          value={it.discountType}
                          onChange={(e) => updateItem(idx, 'discountType', e.target.value)}
                          className="w-full rounded-pill border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200"
                        >
                          {discountTypeOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {mode === 'view' ? (
                        <span>{it.discountValue}</span>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          max={it.discountType === 'disc_rp' ? undefined : 100}
                          step={it.discountType === 'disc_rp' ? 1 : 0.01}
                          value={it.discountValue}
                          onChange={(e) => updateItem(idx, 'discountValue', Number(e.target.value))}
                        />
                      )}
                    </td>
                    {mode !== 'view' && (
                      <td className="px-2 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-600 hover:text-red-800 px-2 py-1"
                        >
                          Hapus
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
