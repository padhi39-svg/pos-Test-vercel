"use client"
import { useEffect, useMemo, useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { formatInputOnChange, parseInputNumber } from '@/lib/regionalNumber'

export default function PriceHistory({ barangId }: { barangId: number }) {
  const [loading, setLoading] = useState(true)
  const [units, setUnits] = useState<{unitId:number; unitName:string; ratio:number; isSmallest:boolean; price:number; effectiveDate:string|null}[]>([])
  const [error, setError] = useState<string|null>(null)

  const [unitId, setUnitId] = useState<number|''>('')
  const [unitName, setUnitName] = useState('')
  const [priceInput, setPriceInput] = useState('')
  const [effDate, setEffDate] = useState<string>(new Date().toISOString().slice(0,10))
  const [submitting, setSubmitting] = useState(false)

  const baseUnit = useMemo(()=> units.find(u=>u.isSmallest), [units])

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/barang/${barangId}/prices`)
      if (!res.ok) throw new Error('Gagal memuat riwayat harga')
      const data = await res.json()
      setUnits(Array.isArray(data.units) ? data.units : [])
      // default select base unit
      const u = (Array.isArray(data.units) ? data.units : []).find((x:any)=>x.isSmallest) || (data.units?.[0])
      if (u) {
        setUnitId(u.unitId)
        setUnitName(u.unitName)
      }
    } catch (e:any) {
      setError(e.message || 'Load error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [barangId])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const price = parseInputNumber(priceInput)
    if (!isFinite(price) || price < 0) { setError('Harga tidak valid'); return }
    try {
      setSubmitting(true)
      const body: any = { price, effectiveDate: effDate }
      if (unitId) body.unitId = unitId
      else if (unitName) body.unitName = unitName
      const res = await fetch(`/api/barang/${barangId}/prices`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const out = await res.json()
      if (!res.ok) throw new Error(out?.error || 'Gagal menyimpan harga')
      setPriceInput('')
      await load()
      alert('Harga tersimpan (termasuk sinkron ke satuan rasio 1).')
    } catch (e:any) {
      setError(e.message || 'Gagal simpan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-slate-800">Riwayat Harga</h3>
        {loading && <span className="text-xs text-slate-500">Memuat...</span>}
      </div>

      {error && <div className="p-2 mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2">Satuan</th>
              <th className="text-left px-3 py-2">Rasio</th>
              <th className="text-right px-3 py-2">Harga Terakhir</th>
              <th className="text-left px-3 py-2">Efektif</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u)=> (
              <tr key={u.unitId} className="border-t">
                <td className="px-3 py-1.5">{u.unitName}{u.isSmallest? ' (base)':''}</td>
                <td className="px-3 py-1.5">{u.ratio}</td>
                <td className="px-3 py-1.5 text-right">{Intl.NumberFormat('id-ID').format(u.price || 0)}</td>
                <td className="px-3 py-1.5">{u.effectiveDate || '-'}</td>
              </tr>
            ))}
            {units.length===0 && (
              <tr><td colSpan={4} className="px-3 py-3 text-center text-slate-500">Belum ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={onSubmit} className="mt-3 grid md:grid-cols-4 gap-2 items-end">
        <div>
          <label className="block text-[10px] mb-1 text-slate-600">Satuan</label>
          <select value={String(unitId)} onChange={(e)=> setUnitId(Number(e.target.value))} className="px-3 py-2 border rounded text-sm w-full">
            {units.map(u=> (<option key={u.unitId} value={u.unitId}>{u.unitName} (rasio {u.ratio})</option>))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] mb-1 text-slate-600">Harga</label>
          <Input placeholder="0" value={priceInput} onChange={(e)=> setPriceInput(formatInputOnChange(e.target.value))} onKeyDown={(e)=> { if (e.key==='Escape') { (e.target as HTMLInputElement).blur(); setPriceInput('') } }} />
        </div>
        <div>
          <label className="block text-[10px] mb-1 text-slate-600">Tanggal Berlaku</label>
          <Input type="date" value={effDate} onChange={(e)=> setEffDate(e.target.value)} />
        </div>
        <div>
          <Button type="submit" disabled={submitting}>{submitting? 'Menyimpan...' : 'Tambah Harga'}</Button>
        </div>
      </form>

      {baseUnit && (
        <p className="text-[10px] text-slate-500 mt-2">Harga yang tampil di list adalah harga satuan dasar (rasio 1): <strong>{baseUnit.unitName}</strong>.</p>
      )}
    </div>
  )
}
