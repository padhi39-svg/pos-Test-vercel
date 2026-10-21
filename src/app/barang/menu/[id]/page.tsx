"use client"
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import BarangForm from '@/components/barang/BarangForm'
import PageLoading from '@/components/ui/PageLoading'

export default function BarangViewPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/barang/${id}`)
        if (!res.ok) throw new Error('Failed to load barang')
        const data = await res.json()
        setItem(data)
      } catch (e) {
        console.error('Load barang by id error:', e)
        setItem(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <PageLoading />
  if (!item) return <div className="text-slate-500">Data tidak ditemukan.</div>

  const latestPrice = item.prices?.[0]

  return (
    <div className="space-y-4">
      <BarangForm
        title="Detail Barang"
        basePath="/barang/menu"
        currentId={id}
        readonly
        initial={{
          ...item,
          price: latestPrice?.price ?? 0,
          effectiveDate: latestPrice?.effectiveDate ?? new Date().toISOString().slice(0, 10),
        }}
        onSubmit={async () => {}}
      />
      {item.prices && item.prices.length > 0 && (
        <div className="container-card p-3 text-xs space-y-3">
          <h3 className="font-medium text-sm">Riwayat Harga</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="px-1" style={{ height: 28, verticalAlign: 'middle' }}>Harga</th>
                  <th className="px-1" style={{ height: 28, verticalAlign: 'middle' }}>Tanggal Berlaku</th>
                </tr>
              </thead>
              <tbody>
                {item.prices.map((p: any, idx: number) => (
                  <tr key={idx} className="border-t hover:bg-teal-bg/50">
                    <td className="px-1" style={{ height: 28, verticalAlign: 'middle' }}>Rp {p.price?.toLocaleString('id-ID')}</td>
                    <td className="px-1" style={{ height: 28, verticalAlign: 'middle' }}>{p.effectiveDate}</td>
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
