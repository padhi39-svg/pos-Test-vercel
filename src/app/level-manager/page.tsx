"use client"

import { useEffect, useState } from 'react'
import MasterList from '@/components/master/MasterList'

export default function LevelManagerListPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/level-manager')
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const onDelete = async (id: number) => {
    if (!confirm('Hapus level ini? (soft delete)')) return
    const res = await fetch(`/api/level-manager/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(()=>({}))
      alert(d?.error || 'Gagal menghapus')
      return
    }
    await loadData()
  }

  const cols = [
    { key: 'code', label: 'Kode' },
    { key: 'name', label: 'Nama' },
    { key: 'permissions_count', label: 'Jumlah Izin', className: 'text-center' },
  ]

  return (
    <div className="p-4">
      <MasterList title="Master Level Manager" basePath="/level-manager" items={items} onDelete={onDelete} columns={cols as any} />
    </div>
  )
}
