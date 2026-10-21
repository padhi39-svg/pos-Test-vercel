"use client"
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { formatCurrency } from '@/lib/regionalNumber'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

type PriceData = {
  unitId: number
  unitName: string
  ratio: number
  price: number
  isManual: boolean
  effectiveDate: string | null
}

type BarangInfo = {
  id: number
  code: string
  name: string
  kategoriName: string
}

type PriceHistory = {
  price: number
  effectiveDate: string
  unitName: string
  ratio: number
}

export default function EditHargaPage() {
  const router = useRouter()
  const params = useParams()
  const barangId = params.id as string

  const [barang, setBarang] = useState<BarangInfo | null>(null)
  const [prices, setPrices] = useState<PriceData[]>([])
  const [history, setHistory] = useState<PriceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingUnit, setEditingUnit] = useState<number | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editPriceDisplay, setEditPriceDisplay] = useState('')
  const [editDate, setEditDate] = useState('')

  useEffect(() => {
    loadData()
    loadHistory()
  }, [barangId])

  const loadData = async () => {
    try {
      const response = await fetch(`/api/harga/${barangId}`)
      if (response.ok) {
        const data = await response.json()
        setBarang(data.barang)
        setPrices(data.prices)
      }
    } catch (error) {
      console.error('Error loading harga:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async () => {
    try {
      const db = await fetch(`/api/harga/${barangId}/history`)
      if (db.ok) {
        const data = await db.json()
        setHistory(data)
      }
    } catch (error) {
      console.error('Error loading history:', error)
    }
  }

  const handleEditClick = (price: PriceData) => {
    setEditingUnit(price.unitId)
    if (price.price > 0) {
      setEditPrice(price.price.toString())
      setEditPriceDisplay(price.price.toLocaleString('id-ID'))
    } else {
      setEditPrice('')
      setEditPriceDisplay('')
    }
    setEditDate(price.effectiveDate || new Date().toISOString().split('T')[0])
  }

  const handlePriceInputChange = (value: string) => {
    const cleanValue = value.replace(/[^0-9,]/g, '')
    const numericValue = cleanValue.replace(/\./g, '').replace(',', '.')
    setEditPrice(numericValue)
    if (numericValue) {
      const num = parseFloat(numericValue)
      if (!isNaN(num)) setEditPriceDisplay(num.toLocaleString('id-ID'))
      else setEditPriceDisplay('')
    } else {
      setEditPriceDisplay('')
    }
  }

  const handleSaveEdit = () => {
    if (!editingUnit) return
    setPrices(prices.map(p => {
      if (p.unitId === editingUnit) {
        return { ...p, price: parseFloat(editPrice) || 0, isManual: true, effectiveDate: editDate }
      }
      return p
    }))
    setEditingUnit(null)
    setEditPrice('')
    setEditPriceDisplay('')
    setEditDate('')
  }

  const handleSaveAll = async () => {
    if (!barang) return
    setSaving(true)
    try {
      const manualPrices = prices
        .filter(p => p.isManual)
        .map(p => ({ unitId: p.unitId, price: p.price, effectiveDate: p.effectiveDate || new Date().toISOString().split('T')[0] }))
      const response = await fetch(`/api/harga/${barangId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices: manualPrices })
      })
      if (response.ok) {
        alert('Harga berhasil disimpan!')
        router.push('/harga')
      } else {
        alert('Gagal menyimpan harga')
      }
    } catch (error) {
      console.error('Error saving harga:', error)
      alert('Terjadi kesalahan saat menyimpan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-primary mx-auto mb-2" />
          <p className="text-slate-600 text-sm">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (!barang) {
    return <div className="p-6 text-center text-slate-600 text-sm">Barang tidak ditemukan</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Master Harga - {barang.name}</h1>
        <p className="text-slate-500 text-xs mt-1">{barang.code} — {barang.kategoriName}</p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/harga')}>Kembali</Button>
      </div>

      <div className="container-card p-3 text-xs space-y-3">
        <div className="font-medium text-xs">Daftar Harga per Satuan</div>
        <div className="border border-teal-bg rounded-card overflow-hidden">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white" style={{ height: 28, verticalAlign: 'middle' }}>
                <th className="text-left px-2 font-medium">Satuan</th>
                <th className="text-center px-2 font-medium">Ratio</th>
                <th className="text-right px-2 font-medium">Harga Jual</th>
                <th className="text-center px-2 font-medium">Tgl Efektif</th>
                <th className="text-center px-2 font-medium w-[1%] whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((price) => (
                <tr key={price.unitId} className="border-t border-teal-bg hover:bg-teal-bg/50" style={{ height: 34, verticalAlign: 'middle' }}>
                  <td className="px-2 font-medium text-slate-800">{price.unitName}</td>
                  <td className="px-2 text-center text-slate-600">{price.ratio}</td>
                  <td className="px-2 text-right">
                    <span className={price.isManual ? 'text-teal-primary font-medium' : 'text-slate-600'}>
                      {formatCurrency(price.price)}
                      {!price.isManual && <span className="text-[10px] ml-1">(auto)</span>}
                    </span>
                  </td>
                  <td className="px-2 text-center text-slate-600">{price.effectiveDate || '-'}</td>
                  <td className="px-2 text-center">
                    <Button variant="outline" onClick={() => handleEditClick(price)} className="text-xs px-2 py-1">Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {history.length > 0 && (
        <div className="container-card p-3 text-xs space-y-3">
          <div className="font-medium text-xs">Riwayat Perubahan Harga</div>
          <div className="border border-teal-bg rounded-card overflow-hidden">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white" style={{ height: 28, verticalAlign: 'middle' }}>
                  <th className="text-left px-2 font-medium">Tanggal</th>
                  <th className="text-left px-2 font-medium">Satuan</th>
                  <th className="text-center px-2 font-medium">Ratio</th>
                  <th className="text-right px-2 font-medium">Harga</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => {
                  const formatDateTime = (dateStr: string) => {
                    if (!dateStr) return '-'
                    const date = new Date(dateStr)
                    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
                  }
                  return (
                    <tr key={idx} className="border-t border-teal-bg hover:bg-teal-bg/50" style={{ height: 32, verticalAlign: 'middle' }}>
                      <td className="px-2 text-slate-600">{formatDateTime(h.effectiveDate)}</td>
                      <td className="px-2 font-medium text-slate-700">{h.unitName}</td>
                      <td className="px-2 text-center text-slate-600">{h.ratio}</td>
                      <td className="px-2 text-right font-medium text-slate-800">{formatCurrency(h.price)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="p-2 rounded bg-teal-bg text-xs text-teal-dark">
        💡 Harga dengan label <strong>(auto)</strong> dihitung otomatis dari satuan terkecil × ratio. Klik <strong>Edit</strong> untuk set harga manual.
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push('/harga')}>Batal</Button>
        <Button onClick={handleSaveAll} disabled={saving}>
          {saving ? 'Menyimpan...' : 'Simpan Semua'}
        </Button>
      </div>

      {editingUnit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl w-[480px] max-w-[95vw] flex flex-col">
            <div className="p-3 border-b flex items-center justify-between shrink-0">
              <div className="font-medium text-sm">Edit Harga - {prices.find(p => p.unitId === editingUnit)?.unitName}</div>
              <button onClick={() => setEditingUnit(null)} className="text-sm text-slate-500 hover:text-slate-700">Tutup</button>
            </div>
            <div className="p-3 space-y-3">
              <div className="text-xs text-slate-600">
                Satuan: {prices.find(p => p.unitId === editingUnit)?.unitName} ({prices.find(p => p.unitId === editingUnit)?.ratio} pcs)
              </div>
              <div>
                <div className="text-xs text-slate-600 mb-1">Harga Manual</div>
                <Input
                  type="text"
                  value={editPriceDisplay}
                  onChange={(e) => handlePriceInputChange(e.target.value)}
                  placeholder="Masukkan harga..."
                />
              </div>
              <div>
                <div className="text-xs text-slate-600 mb-1">Tanggal Efektif</div>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
            </div>
            <div className="p-3 border-t flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={() => setEditingUnit(null)}>Batal</Button>
              <Button onClick={handleSaveEdit}>Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
