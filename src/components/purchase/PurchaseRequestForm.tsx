"use client"
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { showError } from '@/lib/notification'
import SearchPickerModal from '@/components/SearchPickerModal'
import FormHeader from '@/components/ui/FormHeader'
import FormField from '@/components/ui/FormField'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import PageLoading from '@/components/ui/PageLoading'

type UnitOpt = { unit: string; ratio: number; is_base?: number }

type Product = {
  id: number
  code: string
  name: string
  units?: UnitOpt[]
}

type PRItem = {
  id: string
  barang_id: number | null
  barang_code: string
  barang_name: string
  quantity: number
  unit_name: string
  unit_ratio: number
  units?: UnitOpt[]
}

export type PurchaseRequestRow = {
  id?: number
  barang_id: number
  barang_code: string
  barang_name: string
  quantity: number
  unit_name: string
  unit_ratio: number
  units?: UnitOpt[]
}

export type PurchaseRequestFormProps = {
  title: string
  subtitle?: string
  backHref?: string
  readonly?: boolean
  initial?: {
    request_number?: string
    request_date: string
    expected_date?: string | null
    requester_name?: string | null
    items?: PurchaseRequestRow[]
  }
  onEdit?: () => void
  onSubmit?: (data: {
    requestDate: string
    expectedDate?: string | null
    requesterName?: string | null
    items: {
      barang_id: number
      barang_code: string
      barang_name: string
      quantity: number
      unit_name: string
      unit_ratio: number
    }[]
  }) => Promise<void>
}

const EMPTY: PRItem = { id: '', barang_id: null, barang_code: '', barang_name: '', quantity: 0, unit_name: '', unit_ratio: 1 }

function createEmpty(id: string): PRItem { return { ...EMPTY, id } }

export default function PurchaseRequestForm({ title, subtitle, backHref = '/pembelian/pengajuan', readonly = false, initial, onEdit, onSubmit }: PurchaseRequestFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tdate, setTdate] = useState(initial?.request_date ?? new Date().toISOString().slice(0, 10))
  const [expected, setExpected] = useState(initial?.expected_date ?? '')
  const [requesterName, setRequesterName] = useState(initial?.requester_name ?? '')
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<PRItem[]>(() => {
    if (initial?.items && initial.items.length > 0) {
      return [
        ...initial.items.map((it, i) => ({
          id: (Date.now() + i).toString(),
          barang_id: it.barang_id,
          barang_code: it.barang_code,
          barang_name: it.barang_name,
          quantity: it.quantity,
          unit_name: it.unit_name,
          unit_ratio: it.unit_ratio,
          units: it.units,
        })),
        createEmpty((Date.now() + initial.items.length).toString()),
      ]
    }
    return [createEmpty(Date.now().toString())]
  })
  const [showProductModal, setShowProductModal] = useState(false)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [emptyRowSearch, setEmptyRowSearch] = useState('')

  const isEdit = !!initial
  const displayItems = readonly ? items.filter(it => it.barang_id != null) : items

  const loadMasterData = useCallback(async () => {
    try {
      const res = await fetch('/api/barang')
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data?.rows || [])
        setProducts(list.filter((item: any) => item.aktif).map((item: any) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          units: (item.units || []).map((u: any) => ({ unit: u.unit || u.name, ratio: Number(u.ratio) || 1, is_base: Number(u.is_base || 0) })),
        })))
      }
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (readonly) { setLoading(false); return }
    loadMasterData()
  }, [loadMasterData, readonly])

  useEffect(() => {
    if (!initial) return
    setTdate(initial.request_date)
    setExpected(initial.expected_date ?? '')
    setRequesterName(initial.requester_name ?? '')
    ;(async () => {
      const enriched = await Promise.all((initial.items ?? []).map(async (r) => {
        if (r.units && r.units.length > 0) return r
        try {
          const res = await fetch(`/api/barang/${r.barang_id}/units`, { cache: 'no-store' })
          if (!res.ok) return r
          const data = await res.json().catch(() => [])
          const units = Array.isArray(data) ? data.map((u: any) => ({ unit: u.unit || u.name, ratio: Number(u.ratio) || 1, is_base: Number(u.is_base || 0) })) : []
          return { ...r, units }
        } catch { return r }
      }))
      setItems([
        ...enriched.map((it, i) => ({
          id: (Date.now() + i).toString(),
          barang_id: it.barang_id,
          barang_code: it.barang_code,
          barang_name: it.barang_name,
          quantity: it.quantity,
          unit_name: it.unit_name,
          unit_ratio: it.unit_ratio,
          units: it.units,
        })),
        createEmpty((Date.now() + (initial.items?.length ?? 0)).toString()),
      ])
    })()
    setLoading(false)
  }, [initial])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); setShowProductModal(true) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelectProduct = (product: Product) => {
    const smallestUnit = product.units?.find(u => u.is_base === 1) || product.units?.[0]
    const defaultUnit = smallestUnit?.unit || 'PCS'
    const defaultUnitRatio = smallestUnit?.ratio || 1

    if (activeItemId) {
      setItems(items.map(item =>
        item.id === activeItemId
          ? { ...item, barang_id: product.id, barang_code: product.code, barang_name: product.name, unit_name: defaultUnit, unit_ratio: defaultUnitRatio, units: product.units }
          : item
      ))
      setActiveItemId(null)
      setShowProductModal(false)
      return
    }

    const emptyRowIndex = items.findIndex(item => !item.barang_id)
    if (emptyRowIndex >= 0) {
      const updatedItems = items.map((item, index) =>
        index === emptyRowIndex
          ? { ...item, barang_id: product.id, barang_code: product.code, barang_name: product.name, unit_name: defaultUnit, unit_ratio: defaultUnitRatio, units: product.units }
          : item
      )
      const newEmpty = createEmpty((Date.now() + 1).toString())
      setItems([...updatedItems, newEmpty])
      const selectedItem = updatedItems[emptyRowIndex]
      setTimeout(() => {
        const qtyInput = document.querySelector(`input[data-itemid="${selectedItem.id}"][data-field="quantity"]`) as HTMLInputElement
        if (qtyInput) { qtyInput.focus(); qtyInput.select() }
      }, 100)
    } else {
      const newItem: PRItem = { id: Date.now().toString(), barang_id: product.id, barang_code: product.code, barang_name: product.name, quantity: 0, unit_name: defaultUnit, unit_ratio: defaultUnitRatio, units: product.units }
      const newEmpty = createEmpty((Date.now() + 1).toString())
      setItems([...items, newItem, newEmpty])
      setTimeout(() => {
        const qtyInput = document.querySelector(`input[data-itemid="${newItem.id}"][data-field="quantity"]`) as HTMLInputElement
        if (qtyInput) { qtyInput.focus(); qtyInput.select() }
      }, 100)
    }
    setShowProductModal(false)
  }

  const updateItemQuantity = (id: string, quantity: number) => {
    setItems(items.map(item => item.id === id ? { ...item, quantity } : item))
  }

  const updateItemUnit = (id: string, unit_name: string) => {
    setItems(items.map(item => {
      if (item.id !== id || !item.barang_id) return item
      const u = (item.units || []).find(u => u.unit === unit_name)
      return { ...item, unit_name, unit_ratio: u?.ratio || 1 }
    }))
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const handleSave = async () => {
    if (saving || !onSubmit) return
    if (!tdate) { showError('Tanggal wajib diisi'); return }
    const validItems = items.filter(it => it.barang_id)
    if (validItems.length === 0) { showError('Silakan tambahkan minimal 1 item'); return }
    setSaving(true)
    try {
      await onSubmit({
        requestDate: tdate,
        expectedDate: expected || null,
        requesterName: requesterName || null,
        items: validItems.map(r => ({
          barang_id: r.barang_id!,
          barang_code: r.barang_code,
          barang_name: r.barang_name,
          quantity: r.quantity,
          unit_name: r.unit_name,
          unit_ratio: r.unit_ratio,
        })),
      })
      router.push(backHref + (typeof window !== 'undefined' ? '?' + new URLSearchParams(window.location.search).get('return') || '' : ''))
    } catch {
      setSaving(false)
    }
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-3">
      <SearchPickerModal
        open={showProductModal}
        title="Cari Barang"
        subtitle="Ketik nama atau kode barang"
        placeholder="Ketik nama/kode barang..."
        columns={[
          { key: 'code', label: 'Kode', className: 'font-mono text-slate-600' },
          { key: 'name', label: 'Nama Barang', className: 'font-medium text-slate-800' },
          { key: 'aksi', label: 'Aksi', className: 'text-center', render: (r) => <Button type="button" onClick={() => handleSelectProduct(r)} className="!px-2 !py-1 text-xs">Pilih</Button> },
        ]}
        searchKeys={['code', 'name']}
        data={products}
        onPick={handleSelectProduct}
        onClose={() => setShowProductModal(false)}
      />

      <div className="max-w-full mx-auto">
        <FormHeader title={title} subtitle={subtitle} backHref={backHref} />

        {readonly && (
          <div className="flex gap-2 mb-3">
            <Button variant="outline" onClick={() => router.push(backHref)}>Kembali</Button>
            {onEdit && <Button onClick={onEdit}>Edit</Button>}
          </div>
        )}

        <div className="container-card p-3 text-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 pb-3 border-b">
            <FormField label="Tanggal Pengajuan" required>
              <Input type="date" value={tdate} onChange={(e) => setTdate(e.target.value)} disabled={readonly} className="text-xs" />
            </FormField>
            <FormField label="Target Tiba">
              <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} disabled={readonly} className="text-xs" />
            </FormField>
            <FormField label="Peminta">
              <Input type="text" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} disabled={readonly} placeholder="Nama peminta (opsional)" className="text-xs" />
            </FormField>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-800">Detail Transaksi</h2>
              {!readonly && (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={emptyRowSearch}
                    onChange={(e) => setEmptyRowSearch(e.target.value)}
                    placeholder="Scan Barcode / Ketik Kode Barang..."
                    className="w-64 text-xs"
                  />
                  <Button type="button" onClick={() => setShowProductModal(true)}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    Cari
                  </Button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold w-48">Barang</th>
                  <th className="px-2 py-1.5 text-center w-20 text-xs font-semibold">Qty</th>
                  <th className="px-2 py-1.5 text-left w-24 text-xs font-semibold">Satuan</th>
                  {!readonly && <th className="px-2 py-1.5 text-center w-16 text-xs font-semibold">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayItems.length === 0 && (
                  <tr>
                    <td colSpan={readonly ? 3 : 4} className="px-2 py-4 text-center text-slate-400 italic text-xs">Belum ada item</td>
                  </tr>
                )}
                {displayItems.map((item) => (
                  <tr key={item.id} className="border-t border-teal-bg hover:bg-teal-bg/50">
                    <td className="px-2 py-1.5">
                      {item.barang_id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="text"
                            value={`${item.barang_code} — ${item.barang_name}`}
                            readOnly
                            className="flex-1 text-xs !px-2 !py-1 bg-slate-50 text-slate-800 font-medium cursor-pointer"
                            onClick={() => { if (!readonly) { setActiveItemId(item.id); setShowProductModal(true) } }}
                            title="Klik untuk ganti barang"
                          />
                          {!readonly && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => { setActiveItemId(item.id); setShowProductModal(true) }}
                              className="!px-2 !py-1 text-xs"
                              title="Cari barang"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                              </svg>
                            </Button>
                          )}
                        </div>
                      ) : (
                        !readonly && (
                          <div className="flex items-center gap-1">
                            <Input
                              type="text"
                              placeholder="Scan / Ketik Kode Barang..."
                              className="flex-1 text-xs !px-2 !py-1 border-dashed border-slate-300 text-slate-600"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => { setActiveItemId(null); setShowProductModal(true) }}
                              className="!px-2 !py-1 text-xs"
                              title="Cari barang"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                              </svg>
                            </Button>
                          </div>
                        )
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {item.barang_id || readonly ? (
                        <Input
                          type="number"
                          placeholder="0"
                          value={item.quantity || ''}
                          onChange={(e) => updateItemQuantity(item.id, Number(e.target.value))}
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={readonly}
                          data-itemid={item.id}
                          data-field="quantity"
                          className="!px-1.5 !py-0.5 text-xs text-center"
                        />
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {item.barang_id ? (
                        <Select
                          value={item.unit_name}
                          onChange={(e) => updateItemUnit(item.id, e.target.value)}
                          disabled={readonly}
                          className="!px-1.5 !py-0.5 text-xs"
                        >
                          {(item.units || []).map((u, idx) => (
                            <option key={idx} value={u.unit}>{u.unit}</option>
                          ))}
                        </Select>
                      ) : readonly ? (
                        <span className="text-slate-300">-</span>
                      ) : (
                        <Select disabled className="!px-1.5 !py-0.5 text-xs"><option value="">-</option></Select>
                      )}
                    </td>
                    {!readonly && (
                      <td className="px-2 py-1.5 text-center">
                        <button
                          className="px-1 py-1.5 rounded text-red-600 bg-red-50 hover:text-red-800 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center mx-auto"
                          onClick={() => removeItem(item.id)}
                          disabled={!item.barang_id && items.length <= 1}
                        >
                          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>

          {!readonly && (
            <div className="flex justify-end gap-2">
              <Button onClick={handleSave} disabled={saving || !items.some(it => it.barang_id)}>
                {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Pengajuan'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
