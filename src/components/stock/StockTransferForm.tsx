"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import FormHeader from '@/components/ui/FormHeader'
import FormField from '@/components/ui/FormField'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import { showSuccess, showError } from '@/lib/notification'
import { printTransferSlipById } from '@/lib/printStockSlip'

type Warehouse = { id: number; code?: string; name?: string; nama?: string }
type Barang = { id: number; code: string; name: string }
type Unit = { id: number; unit_name: string; unit_ratio: number }

type TransferItem = {
  key: string
  barang_id: number
  barang_code: string
  barang_name: string
  qty: number
  unit_id?: number
  unit_name: string
  unit_ratio: number
}

export type StockTransferFormMode = 'new' | 'edit' | 'view'

export type StockTransferFormInitialItem = {
  id?: number
  barang_id: number
  barang_code?: string
  barang_name?: string
  qty: number
  unit_id?: number
  unit_name?: string
  unit_ratio?: number
}

export type StockTransferFormInitial = {
  id?: number
  number?: string
  tdate?: string
  from_warehouse_id?: number | null
  to_warehouse_id?: number | null
  from_warehouse?: string | null
  to_warehouse?: string | null
  notes?: string
  void?: number
  items?: StockTransferFormInitialItem[]
}

export type StockTransferFormProps = {
  mode: StockTransferFormMode
  initial?: StockTransferFormInitial
  transferId?: number
  backHref?: string
}

export default function StockTransferForm({
  mode,
  initial,
  transferId,
  backHref = '/stock/transfer',
}: StockTransferFormProps) {
  const router = useRouter()
  const isView = mode === 'view'
  const isEdit = mode === 'edit'
  const isVoided = !!initial && Number(initial.void || 0) === 1
  const readOnly = isView || isVoided

  const [tdate, setTdate] = useState<string>(initial?.tdate ? String(initial.tdate).slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [allowBackdate, setAllowBackdate] = useState(true)
  const [codeNumber, setCodeNumber] = useState<string>(initial?.number || '')
  const [fromId, setFromId] = useState<string>(initial?.from_warehouse_id ? String(initial.from_warehouse_id) : '')
  const [toId, setToId] = useState<string>(initial?.to_warehouse_id ? String(initial.to_warehouse_id) : '')
  const [notes, setNotes] = useState<string>(initial?.notes || '')

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [barang, setBarang] = useState<Barang[]>([])
  const [loading, setLoading] = useState(!isView)
  const [saving, setSaving] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [targetRow, setTargetRow] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [barcode, setBarcode] = useState('')
  const [unitsMap, setUnitsMap] = useState<Record<number, Unit[]>>({})
  const [printPrompt, setPrintPrompt] = useState<{ id: number | null; number: string }>({ id: null, number: '' })

  const nextKey = useRef(0)

  const warehouseName = (w: Warehouse) => w.name || w.nama || ''

  const [items, setItems] = useState<TransferItem[]>(() => {
    if (initial?.items && initial.items.length > 0) {
      return initial.items.map((it, i) => ({
        key: `init_${i}`,
        barang_id: Number(it.barang_id) || 0,
        barang_code: it.barang_code || '',
        barang_name: it.barang_name || '',
        qty: Number(it.qty) || 0,
        unit_id: it.unit_id ? Number(it.unit_id) : undefined,
        unit_name: it.unit_name || '',
        unit_ratio: Number(it.unit_ratio || 1) || 1,
      }))
    }
    return []
  })

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setAllowBackdate(d.backdate_permissions?.['stock_transfer'] ?? d.allow_backdate === true)
    }).catch(() => setAllowBackdate(false))
  }, [])

  useEffect(() => {
    if (!allowBackdate && !isView) {
      const today = new Date().toISOString().slice(0, 10)
      if (tdate !== today) setTdate(today)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowBackdate])

  useEffect(() => {
    const load = async () => {
      try {
        const [gw, gb] = await Promise.all([
          fetch('/api/gudang').catch(() => null),
          fetch('/api/barang').catch(() => null),
        ])
        if (gw && gw.ok) {
          const data = await gw.json()
          setWarehouses(Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []))
        }
        if (gb && gb.ok) {
          const data = await gb.json()
          setBarang(Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []))
        }
      } catch {} finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const ensureUnits = useCallback(async (barangId: number): Promise<Unit[]> => {
    if (!barangId) return []
    if (unitsMap[barangId]) return unitsMap[barangId]
    try {
      const res = await fetch(`/api/barang-units?barang_id=${barangId}`)
      const data = await res.json()
      const rows = (data.rows || []) as Unit[]
      setUnitsMap(prev => ({ ...prev, [barangId]: rows }))
      return rows
    } catch { return [] }
  }, [unitsMap])

  useEffect(() => {
    (async () => {
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (!it.barang_id) continue
        const rows = await ensureUnits(it.barang_id)
        if (it.unit_id === undefined && rows.length > 0) {
          const def = rows.find((r: Unit) => Number(r.unit_ratio || 1) === 1) || rows[0]
          setItem(i, { unit_id: def?.id, unit_name: def?.unit_name, unit_ratio: Number(def?.unit_ratio || 1) || 1 })
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, barang])

  const canSave = useMemo(() => {
    if (!tdate || !fromId || !toId) return false
    if (fromId === toId) return false
    if (items.length === 0) return false
    return items.every(it => Number(it.barang_id) > 0 && Number(it.qty) > 0 && Number(it.unit_id || 0) > 0)
  }, [tdate, fromId, toId, items])

  const addItem = () => {
    nextKey.current += 1
    setItems(prev => [...prev, { key: `new_${nextKey.current}`, barang_id: 0, barang_code: '', barang_name: '', qty: 1, unit_name: '', unit_ratio: 1 }])
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const setItem = (idx: number, patch: Partial<TransferItem>) =>
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const filteredBarang = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return barang
    return barang.filter(b => `${b.code} ${b.name}`.toLowerCase().includes(q))
  }, [barang, search])

  const addByBarangId = (barangId: number) => {
    setItems(prev => {
      if (targetRow !== null && targetRow >= 0 && targetRow < prev.length) {
        const next = [...prev]
        next[targetRow] = { ...next[targetRow], barang_id: barangId, barang_code: '', barang_name: '', unit_id: undefined, unit_name: '', unit_ratio: 1 }
        return next
      }
      const idx = prev.findIndex(p => p.barang_id === barangId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: Number(next[idx].qty || 0) + 1 }
        return next
      }
      nextKey.current += 1
      return [...prev, { key: `new_${nextKey.current}`, barang_id: barangId, barang_code: '', barang_name: '', qty: 1, unit_id: undefined, unit_name: '', unit_ratio: 1 }]
    })
  }

  const submitBarcode = async () => {
    const code = barcode.trim().toLowerCase()
    if (!code) return
    const found = barang.find(b => b.code?.toLowerCase() === code)
    if (found) {
      const rows = await ensureUnits(found.id)
      const def = rows.find((r: Unit) => Number(r.unit_ratio || 1) === 1) || rows[0]
      setItems(prev => {
        const idx = prev.findIndex(p => p.barang_id === found.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], qty: Number(next[idx].qty || 0) + 1, unit_id: next[idx].unit_id ?? def?.id, unit_name: next[idx].unit_name || def?.unit_name || '', unit_ratio: next[idx].unit_ratio || Number(def?.unit_ratio || 1) || 1 }
          return next
        }
        nextKey.current += 1
        return [...prev, { key: `new_${nextKey.current}`, barang_id: found.id, barang_code: found.code, barang_name: found.name, qty: 1, unit_id: def?.id, unit_name: def?.unit_name || '', unit_ratio: Number(def?.unit_ratio || 1) || 1 }]
      })
      setBarcode('')
      setShowModal(false)
      setTargetRow(null)
    } else {
      alert('Barang tidak ditemukan untuk barcode/kode tersebut')
    }
  }

  const pickBarang = async (b: Barang) => {
    const rows = await ensureUnits(b.id)
    const def = rows.find((r: Unit) => Number(r.unit_ratio || 1) === 1) || rows[0]
    setItems(prev => {
      if (targetRow !== null && targetRow >= 0 && targetRow < prev.length) {
        const next = [...prev]
        next[targetRow] = { ...next[targetRow], barang_id: b.id, barang_code: b.code, barang_name: b.name, unit_id: def?.id, unit_name: def?.unit_name || '', unit_ratio: Number(def?.unit_ratio || 1) || 1 }
        return next
      }
      const idx = prev.findIndex(p => p.barang_id === b.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: Number(next[idx].qty || 0) + 1, unit_id: next[idx].unit_id ?? def?.id, unit_name: next[idx].unit_name || def?.unit_name || '', unit_ratio: next[idx].unit_ratio || Number(def?.unit_ratio || 1) || 1 }
        return next
      }
      nextKey.current += 1
      return [...prev, { key: `new_${nextKey.current}`, barang_id: b.id, barang_code: b.code, barang_name: b.name, qty: 1, unit_id: def?.id, unit_name: def?.unit_name || '', unit_ratio: Number(def?.unit_ratio || 1) || 1 }]
    })
    setShowModal(false)
    setTargetRow(null)
    setSearch('')
  }

  const handleSubmit = async () => {
    if (readOnly || saving) return
    if (!canSave) return alert('Data belum lengkap')
    try {
      setSaving(true)
      const payload = {
        tdate,
        from_warehouse_id: Number(fromId),
        to_warehouse_id: Number(toId),
        notes,
        items: items.map(it => ({ barang_id: Number(it.barang_id), qty: Number(it.qty), unit_id: it.unit_id ? Number(it.unit_id) : undefined })),
      }
      const url = isEdit && transferId ? `/api/stock-transfers/${transferId}` : '/api/stock-transfers'
      const method = isEdit && transferId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showError(data?.error || 'Gagal menyimpan transfer')
        return
      }
      const id = Number(data?.id || (isEdit ? transferId : 0)) || null
      const number = String(data?.number || initial?.number || '')
      showSuccess(isEdit ? 'Transfer berhasil diubah' : `Transfer berhasil disimpan: ${number || ''}`)
      setPrintPrompt({ id, number })
    } catch (e: any) {
      showError('Gagal menyimpan transfer')
    } finally {
      setSaving(false)
    }
  }

  const title = isView ? 'Detail Transfer Stok' : isEdit ? 'Edit Transfer Stok' : 'Transfer Stok - Baru'
  const subtitle = isView ? 'Informasi transfer stok antar gudang' : isEdit ? 'Ubah data transfer stok' : 'Pindah stok antar gudang'

  return (
    <div className="space-y-4">
      <FormHeader title={title} subtitle={subtitle} backHref={backHref} basePath={backHref} />

      {readOnly && isVoided && (
        <div className="inline-flex items-center px-2 py-0.5 text-[11px] rounded bg-rose-100 text-rose-700 border border-rose-200">VOID</div>
      )}

      {/* Header fields */}
      <div className="container-card p-3 text-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FormField label="Kode Nota">
            <Input value={codeNumber} placeholder="Auto Generate" readOnly disabled className="text-xs" />
          </FormField>

          <FormField label="Tanggal" required>
            <Input
              type="date"
              value={tdate}
              onChange={(e) => setTdate(e.target.value)}
              disabled={readOnly || !allowBackdate}
              className="text-xs"
            />
          </FormField>

          <FormField label="Gudang Asal" required>
            {readOnly ? (
              <Input value={initial?.from_warehouse || warehouseName(warehouses.find(w => String(w.id) === fromId) as Warehouse) || String(fromId)} disabled className="text-xs" />
            ) : (
              <Select
                required
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                disabled={readOnly}
              >
                <option value="" disabled>Pilih gudang...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id} disabled={String(w.id) === toId}>{warehouseName(w) || String(w.id)}</option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField label="Gudang Tujuan" required>
            {readOnly ? (
              <Input value={initial?.to_warehouse || warehouseName(warehouses.find(w => String(w.id) === toId) as Warehouse) || String(toId)} disabled className="text-xs" />
            ) : (
              <Select
                required
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                disabled={readOnly}
              >
                <option value="" disabled>Pilih gudang...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id} disabled={String(w.id) === fromId}>{warehouseName(w) || String(w.id)}</option>
                ))}
              </Select>
            )}
          </FormField>
        </div>

        {!readOnly && fromId && toId && fromId === toId && (
          <div className="text-[11px] text-rose-600">Gudang asal dan tujuan tidak boleh sama.</div>
        )}
      </div>

      {/* Items */}
      <div className="container-card p-3 text-xs space-y-3">
        <div className="flex items-center flex-nowrap gap-3">
          <div className="whitespace-nowrap shrink-0">
            <div className="text-sm font-medium">Detail Transaksi</div>
            <div className="text-xs text-slate-500">Barang yang dipindahkan antar gudang</div>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="min-w-[120px] flex-1">
                <Input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitBarcode() } }}
                  placeholder="Scan / ketik barcode..."
                  className="text-xs"
                />
              </div>
              <Button type="button" onClick={() => { setTargetRow(null); setShowModal(true) }} className="text-xs px-3 py-1.5 whitespace-nowrap shrink-0">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                Cari Barang
              </Button>
              <Button type="button" variant="outline" onClick={addItem} className="text-xs px-3 py-1.5 whitespace-nowrap shrink-0">+ Tambah Baris</Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <colgroup>
              <col />
              <col style={{ width: '96px' }} />
              <col style={{ width: '140px' }} />
              {!readOnly && <col style={{ width: '72px' }} />}
            </colgroup>
            <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">Barang</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">Qty</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">Satuan</th>
                {!readOnly && <th className="px-2 py-1.5 text-center text-xs font-semibold">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 && (
                <tr>
                  <td colSpan={readOnly ? 3 : 4} className="px-2 py-3 text-center text-slate-500 text-xs">
                    {readOnly ? 'Belum ada item' : 'Belum ada item. Klik "Cari Barang" atau "Tambah Baris" untuk mulai.'}
                  </td>
                </tr>
              )}
              {items.map((it, idx) => {
                const barangRow = it.barang_id ? barang.find(b => b.id === it.barang_id) : null
                return (
                  <tr key={it.key} className="border-t border-teal-bg hover:bg-teal-bg/50">
                    <td className="px-2 py-1.5 text-xs">
                      {readOnly ? (
                        <span className="text-slate-800">{it.barang_code ? `${it.barang_code} - ${it.barang_name}` : (it.barang_name || '-')}</span>
                      ) : it.barang_id ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="text"
                            value={it.barang_code ? `${it.barang_code} - ${it.barang_name}` : (barangRow ? `${barangRow.code} - ${barangRow.name}` : it.barang_name)}
                            readOnly
                            onClick={() => { setTargetRow(idx); setShowModal(true) }}
                            className="text-xs cursor-pointer bg-slate-50 font-medium"
                            title="Klik untuk ganti barang"
                          />
                          <button
                            type="button"
                            onClick={() => { setTargetRow(idx); setShowModal(true) }}
                            className="px-2 py-1 text-xs text-teal-primary hover:bg-teal-bg rounded flex items-center justify-center border border-teal-bg shrink-0"
                            title="Cari barang"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Scan / Ketik kode barang..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const code = e.currentTarget.value.trim().toLowerCase()
                                const found = barang.find(b => b.code?.toLowerCase() === code)
                                if (found) { setTargetRow(idx); pickBarang(found) }
                                else alert('Barang tidak ditemukan untuk kode tersebut')
                                e.currentTarget.value = ''
                              }
                            }}
                            className="flex-1 px-2 py-1.5 border border-dashed border-slate-300 rounded text-xs text-slate-600 focus:border-teal-primary focus:outline-none focus:ring-2 focus:ring-[#E8F6F5]"
                          />
                          <button
                            type="button"
                            onClick={() => { setTargetRow(idx); setShowModal(true) }}
                            className="px-2 py-1 text-xs text-teal-primary hover:bg-teal-bg rounded flex items-center justify-center border border-teal-bg shrink-0"
                            title="Cari barang"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-right">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={it.qty}
                        disabled={readOnly}
                        onChange={(e) => setItem(idx, { qty: Number(e.target.value) })}
                        className="w-24 px-2 py-1.5 border border-slate-300 rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {readOnly ? (
                        <span>{it.unit_name || '-'}</span>
                      ) : (
                        <Select
                          value={it.unit_id || 0}
                          onChange={(e) => {
                            const unitId = Number(e.target.value) || undefined
                            const unit = (unitsMap[it.barang_id] || []).find(u => u.id === unitId)
                            setItem(idx, { unit_id: unitId, unit_name: unit?.unit_name || '', unit_ratio: Number(unit?.unit_ratio || 1) || 1 })
                          }}
                          disabled={!it.barang_id}
                          className="w-32 px-2 py-1.5 text-xs"
                        >
                          <option value={0} disabled>-</option>
                          {(unitsMap[it.barang_id] || []).map(u => (
                            <option key={u.id} value={u.id}>{u.unit_name}</option>
                          ))}
                        </Select>
                      )}
                    </td>
                    {!readOnly && (
                      <td className="px-2 py-1.5 text-xs text-center">
                        <button onClick={() => removeItem(idx)} className="px-2 py-1 text-xs rounded bg-coral-bg text-coral-dark hover:bg-coral-primary hover:text-white transition-colors">Hapus</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <div className="text-xs text-slate-500 italic">Scan barcode, ketik kode barang pada baris kosong, atau klik &ldquo;Cari Barang&rdquo; untuk menambah item.</div>
        )}
      </div>

      {/* Footer: Keterangan + Actions */}
      <div className="container-card p-3 text-xs space-y-3">
        <FormField label="Keterangan">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} readOnly={readOnly} rows={3} placeholder="Catatan tambahan..." />
        </FormField>

        {!readOnly && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push(backHref)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={saving || !canSave}>
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan'}
            </Button>
          </div>
        )}
      </div>

      {/* Modal Cari Barang */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col">
            <div className="p-3 border-b border-teal-bg flex items-center justify-between shrink-0">
              <div className="font-medium text-sm">Cari Barang</div>
              <button onClick={() => { setShowModal(false); setSearch('') }} className="text-sm text-slate-500 hover:text-slate-700">Tutup</button>
            </div>
            <div className="p-3 border-b border-teal-bg shrink-0">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ketik nama/kode barang atau scan barcode..."
                className="w-full rounded-pill border border-slate-300 px-3 py-2 text-sm outline-none transition-colors hover:border-slate-400 focus:ring-2 focus:ring-[#E8F6F5] focus:border-[#2BA8A2]"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <table className="w-full text-xs">
                <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold">Kode</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold">Nama</th>
                    <th className="px-2 py-1.5 text-center text-xs font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredBarang.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-500">{search ? 'Barang tidak ditemukan' : 'Ketik untuk mencari barang'}</td></tr>
                  ) : (
                    filteredBarang.map(b => (
                      <tr key={b.id} className="hover:bg-teal-bg/50">
                        <td className="px-2 py-1.5 font-mono text-slate-600">{b.code || '-'}</td>
                        <td className="px-2 py-1.5 font-medium text-slate-800">{b.name}</td>
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => pickBarang(b)} className="px-3 py-1 bg-teal-primary hover:bg-teal-dark text-white rounded-pill text-xs transition-colors">Pilih</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal konfirmasi cetak setelah simpan */}
      {(printPrompt.id || printPrompt.number) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl w-full max-w-sm mx-4 p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              {isEdit ? 'Transfer Stok Diperbarui' : 'Transfer Stok Tersimpan'}
            </h2>
            <p className="text-sm text-slate-700 mb-4">
              Transfer stok dengan kode nota{' '}
              <span className="font-mono font-semibold">{printPrompt.number || '-'}</span>{' '}
              berhasil {isEdit ? 'diubah' : 'disimpan'}.
              <br />
              Apakah ingin {isEdit ? 'mencetak ulang slip' : 'mencetak slip'} sekarang?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPrintPrompt({ id: null, number: '' }); router.push(backHref) }}>Tidak</Button>
              <Button onClick={async () => {
                const id = printPrompt.id
                setPrintPrompt({ id: null, number: '' })
                if (id) await printTransferSlipById(id)
                router.push(backHref)
              }}>Ya, Cetak</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
