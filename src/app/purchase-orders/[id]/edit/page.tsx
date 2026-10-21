"use client"
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { formatCurrency } from '@/lib/regionalNumber'

type DetailItem = {
  tempId: string
  barangId: number | null
  barangCode: string
  barangName: string
  quantity: number
  unitName: string
  unitRatio: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  subtotal: number
}

export default function EditPurchaseOrderPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null)
  const [orderDate, setOrderDate] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [details, setDetails] = useState<DetailItem[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const [poRes, suppRes, prodRes] = await Promise.all([
          fetch(`/api/purchase-orders/${id}`),
          fetch('/api/supplier'),
          fetch('/api/barang')
        ])
        if (!poRes.ok) throw new Error('PO tidak ditemukan')
        const poData = await poRes.json()
        const suppData = suppRes.ok ? await suppRes.json() : []
        const prodData = prodRes.ok ? await prodRes.json() : []

        setSuppliers(Array.isArray(suppData) ? suppData : [])
        setProducts(Array.isArray(prodData) ? prodData : [])

        const supp = suppData.find((s: any) => s.id === poData.supplier_id)
        setSelectedSupplier(supp || null)
        setOrderDate(poData.order_date || '')
        setExpectedDate(poData.expected_date || '')
        setNotes(poData.notes || '')

        const items = (poData.items || []).map((it: any) => {
          const discAmt = Number(it.discount_amount) || 0
          const qty = it.quantity || 0
          const gross = (it.unit_price || 0) * qty
          const subtotal = Math.max(0, gross - discAmt * qty)
          return {
            tempId: `${it.id}`,
            barangId: it.barang_id,
            barangCode: it.barang_code,
            barangName: it.barang_name,
            quantity: qty,
            unitName: it.unit_name,
            unitRatio: it.unit_ratio,
            unitPrice: it.unit_price,
            discountPercent: it.discount_percent,
            discountAmount: discAmt,
            subtotal,
          }
        })
        setDetails(items.length > 0 ? items : [{
          tempId: Date.now().toString(),
          barangId: null,
          barangCode: '',
          barangName: '',
          quantity: 1,
          unitName: 'PCS',
          unitRatio: 1,
          unitPrice: 0,
          discountPercent: 0,
          discountAmount: 0,
          subtotal: 0
        }])
      } catch (e: any) {
        alert(e.message)
        router.push('/purchase-orders')
      }
    }
    load()
  }, [id])

  const addRow = () => {
    setDetails(prev => [...prev, {
      tempId: Date.now().toString(),
      barangId: null,
      barangCode: '',
      barangName: '',
      quantity: 1,
      unitName: 'PCS',
      unitRatio: 1,
      unitPrice: 0,
      discountPercent: 0,
      discountAmount: 0,
      subtotal: 0
    }])
  }

  const removeRow = (tempId: string) => {
    if (details.length === 1) return
    setDetails(prev => prev.filter(d => d.tempId !== tempId))
  }

  const updateDetail = (tempId: string, field: keyof DetailItem, value: any) => {
    setDetails(prev => prev.map(d => {
      if (d.tempId !== tempId) return d
      const updated = { ...d, [field]: value }
      if (field === 'quantity' || field === 'unitPrice' || field === 'discountPercent' || field === 'discountAmount') {
        const gross = updated.unitPrice * updated.quantity
        let perUnitDisc = updated.discountAmount
        if (field === 'discountPercent') {
          perUnitDisc = Math.round(updated.unitPrice * (updated.discountPercent / 100))
        } else if (field === 'discountAmount') {
          perUnitDisc = updated.discountAmount
        } else if (updated.discountPercent > 0) {
          perUnitDisc = Math.round(updated.unitPrice * (updated.discountPercent / 100))
        }
        updated.discountAmount = Math.max(0, perUnitDisc)
        updated.subtotal = Math.max(0, gross - updated.discountAmount * updated.quantity)
      }
      return updated
    }))
  }

  const selectBarang = (tempId: string, barang: any) => {
    const price = barang.prices?.[0]?.price || barang.hpp || 0
    const unit = barang.units?.find((u: any) => u.ratio === 1) || barang.units?.[0] || { name: 'PCS', ratio: 1 }
    setDetails(prev => prev.map(d => {
      if (d.tempId !== tempId) return d
      const gross = price * d.quantity
      return {
        ...d,
        barangId: barang.id,
        barangCode: barang.code,
        barangName: barang.name,
        unitName: unit.name,
        unitRatio: unit.ratio,
        unitPrice: price,
        subtotal: gross
      }
    }))
  }

  const handleSave = async () => {
    const filled = details.filter(d => d.barangId)
    if (filled.length === 0) {
      alert('Minimal harus ada 1 item barang')
      return
    }
    if (filled.some(d => d.quantity <= 0)) {
      alert('Qty harus lebih dari 0')
      return
    }

    setLoading(true)
    try {
      const payload = {
        supplierId: selectedSupplier?.id || null,
        supplierName: selectedSupplier?.name || null,
        orderDate,
        expectedDate: expectedDate || null,
        notes,
        items: filled.map(d => ({
          barangId: d.barangId,
          barangCode: d.barangCode,
          barangName: d.barangName,
          quantity: d.quantity,
          unitName: d.unitName,
          unitRatio: d.unitRatio,
          unitPrice: d.unitPrice,
          discountPercent: d.discountPercent,
          discountAmount: d.discountAmount,
          totalPrice: d.subtotal
        }))
      }
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Gagal menyimpan PO')
      }
      alert('PO berhasil diupdate')
      router.push('/purchase-orders')
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const subtotal = details.reduce((s, d) => s + d.subtotal, 0)
  const ppn = Math.round(subtotal * 0.11)
  const total = subtotal + ppn

  return (
    <div className="p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Edit Purchase Order</h1>
        <button onClick={() => router.back()} className="text-sm text-slate-600 hover:text-slate-800">← Kembali</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Supplier (Opsional)</label>
            <select value={selectedSupplier?.id || ''} onChange={e => {
              const s = suppliers.find(x => x.id === Number(e.target.value))
              setSelectedSupplier(s || null)
            }} className="w-full px-3 py-2 border rounded text-sm">
              <option value="">-- Pilih Supplier --</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Order</label>
            <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Diharapkan</label>
            <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Catatan</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-800">Items</h3>
          <button onClick={addRow} className="px-3 py-1 bg-emerald-600 text-white rounded text-xs">+ Tambah Baris</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-1 text-left">Kode Barang</th>
                <th className="px-2 py-1 text-left">Nama</th>
                <th className="px-2 py-1 text-right">Qty</th>
                <th className="px-2 py-1 text-left">Unit</th>
                <th className="px-2 py-1 text-right">Harga</th>
                <th className="px-2 py-1 text-right">Disc%</th>
                <th className="px-2 py-1 text-right">Disc Nom</th>
                <th className="px-2 py-1 text-right">Subtotal</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {details.map(d => (
                <tr key={d.tempId} className="border-t">
                  <td className="px-2 py-1">
                    <input list={`barang-${d.tempId}`} value={d.barangCode} onChange={e => {
                      const val = e.target.value.toUpperCase()
                      updateDetail(d.tempId, 'barangCode', val)
                      const found = products.find(p => p.code === val)
                      if (found) selectBarang(d.tempId, found)
                    }} className="w-full px-2 py-1 border rounded text-xs" />
                    <datalist id={`barang-${d.tempId}`}>
                      {products.map(p => <option key={p.id} value={p.code}>{p.name}</option>)}
                    </datalist>
                  </td>
                  <td className="px-2 py-1">{d.barangName || '-'}</td>
                  <td className="px-2 py-1"><input type="number" min={0} value={d.quantity} onChange={e => updateDetail(d.tempId, 'quantity', Number(e.target.value))} className="w-16 px-2 py-1 border rounded text-xs text-right" /></td>
                  <td className="px-2 py-1">{d.unitName}</td>
                  <td className="px-2 py-1"><input type="number" min={0} value={d.unitPrice} onChange={e => updateDetail(d.tempId, 'unitPrice', Number(e.target.value))} className="w-24 px-2 py-1 border rounded text-xs text-right" /></td>
                  <td className="px-2 py-1"><input type="number" min={0} max={100} value={d.discountPercent} onChange={e => updateDetail(d.tempId, 'discountPercent', Number(e.target.value))} className="w-16 px-2 py-1 border rounded text-xs text-right" /></td>
                  <td className="px-2 py-1"><input type="number" min={0} value={d.discountAmount} onChange={e => updateDetail(d.tempId, 'discountAmount', Number(e.target.value))} className="w-20 px-2 py-1 border rounded text-xs text-right" /></td>
                  <td className="px-2 py-1 text-right">{formatCurrency(d.subtotal)}</td>
                  <td className="px-2 py-1 text-center">
                    <button onClick={() => removeRow(d.tempId)} className="text-red-600 hover:text-red-800">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm"><span className="text-slate-600">DPP (Subtotal):</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-slate-600">PPN (11%):</span><span className="font-semibold">{formatCurrency(ppn)}</span></div>
        <div className="flex justify-between text-base font-bold border-t pt-2"><span>Total:</span><span>{formatCurrency(total)}</span></div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
        <button onClick={() => router.back()} className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300">Batal</button>
      </div>
    </div>
  )
}
