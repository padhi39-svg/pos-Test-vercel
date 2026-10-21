"use client"
import { Suspense, useState, useEffect } from 'react'

type ReconcileStatus = {
  status: {
    totalPurchases: number
    totalSales: number
    totalMovements: number
    itemsWithStock: number
  }
  needsReconciliation: boolean
  stockSample: Array<{
    code: string
    name: string
    jenis: number
    current_stock: number
  }>
}

function StockReconcileContent() {
  const [status, setStatus] = useState<ReconcileStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [reconciling, setReconciling] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/stock/reconcile')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch (error) {
      console.error('Error loading status:', error)
    } finally {
      setLoading(false)
    }
  }

  const runReconciliation = async () => {
    if (!confirm('Apakah Anda yakin ingin menjalankan stock reconciliation?\n\nProses ini akan:\n1. Menghapus semua data stock movements dan balance yang ada\n2. Membuat ulang dari data pembelian dan penjualan\n3. Memperbarui stok semua barang')) {
      return
    }

    try {
      setReconciling(true)
      setResult(null)
      
      const res = await fetch('/api/stock/reconcile', {
        method: 'POST'
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setResult(data)
        // Reload status after reconciliation
        await loadStatus()
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error running reconciliation:', error)
      alert('Error running reconciliation')
    } finally {
      setReconciling(false)
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Stock Reconciliation</h1>
        <p className="text-sm text-slate-600 mt-1">
          Perbaiki stok yang belum terekap dari pembelian dan penjualan
        </p>
      </div>

      {/* Status Card */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Status Saat Ini</h2>
        
        {status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{status.status.totalPurchases}</div>
              <div className="text-sm text-blue-700">Total Pembelian</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{status.status.totalSales}</div>
              <div className="text-sm text-green-700">Total Penjualan</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{status.status.totalMovements}</div>
              <div className="text-sm text-purple-700">Stock Movements</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{status.status.itemsWithStock}</div>
              <div className="text-sm text-orange-700">Items dengan Stok</div>
            </div>
          </div>
        )}

        {status?.needsReconciliation && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <div className="text-yellow-600 mr-3">⚠️</div>
              <div>
                <div className="font-medium text-yellow-800">Reconciliation Diperlukan</div>
                <div className="text-sm text-yellow-700">
                  Ada transaksi yang belum terekap dalam stock movements. Jalankan reconciliation untuk memperbaiki stok.
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={runReconciliation}
          disabled={reconciling}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            reconciling
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {reconciling ? '🔄 Memproses...' : '🔧 Jalankan Stock Reconciliation'}
        </button>
      </div>

      {/* Result Card */}
      {result && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Hasil Reconciliation</h2>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <div className="text-green-600 mr-3">✅</div>
              <div>
                <div className="font-medium text-green-800">{result.message}</div>
                <div className="text-sm text-green-700 mt-1">
                  Diproses: {result.summary.purchaseItems} item pembelian, {result.summary.saleItems} item penjualan
                </div>
              </div>
            </div>
          </div>

          {result.stockSummary && result.stockSummary.length > 0 && (
            <div>
              <h3 className="font-medium text-slate-800 mb-2">Sample Stok Setelah Reconciliation:</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Kode</th>
                      <th className="px-3 py-2 text-left">Nama</th>
                      <th className="px-3 py-2 text-right">Stok</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.stockSummary.map((item: any, index: number) => (
                      <tr key={index} className="border-t">
                        <td className="px-3 py-2 font-mono">{item.code}</td>
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {item.current_stock.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current Stock Sample */}
      {status?.stockSample && status.stockSample.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Sample Stok Saat Ini</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Kode</th>
                  <th className="px-3 py-2 text-left">Nama</th>
                  <th className="px-3 py-2 text-center">Jenis</th>
                  <th className="px-3 py-2 text-right">Stok</th>
                </tr>
              </thead>
              <tbody>
                {status.stockSample.map((item, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-3 py-2 font-mono">{item.code}</td>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.jenis === 1 ? 'bg-blue-100 text-blue-800' : item.jenis === 2 ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {item.jenis === 1 ? 'Barang Jadi' : item.jenis === 2 ? 'Bahan Baku' : 'Barang Setengah Jadi'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      <span className={item.current_stock < 0 ? 'text-red-600' : 'text-slate-800'}>
                        {item.current_stock.toLocaleString('id-ID')}
                      </span>
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

export default function StockReconcilePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <StockReconcileContent />
    </Suspense>
  )
}
