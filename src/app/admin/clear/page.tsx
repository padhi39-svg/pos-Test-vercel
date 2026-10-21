"use client"
import { Suspense, useEffect } from 'react'
import { clearAllData } from '@/lib/clearData'
import Link from 'next/link'

function AdminClearDataContent() {
  useEffect(() => {
    try {
      clearAllData()
    } catch (e) {
      console.error('Failed to clear data:', e)
    }
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Hapus Semua Data</h1>
      <p className="text-slate-600">Semua data localStorage untuk aplikasi ini telah dihapus.</p>
      <div className="flex gap-2">
        <Link
          href="/"
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          ⬅️ Kembali ke Dashboard
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium"
        >
          🔄 Reload Halaman
        </button>
      </div>
    </div>
  )
}

export default function AdminClearDataPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminClearDataContent />
    </Suspense>
  )
}
