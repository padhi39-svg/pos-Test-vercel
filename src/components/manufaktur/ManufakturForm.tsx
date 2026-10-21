"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import FormHeader from '@/components/ui/FormHeader'
import FormField from '@/components/ui/FormField'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import { formatCurrency } from '@/lib/regionalNumber'
import { showError } from '@/lib/notification'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { getTodayDate } from '@/lib/date-utils'

type Barang = { id: number; code: string; name: string; hpp?: number }
type Warehouse = { id: number; code?: string; name: string }
type Account = { id: number; code?: string; name: string }

type DetailItem = { barang_id: number; barang_code: string; barang_name: string; quantity: number; hpp_satuan: number; total_hpp: number }
type BiayaItem = { account_id: number; account_code: string; account_name: string; notes: string; debit: number; credit: number }

export type FormData = {
  barang_id: number
  quantity: number
  tanggal: string
  notes: string
  warehouse_id: number
  details: { barang_id: number; quantity: number; hpp_satuan: number }[]
  biaya: { account_id: number; notes: string; debit: number; credit: number }[]
}

export type ManufakturFormMode = 'new' | 'edit' | 'view'

export type ManufakturFormInitial = {
  id?: number
  nomor?: string
  barang_id: number
  barang_code?: string
  barang_name?: string
  quantity: number
  tanggal: string
  notes: string
  warehouse_id: number
  warehouse_name?: string
  status?: string
  details: DetailItem[]
  biaya: BiayaItem[]
  hpp_sebelum?: number
  hpp_sesudah?: number
  total_biaya_bahan?: number
  total_biaya_lain?: number
  total_biaya?: number
  created_at?: string
  updated_at?: string
  user_create?: string
  user_edit?: string
  user_approve?: string
  approved_at?: string
}

type Props = {
  mode: ManufakturFormMode
  initialData?: ManufakturFormInitial
  onSubmit?: (data: FormData) => Promise<void>
  loading?: boolean
  backHref?: string
}

export default function ManufakturForm({ mode, initialData, onSubmit, loading, backHref = '/persediaan/manufaktur' }: Props) {
  const router = useRouter()
  const isView = mode === 'view'
  const isEdit = mode === 'edit'
  const readOnly = isView

  const [barangList, setBarangList] = useState<Barang[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [accountList, setAccountList] = useState<Account[]>([])
  const [detailBarangList, setDetailBarangList] = useState<Barang[]>([])

  const [barangId, setBarangId] = useState<number>(initialData?.barang_id || 0)
  const [quantity, setQuantity] = useState<number>(initialData?.quantity || 1)
  const getTodayLocal = () => getTodayDate()
  const [tanggal, setTanggal] = useState<string>(initialData?.tanggal || getTodayLocal())
  const [notes, setNotes] = useState<string>(initialData?.notes || '')
  const [warehouseId, setWarehouseId] = useState<number>(initialData?.warehouse_id || 0)
  const [details, setDetails] = useState<DetailItem[]>(initialData?.details || [])
  const [biayaList, setBiayaList] = useState<BiayaItem[]>(initialData?.biaya || [])

  const [allowBackdate, setAllowBackdate] = useState<boolean | null>(null)
  const [periodHppMap, setPeriodHppMap] = useState<Record<number, number>>({})

  const statusBadge = (status?: string) => {
    const s = String(status || '')
    const map: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      void: 'bg-red-100 text-red-700',
    }
    const labelMap: Record<string, string> = {
      draft: 'Draft',
      approved: 'Approved',
      void: 'Void',
    }
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[s] || 'bg-slate-100 text-slate-600'}`}>
        {labelMap[s] || s || '-'}
      </span>
    )
  }

  useEffect(() => {
    const load = async () => {
      try {
        const authRes = await fetch('/api/auth/me', { cache: 'no-store' })
        const auth = await authRes.json().catch(() => ({}))
        setAllowBackdate(auth.backdate_permissions?.['manufaktur'] ?? auth.allow_backdate === true)
      } catch {}
      const todayObj = new Date()
      const [gb, gw, ga, gdb, gPeriod] = await Promise.all([
        fetch('/api/barang?jenis=1,3').catch(() => null),
        fetch('/api/gudang').catch(() => null),
        fetch('/api/keuangan/setting-perkiraan').catch(() => null),
        fetch('/api/barang?jenis=2,3&aktif=1').catch(() => null),
        fetch('/api/periode?active=1').catch(() => null),
      ])
      if (gb && gb.ok) {
        const d = await gb.json()
        setBarangList(Array.isArray(d?.rows) ? d.rows : (Array.isArray(d) ? d : []))
      }
      if (gw && gw.ok) {
        const d = await gw.json()
        setWarehouses(Array.isArray(d?.rows) ? d.rows : (Array.isArray(d) ? d : []))
      }
      if (ga && ga.ok) {
        const d = await ga.json()
        setAccountList(Array.isArray(d?.accounts) ? d.accounts : (Array.isArray(d) ? d : []))
      }
      if (gdb && gdb.ok) {
        const d = await gdb.json()
        setDetailBarangList(Array.isArray(d?.rows) ? d.rows : (Array.isArray(d) ? d : []))
      }
      if (gPeriod && gPeriod.ok) {
        const periods = await gPeriod.json()
        const active = Array.isArray(periods) ? periods.find((p: any) => p.is_active) : null
        if (active) {
          try {
            const hppRes = await fetch(`/api/barang-hpp?year=${active.startDate?.slice(0, 4) || todayObj.getFullYear()}&month=${active.startDate?.slice(5, 7) || (todayObj.getMonth() + 1)}`).catch(() => null)
            if (hppRes && hppRes.ok) {
              const hppData = await hppRes.json()
              if (Array.isArray(hppData)) {
                const map: Record<number, number> = {}
                for (const h of hppData) {
                  if (h.barang_id) map[h.barang_id] = Number(h.hpp || h.avg_cost || 0)
                }
                setPeriodHppMap(map)
              }
            }
          } catch {}
        }
      }
    }
    load()
  }, [])

  const totalBiayaBahan = useMemo(() => {
    return details.reduce((sum, d) => sum + d.total_hpp, 0)
  }, [details])

  const totalBiayaLain = useMemo(() => {
    return biayaList.reduce((sum, b) => sum + (b.debit || 0) - (b.credit || 0), 0)
  }, [biayaList])

  const grandTotal = totalBiayaBahan + totalBiayaLain

  const addDetail = useCallback(() => {
    setDetails(prev => [...prev, { barang_id: 0, barang_code: '', barang_name: '', quantity: 1, hpp_satuan: 0, total_hpp: 0 }])
  }, [])

  const removeDetail = useCallback((idx: number) => {
    setDetails(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const updateDetail = useCallback((idx: number, patch: Partial<DetailItem>) => {
    setDetails(prev => prev.map((d, i) => {
      if (i !== idx) return d
      const next = { ...d, ...patch }
      next.total_hpp = next.hpp_satuan * next.quantity
      return next
    }))
  }, [])

  const selectDetailBarang = useCallback((idx: number, b: Barang) => {
    const hpp = periodHppMap[b.id] || b.hpp || 0
    updateDetail(idx, {
      barang_id: b.id,
      barang_code: b.code || '',
      barang_name: b.name || '',
      hpp_satuan: hpp,
    })
  }, [updateDetail, periodHppMap])

  const addBiaya = useCallback(() => {
    setBiayaList(prev => [...prev, { account_id: 0, account_code: '', account_name: '', notes: '', debit: 0, credit: 0 }])
  }, [])

  const removeBiaya = useCallback((idx: number) => {
    setBiayaList(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const updateBiaya = useCallback((idx: number, patch: Partial<BiayaItem>) => {
    setBiayaList(prev => prev.map((b, i) => {
      if (i !== idx) return b
      const next = { ...b, ...patch }
      if ('debit' in patch && patch.debit !== undefined && patch.debit > 0) next.credit = 0
      if ('credit' in patch && patch.credit !== undefined && patch.credit > 0) next.debit = 0
      return next
    }))
  }, [])

  const selectAccount = useCallback((idx: number, a: Account) => {
    updateBiaya(idx, { account_id: a.id, account_code: a.code || '', account_name: a.name || '' })
  }, [updateBiaya])

  const canSave = useMemo(() => {
    if (!barangId || !quantity || !tanggal || !warehouseId) return false
    if (details.length === 0) return false
    if (!allowBackdate && tanggal < getTodayLocal()) return false
    return true
  }, [barangId, quantity, tanggal, warehouseId, allowBackdate, details.length])

  const handleSubmit = async () => {
    if (!canSave) {
      showError('Data belum lengkap')
      return
    }
    await onSubmit?.({
      barang_id: barangId,
      quantity,
      tanggal,
      notes,
      warehouse_id: warehouseId,
      details: details.map(d => ({ barang_id: d.barang_id, quantity: d.quantity, hpp_satuan: d.hpp_satuan })),
      biaya: biayaList.map(b => ({ account_id: b.account_id, notes: b.notes, debit: b.debit, credit: b.credit })),
    })
  }

  const title = isView ? 'Detail Manufaktur' : isEdit ? 'Edit Manufaktur' : 'Buat Manufaktur'
  const subtitle = isView ? 'Informasi produksi barang jadi (read-only)' : isEdit ? 'Ubah data produksi barang jadi' : 'Buat produksi barang jadi baru'
  const barangJadiName = initialData?.barang_code ? `${initialData.barang_code} - ${initialData.barang_name}` : (initialData?.barang_name || '-')
  const warehouseName = initialData?.warehouse_name || (warehouses.find(w => w.id === Number(warehouseId))?.name || '')

  return (
    <div className="space-y-4">
      <FormHeader title={title} subtitle={subtitle} backHref={backHref} basePath={backHref} />

      {/* Header Card */}
      <div className="container-card p-3 text-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FormField label="Kode Nota">
            <Input value={initialData?.nomor || ''} placeholder="Auto Generate" readOnly disabled className="text-xs bg-slate-50 text-slate-600" />
          </FormField>

          <FormField label="Tanggal" required>
            <Input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              max={!allowBackdate ? getTodayLocal() : undefined}
              disabled={readOnly || !allowBackdate}
              className="text-xs"
            />
          </FormField>

          <FormField label="Barang Jadi" required>
            {readOnly ? (
              <Input value={barangJadiName} disabled className="text-xs" />
            ) : (
              <Select required value={barangId} onChange={(e) => setBarangId(Number(e.target.value))}>
                <option value={0}>Pilih Barang...</option>
                {barangList.map(b => (
                  <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField label="Gudang" required>
            {readOnly ? (
              <Input value={warehouseName || String(warehouseId)} disabled className="text-xs" />
            ) : (
              <Select required value={warehouseId} onChange={(e) => setWarehouseId(Number(e.target.value))}>
                <option value={0}>Pilih Gudang...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            )}
          </FormField>
        </div>

        <FormField label="Quantity Produksi" required>
          <Input
            type="number"
            min={1}
            step={0.01}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 1)}
            disabled={readOnly}
            className="text-xs"
          />
        </FormField>

        {!allowBackdate && !readOnly && tanggal < getTodayLocal() && (
          <p className="text-[10px] text-red-500">Tidak diizinkan input tanggal mundur</p>
        )}
      </div>

      {/* Details Section */}
      <div className="container-card p-3 text-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Detail Bahan Baku</div>
            <div className="text-xs text-slate-500">Barang bahan baku / setengah jadi</div>
          </div>
          {!readOnly && (
            <Button type="button" onClick={addDetail} className="text-xs px-3 py-1.5 whitespace-nowrap">+ Tambah Baris</Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <colgroup>
              <col />
              <col style={{ width: '80px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              {!readOnly && <col style={{ width: '60px' }} />}
            </colgroup>
            <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">Barang (Bahan Baku / Setengah Jadi)</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">Qty</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">HPP Satuan</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">Total HPP</th>
                {!readOnly && <th className="px-2 py-1.5 text-center text-xs font-semibold">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {details.length === 0 && (
                <tr><td colSpan={readOnly ? 4 : 5} className="px-2 py-3 text-center text-slate-400">Belum ada item bahan baku</td></tr>
              )}
              {details.map((d, idx) => (
                <tr key={idx} className="border-t border-teal-bg hover:bg-teal-bg/50">
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      <span className="text-slate-800">{d.barang_code ? `${d.barang_code} - ${d.barang_name}` : (d.barang_name || '-')}</span>
                    ) : (
                      <SearchableSelect
                        options={detailBarangList.map(b => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
                        value={d.barang_id}
                        onChange={val => {
                          const b = detailBarangList.find(x => x.id === Number(val))
                          if (b) selectDetailBarang(idx, b)
                        }}
                        placeholder="Pilih Barang..."
                        className="text-xs"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      <span className="block text-right">{d.quantity}</span>
                    ) : (
                      <input type="number" min={0.01} step={0.01} value={d.quantity} onChange={e => updateDetail(idx, { quantity: Number(e.target.value) })} className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right" />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="text" value={formatCurrency(d.hpp_satuan)} readOnly className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-right bg-slate-50 text-slate-600" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="text" value={formatCurrency(d.total_hpp)} readOnly className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-right bg-slate-50 text-slate-600" />
                  </td>
                  {!readOnly && (
                    <td className="px-2 py-1.5 text-center">
                      <button type="button" onClick={() => removeDetail(idx)} className="px-2 py-1 text-xs rounded bg-coral-bg text-coral-dark hover:bg-coral-primary hover:text-white transition-colors">Hapus</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-teal-bg/40 font-semibold">
                <td colSpan={readOnly ? 3 : 4} className="px-2 py-1.5 text-xs text-right">Total Biaya Bahan:</td>
                <td className="px-2 py-1.5 text-xs text-right">{formatCurrency(totalBiayaBahan)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Biaya Lain Section */}
      <div className="container-card p-3 text-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Biaya Lain</div>
            <div className="text-xs text-slate-500">Biaya tambahan selain bahan baku</div>
          </div>
          {!readOnly && (
            <Button type="button" onClick={addBiaya} className="text-xs px-3 py-1.5 whitespace-nowrap">+ Tambah Baris</Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <colgroup>
              <col />
              <col style={{ width: '160px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              {!readOnly && <col style={{ width: '60px' }} />}
            </colgroup>
            <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">Akun</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">Keterangan</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">Debit</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">Kredit</th>
                {!readOnly && <th className="px-2 py-1.5 text-center text-xs font-semibold">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {biayaList.length === 0 && (
                <tr><td colSpan={readOnly ? 4 : 5} className="px-2 py-3 text-center text-slate-400">Belum ada biaya lain</td></tr>
              )}
              {biayaList.map((b, idx) => (
                <tr key={idx} className="border-t border-teal-bg hover:bg-teal-bg/50">
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      <span className="text-slate-800">{b.account_code ? `${b.account_code} - ${b.account_name}` : (b.account_name || '-')}</span>
                    ) : (
                      <SearchableSelect
                        options={accountList.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
                        value={b.account_id}
                        onChange={val => {
                          const a = accountList.find(x => x.id === Number(val))
                          if (a) selectAccount(idx, a)
                        }}
                        placeholder="Pilih Akun..."
                        className="text-xs"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      <span>{b.notes || '-'}</span>
                    ) : (
                      <input type="text" value={b.notes} onChange={e => updateBiaya(idx, { notes: e.target.value })} className="w-full px-2 py-1 border border-slate-300 rounded text-xs" placeholder="Catatan..." />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      <span className="block text-right">{b.debit ? formatCurrency(b.debit) : '-'}</span>
                    ) : (
                      <input type="number" min={0} step={100} value={b.debit} onChange={e => updateBiaya(idx, { debit: Number(e.target.value) })} className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right" />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      <span className="block text-right">{b.credit ? formatCurrency(b.credit) : '-'}</span>
                    ) : (
                      <input type="number" min={0} step={100} value={b.credit} onChange={e => updateBiaya(idx, { credit: Number(e.target.value) })} className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right" />
                    )}
                  </td>
                  {!readOnly && (
                    <td className="px-2 py-1.5 text-center">
                      <button type="button" onClick={() => removeBiaya(idx)} className="px-2 py-1 text-xs rounded bg-coral-bg text-coral-dark hover:bg-coral-primary hover:text-white transition-colors">Hapus</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-teal-bg/40 font-semibold">
                <td colSpan={readOnly ? 3 : 4} className="px-2 py-1.5 text-xs text-right">Total Biaya Lain:</td>
                <td className="px-2 py-1.5 text-xs text-right">{formatCurrency(totalBiayaLain)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="container-card p-3 text-xs space-y-2">
        <div className="text-sm font-medium">Ringkasan Biaya</div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Total Biaya Bahan</span>
          <span className="font-semibold">{formatCurrency(isView ? (initialData?.total_biaya_bahan ?? totalBiayaBahan) : totalBiayaBahan)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Total Biaya Lain</span>
          <span className="font-semibold">{formatCurrency(isView ? (initialData?.total_biaya_lain ?? totalBiayaLain) : totalBiayaLain)}</span>
        </div>
        <div className="border-t pt-2 flex items-center justify-between text-sm font-bold">
          <span>Grand Total</span>
          <span className="text-teal-primary">{formatCurrency(isView ? (initialData?.total_biaya ?? grandTotal) : grandTotal)}</span>
        </div>
        {isView && (
          <div className="border-t pt-2 grid grid-cols-2 gap-4 text-xs text-slate-600">
            <div>
              <span className="block">HPP Sebelum</span>
              <span className="font-semibold text-slate-800">{initialData?.hpp_sebelum != null ? formatCurrency(initialData.hpp_sebelum) : '-'}</span>
            </div>
            <div>
              <span className="block">HPP Sesudah</span>
              <span className="font-semibold text-slate-800">{initialData?.hpp_sesudah != null ? formatCurrency(initialData.hpp_sesudah) : '-'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Notes + Actions */}
      <div className="container-card p-3 text-xs space-y-3">
        <FormField label="Catatan">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} readOnly={readOnly} rows={3} placeholder="Catatan tambahan..." />
        </FormField>

        {!readOnly && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push(backHref)}>Batal</Button>
            <Button disabled={!canSave || loading} onClick={handleSubmit}>
              {loading ? 'Menyimpan...' : (isEdit ? 'Simpan Perubahan' : 'Simpan')}
            </Button>
          </div>
        )}
      </div>

      {/* Audit Info (view) */}
      {isView && (initialData?.user_create || initialData?.user_edit || initialData?.user_approve) && (
        <div className="container-card p-3 text-xs space-y-2">
          <div className="text-sm font-medium">Informasi Audit</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
            <div>
              <span className="block">Dibuat Oleh</span>
              <span className="font-medium text-slate-800">{initialData?.user_create || '-'}</span>
            </div>
            <div>
              <span className="block">Dibuat Pada</span>
              <span className="font-medium text-slate-800">{initialData?.created_at ? String(initialData.created_at).slice(0, 16) : '-'}</span>
            </div>
            <div>
              <span className="block">Diedit Oleh</span>
              <span className="font-medium text-slate-800">{initialData?.user_edit || '-'}</span>
            </div>
            <div>
              <span className="block">Diedit Pada</span>
              <span className="font-medium text-slate-800">{initialData?.updated_at ? String(initialData.updated_at).slice(0, 16) : '-'}</span>
            </div>
            {String(initialData?.status) === 'approved' && (
              <>
                <div>
                  <span className="block">Disetujui Oleh</span>
                  <span className="font-medium text-slate-800">{initialData?.user_approve || '-'}</span>
                </div>
                <div>
                  <span className="block">Disetujui Pada</span>
                  <span className="font-medium text-slate-800">{initialData?.approved_at ? String(initialData.approved_at).slice(0, 16) : '-'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}