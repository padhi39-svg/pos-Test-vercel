"use client"
import BarangForm, { BarangFormData } from '@/components/barang/BarangForm'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import PageLoading from '@/components/ui/PageLoading'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { showSuccess, showError, CrudMessages, CrudErrors } from '@/lib/notification'
import { formatInputOnChange, parseInputNumber } from '@/lib/regionalNumber'

export default function BarangEditPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [priceNew, setPriceNew] = useState<string>('')
  const [dateNew, setDateNew] = useState<string>(new Date().toISOString().slice(0, 10))
  const [submittingPrice, setSubmittingPrice] = useState(false)

  const returnQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('return') || '' : ''

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

  const latestPrice = item?.prices?.[0]

  const onSubmit = async (data: BarangFormData) => {
    const payload = {
      code: data.code,
      name: data.name,
      kategoriId: data.kategoriId ?? null,
      spesifikasiId: data.spesifikasiId ?? null,
      merkId: data.merkId ?? null,
      hpp: data.hpp,
      jenis: data.jenis,
      aktif: data.aktif,
      tampilMenu: data.tampilMenu,
      accountId: data.accountId ?? null,
      units: data.units,
      prices: [{ price: data.price, effectiveDate: data.effectiveDate }],
      photoUrl: (data as any).photoUrl ?? item?.photoUrl ?? null,
    }
    const res = await fetch(`/api/barang/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showError(err?.error || CrudErrors.updateFailed('barang'))
      throw new Error('Save failed')
    }
    showSuccess(CrudMessages.updated('barang'))
  }

  if (loading) return <PageLoading />
  if (!item) return <div className="text-slate-500">Data tidak ditemukan.</div>

  return (
    <div className="space-y-4">
      <BarangForm
        title="Ubah Barang"
        basePath="/barang/menu"
        currentId={id}
        initial={{
          ...item,
          price: latestPrice?.price ?? 0,
          effectiveDate: latestPrice?.effectiveDate ?? new Date().toISOString().slice(0, 10),
        }}
        onSubmit={onSubmit}
      />

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
              {item.prices?.length > 0 ? (
                item.prices.map((p: any, idx: number) => (
                  <tr key={idx} className="border-t hover:bg-teal-bg/50">
                    <td className="px-1" style={{ height: 28, verticalAlign: 'middle' }}>Rp {p.price?.toLocaleString('id-ID')}</td>
                    <td className="px-1" style={{ height: 28, verticalAlign: 'middle' }}>{p.effectiveDate}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="px-1 text-center text-slate-500" style={{ height: 28, verticalAlign: 'middle' }}>Belum ada riwayat harga</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-600 mb-1">Harga Baru (Rp)</div>
            <Input
              type="text"
              value={priceNew}
              onChange={(e) => setPriceNew(formatInputOnChange(e.target.value))}
              placeholder="0"
            />
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">Tanggal Berlaku</div>
            <Input type="date" value={dateNew} onChange={(e) => setDateNew(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={submittingPrice || !priceNew}
            onClick={async () => {
              if (!priceNew || submittingPrice) return
              setSubmittingPrice(true)
              try {
                const res = await fetch(`/api/barang/${id}/prices`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ price: parseInputNumber(priceNew), effectiveDate: dateNew }),
                })
                if (!res.ok) throw new Error('Gagal menambah harga')
                showSuccess('Harga berhasil ditambahkan')
                setPriceNew('')
                setDateNew(new Date().toISOString().slice(0, 10))
                const reload = await fetch(`/api/barang/${id}`)
                if (reload.ok) setItem(await reload.json())
              } catch (e: any) {
                showError(e?.message || 'Gagal menambah harga')
              } finally {
                setSubmittingPrice(false)
              }
            }}
          >
            {submittingPrice ? 'Menyimpan...' : '+ Tambah Riwayat Harga'}
          </Button>
        </div>
      </div>
    </div>
  )
}
