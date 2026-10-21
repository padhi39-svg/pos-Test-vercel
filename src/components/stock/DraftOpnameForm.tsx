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
import UserSelect from '@/components/UserSelect'
import BarangPickerModal from '@/components/BarangPickerModal'

type Option = { id: number; name: string }
type Warehouse = { id: number; code?: string; name?: string; nama?: string }
type BalanceRow = {
  ingredient_id: number
  ingredient_code: string
  ingredient_name: string
  warehouse_id?: number
  quantity: number
  count_qty?: number | null
  variance_qty?: number | null
}

export type DraftOpnameFormMode = 'new' | 'edit' | 'view'

export type DraftOpnameFormInitialItem = {
  id?: number
  barang_id: number
  barang_code?: string
  barang_name?: string
  system_qty?: number
  count_qty?: number | null
  variance_qty?: number | null
}

export type DraftOpnameFormInitial = {
  id?: number
  number?: string
  tdate?: string
  warehouse_id?: number | null
  warehouse?: string | null
  notes?: string
  status?: string
  assignees?: string | null
  void?: number
  items?: DraftOpnameFormInitialItem[]
}

export type DraftOpnameFormProps = {
  mode: DraftOpnameFormMode
  initial?: DraftOpnameFormInitial
  opnameId?: number
  backHref?: string
}

export default function DraftOpnameForm({
  mode,
  initial,
  opnameId,
  backHref = '/stock/draftopname',
}: DraftOpnameFormProps) {
  const router = useRouter()
  const isView = mode === 'view'
  const isEdit = mode === 'edit'
  const isVoided = !!initial && Number(initial.void || 0) === 1
  const readOnly = isView || isVoided

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [allowBackdate, setAllowBackdate] = useState(true)

  const [tdate, setTdate] = useState<string>(initial?.tdate ? String(initial.tdate).slice(0, 10) : new Date().toLocaleDateString('en-CA'))
  const [warehouseId, setWarehouseId] = useState<string>(initial?.warehouse_id ? String(initial.warehouse_id) : '')
  const [notes, setNotes] = useState<string>(initial?.notes || '')
  const [rows, setRows] = useState<BalanceRow[]>([])
  const [assignees, setAssignees] = useState<{ id: number; name: string }[]>([])

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [kategoriOpt, setKategoriOpt] = useState<Option[]>([])
  const [merkOpt, setMerkOpt] = useState<Option[]>([])
  const [filters, setFilters] = useState({ kategoriId: 'all', merkId: 'all' })
  const [rowQuery, setRowQuery] = useState('')
  const [pickOpen, setPickOpen] = useState(false)

  const [userId, setUserId] = useState<number | null>(null)
  const [userRole, setUserRole] = useState<string>('')

  const [approvedChecked, setApprovedChecked] = useState<boolean>(false)
  const docStatus = String(initial?.status || '')
  const wasApproved = docStatus.toLowerCase() === 'approved'
  const locked = isEdit && approvedChecked === true
  const editable = !readOnly && !locked

  const warehouseName = (w: Warehouse) => w.name || w.nama || w.code || ''

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setAllowBackdate(d.backdate_permissions?.['stock_draftopname'] ?? d.allow_backdate === true)
      if (d?.user?.id) setUserId(Number(d.user.id))
      if (d?.user?.role) setUserRole(String(d.user.role))
    }).catch(() => setAllowBackdate(false))
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [gw, gk, gm] = await Promise.all([
          fetch('/api/gudang'),
          fetch('/api/kategori'),
          fetch('/api/merk'),
        ])
        const [dw, dk, dm] = await Promise.all([
          gw.ok ? gw.json() : [],
          gk.ok ? gk.json() : [],
          gm.ok ? gm.json() : [],
        ])
        if (!alive) return
        setWarehouses(Array.isArray(dw) ? dw.map((x: any) => ({ id: x.id, name: x.name || x.nama || x.code })) : [])
        setKategoriOpt(Array.isArray(dk) ? dk.map((x: any) => ({ id: x.id, name: x.name })) : [])
        setMerkOpt(Array.isArray(dm) ? dm.map((x: any) => ({ id: x.id, name: x.name })) : [])
      } catch (e) { console.error(e) }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (initial?.items && initial.items.length > 0) {
      const list: BalanceRow[] = initial.items.map((x: any) => ({
        ingredient_id: Number(x.barang_id || 0),
        ingredient_code: String(x.barang_code || ''),
        ingredient_name: String(x.barang_name || ''),
        warehouse_id: initial.warehouse_id ? Number(initial.warehouse_id) : undefined,
        quantity: Number(x.system_qty || 0),
        count_qty: x.count_qty == null ? null : Number(x.count_qty),
        variance_qty: x.variance_qty == null ? null : Number(x.variance_qty),
      }))
      setRows(list)
    }
  }, [initial])

  useEffect(() => {
    if (initial?.assignees) {
      const ids = JSON.parse(String(initial.assignees))
      if (Array.isArray(ids) && ids.length) {
        fetch('/api/users?q=').then(r => r.json()).then(du => {
          const map = new Map<number, string>()
          if (Array.isArray(du)) du.forEach((u: any) => { if (u?.id) map.set(Number(u.id), u.name || u.fullName || u.code || '') })
          setAssignees(ids.map((n: any) => ({ id: Number(n), name: map.get(Number(n)) || `User #${n}` })))
        }).catch(() => {})
      }
    }
  }, [initial?.assignees])

  const hasCounts = useMemo(() => {
    if (docStatus === 'submitted' || docStatus === 'approved') return true
    return rows.some(r => r.count_qty != null)
  }, [rows, docStatus])

  const filteredRows = useMemo(() => {
    const q = rowQuery.trim().toLowerCase()
    return rows.filter(r => `${r.ingredient_code} ${r.ingredient_name}`.toLowerCase().includes(q))
  }, [rows, rowQuery])

  async function generateItems() {
    try {
      if (!warehouseId) { showError('Pilih gudang terlebih dahulu'); return }
      setLoading(true)
      const url = new URL(location.origin + '/api/stock-balance')
      url.searchParams.set('warehouse_id', warehouseId)
      if (filters.kategoriId && filters.kategoriId !== 'all') url.searchParams.set('kategori_id', String(filters.kategoriId))
      if (filters.merkId && filters.merkId !== 'all') url.searchParams.set('merk_id', String(filters.merkId))
      url.searchParams.set('includeZero', '1')
      const res = await fetch(url.toString())
      if (!res.ok) { showError('Gagal memuat saldo stok'); return }
      const data = await res.json()
      const incoming: BalanceRow[] = Array.isArray(data) ? data.map((x: any) => ({
        ingredient_id: Number(x.ingredient_id || x.barang_id || x.id),
        ingredient_code: String(x.ingredient_code || x.code || ''),
        ingredient_name: String(x.ingredient_name || x.name || ''),
        warehouse_id: Number(warehouseId),
        quantity: Number((x.current_stock ?? x.quantity) || 0),
        count_qty: null,
        variance_qty: null,
      })) : []
      if (isEdit) {
        const map = new Map<number, BalanceRow>()
        for (const r of rows) map.set(Number(r.ingredient_id), { ...r })
        for (const it of incoming) {
          const ex = map.get(Number(it.ingredient_id))
          if (ex) {
            map.set(Number(it.ingredient_id), {
              ...ex,
              ingredient_code: it.ingredient_code || ex.ingredient_code,
              ingredient_name: it.ingredient_name || ex.ingredient_name,
              warehouse_id: it.warehouse_id,
              quantity: it.quantity,
            })
          } else {
            map.set(Number(it.ingredient_id), { ...it, count_qty: null, variance_qty: null })
          }
        }
        setRows(Array.from(map.values()).sort((a, b) => String(a.ingredient_code).localeCompare(String(b.ingredient_code))))
      } else {
        setRows(incoming)
      }
      showSuccess('Daftar item berhasil digenerate')
    } catch (e: any) { showError(e?.message || 'Gagal generate item') }
    finally { setLoading(false) }
  }

  function canCount(): boolean {
    if (userRole === 'manager') return true
    try {
      const ids = assignees.map(a => a.id)
      if (!ids.length) return false
      if (userId == null) return false
      return ids.includes(Number(userId))
    } catch { return false }
  }

  async function saveDraft() {
    try {
      if (!warehouseId) { showError('Gudang wajib dipilih'); return }
      if (!tdate) { showError('Tanggal wajib diisi'); return }
      if (!rows.length) { showError('Belum ada item untuk disimpan'); return }
      let rowsToSave = [...rows]
      if (approvedChecked) {
        try {
          const resp = await fetch(`/api/stock-opname/${opnameId}/counts`)
          const dj = resp.ok ? await resp.json() : null
          const counted = new Set<number>()
          const arr = Array.isArray(dj?.rows) ? dj.rows : []
          for (const x of arr) counted.add(Number(x.barang_id))
          const notCounted = rows.filter(r => !counted.has(Number(r.ingredient_id)))
          const countedCount = rows.length - notCounted.length
          if (countedCount <= 0) { showError('Minimal 1 barang harus sudah dihitung (Hitung Mobile) untuk approve.'); return }
          if (notCounted.length > 0) {
            const ok = window.confirm(`Ada ${notCounted.length} item belum dihitung. Jika dilanjutkan, item tsb akan dihapus dari draft ini agar bisa digunakan pada Draft SO berikutnya.\n\nTetap simpan & approve?`)
            if (!ok) return
            rowsToSave = rows.filter(r => counted.has(Number(r.ingredient_id)))
          }
        } catch {
          if (!hasCounts) { showError('Belum ada hasil hitung. Lakukan hitung mobile terlebih dahulu sebelum approve.'); return }
        }
      }
      setSaving(true)
      const payload = {
        tdate,
        warehouse_id: Number(warehouseId),
        notes,
        items: rowsToSave.map(r => ({ barang_id: r.ingredient_id, system_qty: r.quantity })),
      }
      const url = isEdit && opnameId ? `/api/stock-opname/${opnameId}` : '/api/stock-opname'
      const method = isEdit && opnameId ? 'PUT' : 'POST'
      const r1 = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d1 = await r1.json().catch(() => ({}))
      if (!r1.ok) { showError(d1?.error || 'Gagal menyimpan draft'); return }
      const docId = Number(d1?.id || d1?.opname_id || d1?.created_id || opnameId || 0)
      const ids = assignees.map(a => a.id)
      await fetch(`/api/stock-opname/${docId}/assignees`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignees: ids }) })
      if (approvedChecked) {
        const ok = window.confirm('Anda yakin data sudah sesuai dan akan di APPROVE?')
        if (!ok) return
        const r2 = await fetch(`/api/stock-opname/${docId}/approve`, { method: 'POST' })
        const d2 = await r2.json().catch(() => ({}))
        if (!r2.ok) { showError(d2?.error || 'Gagal approve dokumen'); return }
      } else if (isEdit && wasApproved) {
        const ok2 = window.confirm('Batalkan status APPROVED dokumen ini?')
        if (!ok2) return
        const r3 = await fetch(`/api/stock-opname/${docId}/unapprove`, { method: 'POST' })
        const d3 = await r3.json().catch(() => ({}))
        if (!r3.ok) { showError(d3?.error || 'Gagal unapprove dokumen'); return }
      }
      showSuccess(approvedChecked ? 'Draft disimpan & di-approve' : (wasApproved ? 'Draft disimpan & status di-unapprove' : 'Draft disimpan'))
      router.push(backHref)
    } catch (e: any) { showError(e?.message || 'Gagal menyimpan draft') }
    finally { setSaving(false) }
  }

  const title = isView ? 'Detail Draft Stok Opname' : isEdit ? 'Edit Draft Stok Opname' : 'Buat Draft Stok Opname'
  const subtitle = 'Siapkan draft opname untuk pencatatan via mobile. Sistem Qty diambil dari saldo stok gudang yang dipilih.'

  return (
    <div className="space-y-4">
      <FormHeader title={title} subtitle={subtitle} backHref={backHref} basePath={backHref} />

      {isVoided && (
        <div className="inline-flex items-center px-2 py-0.5 text-[11px] rounded bg-rose-100 text-rose-700 border border-rose-200">VOID</div>
      )}

      {/* Header fields */}
      <div className="container-card p-3 text-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FormField label="No Dokumen">
            <Input value={initial?.number || ''} placeholder="Auto Generate" readOnly disabled className="text-xs" />
          </FormField>

          <FormField label="Tanggal" required>
            <Input
              type="date"
              value={tdate}
              onChange={(e) => setTdate(e.target.value)}
              disabled={!editable || !allowBackdate}
              className="text-xs"
            />
          </FormField>

          <FormField label="Gudang" required>
            {readOnly ? (
              <Input value={initial?.warehouse || warehouseName(warehouses.find(w => String(w.id) === warehouseId) as Warehouse) || String(warehouseId)} disabled className="text-xs" />
            ) : (
              <Select
                required
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                disabled={!editable}
              >
                <option value="" disabled>-- Pilih Gudang --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{warehouseName(w) || String(w.id)}</option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField label="Filter Kategori">
            <Select
              value={filters.kategoriId}
              onChange={(e) => setFilters(s => ({ ...s, kategoriId: e.target.value }))}
              disabled={!editable}
            >
              <option value="all">Semua</option>
              {kategoriOpt.map(k => (<option key={k.id} value={k.id}>{k.name}</option>))}
            </Select>
          </FormField>

          <FormField label="Filter Merk">
            <Select
              value={filters.merkId}
              onChange={(e) => setFilters(s => ({ ...s, merkId: e.target.value }))}
              disabled={!editable}
            >
              <option value="all">Semua</option>
              {merkOpt.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </Select>
          </FormField>
        </div>

        {/* Petugas & Keterangan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          <FormField label="Petugas (multi)">
            <div className="flex flex-wrap items-center gap-1.5 mb-1 border border-slate-300 rounded-lg px-2 py-1.5 min-h-[38px] bg-white">
              {assignees.length === 0 && (<span className="text-[11px] text-slate-500">Belum ada petugas</span>)}
              {assignees.map(a => (
                <span key={a.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-teal-bg text-teal-primary text-[12px] border border-teal-bg">
                  <span>{a.name}</span>
                  {editable && (
                    <button onClick={() => setAssignees(prev => prev.filter(x => x.id !== a.id))} className="text-teal-primary/70 hover:text-teal-dark" title="Hapus">×</button>
                  )}
                </span>
              ))}
            </div>
            {editable && (
              <UserSelect
                placeholder="Cari nama user..."
                onSelect={(u) => {
                  const exists = assignees.some(a => a.id === u.id)
                  if (exists) setAssignees(prev => prev.filter(a => a.id !== u.id))
                  else setAssignees(prev => [...prev, { id: u.id, name: u.name }])
                }}
              />
            )}
          </FormField>

          <FormField label="Keterangan">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} readOnly={!editable} rows={2} placeholder="Catatan (opsional)" />
          </FormField>
        </div>

        {/* Generate + Approve controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {editable && (
              <>
                <Button type="button" disabled={loading || !warehouseId} onClick={generateItems} className="text-xs px-3 py-1.5 whitespace-nowrap">
                  {loading ? 'Mengambil...' : 'Generate Item'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setRows([]); setRowQuery('') }} className="text-xs px-3 py-1.5 whitespace-nowrap">
                  Bersihkan
                </Button>
              </>
            )}
            {isEdit && (
              <Button type="button" disabled={!canCount()} onClick={() => { window.location.href = `/m/opname/by-id/${opnameId}` }} className="text-xs px-3 py-1.5 whitespace-nowrap">
                Hitung (Mobile)
              </Button>
            )}
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              {!hasCounts && (
                <span className="text-[11px] text-slate-500 hidden md:inline">Lakukan hitung mobile terlebih dahulu untuk mengaktifkan Approve</span>
              )}
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={approvedChecked}
                  onChange={(e) => {
                    const next = e.target.checked
                    if (next) {
                      if (!hasCounts) { showError('Belum ada hasil hitung. Lakukan hitung mobile terlebih dahulu sebelum approve.'); return }
                      setApprovedChecked(true)
                    } else {
                      setApprovedChecked(false)
                    }
                  }}
                />
                <span>Approved</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="container-card p-3 text-xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-sm font-medium">Detail Item ({rows.length})</div>
            <div className="text-xs text-slate-500">Hasil hitung stok fisik dibandingkan sistem</div>
          </div>
          <div className="flex items-center gap-2">
            <Input value={rowQuery} onChange={(e) => setRowQuery(e.target.value)} placeholder="Filter tampilan..." className="text-xs w-40" />
            {editable && (
              <Button type="button" variant="outline" onClick={() => setPickOpen(true)} className="text-xs px-3 py-1.5 whitespace-nowrap">+ Tambah Item</Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <colgroup>
              <col />
              <col />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              {editable && <col style={{ width: '120px' }} />}
              {editable && <col style={{ width: '72px' }} />}
            </colgroup>
            <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">Kode</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">Nama</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">System Qty</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">Count Qty</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">Selisih</th>
                {editable && <th className="px-2 py-1.5 text-left text-xs font-semibold">Catatan</th>}
                {editable && <th className="px-2 py-1.5 text-center text-xs font-semibold">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={editable ? 7 : 5} className="px-2 py-6 text-center text-slate-500">
                    Belum ada item
                  </td>
                </tr>
              )}
              {filteredRows.map((r) => {
                const variance = (r.count_qty == null ? null : Number(Number(r.count_qty) - Number(r.quantity || 0)))
                return (
                  <tr key={r.ingredient_id} className="border-t border-teal-bg hover:bg-teal-bg/50">
                    <td className="px-2 py-1.5 font-mono text-slate-600">{r.ingredient_code}</td>
                    <td className="px-2 py-1.5 font-medium text-slate-800">{r.ingredient_name}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{Number(r.quantity || 0).toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1.5 text-right">
                      <span>{r.count_qty == null ? '-' : Number(r.count_qty).toLocaleString('id-ID')}</span>
                    </td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${variance == null ? 'text-slate-700' : (Number(variance) > 0 ? 'text-teal-primary' : 'text-rose-700')}`}>
                      {variance == null ? '-' : Number(variance).toLocaleString('id-ID')}
                    </td>
                    {editable && (
                      <td className="px-2 py-1.5 text-left">
                        <input type="text" placeholder="Catatan (opsional)" className="w-full px-2 py-1 border border-slate-300 rounded text-xs" />
                      </td>
                    )}
                    {editable && (
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => setRows(prev => prev.filter(x => x.ingredient_id !== r.ingredient_id))} className="px-2 py-1 text-xs rounded bg-coral-bg text-coral-dark hover:bg-coral-primary hover:text-white transition-colors">Hapus</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-500">Menampilkan {filteredRows.length} dari {rows.length} item</div>
      </div>

      {/* Footer actions */}
      {!readOnly && (
        <div className="container-card p-3 text-xs">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push(backHref)}>Batal</Button>
            <Button disabled={saving || !rows.length || !warehouseId} onClick={saveDraft}>
              {saving ? 'Menyimpan...' : 'Simpan Draft'}
            </Button>
          </div>
        </div>
      )}

      {/* Modal Picker Barang */}
      <BarangPickerModal
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        onPick={(it) => {
          const exists = rows.some(r => r.ingredient_id === it.id)
          if (exists) { showError('Item sudah ada di daftar'); return }
          setRows(prev => [...prev, {
            ingredient_id: it.id,
            ingredient_code: it.code,
            ingredient_name: it.name,
            warehouse_id: warehouseId ? Number(warehouseId) : undefined,
            quantity: 0,
            count_qty: null,
            variance_qty: null,
          }])
          setPickOpen(false)
        }}
      />
    </div>
  )
}