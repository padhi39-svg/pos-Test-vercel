"use client"
import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'
import SearchableSelect from '@/components/ui/SearchableSelect'

type Barang = {
  id: number
  code: string
  name: string
}

type Gudang = {
  id: number
  code: string
  name: string
  is_active: number
}

type Unit = {
  id: number
  unit: string
  ratio: number
  is_base: number
}

type StockInitial = {
  id: number
  ingredient_id: number
  warehouse_id: number
  quantity: number
  unit: string
  ingredient_code: string
  ingredient_name: string
  warehouse_code: string
  warehouse_name: string
  created_at: string
}

export default function StockInitialPage() {
  const [barangList, setBarangList] = useState<Barang[]>([])
  const [gudangList, setGudangList] = useState<Gudang[]>([])
  const [stockList, setStockList] = useState<StockInitial[]>([])
  
  const [selectedBarang, setSelectedBarang] = useState<number | null>(null)
  const [selectedGudang, setSelectedGudang] = useState<number | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [selectedUnit, setSelectedUnit] = useState<string>('')
  const [inputQuantity, setInputQuantity] = useState('')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0])
  
  const [loading, setLoading] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  const openImport = () => setShowImportModal(true)
  const closeImport = () => { setShowImportModal(false); setImportFile(null) }

  const handleImport = async () => {
    if (!importFile) {
      alert('Pilih file Excel terlebih dahulu')
      return
    }
    try {
      setImporting(true)
      const form = new FormData()
      form.append('file', importFile)
      const res = await fetch('/api/stock-initial/import', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Gagal import data')
        return
      }
      const summary = `Import selesai. Berhasil: ${data.imported}, Gagal: ${data.failed}`
      alert(summary + (data.failed ? `\n\nErrors:\n- ${data.errors.join('\n- ')}` : ''))
      await loadStockList()
      closeImport()
    } catch (e) {
      console.error('Import error:', e)
      alert('Gagal import data')
    } finally {
      setImporting(false)
    }
  }

  useEffect(() => {
    loadBarang()
    loadGudang()
    loadStockList()
  }, [])

  useEffect(() => {
    if (selectedBarang) {
      loadUnits(selectedBarang)
    } else {
      setUnits([])
      setSelectedUnit('')
    }
  }, [selectedBarang])

  // Options for SearchableSelect (search by name)
  const barangOptions = useMemo(() => {
    return barangList
      .filter((b: any) => !b.isdelete)
      .map((b: any) => ({
        value: b.id,
        label: b.code ? `${b.code} - ${b.name}` : (b.name as string),
        description: typeof b.hpp === 'number' ? `HPP: ${formatCurrency(b.hpp)}` : undefined,
      }))
  }, [barangList])

  const loadBarang = async () => {
    try {
      const res = await fetch('/api/barang')
      if (res.ok) {
        const data = await res.json()
        // Get all barang with isdelete = false
        const activeBarang = data.filter((b: any) => !b.isdelete)
        setBarangList(activeBarang)
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
        // Filter only active gudang
        const active = data.filter((g: Gudang) => g.is_active === 1)
        setGudangList(active)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadUnits = async (barangId: number) => {
    try {
      const res = await fetch(`/api/barang/${barangId}/units`)
      if (res.ok) {
        const data = await res.json()
        setUnits(data)
        // Auto-select base unit (ratio = 1)
        const baseUnit = data.find((u: Unit) => u.is_base === 1)
        if (baseUnit) {
          setSelectedUnit(baseUnit.unit)
        }
      }
    } catch (e) {
      console.error(e)
      setUnits([])
    }
  }

  const loadStockList = async () => {
    try {
      const res = await fetch('/api/stock-initial')
      if (res.ok) {
        const data = await res.json()
        setStockList(data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedBarang || !selectedGudang || !inputQuantity || !selectedUnit) {
      alert('Semua field harus diisi')
      return
    }

    const qty = parseFloat(inputQuantity)
    if (isNaN(qty) || qty < 0) {
      alert('Quantity harus berupa angka positif')
      return
    }

    // Find selected unit ratio
    const unitData = units.find(u => u.unit === selectedUnit)
    if (!unitData) {
      alert('Unit tidak valid')
      return
    }

    // Convert to base unit
    const baseUnit = units.find(u => u.is_base === 1)
    if (!baseUnit) {
      alert('Base unit tidak ditemukan')
      return
    }

    const quantityInBaseUnit = qty * unitData.ratio

    try {
      setLoading(true)
      const res = await fetch('/api/stock-initial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_id: selectedBarang,
          warehouse_id: selectedGudang,
          quantity: quantityInBaseUnit,
          unit: baseUnit.unit,
          input_quantity: qty,
          input_unit: selectedUnit,
          transaction_date: transactionDate
        })
      })

      const data = await res.json()

      if (res.ok) {
        alert(data.message || 'Saldo awal berhasil disimpan')
        // Reset form
        setSelectedBarang(null)
        setSelectedGudang(null)
        setInputQuantity('')
        setSelectedUnit('')
        setTransactionDate(new Date().toISOString().split('T')[0])
        // Reload list
        loadStockList()
      } else {
        alert(data.error || 'Gagal menyimpan saldo awal')
      }
    } catch (e) {
      console.error(e)
      alert('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus saldo awal ini?')) return

    try {
      const res = await fetch(`/api/stock-initial?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        alert('Saldo awal berhasil dihapus')
        loadStockList()
      } else {
        const data = await res.json()
        alert(data.error || 'Gagal menghapus saldo awal')
      }
    } catch (e) {
      console.error(e)
      alert('Terjadi kesalahan')
    }
  }

  

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Saldo Awal Stok</h1>
          <p className="text-sm text-slate-600 mt-1">Input saldo awal stok barang per gudang</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.open('/api/stock-initial/template', '_blank')}
            className="px-3 md:px-4 py-2 bg-teal-bg text-teal-dark rounded-pill hover:bg-teal-bg transition-colors text-xs md:text-sm"
          >
            Download Template
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm"
          >
            Import Excel
          </button>
        </div>
      </div>

      {/* Form Input */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Input Saldo Awal</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Barang */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Barang <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={barangOptions}
                value={selectedBarang}
                onChange={(v) => setSelectedBarang(typeof v === 'number' ? v : (v ? Number(v) : null))}
                placeholder="Pilih nama barang..."
                className="w-full text-xs"
              />
            </div>

            {/* Gudang */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 whitespace-nowrap">
                Gudang <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedGudang || ''}
                onChange={(e) => setSelectedGudang(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-xs"
                required
              >
                <option value="">-- Pilih Gudang --</option>
                {gudangList.map(g => (
                  <option key={g.id} value={g.id}>{g.code} - {g.name}</option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Stok Awal <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={inputQuantity}
                onChange={(e) => setInputQuantity(e.target.value)}
                placeholder="0"
                className="w-full px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-xs"
                required
              />
            </div>

            {/* Unit */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Satuan <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                disabled={!selectedBarang || units.length === 0}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary disabled:bg-slate-100 text-xs"
                required
              >
                <option value="">-- Pilih Satuan --</option>
                {units.map(u => (
                  <option key={u.id} value={u.unit}>
                    {u.unit} {u.is_base === 1 ? '(Base)' : `(1 = ${u.ratio} base)`}
                  </option>
                ))}
              </select>
              {selectedBarang && units.length === 0 && (
                <p className="text-[10px] text-red-500 mt-1">Barang ini belum memiliki satuan</p>
              )}
            </div>

            {/* Tanggal */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-xs"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary disabled:opacity-50 font-medium text-xs"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedBarang(null)
                setSelectedGudang(null)
                setInputQuantity('')
                setSelectedUnit('')
              }}
              className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-pill hover:bg-slate-300 font-medium text-xs"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* List Saldo Awal */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Daftar Saldo Awal</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gradient-to-r from-teal-primary to-teal-light text-white">
              <tr>
                <th className="px-2 py-1 text-left text-xs font-semibold">Kode Barang</th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Nama Barang</th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Gudang</th>
                <th className="px-2 py-1 text-right text-xs font-semibold">Stok</th>
                <th className="px-2 py-1 text-left text-xs font-semibold">Satuan</th>
                <th className="px-2 py-1 text-center text-xs font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {stockList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-slate-500 text-xs">
                    Belum ada saldo awal
                  </td>
                </tr>
              ) : (
                stockList.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-slate-50">
                    <td className="px-2 py-1 text-xs text-slate-700 font-mono">{item.ingredient_code}</td>
                    <td className="px-2 py-1 text-xs text-slate-700">{item.ingredient_name}</td>
                    <td className="px-2 py-1 text-xs text-slate-700 whitespace-nowrap max-w-[220px] truncate" title={item.warehouse_name}>{item.warehouse_name}</td>
                    <td className="px-2 py-1 text-xs text-right text-slate-800 font-semibold">
                      {Number(item.quantity).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1 text-xs text-slate-700">{item.unit}</td>
                    <td className="px-2 py-1 text-center">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Hapus"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="px-4 py-3 border-b font-semibold">Import Saldo Awal (Excel)</div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Pilih file Excel sesuai template. Sheet1 digunakan untuk input. Sheet2 hanya referensi.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2 bg-slate-50">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 rounded-pill bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm">Batal</button>
              <button onClick={handleImport} disabled={importing} className="px-4 py-2 rounded-pill bg-teal-primary hover:bg-teal-dark disabled:opacity-60 text-white text-sm">
                {importing ? 'Mengimpor...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
