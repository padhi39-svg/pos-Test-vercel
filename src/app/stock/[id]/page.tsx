"use client"
import { useState, useEffect } from 'react'
import { useSort } from '@/lib/useSort'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/regionalNumber'

type Movement = {
  id: number
  movement_type: string
  in_qty: number
  out_qty: number
  balance: number
  reference_type: string
  reference_id: number | null
  reference_number: string | null
  notes: string
  created_at: string
}

type Warehouse = {
  id: number
  code: string
  name: string
  is_active: number
}

type StockCard = {
  ingredient: {
    id: number
    code: string
    name: string
    base_unit: string
  }
  period: {
    from: string | null
    to: string | null
  }
  opening_balance: number
  movements: Movement[]
  total_in: number
  total_out: number
  closing_balance: number
}

export default function StockCardDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string
  const warehouseId = searchParams.get('warehouseId') || '1'
  const urlSortBy = (searchParams.get('sortBy') as 'date'|'ref'|'notes'|null) || 'date'
  const urlSortDir = (searchParams.get('sortDir') as 'asc'|'desc'|null) || 'asc'

  const [stockCard, setStockCard] = useState<StockCard | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(warehouseId)
  const [loading, setLoading] = useState(true)
  const [autoLoaded, setAutoLoaded] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    // Do not auto-fill dates; prefill from URL if provided
    try {
      const qFrom = searchParams.get('from') || ''
      const qTo = searchParams.get('to') || ''
      if (qFrom) setFrom(qFrom)
      if (qTo) setTo(qTo)
    } catch {}
    loadWarehouses()
  }, [])

  // Auto-load once if from/to already provided via URL (opened from list with filters)
  useEffect(() => {
    if (!autoLoaded && from && to && selectedWarehouse) {
      setAutoLoaded(true)
      loadStockCard()
    }
  }, [autoLoaded, from, to, selectedWarehouse])

  const loadWarehouses = async () => {
    try {
      const res = await fetch('/api/gudang')
      if (res.ok) {
        const data = await res.json()
        const whList = data?.rows || data || []
        const activeWarehouses = whList.filter((w: any) => w.is_active && !w.isdelete)
        setWarehouses(activeWarehouses)
      }
    } catch (e) {
      console.error('Error loading warehouses:', e)
    } finally {
      // Allow page to render filter panel without blocking
      setLoading(false)
    }
  }

  const loadStockCard = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/stock-card?ingredientId=${id}&warehouseId=${selectedWarehouse}&from=${from}&to=${to}`)
      if (res.ok) {
        const data = await res.json()
        setStockCard(data)
        // reflect current filters into URL
        const q = new URLSearchParams()
        q.set('warehouseId', selectedWarehouse)
        if (from) q.set('from', from)
        if (to) q.set('to', to)
        router.replace(`/stock/${id}?${q.toString()}`)
      } else {
        console.error('Failed to load stock card')
      }
    } catch (e) {
      console.error('Error loading stock card:', e)
    } finally {
      setLoading(false)
    }
  }

  // Sorting for movements (default: ASC by created_at so newest at bottom)
  const safeRows: Movement[] = ((stockCard?.movements ?? []) as Movement[]).filter(Boolean)
  // Stable key functions to allow toggle on repeated clicks
  const dateKeyFn = (m: Movement) => {
    const t = Date.parse(m?.created_at || '')
    return Number.isNaN(t) ? 0 : t
  }
  const refKeyFn = (m: Movement) => (m.reference_number || `${m.reference_type || ''} ${m.reference_id || ''}`)
  const notesKeyFn = (m: Movement) => (m.notes || '')
  const { sorted: sortedMovements, sortKey, sortOrder, toggleSort, setSortKey, setSortOrder } = useSort<Movement>(
    safeRows,
    dateKeyFn,
    'asc'
  )
  const [sortId, setSortId] = useState<'date'|'ref'|'notes'>(urlSortBy)
  // Initialize from URL sort
  useEffect(() => {
    setSortOrder(urlSortDir)
    if (urlSortBy === 'date') setSortKey(dateKeyFn)
    if (urlSortBy === 'ref') setSortKey(refKeyFn)
    if (urlSortBy === 'notes') setSortKey(notesKeyFn)
    setSortId(urlSortBy)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const indicator = (idKey: 'date'|'ref'|'notes') => (sortId === idKey ? (sortOrder === 'asc' ? '▲' : '▼') : '↕')

  const updateUrlSort = (by: 'date'|'ref'|'notes', dir: 'asc'|'desc') => {
    const q = new URLSearchParams()
    q.set('warehouseId', selectedWarehouse)
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    q.set('sortBy', by)
    q.set('sortDir', dir)
    router.replace(`/stock/${id}?${q.toString()}`)
  }

  const onToggleHeader = (by: 'date'|'ref'|'notes') => {
    if (by === 'date') toggleSort(dateKeyFn)
    if (by === 'ref') toggleSort(refKeyFn)
    if (by === 'notes') toggleSort(notesKeyFn)
    const nextDir = sortId === by ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc'
    setSortId(by)
    updateUrlSort(by, nextDir)
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!stockCard) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
              ← Kembali
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Kartu Stok</h1>
              <p className="text-sm text-slate-600">Pilih gudang dan isi tanggal, lalu klik Tampilkan</p>
            </div>
          </div>
        </div>
        {/* Filter Periode */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
              />
            </div>
            <div>
              <button
                onClick={loadStockCard}
                disabled={!from || !to || !selectedWarehouse}
                className="w-full px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-sm font-semibold disabled:opacity-50"
              >
                Tampilkan
              </button>
            </div>
          </div>
        </div>
        <div className="text-sm text-slate-600">Silakan isi tanggal lalu klik Tampilkan untuk melihat detail kartu stok.</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            ← Kembali
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Kartu Stok</h1>
            <p className="text-sm text-slate-600">
              {stockCard?.ingredient.code} - {stockCard?.ingredient.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Gudang:</label>
          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value)
              // Update URL parameter
              const newUrl = `/stock/${id}?warehouseId=${e.target.value}`
              router.replace(newUrl)
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary min-w-[200px]"
          >
            {warehouses.map(warehouse => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} - {warehouse.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Periode */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
            />
          </div>
          <div>
            <button
              onClick={loadStockCard}
              className="w-full px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-sm font-semibold"
            >
              Tampilkan
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
          <div className="text-xs text-teal-primary mb-1 font-semibold">Total Masuk</div>
          <div className="text-xl font-bold text-teal-primary">
            {stockCard.total_in.toLocaleString('id-ID')} {stockCard.ingredient.base_unit}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
          <div className="text-xs text-red-600 mb-1 font-semibold">Total Keluar</div>
          <div className="text-xl font-bold text-red-600">
            {stockCard.total_out.toLocaleString('id-ID')} {stockCard.ingredient.base_unit}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
          <div className="text-xs text-slate-600 mb-1 font-semibold">Saldo Akhir</div>
          <div className="text-xl font-bold text-teal-primary">
            {stockCard.closing_balance.toLocaleString('id-ID')} {stockCard.ingredient.base_unit}
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-teal-primary text-white">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => onToggleHeader('date')}>
                    Tanggal <span>{indicator('date')}</span>
                  </button>
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => onToggleHeader('ref')}>
                    Ref <span>{indicator('ref')}</span>
                  </button>
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => onToggleHeader('notes')}>
                    Keterangan <span>{indicator('notes')}</span>
                  </button>
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('in_qty' as any)}>
                    Masuk <span>{indicator('in_qty' as any)}</span>
                  </button>
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('out_qty' as any)}>
                    Keluar <span>{indicator('out_qty' as any)}</span>
                  </button>
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('balance' as any)}>
                    Saldo <span>{indicator('balance' as any)}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance Row */}
              <tr className="bg-slate-50 border-b-2 border-slate-300">
                <td className="px-3 py-2 text-xs text-slate-600" colSpan={3}>
                  <strong>Saldo Awal</strong>
                </td>
                <td className="px-3 py-2 text-xs text-right">-</td>
                <td className="px-3 py-2 text-xs text-right">-</td>
                <td className="px-3 py-2 text-xs text-right font-bold text-slate-800">
                  {stockCard.opening_balance.toLocaleString('id-ID')}
                </td>
              </tr>

              {sortedMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                    Tidak ada pergerakan dalam periode ini
                  </td>
                </tr>
              ) : (
                sortedMovements.map((m) => (
                  <tr key={m.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {new Date(m.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-3 py-2 text-xs text-teal-primary font-medium">
                      {m.reference_number || (m.reference_type === 'initial_stock' ? `${m.reference_type} #${m.reference_id}` : '-')}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">{m.notes || '-'}</td>
                    <td className="px-3 py-2 text-xs text-right text-teal-primary font-semibold">
                      {m.in_qty > 0 ? m.in_qty.toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-red-600 font-semibold">
                      {m.out_qty > 0 ? m.out_qty.toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-slate-800">
                      {m.balance.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
