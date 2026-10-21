"use client"
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function KategoriViewPage() {
  const router = useRouter()
  const params = useParams()
  const id = Number(params.id)
  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const returnQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('return') || '' : ''

  useEffect(() => {
    fetch(`/api/kategori/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setItem(data))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-sm text-slate-500">Memuat...</div>
  if (!item) return <div className="text-sm text-red-600">Data tidak ditemukan</div>

  const printLabel = item.print_target
    ? item.print_target.charAt(0).toUpperCase() + item.print_target.slice(1)
    : '-'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Detail Kategori</h1>
        <p className="text-slate-500 text-xs mt-1">Informasi kategori</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/barang/kategori?' + returnQuery)}>Kembali</Button>
        <Button onClick={() => router.push(`/barang/kategori/${id}/edit?return=${encodeURIComponent(returnQuery)}`)}>Edit</Button>
      </div>
      <div className="container-card p-3 text-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-center gap-3">
            <span className="w-20 text-slate-600 shrink-0">Kode</span>
            <Input value={item.code} disabled />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-20 text-slate-600 shrink-0">Nama</span>
            <Input value={item.name} disabled />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-20 text-slate-600 shrink-0">Print</span>
            <Input value={printLabel} disabled />
          </label>
        </div>
      </div>
    </div>
  )
}
