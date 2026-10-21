"use client"

import MasterList from '@/components/master/MasterList'
import { useEffect, useState } from 'react'

export default function UsersPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/users')
        const data = res.ok ? await res.json() : []
        setItems(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error('Load users failed', e)
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="p-3">
      <MasterList
        title="Master User"
        basePath="/users"
        items={items}
        columns={[
          { key: 'code', label: 'Kode' },
          { key: 'name', label: 'Nama' },
          { key: 'level_name', label: 'Level' },
        ]}
        onDelete={async (id: number) => {
          if (!confirm('Hapus user ini?')) return
          const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
          if (res.ok) {
            setItems(prev => prev.filter((x) => x.id !== id))
          } else {
            alert('Gagal menghapus user')
          }
        }}
      />
    </div>
  )
}
