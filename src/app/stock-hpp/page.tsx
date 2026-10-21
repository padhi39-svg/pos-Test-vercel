"use client"
import { useEffect, useState } from 'react'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { sanitizeDateInput } from '@/lib/sanitizeDateInput'

type Ingredient = { id: number; code: string; name: string; base_unit: string; current_stock: number; hpp: number; avg_cost: number }
type Warehouse = { id: number; code: string; name: string; is_active: number }

export default function StockHppIndexPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [listReady, setListReady] = useState(false)

  useEffect(() => { loadWarehouses() }, [])
  useEffect(() => { if (selectedWarehouse && listReady) loadIngredients() }, [selectedWarehouse, listReady])

  const loadWarehouses = async () => {
    try {
      const res = await fetch('/api/gudang')
      if (res.ok) {
        const data = await res.json()
        const whList = data?.rows || data || []
        const active = whList.filter((w: any) => w.is_active && !w.isdelete)
        setWarehouses(active)
        const w1 = active.find((w: any) => Number(w.id) === 1)
        setSelectedWarehouse(w1 || active[0] || null)
      }
    } catch (e) {
      console.error('Error loading warehouses:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadIngredients = async () => {
    if (!selectedWarehouse || !listReady) return
    try {
      setLoading(true)
      const res = await fetch(`/api/stock-balance?warehouseId=${selectedWarehouse.id}&includeZero=1`)
      if (res.ok) {
        const data = await res.json()
        setIngredients(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Error loading ingredients:', e)
    } finally {
      setLoading(false)
    }
  }

  const normDate = (s: string): string | null => {
    if (!s) return null
    const v = s.trim()
    const m1 = v.match(/^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/)
    if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
    const m2 = v.match(/^(\d{4})-([0-1]?\d)-([0-3]?\d)$/)
    if (m2) return `${m2[1]}-${m2[2].padStart(2,'0')}-${m2[3].padStart(2,'0')}`
    return null
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="report-page">
      <div>
        <h1 className="report-title">Kartu Stok HPP</h1>
        <p className="report-subtitle">Monitoring stok beserta HPP (moving average) per barang</p>
      </div>

      <div className="report-card report-card-pad">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Gudang</label>
            <select
              value={selectedWarehouse?.id || ''}
              onChange={(e) => {
                const w = warehouses.find(x => x.id === Number(e.target.value))
                setSelectedWarehouse(w || null)
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm min-w-[200px]"
            >
              <option value="">Pilih Gudang...</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Dari Tanggal</label>
            <input 
              type="date" 
              value={from} 
              onChange={(e)=>setFrom(sanitizeDateInput(e.target.value))} 
              className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" 
            />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Sampai Tanggal</label>
            <input 
              type="date" 
              value={to} 
              onChange={(e)=>setTo(sanitizeDateInput(e.target.value))} 
              className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" 
            />
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={() => {
                if (!from || !to) { alert('Pilih tanggal awal dan akhir terlebih dahulu'); return }
                setListReady(true)
                loadIngredients()
              }}
              disabled={loading}
              className="px-4 py-1.5 bg-teal-primary text-white rounded-pill hover:bg-teal-dark disabled:opacity-50 text-sm font-medium shadow-lg"
            >
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
          </div>
          <div className="flex-1 min-w-[18rem]">
            <label className="block text-xs font-medium text-slate-700 mb-1">Pilih Barang</label>
            <SearchableSelect
              options={ingredients.map((ing: any) => ({
                value: ing.id,
                label: `${ing.code} - ${ing.name}`,
                description: `Stok: ${(ing.current_stock || 0).toLocaleString('id-ID')} ${ing.base_unit || 'unit'}`
              }))}
              value={null}
              onChange={(value) => {
                if (!from || !to) { alert('Pilih tanggal dulu'); return }
                const q = new URLSearchParams()
                q.set('warehouseId', String(selectedWarehouse?.id || 1))
                q.set('from', from)
                q.set('to', to)
                window.open(`/stock-hpp/${value}?${q.toString()}`, '_blank')
              }}
              placeholder="Cari kode atau nama barang..."
            />
          </div>
        </div>
      </div>

      {!listReady ? (
        <div className="report-card">
          <div className="text-center text-slate-500 text-xs py-8">Isi tanggal lalu klik Tampilkan untuk melihat daftar barang.</div>
        </div>
      ) : (
      <div className="report-card">
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead className="bg-teal-primary text-white">
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">Kode</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">Nama Barang</th>
                <th className="px-2 py-1.5 text-center text-xs font-semibold">Satuan</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">Stok Saat Ini</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">HPP</th>
                <th className="px-2 py-1.5 text-center text-xs font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.length === 0 ? (
                <tr><td colSpan={6} className="px-2 py-4 text-center text-slate-500 text-xs">Tidak ada data barang</td></tr>
              ) : ingredients.map((ing) => (
                <tr key={ing.id} className="border-t hover:bg-slate-50">
                  <td className="px-2 py-1 text-xs text-slate-700">{ing.code}</td>
                  <td className="px-2 py-1 text-xs text-slate-700">{ing.name}</td>
                  <td className="px-2 py-1 text-xs text-center text-slate-700">{ing.base_unit || 'unit'}</td>
                  <td className="px-2 py-1 text-xs text-right text-slate-800 font-semibold">{(ing.current_stock || 0).toLocaleString('id-ID')}</td>
                  <td className="px-2 py-1 text-xs text-right text-slate-700">{(ing.avg_cost || ing.hpp || 0).toLocaleString('id-ID')}</td>
                  <td className="px-2 py-1 text-center">
                    <button
                      onClick={() => {
                        if (!from || !to) { alert('Pilih tanggal dulu'); return }
                        const q = new URLSearchParams()
                        q.set('warehouseId', String(selectedWarehouse?.id || 1))
                        q.set('from', from)
                        q.set('to', to)
                        window.open(`/stock-hpp/${ing.id}?${q.toString()}`, '_blank')
                      }}
                      className="inline-block px-2 py-1 bg-teal-primary text-white text-xs rounded hover:bg-teal-dark"
                    >
                      Lihat Kartu HPP
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  )
}
