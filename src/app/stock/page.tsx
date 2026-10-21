"use client"
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'
import Link from 'next/link'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { useRouter } from 'next/navigation'

type Ingredient = {
  id: number
  code: string
  name: string
  base_unit: string
  current_stock: number
}

type Warehouse = {
  id: number
  code: string
  name: string
  is_active: number
}

export default function StockPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [listReady, setListReady] = useState<boolean>(false)
  const router = useRouter()

  useEffect(() => {
    loadWarehouses()
  }, [])

  useEffect(() => {
    if (selectedWarehouse && listReady) {
      loadIngredients()
    }
  }, [selectedWarehouse, listReady])

  const loadWarehouses = async () => {
    try {
      const res = await fetch('/api/gudang')
      if (res.ok) {
        const data = await res.json()
        const whList = data?.rows || data || []
        const activeWarehouses = whList.filter((w: any) => w.is_active && !w.isdelete)
        setWarehouses(activeWarehouses)
        // Set default warehouse: prefer id=1 (Resto/Retail default), else first active
        const w1 = activeWarehouses.find((w: any) => Number(w.id) === 1)
        setSelectedWarehouse(w1 || activeWarehouses[0] || null)
        // Do not auto-fill date range; user must input manually
      }
    } catch (e) {
      console.error('Error loading warehouses:', e)
    } finally {
      // Allow page content to render; ingredients will load after user clicks Tampilkan
      setLoading(false)
    }
  }

  const loadIngredients = async () => {
    if (!selectedWarehouse || !listReady) return
    
    try {
      setLoading(true)
      // Get all barang with stock balance for selected warehouse, include zero-stock items
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

  const handleSelectBahan = (value: number | string | null) => {
    if (!from || !to) { alert('Pilih tanggal awal dan akhir terlebih dahulu'); return }
    if (value && selectedWarehouse) {
      const q = new URLSearchParams()
      q.set('warehouseId', String(selectedWarehouse.id))
      q.set('from', from)
      q.set('to', to)
      window.open(`/stock/${value}?${q.toString()}`, '_blank')
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Kartu Stok</h1>
            <p className="text-sm text-slate-600 mt-1">Monitoring stok dan pergerakan semua barang</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Gudang:</label>
              <select
                value={selectedWarehouse?.id || ''}
                onChange={(e) => {
                  const warehouse = warehouses.find(w => w.id === Number(e.target.value))
                  setSelectedWarehouse(warehouse || null)
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary min-w-[200px]"
              >
                <option value="">Pilih Gudang...</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <Link
              href="/barang/stock-initial"
              className="px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors flex items-center gap-2"
            >
              📋 Laporan Pemakaian
            </Link>
          </div>
        </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Awal</label>
            <input type="date" className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm" value={from} onChange={(e)=>setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Akhir</label>
            <input type="date" className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm" value={to} onChange={(e)=>setTo(e.target.value)} />
          </div>
          <div>
            <button
              onClick={() => {
                if (!from || !to) { alert('Pilih tanggal awal dan akhir terlebih dahulu'); return }
                setListReady(true)
                loadIngredients()
              }}
              className="px-4 py-1.5 bg-teal-primary text-white rounded-pill hover:bg-teal-dark disabled:opacity-50 text-sm font-medium shadow-lg"
            >
              Tampilkan
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
              value={selectedId}
              onChange={handleSelectBahan}
              placeholder="Cari kode atau nama barang..."
            />
          </div>
        </div>
      </div>

      {!listReady ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 text-sm text-slate-600">
          Isi tanggal lalu klik Tampilkan untuk melihat daftar barang.
        </div>
      ) : (
      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-teal-primary text-white">
            <tr>
              <th className="px-2 py-1.5 text-left text-xs font-semibold">Kode</th>
              <th className="px-2 py-1.5 text-left text-xs font-semibold">Nama Barang</th>
              <th className="px-2 py-1.5 text-center text-xs font-semibold">Jenis</th>
              <th className="px-2 py-1.5 text-center text-xs font-semibold">Satuan</th>
              <th className="px-2 py-1.5 text-right text-xs font-semibold">Stok Saat Ini</th>
              <th className="px-2 py-1.5 text-center text-xs font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-slate-500 text-xs">
                  Tidak ada data barang
                </td>
              </tr>
            ) : (
              ingredients.map((ing: any) => (
                <tr key={ing.id} className="border-t hover:bg-slate-50">
                  <td className="px-2 py-1 text-xs font-semibold text-slate-800">{ing.code}</td>
                  <td className="px-2 py-1 text-xs text-slate-700">{ing.name}</td>
                  <td className="px-2 py-1 text-xs text-center text-slate-600">
                    {(() => {
                      const jenisVal = (ing as any).jenis ?? 1
                      const isJadi = jenisVal === 1 || jenisVal === '1' || jenisVal === 3 || jenisVal === '3'
                      const isBahan = jenisVal === 2 || jenisVal === '2'
                      const label = isJadi ? 'Barang Jadi' : isBahan ? 'Bahan Baku' : 'Barang Setengah Jadi'
                      const cls = isJadi ? 'bg-blue-100 text-blue-800' : isBahan ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
                          {label}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-2 py-1 text-xs text-center text-slate-600">
                    {ing.base_unit || 'unit'}
                  </td>
                  <td className="px-2 py-1 text-xs text-right font-semibold text-slate-800">
                    {(ing.current_stock || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-2 py-1 text-center space-x-2">
                    <button
                      onClick={() => {
                        if (!from || !to) { alert('Pilih tanggal awal dan akhir terlebih dahulu'); return }
                        const q = new URLSearchParams()
                        q.set('warehouseId', String(selectedWarehouse?.id || 1))
                        q.set('from', from)
                        q.set('to', to)
                        window.open(`/stock/${ing.id}?${q.toString()}`, '_blank')
                      }}
                      className="inline-block px-2 py-1 bg-teal-primary text-white text-xs rounded hover:bg-teal-dark transition-colors disabled:opacity-50"
                      disabled={!from || !to}
                    >
                      Lihat Kartu
                    </button>
                    <button
                      onClick={() => {
                        if (!from || !to) { alert('Pilih tanggal awal dan akhir terlebih dahulu'); return }
                        const q = new URLSearchParams()
                        q.set('warehouseId', String(selectedWarehouse?.id || 1))
                        q.set('from', from)
                        q.set('to', to)
                        window.open(`/stock-hpp/${ing.id}?${q.toString()}`, '_blank')
                      }}
                      className="inline-block px-2 py-1 bg-teal-primary text-white text-xs rounded hover:bg-teal-dark transition-colors disabled:opacity-50"
                      disabled={!from || !to}
                    >
                      Lihat Kartu HPP
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
