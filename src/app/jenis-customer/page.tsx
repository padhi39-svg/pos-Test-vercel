"use client"

import { useEffect, useState } from 'react'
import MasterList from '@/components/master/MasterList'
import { showSuccess, showError } from '@/lib/notification'

export default function JenisCustomerListPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const basePath = '/jenis-customer'

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/jenis-customer')
      const data = res.ok ? await res.json() : []
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="p-3">
        <div className="bg-white rounded-lg shadow-sm p-4 text-center text-sm text-slate-600">Memuat data jenis customer...</div>
      </div>
    )
  }

  return (
    <div className="p-3">
      <MasterList
        title="Master Jenis Customer"
        basePath={basePath}
        items={items}
        onDelete={async (id: number) => {
          if (!confirm('Hapus jenis customer ini?')) return
          const res = await fetch(`/api/jenis-customer/${id}`, { method: 'DELETE' })
          if (!res.ok) {
            showError('Gagal menghapus jenis customer')
          } else {
            showSuccess('Jenis customer berhasil dihapus')
            await load()
          }
        }}
      />
    </div>
  )
}
