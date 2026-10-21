"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import FormHeader from '@/components/ui/FormHeader'
import FormField from '@/components/ui/FormField'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import { showSuccess, showError } from '@/lib/notification'

type Option = { id: number; name: string }
type Warehouse = { id: number; code?: string; name?: string; nama?: string }
type BarangItem = { id: number; code: string; name: string }
type ScopeFilters = { kategoriId: string; merkId: string }
type DraftRow = { id: number; number: string; tdate: string; warehouse_id: number }

type BalanceRow = {
  ingredient_id: number
  ingredient_code: string
  ingredient_name: string
  warehouse_id?: number
  system_qty: number
  physical_qty?: number
  notes?: string
}

export type StockOpnameFormProps = {
  backHref?: string
}

export default function StockOpnameForm({ backHref = '/stock/opname' }: StockOpnameFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [tdate, setTdate] = useState<string>(new Date().toLocaleDateString('en-CA'))
  const [allowBackdate, setAllowBackdate] = useState(true)
  const [warehouseId, setWarehouseId] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [filters, setFilters] = useState<ScopeFilters>({ kategoriId: 'all', merkId: 'all' })

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [kategoriOpt, setKategoriOpt] = useState<Option[]>([])
  const [merkOpt, setMerkOpt] = useState<Option[]>([])
  const [barang, setBarang] = useState<BarangItem[]>([])

  const [rows, setRows] = useState<BalanceRow[]>([])
  const [query, setQuery] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [barcode, setBarcode] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [targetRow, setTargetRow] = useState<number | null>(null)
  const [draftSOId, setDraftSOId] = useState<string>('')
  const [number, setNumber] = useState<string>('')
  const [draftOpen, setDraftOpen] = useState(false)
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [draftQuery, setDraftQuery] = useState('')

  const warehouseName = (w: Warehouse) => w.name || w.nama || w.code || ''

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setAllowBackdate(d.backdate_permissions?.['stock_opname'] ?? d.allow_backdate === true)
    }).catch(() => setAllowBackdate(false))
  }, [])

  useEffect(() => {
    if (!allowBackdate) {
      const today = new Date().toISOString().slice(0, 10)
      if (tdate !== today) setTdate(today)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowBackdate])

  async function loadDrafts(q: string) {
    try {
      const res = await fetch('/api/stock-opname')
      const dj = res.ok ? await res.json() : { rows: [] }
      const all = Array.isArray(dj?.rows) ? dj.rows : []
      const approved = all.filter((r: any) => String(r.status).toLowerCase() === 'approved')
      const ql = q.trim().toLowerCase()
      const list = ql ? approved.filter((r: any) => (`${r.number || ''} ${r.notes || ''}`).toLowerCase().includes(ql)) : approved
      setDrafts(list.map((r: any) => ({ id: Number(r.id), number: String(r.number), tdate: String(r.tdate), warehouse_id: Number(r.warehouse_id) })))
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (draftOpen) loadDrafts(draftQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftOpen])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [gw, gk, gm, gb] = await Promise.all([
          fetch('/api/gudang'),
          fetch('/api/kategori'),
          fetch('/api/merk'),
          fetch('/api/barang').catch(() => null),
        ])
        const [dw, dk, dm, db] = await Promise.all([
          gw.ok ? gw.json() : [],
          gk.ok ? gk.json() : [],
          gm.ok ? gm.json() : [],
          gb && gb.ok ? gb.json() : [],
        ])
        if (!alive) return
        setWarehouses(Array.isArray(dw) ? dw.map((x: any) => ({ id: x.id, name: x.name || x.nama || x.code })) : [])
        setKategoriOpt(Array.isArray(dk) ? dk.map((x: any) => ({ id: x.id, name: x.name })) : [])
        setMerkOpt(Array.isArray(dm) ? dm.map((x: any) => ({ id: x.id, name: x.name })) : [])
        setBarang(Array.isArray(db?.rows) ? db.rows.map((x: any) => ({ id: x.id, code: x.code, name: x.name })) : (Array.isArray(db) ? db.map((x: any) => ({ id: x.id, code: x.code, name: x.name })) : []))
      } catch (e) { console.error(e) }
    })()
    return () => { alive = false }
  }, [])

  const submitBarcode = () => {
    const code = barcode.trim().toLowerCase()
    if (!code) return
    const found = barang.find(b => b.code?.toLowerCase() === code)
    if (found) {
      const exists = rows.some(r => r.ingredient_id === found.id)
      if (exists) { showError('Item sudah ada di daftar'); setBarcode(''); return }
      setRows(prev => [...prev, {
        ingredient_id: found.id,
        ingredient_code: found.code,
        ingredient_name: found.name,
        warehouse_id: warehouseId ? Number(warehouseId) : undefined,
        system_qty: 0,
        physical_qty: 0,
      }])
      setBarcode('')
    } else {
      alert('Barang tidak ditemukan untuk barcode/kode tersebut')
    }
  }

  const filteredBarang = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    if (!q) return barang
    return barang.filter(b => `${b.code} ${b.name}`.toLowerCase().includes(q))
  }, [barang, searchQ])

  const addBlankRow = () => {
    setRows(prev => [...prev, {
      ingredient_id: 0,
      ingredient_code: '',
      ingredient_name: '',
      system_qty: 0,
      physical_qty: 0,
    }])
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      const hit = `${r.ingredient_code} ${r.ingredient_name}`.toLowerCase()
      return !q || hit.includes(q)
    })
  }, [rows, query])

  async function generateItems() {
    try {
      if (!warehouseId) { showError('Pilih gudang terlebih dahulu'); return }
      setLoading(true)
      const params = new URLSearchParams()
      params.set('warehouse_id', warehouseId)
      if (filters.kategoriId && filters.kategoriId !== 'all') params.set('kategori_id', String(filters.kategoriId))
      if (filters.merkId && filters.merkId !== 'all') params.set('merk_id', String(filters.merkId))
      params.set('includeZero', '1')
      const res = await fetch(`/api/stock-balance?${params.toString()}`)
      if (!res.ok) { showError('Gagal memuat saldo stok'); return }
      const data = await res.json()
      const list: BalanceRow[] = Array.isArray(data) ? data.map((x: any) => ({
        ingredient_id: x.ingredient_id || x.barang_id || x.id,
        ingredient_code: x.ingredient_code || x.code,
        ingredient_name: x.ingredient_name || x.name,
        warehouse_id: Number(warehouseId),
        system_qty: Number((x.current_stock ?? x.quantity) || 0),
        physical_qty: 0,
      })) : []
      setRows(list)
      showSuccess(`Daftar item berhasil digenerate (${list.length} item)`)
    } catch (e: any) {
      showError(e?.message || 'Gagal generate item')
    } finally {
      setLoading(false)
    }
  }

  async function saveDraft() {
    try {
      if (!warehouseId) { showError('Gudang wajib dipilih'); return }
      if (!tdate) { showError('Tanggal wajib diisi'); return }
      if (!rows.length) { showError('Belum ada item'); return }
      setSaving(true)
      showSuccess('UI siap. Fungsi simpan SO akan dibahas selanjutnya.')
    } catch (e: any) {
      showError(e?.message || 'Gagal tindakan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <FormHeader title="Stok Opname - Buat SO" subtitle="Buat dokumen stok opname (SO) dari draft approved" backHref={backHref} basePath={backHref} />

      {/* Header fields */}
      <div className="container-card p-3 text-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Kode Nota">
            <Input value={number || ''} placeholder="Auto Generate" readOnly disabled className="text-xs bg-slate-50 text-slate-600" />
          </FormField>

          <FormField label="Tanggal" required>
            <Input type="date" value={tdate} onChange={(e) => setTdate(e.target.value)} disabled={!allowBackdate} className="text-xs" />
          </FormField>

          <FormField label="Gudang" required>
            <Select required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="" disabled>-- Pilih Gudang --</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{warehouseName(w) || String(w.id)}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Filter Kategori">
            <Select value={filters.kategoriId} onChange={(e) => setFilters(s => ({ ...s, kategoriId: e.target.value }))}>
              <option value="all">Semua</option>
              {kategoriOpt.map(k => (<option key={k.id} value={k.id}>{k.name}</option>))}
            </Select>
          </FormField>

          <FormField label="Filter Merk">
            <Select value={filters.merkId} onChange={(e) => setFilters(s => ({ ...s, merkId: e.target.value }))}>
              <option value="all">Semua</option>
              {merkOpt.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </Select>
          </FormField>

          <FormField label="Draft Stok Opname">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDraftOpen(true)}
                className="text-xs px-3 py-1.5 whitespace-nowrap"
                aria-haspopup="dialog"
                aria-expanded={draftOpen}
              >
                {draftSOId ? `Draft #${draftSOId}` : 'Pilih Draft...'}
              </Button>
            </div>
          </FormField>
        </div>

        <FormField label="Keterangan">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Catatan (opsional)" />
        </FormField>

        <div className="flex items-center gap-2">
          <Button type="button" disabled={loading || !warehouseId} onClick={generateItems} className="text-xs px-3 py-1.5 whitespace-nowrap">
            {loading ? 'Memuat...' : 'Muat Stok'}
          </Button>
          <span className="text-[11px] text-slate-500">Ambil data stok dari gudang terpilih</span>
        </div>
      </div>

      {/* Items table */}
      <div className="container-card p-3 text-xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-sm font-medium">Detail Transaksi ({rows.length})</div>
            <div className="text-xs text-slate-500">Masukkan stok fisik hasil opname</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter tampilan..." className="text-xs w-40" />
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan/ketik barcode..." className="text-xs w-40" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitBarcode() } }} />
            <Button type="button" onClick={() => { setTargetRow(null); setShowModal(true) }} className="text-xs px-3 py-1.5 whitespace-nowrap">Cari Barang</Button>
            <Button type="button" variant="outline" onClick={addBlankRow} className="text-xs px-3 py-1.5 whitespace-nowrap">+ Tambah Baris</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <colgroup>
              <col />
              <col />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '100px' }} />
              <col />
              <col style={{ width: '80px' }} />
            </colgroup>
            <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">Kode</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">Nama</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">Stok Komputer</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">Stok Fisik</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">Selisih</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">Catatan</th>
                <th className="px-2 py-1.5 text-center text-xs font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-3 text-center text-slate-500 text-xs">Belum ada item</td>
                </tr>
              )}
              {filteredRows.map((r, idx) => {
                const isNew = !r.ingredient_id
                const sys = Number(r.system_qty || 0)
                const phy = Number(r.physical_qty || 0)
                const diff = phy - sys
                return (
                  <tr key={idx} className="border-t border-teal-bg hover:bg-teal-bg/50">
                    <td className="px-2 py-1.5 text-xs">
                      {isNew ? (
                        <select
                          value={r.ingredient_id}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            const found = barang.find(b => b.id === v)
                            if (found) {
                              setRows(prev => prev.map((x, i) => i === idx ? {
                                ...x,
                                ingredient_id: found.id,
                                ingredient_code: found.code,
                                ingredient_name: found.name,
                              } : x))
                            }
                          }}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                        >
                          <option value={0}>Pilih barang...</option>
                          {barang.map(b => (
                            <option key={b.id} value={b.id}>{b.code ? `${b.code} - ${b.name}` : b.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="flex-1 min-w-0 truncate">{r.ingredient_code}</span>
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
                    <td className="px-2 py-1.5 text-xs">{r.ingredient_name || '-'}</td>
                    <td className="px-2 py-1.5 text-xs text-right tabular-nums">{sys.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-xs text-right">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="w-28 px-2 py-1.5 border border-slate-300 rounded text-xs text-right"
                        value={String(phy)}
                        onChange={(e) => {
                          const val = Number(e.target.value || 0)
                          setRows(prev => prev.map((x, i) => i === idx ? ({ ...x, physical_qty: val }) : x))
                        }}
                      />
                    </td>
                    <td className={`px-2 py-1.5 text-xs text-right tabular-nums ${diff === 0 ? 'text-slate-700' : diff > 0 ? 'text-teal-primary' : 'text-rose-700'}`}>{diff.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-xs">
                      <input type="text" placeholder="Catatan" className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs" value={r.notes || ''} onChange={(e) => setRows(prev => prev.map((x, i) => i === idx ? ({ ...x, notes: e.target.value }) : x))} />
                    </td>
                    <td className="px-2 py-1.5 text-xs text-center">
                      <button onClick={() => setRows(prev => prev.filter((_, i) => i !== idx))} className="px-2 py-1 text-xs rounded bg-coral-bg text-coral-dark hover:bg-coral-primary hover:text-white transition-colors">Hapus</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer: actions */}
      <div className="container-card p-3 text-xs space-y-3">
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push(backHref)}>Batal</Button>
          <Button disabled={saving || !rows.length || !warehouseId} onClick={saveDraft}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </div>

      {/* Modal Cari Barang */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col">
            <div className="p-3 border-b border-teal-bg flex items-center justify-between shrink-0">
              <div className="font-medium text-sm">Cari Barang</div>
              <button onClick={() => { setShowModal(false); setSearchQ('') }} className="text-sm text-slate-500 hover:text-slate-700">Tutup</button>
            </div>
            <div className="p-3 border-b border-teal-bg shrink-0">
              <input
                autoFocus
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Ketik nama/kode barang..."
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
                    <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-500">{searchQ ? 'Barang tidak ditemukan' : 'Ketik untuk mencari barang'}</td></tr>
                  ) : (
                    filteredBarang.map(b => (
                      <tr key={b.id} className="hover:bg-teal-bg/50">
                        <td className="px-2 py-1.5 font-mono text-slate-600">{b.code || '-'}</td>
                        <td className="px-2 py-1.5 font-medium text-slate-800">{b.name}</td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => {
                              const exists = rows.some(r => r.ingredient_id === b.id)
                              if (exists) { showError('Item sudah ada di daftar'); return }
                              if (targetRow !== null && targetRow >= 0 && targetRow < rows.length) {
                                setRows(prev => prev.map((r, i) => i === targetRow ? { ...r, ingredient_id: b.id, ingredient_code: b.code, ingredient_name: b.name } : r))
                              } else {
                                setRows(prev => [...prev, { ingredient_id: b.id, ingredient_code: b.code, ingredient_name: b.name, system_qty: 0, physical_qty: 0 }])
                              }
                              setShowModal(false); setTargetRow(null); setSearchQ('')
                            }}
                            className="px-3 py-1 bg-teal-primary hover:bg-teal-dark text-white rounded-pill text-xs transition-colors">Pilih</button>
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

      {/* Modal Draft Picker */}
      {draftOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-modal shadow-2xl w-full max-w-xl">
            <div className="p-3 border-b border-teal-bg flex items-center justify-between">
              <div className="font-semibold text-slate-800 text-sm">Pilih Draft Approved</div>
              <button className="text-slate-600 hover:text-slate-900" onClick={() => setDraftOpen(false)}>Tutup</button>
            </div>
            <div className="p-3 border-b border-teal-bg flex items-center gap-2">
              <input value={draftQuery} onChange={(e) => setDraftQuery(e.target.value)} placeholder="Cari no/notes..." className="flex-1 rounded-pill border border-slate-300 px-3 py-2 text-sm outline-none" />
              <Button type="button" variant="outline" onClick={() => loadDrafts(draftQuery)} className="text-xs px-3 py-1.5 whitespace-nowrap">Cari</Button>
            </div>
            <div className="max-h-64 overflow-auto p-3">
              <table className="min-w-full text-xs">
                <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
                  <tr>
                    <th className="px-2 py-1.5 text-left">No</th>
                    <th className="px-2 py-1.5 text-left">Tanggal</th>
                    <th className="px-2 py-1.5 text-left">Gudang</th>
                    <th className="px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {drafts.length === 0 && (<tr><td colSpan={4} className="px-2 py-3 text-center text-slate-500">Belum ada hasil</td></tr>)}
                  {drafts.map(d => (
                    <tr key={d.id} className="hover:bg-teal-bg/50">
                      <td className="px-2 py-1">{d.number}</td>
                      <td className="px-2 py-1">{d.tdate}</td>
                      <td className="px-2 py-1">#{d.warehouse_id}</td>
                      <td className="px-2 py-1 text-right">
                        <button className="px-3 py-1 bg-teal-primary hover:bg-teal-dark text-white rounded-pill text-xs" onClick={() => { setDraftSOId(String(d.id)); setDraftOpen(false) }}>Pilih</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}