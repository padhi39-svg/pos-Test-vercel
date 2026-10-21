"use client"
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'
import { useRouter } from 'next/navigation'

type PO = { id: number; po_number: string; supplier_id: number; supplier_name: string; order_date: string; items: any[] }
type GRItem = { id: string; barangId: number; barangCode: string; barangName: string; poQty: number; receivedQty: number; unit: string; unitRatio: number; price: number; discountPercent: number; discountAmount: number; total: number }

export default function NewGoodsReceiptPage() {
  const router = useRouter()
  const [pos, setPOs] = useState<PO[]>([])
  const [selectedPO, setSelectedPO] = useState<PO | null>(null)
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<GRItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPOModal, setShowPOModal] = useState(false)
  const [searchPO, setSearchPO] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [ppnPercent] = useState(11)
  const [allowBackdate, setAllowBackdate] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setAllowBackdate(d.backdate_permissions?.['purchase'] ?? d.allow_backdate === true)
    }).catch(() => setAllowBackdate(false))
  }, [])

const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const discountAmount = Math.round(subtotal * (discountPercent / 100))
  const dpp = subtotal - discountAmount
  const ppnAmount = Math.round(dpp * (ppnPercent / 100))
  const total = dpp + ppnAmount

  useEffect(() => { loadPOs() }, [])

  const loadPOs = async () => {
    try {
      const res = await fetch('/api/purchase-orders')
      if (res.ok) {
        const data = await res.json()
        // Only show draft POs
        setPOs(data.filter((po: any) => po.status === 'draft'))
      }
      setLoading(false)
    } catch (error) { console.error('Error loading POs:', error); setLoading(false) }
  }

  const selectPO = (po: PO) => {
    setSelectedPO(po)
    setDiscountPercent(po.discount_percent || 0)
    setItems(po.items.map((item: any) => ({
      id: Date.now().toString() + Math.random(),
      barangId: item.barang_id,
      barangCode: item.barang_code,
      barangName: item.barang_name,
      poQty: item.quantity,
      receivedQty: item.quantity,
      unit: item.unit_name,
      unitRatio: item.unit_ratio || 1,
      price: item.unit_price,
      discountPercent: item.discount_percent || 0,
      discountAmount: item.discount_amount || 0,
      total: item.total_price
    })))
    setShowPOModal(false)
    setSearchPO('')
  }

  const updateReceivedQty = (id: string, qty: number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item
      const gross = item.price * qty
      const disc = Math.round(gross * (item.discountPercent / 100))
      return { ...item, receivedQty: qty, discountAmount: disc, total: Math.max(0, gross - disc) }
    }))
  }

  const handleSave = async () => {
    if (!selectedPO) { alert('Pilih PO terlebih dahulu'); return }
    if (items.some(i => i.receivedQty <= 0)) { alert('Qty diterima harus lebih dari 0'); return }
    setSaving(true)
    try {
      const payload = {
        poId: selectedPO.id,
        poNumber: selectedPO.po_number,
        supplierId: selectedPO.supplier_id,
        supplierName: selectedPO.supplier_name,
        receiptDate,
        notes,
        discountPercent,
        items: items.map(i => ({
          barang_id: i.barangId,
          barang_code: i.barangCode,
          barang_name: i.barangName,
          quantity: i.receivedQty,
          unit_name: i.unit,
          unit_ratio: i.unitRatio,
          unit_price: i.price,
          discount_percent: i.discountPercent,
          discount_amount: i.discountAmount,
          total_price: i.total
        }))
      }
      const res = await fetch('/api/goods-receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Gagal menyimpan penerimaan barang') }
      const result = await res.json()
      alert(`Penerimaan barang berhasil!\nNo. GR: ${result.grNumber}\nStok barang telah diupdate.`)
      router.push('/pembelian/penerimaan')
    } catch (e: any) { alert('Error: ' + e.message) } finally { setSaving(false) }
  }

  const filteredPOs = pos.filter(po => po.po_number.toLowerCase().includes(searchPO.toLowerCase()) || po.supplier_name?.toLowerCase().includes(searchPO.toLowerCase()))

  if (loading) return (<div className="flex-1 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-primary mx-auto mb-2"></div><p className="text-slate-600">Memuat data...</p></div></div>)

  return (
    <div className="p-3 max-w-full mx-auto">
      <div className="mb-2"><h1 className="text-lg font-bold text-slate-800">PENERIMAAN BARANG</h1></div>
      <div className="bg-white rounded-lg shadow-sm p-3">
        {/* Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 pb-3 border-b">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">No. GR</label>
            <input type="text" disabled placeholder="Akan digenerate saat disimpan" className="w-full bg-slate-100 px-2 py-1.5 border border-slate-300 rounded-pill text-xs text-slate-500 placeholder-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Terima *</label>
            <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Purchase Order *</label>
            <div className="relative">
              <input type="text" value={selectedPO ? `${selectedPO.po_number} - ${selectedPO.supplier_name}` : ''} readOnly onClick={() => setShowPOModal(true)} placeholder="Klik untuk pilih PO..." className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary cursor-pointer" />
            </div>
          </div>
        </div>

        {/* Items */}
        {selectedPO && (
          <>
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-800 mb-2">Detail Barang</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gradient-to-r from-slate-600 to-slate-700 text-white">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-xs font-semibold">Kode</th>
                      <th className="px-2 py-1.5 text-left text-xs font-semibold">Barang</th>
                      <th className="px-2 py-1.5 text-center text-xs font-semibold">Qty PO</th>
                      <th className="px-2 py-1.5 text-center text-xs font-semibold">Qty Terima</th>
                      <th className="px-2 py-1.5 text-left text-xs font-semibold">Satuan</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold">Harga</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold">Diskon %</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-2 py-1.5 text-slate-700">{item.barangCode}</td>
                        <td className="px-2 py-1.5 text-slate-700">{item.barangName}</td>
                        <td className="px-2 py-1.5 text-center text-slate-600">{item.poQty}</td>
                        <td className="px-2 py-1.5">
                          <input type="number" min={0} max={item.poQty} value={item.receivedQty} onChange={(e) => updateReceivedQty(item.id, Number(e.target.value))} onFocus={(e) => e.currentTarget.select()} className="w-full px-1.5 py-0.5 border rounded text-xs text-center" />
                        </td>
                        <td className="px-2 py-1.5 text-slate-700">{item.unit}</td>
                        <td className="px-2 py-1.5 text-right text-slate-700">{formatCurrency(item.price)}</td>
                        <td className="px-2 py-1.5 text-right text-slate-700">{item.discountPercent}%</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-teal-primary">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Catatan</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Catatan penerimaan barang..." className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" />
              </div>
              <div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <h3 className="text-xs font-semibold text-slate-700 mb-2">Ringkasan</h3>
                  <div className="space-y-1.5 mb-2">
                    <div className="flex justify-between text-xs"><span className="text-slate-600">Subtotal:</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-600">Diskon ({discountPercent}%):</span><span className="font-medium text-red-600">-{formatCurrency(discountAmount)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-600">DPP:</span><span className="font-medium">{formatCurrency(dpp)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-600">PPN ({ppnPercent}%):</span><span className="font-medium">{formatCurrency(ppnAmount)}</span></div>
                  </div>
                  <div className="border-t border-slate-300 pt-2">
                    <div className="flex justify-between text-sm font-bold"><span className="text-slate-800">TOTAL:</span><span className="text-teal-primary">{formatCurrency(total)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-slate-200">
          <button onClick={() => router.push('/pembelian/penerimaan')} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-pill font-medium transition-colors text-sm">Batal</button>
          <button onClick={handleSave} disabled={saving || !selectedPO} className="px-6 py-2 bg-gradient-to-r from-teal-primary to-teal-light hover:from-teal-dark hover:to-teal-primary text-white rounded-pill font-medium transition-colors disabled:opacity-50 text-sm">{saving ? 'Menyimpan...' : 'Simpan & Update Stok'}</button>
        </div>
      </div>

      {/* PO Modal */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">Pilih Purchase Order</h3>
              <button onClick={() => { setShowPOModal(false); setSearchPO('') }} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-4 border-b">
              <input type="text" placeholder="Cari No. PO atau Supplier..." value={searchPO} onChange={(e) => setSearchPO(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary" autoFocus />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {filteredPOs.length === 0 ? (
                <div className="text-center text-slate-500 py-8">Tidak ada PO draft yang tersedia</div>
              ) : (
                <div className="space-y-2">
                  {filteredPOs.map(po => (
                    <button key={po.id} onClick={() => selectPO(po)} className="w-full text-left p-3 border rounded-lg hover:bg-teal-bg text-sm transition-colors">
                      <div className="font-semibold text-slate-800">{po.po_number}</div>
                      <div className="text-slate-600">{po.supplier_name || 'Tanpa Supplier'}</div>
                      <div className="text-xs text-slate-500">Tanggal: {po.order_date} • {po.items?.length || 0} item</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
