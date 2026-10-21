"use client"
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import Input from '@/components/ui/Input'
import { useSort } from '@/lib/useSort'
import ActionIcons from '@/components/ActionIcons'

export default function PeriodeListPage() {
  const [items, setItems] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadPeriode = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/periode')
      if (!response.ok) throw new Error('Failed to load periode')
      const data = await response.json()
      console.log('Loaded periode from SQLite:', data)
      // Map snake_case fields from API to camelCase for UI consumption
      const mapped = (Array.isArray(data) ? data : []).map((r: any) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        startDate: r.startDate,
        endDate: r.endDate,
        isActive: !!r.isActive,
      }))
      setItems(mapped)
    } catch (error) {
      console.error('Error loading periode:', error)
      alert('Gagal memuat data periode')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    loadPeriode()
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return items.filter((i) =>
      !q || i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
    )
  }, [items, query])

  const { sorted, sortKey, sortOrder, toggleSort } = useSort<any>(filtered, 'name', 'asc')
  const indicator = (key: any) => sortKey === key ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'

  const onDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus periode ini?')) return
    try {
      const response = await fetch(`/api/periode/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete periode')
      await loadPeriode() // Refresh data
    } catch (error) {
      console.error('Error deleting periode:', error)
      alert('Gagal menghapus periode')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Master Periode</h1>
          <p className="text-slate-500 text-xs mt-1">Kelola periode akuntansi</p>
        </div>
        <Link href="/periode/new" className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Tambah</Link>
      </div>

      <div className="container-card p-3">
        <div className="flex items-center gap-3 mb-3">
          <Input placeholder="Cari kode/nama..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('code')}>
                    Kode <span>{indicator('code')}</span>
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('name')}>
                    Nama <span>{indicator('name')}</span>
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('startDate')}>
                    Tanggal Awal <span>{indicator('startDate')}</span>
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('endDate')}>
                    Tanggal Akhir <span>{indicator('endDate')}</span>
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('isActive')}>
                    Status <span>{indicator('isActive')}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">Belum ada data</td>
                </tr>
              ) : (
                sorted.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{it.code}</td>
                    <td className="px-3 py-2">{it.name}</td>
                    <td className="px-3 py-2">{it.startDate}</td>
                    <td className="px-3 py-2">{it.endDate}</td>
                    <td className="px-3 py-2">{it.isActive ? 'Buka' : 'Tutup'}</td>
                    <td className="px-3 py-2 text-right">
                      <ActionIcons
                        viewHref={`/periode/${it.id}`}
                        editHref={`/periode/${it.id}/edit`}
                      />
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
