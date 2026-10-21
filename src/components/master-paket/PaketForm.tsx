"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import BarangPickerModal, { type BarangLite } from '../BarangPickerModal'

type PaketItem = {
  barangId: number
  barangCode: string
  barangName: string
  quantity: number
  hpp?: number
}

type Props = {
  title: string
  initial?: {
    kode?: string
    nama?: string
    hargaJual?: number
    aktif?: boolean
    items?: PaketItem[]
  }
  onSubmit: (data: any) => Promise<void>
  readonly?: boolean
  currentId?: number
}

export default function PaketForm({ title, initial, onSubmit, readonly, currentId }: Props) {
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''
  const [kode, setKode] = useState(initial?.kode || '')
  const [nama, setNama] = useState(initial?.nama || '')
  const [hargaJual, setHargaJual] = useState(initial?.hargaJual || 0)
  const [aktif, setAktif] = useState(initial?.aktif ?? true)
  const [items, setItems] = useState<PaketItem[]>(initial?.items || [])
  const [loading, setLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const addItem = async (barang: BarangLite) => {
    if (items.some(i => i.barangId === barang.id)) return
    try {
      const res = await fetch(`/api/barang/${barang.id}`)
      if (!res.ok) throw new Error()
      const detail = await res.json()
      setItems([...items, {
        barangId: barang.id,
        barangCode: barang.code,
        barangName: barang.name,
        quantity: 1,
        hpp: detail.hpp,
      }])
    } catch {
      setItems([...items, {
        barangId: barang.id,
        barangCode: barang.code,
        barangName: barang.name,
        quantity: 1,
        hpp: 0,
      }])
    }
    setPickerOpen(false)
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateQty = (idx: number, qty: number) => {
    const updated = [...items]
    updated[idx] = { ...updated[idx], quantity: Math.max(0.01, qty) }
    setItems(updated)
  }

  const handleSubmit = async () => {
    if (loading) return
    if (!nama.trim()) { alert('Nama paket harus diisi'); return }
    if (items.length === 0) { alert('Paket harus memiliki minimal 1 item'); return }
    setLoading(true)
    try {
      await onSubmit({
        kode,
        nama: nama.trim(),
        hargaJual,
        aktif,
        items: items.map(i => ({ barangId: i.barangId, quantity: i.quantity })),
      })
    } catch (e: any) {
      alert(e?.message || 'Gagal menyimpan')
    } finally {
      setLoading(false)
    }
  }

  const totalHpp = items.reduce((sum, i) => sum + (Number(i.hpp) || 0) * i.quantity, 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-slate-500 text-xs mt-1">{readonly ? 'Detail paket bundling barang jadi' : 'Lengkapi data paket lalu simpan'}</p>
      </div>

      <div className="container-card p-3 text-xs space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Kode Paket</span>
            <input
              className="w-full border border-slate-300 rounded-pill px-3 py-1.5 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary disabled:bg-slate-100 disabled:text-slate-500"
              value={kode}
              onChange={e => setKode(e.target.value.toUpperCase())}
              placeholder="Otomatis jika kosong"
              disabled={readonly}
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Nama Paket *</span>
            <input
              className="w-full border border-slate-300 rounded-pill px-3 py-1.5 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary disabled:bg-slate-100 disabled:text-slate-500"
              value={nama}
              onChange={e => setNama(e.target.value)}
              disabled={readonly}
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Harga Jual</span>
            <input
              type="number"
              className="w-full border border-slate-300 rounded-pill px-3 py-1.5 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary disabled:bg-slate-100 disabled:text-slate-500"
              value={hargaJual}
              onChange={e => setHargaJual(Number(e.target.value) || 0)}
              disabled={readonly}
            />
          </label>
          {!readonly && (
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Aktif</span>
              <input type="checkbox" checked={aktif} onChange={e => setAktif(e.target.checked)} className="rounded" />
            </label>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600">Item Barang</span>
            {!readonly && (
              <button onClick={() => setPickerOpen(true)} className="px-2 py-1 rounded-pill border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg text-xs">
                + Tambah Item
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-xs text-slate-400 p-3 border border-slate-200 rounded-lg">Belum ada item, tambah barang ke paket</div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
                    <th className="px-2 py-1 text-left">Barang</th>
                    <th className="px-2 py-1 text-center w-20">Qty</th>
                    <th className="px-2 py-1 text-right w-28">HPP</th>
                    <th className="px-2 py-1 text-right w-28">Subtotal</th>
                    {!readonly && <th className="px-2 py-1 text-center w-16">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-t border-slate-200 hover:bg-teal-bg/50">
                      <td className="px-2 py-1">
                        <div className="font-medium">{it.barangCode}</div>
                        <div className="text-slate-500">{it.barangName}</div>
                      </td>
                      <td className="px-2 py-1 text-center">
                        {readonly ? it.quantity : (
                          <input
                            type="number"
                            className="w-16 text-center border border-slate-300 rounded-pill px-1 py-0.5 text-xs outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
                            value={it.quantity}
                            onChange={e => updateQty(idx, Number(e.target.value) || 0)}
                            min={0.01}
                            step={0.01}
                          />
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">Rp {Number(it.hpp || 0).toLocaleString('id-ID')}</td>
                      <td className="px-2 py-1 text-right font-medium">Rp {((Number(it.hpp) || 0) * it.quantity).toLocaleString('id-ID')}</td>
                      {!readonly && (
                        <td className="px-2 py-1 text-center">
                          <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">Hapus</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {totalHpp > 0 && (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-teal-bg/30">
                      <td colSpan={3} className="px-2 py-1 text-right">Total HPP Komponen:</td>
                      <td className="px-2 py-1 text-right font-medium">Rp {totalHpp.toLocaleString('id-ID')}</td>
                      {!readonly && <td></td>}
                    </tr>
                    <tr className="bg-teal-bg/30">
                      <td colSpan={3} className="px-2 py-1 text-right">Harga Jual Paket:</td>
                      <td className="px-2 py-1 text-right font-medium">Rp {hargaJual.toLocaleString('id-ID')}</td>
                      {!readonly && <td></td>}
                    </tr>
                    <tr className="bg-teal-bg/30">
                      <td colSpan={3} className="px-2 py-1 text-right">Laba Kotor:</td>
                      <td className={`px-2 py-1 text-right font-medium ${hargaJual >= totalHpp ? 'text-green-600' : 'text-red-600'}`}>
                        Rp {(hargaJual - totalHpp).toLocaleString('id-ID')}
                      </td>
                      {!readonly && <td></td>}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {!readonly ? (
            <>
              <Button variant="outline" onClick={() => router.push('/master-paket?' + returnQuery)}>Batal</Button>
              <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Menyimpan...' : (currentId ? 'Simpan Perubahan' : 'Simpan')}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => router.push('/master-paket?' + returnQuery)}>Kembali</Button>
              {currentId && <Button onClick={() => router.push(`/master-paket/${currentId}/edit?return=${encodeURIComponent(returnQuery)}`)}>Edit</Button>}
            </>
          )}
        </div>
      </div>

      <BarangPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addItem} />
    </div>
  )
}
