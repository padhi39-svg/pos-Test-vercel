"use client"
import { useState } from 'react'

export default function CleanupPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleCleanupVoidMovements = async () => {
    if (!confirm('Yakin ingin menghapus semua stock movement void yang lama?\n\nIni akan menghapus baris "Void: ..." dari Kartu Stok.')) {
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/cleanup/void-movements', {
        method: 'DELETE'
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        alert(`Berhasil!\n\n${data.message}`)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error cleanup:', error)
      alert('Terjadi kesalahan saat cleanup')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Database Cleanup</h1>
        <p className="text-sm text-slate-600 mt-1">
          Utilitas untuk membersihkan data lama yang tidak diperlukan
        </p>
      </div>

      {/* Cleanup Void Movements */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              Cleanup Void Stock Movements
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Menghapus stock movement dengan <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">reference_type = &rsquo;void&rsquo;</code> yang dibuat oleh logic void lama.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-yellow-800">
                  <strong>Perhatian:</strong> Ini akan menghapus baris &ldquo;Void: Penjualan ...&rdquo; dari Kartu Stok. 
                  Stock balance tidak akan berubah karena sudah disesuaikan saat void.
                </div>
              </div>
            </div>
            <ul className="text-sm text-slate-600 space-y-1 mb-4">
              <li>✓ Menghapus baris void yang muncul di Kartu Stok</li>
              <li>✓ Membersihkan data reversal movement yang tidak diperlukan</li>
              <li>✓ Stock balance tetap akurat (tidak berubah)</li>
              <li>✓ Transaksi void tetap tercatat di tabel transactions</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCleanupVoidMovements}
            disabled={loading}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Memproses...' : 'Cleanup Void Movements'}
          </button>
          
          {result && (
            <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
              result.success 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {result.success 
                ? `✓ Berhasil menghapus ${result.deleted} movements` 
                : `✗ ${result.error}`}
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <strong>Catatan:</strong> Cleanup ini hanya perlu dilakukan sekali untuk membersihkan data void yang dibuat dengan logic lama. 
            Transaksi void yang baru (setelah update) tidak akan membuat reversal movement lagi.
          </div>
        </div>
      </div>
    </div>
  )
}
