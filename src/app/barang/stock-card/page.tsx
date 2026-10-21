"use client"
import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'

type StockMovement = {
  id: number
  movement_type: 'in' | 'out'
  in_qty: number
  out_qty: number
  balance: number
  created_at: string
  reference_type?: string | null
  reference_id?: number | null
  reference_number?: string | null
  notes?: string | null
}

export default function StockCardPage() {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [baseUnit, setBaseUnit] = useState<string>('unit')
  const [openingBalance, setOpeningBalance] = useState<number>(0)
  const [sortKey, setSortKey] = useState<'date' | 'ref' | 'notes'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState(true)
  const [barangList, setBarangList] = useState<any[]>([])
  const [gudangList, setGudangList] = useState<any[]>([])
  const [selectedBarang, setSelectedBarang] = useState<number | null>(null)
  const [selectedGudang, setSelectedGudang] = useState<number | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    (async () => {
      await loadBarang()
      await loadGudang()
      // Auto-select first barang & gudang to avoid empty state
      setSelectedBarang((prev) => prev ?? (barangList[0]?.id ?? null))
      setSelectedGudang((prev) => prev ?? (gudangList[0]?.id ?? null))
      loadMovements()
    })()
  }, [])

  const loadBarang = async () => {
    try {
      const res = await fetch('/api/barang')
      if (res.ok) {
        const data = await res.json()
        // Tampilkan semua jenis barang (jadi + baku) dan yang aktif
        setBarangList(data.filter((b: any) => !b.isdelete))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadGudang = async () => {
    try {
      const res = await fetch('/api/gudang')
      if (res.ok) {
        const data = await res.json()
        const gList = data?.rows || data || []
        setGudangList(gList.filter((g: any) => !g.isdelete))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadMovements = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const barang = selectedBarang ? barangList.find(b => b.id === selectedBarang) : null
      const gudang = selectedGudang ? gudangList.find(g => g.id === selectedGudang) : null
      if (barang?.id) params.set('ingredientId', String(barang.id))
      if (gudang?.id) params.set('warehouseId', String(gudang.id))
      if (startDate) params.set('from', startDate)
      if (endDate) params.set('to', endDate)
      const url = `/api/stock-card?${params.toString()}`
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        setMovements(Array.isArray(json.movements) ? json.movements : [])
        setBaseUnit(json.ingredient?.base_unit || 'unit')
        setOpeningBalance(Number(json.opening_balance || 0))
      } else {
        // Jika belum pilih barang, tampilkan saldo 0 dan kosongkan pergerakan
        setMovements([])
        setOpeningBalance(0)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Sorting client-side sesuai tombol header
  const sortedMovements = [...movements].sort((a, b) => {
    if (sortKey === 'date') {
      const da = new Date(a.created_at || '').getTime()
      const db = new Date(b.created_at || '').getTime()
      return sortDir === 'asc' ? da - db : db - da
    }
    if (sortKey === 'ref') {
      const ra = (a.reference_number || '').localeCompare(b.reference_number || '')
      return sortDir === 'asc' ? ra : -ra
    }
    // notes
    const na = (a.notes || '').localeCompare(b.notes || '')
    return sortDir === 'asc' ? na : -na
  })

  // Hitung running balance berdasarkan urutan yang sedang ditampilkan
  let bal = openingBalance
  const movementsWithBalance = sortedMovements.map(m => {
    const inQty = Number(m.in_qty || 0)
    const outQty = Number(m.out_qty || 0)
    bal += inQty - outQty
    return { ...m, balance: bal }
  })

  const toggleSort = (key: 'date' | 'ref' | 'notes') => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Kartu Stok</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Barang</label>
            <select
              value={selectedBarang || ''}
              onChange={(e) => setSelectedBarang(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">Semua Barang</option>
              {barangList.map(b => (
                <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gudang</label>
            <select
              value={selectedGudang || ''}
              onChange={(e) => setSelectedGudang(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">Semua Gudang</option>
              {gudangList.map(g => (
                <option key={g.id} value={g.id}>{g.code} - {g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={loadMovements}
            className="px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark text-sm font-medium"
          >
            Tampilkan
          </button>
          <button
            onClick={() => {
              setSelectedBarang(null)
              setSelectedGudang(null)
              setStartDate('')
              setEndDate('')
              loadMovements()
            }}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-pill hover:bg-slate-300 text-sm font-medium"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* Stock Card Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-teal-primary text-white">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold cursor-pointer" onClick={() => toggleSort('date')}>Tanggal ⇅</th>
                <th className="px-3 py-3 text-left text-xs font-semibold">Kode Barang</th>
                <th className="px-3 py-3 text-left text-xs font-semibold">Nama Barang</th>
                <th className="px-3 py-3 text-left text-xs font-semibold">Gudang</th>
                <th className="px-3 py-3 text-left text-xs font-semibold">Jenis</th>
                <th className="px-3 py-3 text-right text-xs font-semibold">Masuk</th>
                <th className="px-3 py-3 text-right text-xs font-semibold">Keluar</th>
                <th className="px-3 py-3 text-right text-xs font-semibold">Saldo</th>
                <th className="px-3 py-3 text-left text-xs font-semibold">Satuan</th>
                <th className="px-3 py-3 text-left text-xs font-semibold cursor-pointer" onClick={() => toggleSort('ref')}>Ref ⇅</th>
                <th className="px-3 py-3 text-left text-xs font-semibold cursor-pointer" onClick={() => toggleSort('notes')}>Keterangan ⇅</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-sm text-slate-500">
                    Memuat data...
                  </td>
                </tr>
              ) : movementsWithBalance.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-sm text-slate-500">
                    Belum ada pergerakan stok
                  </td>
                </tr>
              ) : (
                <>
                  {/* Saldo Awal */}
                  <tr key="opening" className="bg-slate-50">
                    <td className="px-3 py-2 text-xs">Saldo Awal</td>
                    <td className="px-3 py-2 text-xs font-mono">-</td>
                    <td className="px-3 py-2 text-xs">-</td>
                    <td className="px-3 py-2 text-xs">-</td>
                    <td className="px-3 py-2 text-xs"></td>
                    <td className="px-3 py-2 text-xs text-right font-mono">-</td>
                    <td className="px-3 py-2 text-xs text-right font-mono">-</td>
                    <td className="px-3 py-2 text-xs text-right font-mono font-semibold">{openingBalance.toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs">{baseUnit}</td>
                    <td className="px-3 py-2 text-xs">-</td>
                    <td className="px-3 py-2 text-xs text-slate-600">-</td>
                  </tr>
                  {movementsWithBalance.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs">{(m.created_at || '').slice(0,10)}</td>
                    <td className="px-3 py-2 text-xs font-mono">-</td>
                    <td className="px-3 py-2 text-xs">-</td>
                    <td className="px-3 py-2 text-xs">-</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.movement_type === 'in' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {m.movement_type === 'in' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-mono text-green-700">
                      {m.in_qty ? m.in_qty.toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-mono text-red-700">
                      {m.out_qty ? m.out_qty.toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-mono font-semibold">
                      {m.balance.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs">{baseUnit}</td>
                    <td className="px-3 py-2 text-xs">
                      {m.reference_type === 'initial_stock' && 'Saldo Awal'}
                      {m.reference_number || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs">{m.reference_number || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{m.notes || ''}</td>
                  </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        {movementsWithBalance.length > 0 && (
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-slate-700">
                Total Pergerakan: {movementsWithBalance.length} transaksi
              </span>
              <span className="font-semibold text-teal-dark">
                Saldo Akhir: {movementsWithBalance[movementsWithBalance.length - 1]?.balance.toLocaleString()} {movementsWithBalance[0]?.unit}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
