"use client"
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import SearchableSelect from '@/components/ui/SearchableSelect'
import Textarea from '@/components/ui/Textarea'
import { Ingredient, IngredientFormData, IngredientItem } from '@/lib/ingredientStore'
import { formatCurrency } from '@/lib/regionalNumber'

export type IngredientFormProps = {
  title: string
  basePath: string
  initial?: Partial<Ingredient>
  onSubmit: (data: IngredientFormData) => void
  currentId?: number
  readonly?: boolean
}

export default function IngredientForm({
  title,
  basePath,
  initial,
  onSubmit,
  currentId,
  readonly = false,
}: IngredientFormProps) {
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''
  const [form, setForm] = useState<IngredientFormData>({
    barangJadiId: initial?.barangJadiId ?? null,
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    portion: initial?.portion ?? 1,
    items: initial?.items ?? [],
    isActive: initial?.isActive ?? true,
  })
  const [errors, setErrors] = useState<string | null>(null)
  const [allBarang, setAllBarang] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadBarang = async () => {
      try {
        const response = await fetch('/api/ingredient/lookup-barang')
        if (!response.ok) throw new Error('Failed to load barang')
        const data = await response.json()
        setAllBarang(data)
      } catch (error) {
        console.error('Error loading barang:', error)
        setErrors('Gagal memuat data barang')
      } finally {
        setLoading(false)
      }
    }
    loadBarang()
  }, [])

  const barangJadiOptions = useMemo(() => 
    allBarang.filter((b: any) => (b.jenis === 1 || b.jenis === 3) && b.aktif && !b.isdelete), [allBarang]
  )
  const barangBahanOptions = useMemo(() => 
    allBarang.filter((b: any) => (b.jenis === 2 || b.jenis === 3) && b.aktif && !b.isdelete), [allBarang]
  )

  const addIngredientItem = () => {
    setForm({
      ...form,
      items: [...form.items, { bahanBakuId: 0, quantity: 0, unitName: '', notes: '' }]
    })
  }

  const updateIngredientItem = (index: number, updates: Partial<IngredientItem>) => {
    const newItems = [...form.items]
    newItems[index] = { ...newItems[index], ...updates }
    setForm({ ...form, items: newItems })
  }

  const removeIngredientItem = (index: number) => {
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (readonly) return
    setErrors(null)
    if (!form.barangJadiId) {
      setErrors('Barang jadi wajib diisi')
      return
    }
    if (form.items.length === 0) {
      setErrors('Minimal harus ada 1 bahan baku')
      return
    }
    for (let i = 0; i < form.items.length; i++) {
      const item = form.items[i]
      if (!item.bahanBakuId || item.quantity <= 0 || !item.unitName.trim()) {
        setErrors(`Bahan baku ke-${i + 1}: Semua field wajib diisi dan quantity > 0`)
        return
      }
    }
    onSubmit(form)
  }

  const getBarangHPP = (barangId: number): number => {
    const barang = allBarang.find(b => b.id === barangId)
    return barang?.hpp || 0
  }

  const calculateSubtotal = (item: IngredientItem): number => {
    const hpp = getBarangHPP(item.bahanBakuId)
    return item.quantity * hpp
  }

  const calculateTotalCost = (): number => {
    return form.items.reduce((total, item) => total + calculateSubtotal(item), 0)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-slate-500 text-xs mt-1">{readonly ? 'Detail resep ingredient' : 'Lengkapi data resep lalu simpan'}</p>
      </div>

      <form onSubmit={readonly ? (e) => e.preventDefault() : handleSubmit} className="container-card p-3 text-xs space-y-3">
        {errors && (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs">{errors.split('\n').map((m, i) => (<div key={i}>{m}</div>))}</div>
        )}

        <div className="grid grid-cols-1 gap-3">
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Barang Jadi</span>
            <div className="flex-1">
              <SearchableSelect
                options={barangJadiOptions.map(barang => ({
                  value: barang.id,
                  label: `${barang.code} - ${barang.name}`,
                  description: `HPP: Rp ${barang.hpp.toLocaleString('id-ID')}`
                }))}
                value={form.barangJadiId}
                onChange={(value) => setForm({ ...form, barangJadiId: value as number | null })}
                placeholder="Pilih barang jadi..."
                disabled={readonly}
              />
            </div>
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Porsi</span>
            <Input
              type="number"
              min={1}
              value={form.portion}
              onChange={(e) => setForm({ ...form, portion: Number(e.target.value) })}
              placeholder="Jumlah porsi"
              disabled={readonly}
              required
            />
          </label>
          {!readonly && (
            <label className="flex items-center gap-3">
              <span className="w-28 text-slate-600 shrink-0">Aktif</span>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded"
              />
            </label>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 font-medium">Bahan Baku</span>
            {!readonly && (
              <button
                type="button"
                onClick={addIngredientItem}
                className="px-2 py-1 rounded-pill border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg text-xs"
              >+ Tambah Bahan Baku</button>
            )}
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
                  <th className="px-2 py-1 text-left">Bahan Baku</th>
                  <th className="px-2 py-1 text-center w-16">Qty</th>
                  <th className="px-2 py-1 text-center w-20">Unit</th>
                  <th className="px-2 py-1 text-right w-24">HPP</th>
                  <th className="px-2 py-1 text-right w-28">Subtotal</th>
                  <th className="px-2 py-1 text-left w-28">Catatan</th>
                  {!readonly && <th className="px-2 py-1 text-center w-16">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, index) => {
                  const selectedBarang = allBarang.find(b => b.id === item.bahanBakuId)
                  const availableUnits = selectedBarang?.units?.map(u => u.name) || []
                  const hpp = getBarangHPP(item.bahanBakuId)
                  const subtotal = calculateSubtotal(item)
                  return (
                    <tr key={index} className="border-t border-slate-200 hover:bg-teal-bg/50">
                      <td className="px-2 py-1">
                        <SearchableSelect
                          options={barangBahanOptions.map((barang: any) => ({
                            value: barang.id,
                            label: `${barang.code} - ${barang.name}`,
                            description: `HPP: ${formatCurrency(barang.hpp)} | Units: ${barang.units?.map((u: any) => u.name).join(', ') || 'N/A'}`
                          }))}
                          value={item.bahanBakuId || null}
                          onChange={(value) => updateIngredientItem(index, { bahanBakuId: value as number, unitName: '' })}
                          placeholder="Pilih bahan baku..."
                          disabled={readonly}
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        {readonly ? item.quantity : (
                          <Input
                            type="number"
                            step="any"
                            value={item.quantity === null || item.quantity === undefined ? '' : item.quantity}
                            onChange={(e) => updateIngredientItem(index, { quantity: Number(e.target.value) || 0 })}
                            onFocus={(e) => { if (item.quantity === 0) e.target.select() }}
                            placeholder="0"
                            disabled={readonly}
                            className="text-right"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <Select
                          value={item.unitName || ''}
                          onChange={(e) => updateIngredientItem(index, { unitName: e.target.value })}
                          disabled={readonly || !item.bahanBakuId || availableUnits.length === 0}
                        >
                          <option value="" disabled>
                            {!item.bahanBakuId ? 'Pilih dulu' : availableUnits.length === 0 ? 'N/A' : 'Pilih'}
                          </option>
                          {availableUnits.map((unit: string) => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2 py-1 text-right font-mono">Rp {hpp.toLocaleString('id-ID')}</td>
                      <td className="px-2 py-1 text-right font-medium">Rp {subtotal.toLocaleString('id-ID')}</td>
                      <td className="px-2 py-1">
                        <Input
                          value={item.notes || ''}
                          onChange={(e) => updateIngredientItem(index, { notes: e.target.value })}
                          placeholder="Catatan"
                          disabled={readonly}
                        />
                      </td>
                      {!readonly && (
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeIngredientItem(index)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >Hapus</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              {form.items.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-teal-bg/30">
                    <td colSpan={4} className="px-2 py-1 text-right font-medium">Total Biaya Bahan Baku</td>
                    <td className="px-2 py-1 text-right font-bold">Rp {calculateTotalCost().toLocaleString('id-ID')}</td>
                    <td colSpan={!readonly ? 2 : 1}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {form.items.length === 0 && (
            <p className="text-xs text-slate-500 italic mt-1">Belum ada bahan baku. Klik &ldquo;Tambah Bahan Baku&rdquo; untuk menambah.</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="flex items-start gap-3">
            <span className="w-28 text-slate-600 shrink-0 mt-1.5">Deskripsi</span>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Deskripsi resep (opsional)"
              disabled={readonly}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          {readonly ? (
            <>
              <Button variant="outline" onClick={() => router.push(basePath + '?' + returnQuery)}>Kembali</Button>
              {currentId && <Button onClick={() => router.push(`${basePath}/${currentId}/edit?return=${encodeURIComponent(returnQuery)}`)}>Edit</Button>}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => router.push(basePath + '?' + returnQuery)}>Batal</Button>
              <Button type="submit">Simpan</Button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
