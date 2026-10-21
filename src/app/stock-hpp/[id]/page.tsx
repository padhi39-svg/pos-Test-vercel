"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/regionalNumber'

type Movement = {
  id: number
  movement_type: 'in'|'out'
  in_qty: number
  out_qty: number
  balance: number
  reference_type: string | null
  reference_id: number | null
  reference_number: string | null
  notes: string | null
  created_at: string
  hpp: number
  value_in: number
  value_out: number
}

// Function to get proper keterangan based on reference_type
function getKeterangan(movement: Movement): string {
  // Use notes if available (from API mapping)
  if (movement.notes) {
    return movement.notes
  }
  
  // Fallback to reference_type mapping
  switch (movement.reference_type) {
    case 'purchase':
      return 'Pembelian'
    case 'retur_pembelian':
      return 'Retur'
    case 'retur_penjualan':
      return 'Retur'
    case 'retur':
      return 'Retur'
    case 'transaction':
      // Check if it's POS or Invoice based on transaction number pattern
      if (movement.reference_number) {
        if (movement.reference_number.startsWith('POS/')) {
          return 'Penjualan POS'
        } else if (movement.reference_number.startsWith('JL/')) {
          return 'Penjualan Invoice'
        } else if (movement.reference_number.startsWith('RTJ/')) {
          return 'Retur'
        } else {
          return 'Penjualan'
        }
      }
      return 'Penjualan'
    case 'sale':
      return 'Penjualan'
    case 'stock_transfer':
      return 'Transfer Stok'
    case 'stock_usage':
      return 'Pemakaian'
    case 'stock_opname':
      return 'Stock Opname'
    case 'initial_stock':
      return 'Saldo Awal'
    default:
      return movement.reference_type || '-'
  }
}

type Warehouse = { id: number; code: string; name: string; is_active: number }

type StockCardHpp = {
  ingredient: { id: number; code: string; name: string; base_unit: string }
  period: { from: string | null; to: string | null }
  opening_balance: number
  opening_avg_cost: number
  movements: Movement[]
  total_in: number
  total_out: number
  total_value_in: number
  total_value_out: number
  closing_balance: number
  closing_avg_cost: number
}

export default function StockCardHppDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string
  const initialWarehouseId = searchParams.get('warehouseId') || '1'

  const [data, setData] = useState<StockCardHpp | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(initialWarehouseId)
  const [from, setFrom] = useState(searchParams.get('from') || '')
  const [to, setTo] = useState(searchParams.get('to') || '')
  const [loading, setLoading] = useState(true)
  const [autoLoaded, setAutoLoaded] = useState(false)

  useEffect(() => { loadWarehouses() }, [])

  useEffect(() => {
    if (!autoLoaded && from && to && selectedWarehouse) {
      setAutoLoaded(true)
      load()
    }
  }, [autoLoaded, from, to, selectedWarehouse])

  const loadWarehouses = async () => {
    try {
      const res = await fetch('/api/gudang')
      if (res.ok) {
        const data = await res.json()
        const whList = data?.rows || data || []
        const active = whList.filter((w: any) => w.is_active && !w.isdelete)
        setWarehouses(active)
      }
    } catch (e) {
      console.error('Error loading warehouses:', e)
    } finally {
      setLoading(false)
    }
  }

  const load = async () => {
    try {
      setLoading(true)
      const url = `/api/stock-card-hpp?ingredientId=${id}&warehouseId=${selectedWarehouse}&from=${from}&to=${to}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setData(json)
      const q = new URLSearchParams()
      q.set('warehouseId', selectedWarehouse)
      if (from) q.set('from', from)
      if (to) q.set('to', to)
      router.replace(`/stock-hpp/${id}?${q.toString()}`)
    } catch (e) {
      console.error('Error loading stock card HPP:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-6">Loading...</div>

  if (!data) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-800 transition-colors">← Kembali</button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Kartu Stok HPP</h1>
              <p className="text-sm text-slate-600">Pilih gudang dan isi tanggal, lalu klik Tampilkan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Gudang:</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm min-w-[200px]"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dari Tanggal</label>
              <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sampai Tanggal</label>
              <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <button onClick={load} disabled={!from || !to || !selectedWarehouse} className="w-full px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark disabled:opacity-50 text-sm font-semibold">Tampilkan</button>
            </div>
          </div>
        </div>
        <div className="text-sm text-slate-600">Silakan isi tanggal lalu klik Tampilkan untuk melihat detail kartu stok HPP.</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Kartu Stok HPP</h1>
            <p className="text-sm text-slate-600">{data.ingredient.code} - {data.ingredient.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Gudang:</label>
          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value)
              const q = new URLSearchParams()
              q.set('warehouseId', e.target.value)
              if (from) q.set('from', from)
              if (to) q.set('to', to)
              router.replace(`/stock-hpp/${id}?${q.toString()}`)
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm min-w-[200px]"
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
          <div className="text-xs text-teal-primary mb-1 font-semibold">Total Nilai Masuk</div>
          <div className="text-xl font-bold text-teal-primary">{formatCurrency(data.total_value_in)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
          <div className="text-xs text-red-600 mb-1 font-semibold">Total Nilai Keluar</div>
          <div className="text-xl font-bold text-red-600">{formatCurrency(data.total_value_out)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
          <div className="text-xs text-slate-600 mb-1 font-semibold">Nilai Saldo Akhir</div>
          <div className="text-xl font-bold text-teal-primary">{formatCurrency(data.closing_balance * data.closing_avg_cost)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-teal-primary text-white">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold">Tanggal</th>
                <th className="px-3 py-3 text-left text-xs font-semibold">Ref</th>
                <th className="px-3 py-3 text-left text-xs font-semibold">Keterangan</th>
                <th className="px-3 py-3 text-right text-xs font-semibold">Masuk</th>
                <th className="px-3 py-3 text-right text-xs font-semibold">Keluar</th>
                <th className="px-3 py-3 text-right text-xs font-semibold">Saldo</th>
                <th className="px-3 py-3 text-right text-xs font-semibold">HPP</th>
                <th className="px-3 py-3 text-right text-xs font-semibold">Nilai Masuk</th>
                <th className="px-3 py-3 text-right text-xs font-semibold">Nilai Keluar</th>
                <th className="px-3 py-3 text-right text-xs font-semibold">Saldo Nilai</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance Row */}
              <tr className="bg-slate-50 border-b-2 border-slate-300">
                <td className="px-3 py-2 text-xs text-slate-600" colSpan={5}><strong>Saldo Awal</strong></td>
                <td className="px-3 py-2 text-xs text-right font-bold text-slate-800">{data.opening_balance.toLocaleString('id-ID')}</td>
                <td className="px-3 py-2 text-xs text-right">{formatCurrency(data.opening_avg_cost)}</td>
                <td className="px-3 py-2 text-xs text-right">-</td>
                <td className="px-3 py-2 text-xs text-right">-</td>
                <td className="px-3 py-2 text-xs text-right font-semibold">{formatCurrency(data.opening_balance * data.opening_avg_cost)}</td>
              </tr>

              {data.movements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-sm">Tidak ada pergerakan dalam periode ini</td>
                </tr>
              ) : (
                data.movements.map((m) => (
                  <tr key={m.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs text-slate-700">{new Date(m.created_at).toLocaleDateString('id-ID')}</td>
                    <td className="px-3 py-2 text-xs text-teal-primary font-medium">{m.reference_number || (m.reference_type === 'initial_stock' ? `${m.reference_type} #${m.reference_id}` : '-')}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{getKeterangan(m)}</td>
                    <td className="px-3 py-2 text-xs text-right text-teal-primary font-semibold">{m.in_qty > 0 ? m.in_qty.toLocaleString('id-ID') : '-'}</td>
                    <td className="px-3 py-2 text-xs text-right text-red-600 font-semibold">{m.out_qty > 0 ? m.out_qty.toLocaleString('id-ID') : '-'}</td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-slate-800">{m.balance.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2 text-xs text-right">{formatCurrency(m.hpp)}</td>
                    <td className="px-3 py-2 text-xs text-right text-teal-primary font-semibold">{m.value_in > 0 ? formatCurrency(m.value_in) : '-'}</td>
                    <td className="px-3 py-2 text-xs text-right text-red-700 font-semibold">{m.value_out > 0 ? formatCurrency(m.value_out) : '-'}</td>
                    <td className="px-3 py-2 text-xs text-right font-semibold">{formatCurrency(m.balance * m.hpp)}</td>
                  </tr>
                ))
              )}

              {/* Closing Summary Row */}
              <tr className="bg-slate-50 border-t-2 border-slate-300">
                <td className="px-3 py-2 text-xs text-slate-600" colSpan={5}><strong>Saldo Akhir</strong></td>
                <td className="px-3 py-2 text-xs text-right font-bold text-slate-800">{data.closing_balance.toLocaleString('id-ID')}</td>
                <td className="px-3 py-2 text-xs text-right">{formatCurrency(data.closing_avg_cost)}</td>
                <td className="px-3 py-2 text-xs text-right font-bold text-teal-primary">{formatCurrency(data.total_value_in)}</td>
                <td className="px-3 py-2 text-xs text-right font-bold text-red-700">{formatCurrency(data.total_value_out)}</td>
                <td className="px-3 py-2 text-xs text-right font-bold text-blue-700">{formatCurrency(data.closing_balance * data.closing_avg_cost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
