"use client"
import { useEffect, useMemo, useState } from 'react'
import { formatNumberID } from '@/lib/formatNumber'

export type MethodPick = {
  temp_id: string
  account_id: number
  account_code: string
  account_name: string
  amount: number
}

const numKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.ctrlKey || e.metaKey || ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
  if (!/^\d$/.test(e.key)) e.preventDefault()
}

export default function MethodPickerModal({
  onClose,
  onApply,
}: {
  onClose: () => void
  onApply: (rows: MethodPick[]) => void
}) {
  const [rows, setRows] = useState<MethodPick[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const qs = query ? `&q=${encodeURIComponent(query)}` : ''
        const res = await fetch(`/api/accounts?filter=kas_bank${qs}`, { cache: 'no-store' })
        const data = await res.json()
        const list = Array.isArray(data) ? data : []
        setRows(list.map((a: any) => ({
          temp_id: `${a.id}`,
          account_id: a.id,
          account_code: a.code,
          account_name: a.name,
          amount: 0,
        })))
      } catch {
        setRows([])
      }
    }
    load()
  }, [query])

  const selected = useMemo(() => rows.filter((r) => checked[r.temp_id]), [rows, checked])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-modal shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col">
        <div className="p-3 border-b flex items-center justify-between shrink-0">
          <div className="font-medium text-sm">Pilih Metode Pembayaran (Akun)</div>
          <button className="text-sm text-slate-500 hover:text-slate-700" onClick={onClose}>Tutup</button>
        </div>
        <div className="p-3 border-b shrink-0">
          <input
            className="w-full rounded-pill border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-primary focus:ring-2 focus:ring-teal-bg"
            placeholder="Cari kode/nama akun..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2 w-10">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      const v = e.target.checked
                      const obj: Record<string, boolean> = {}
                      rows.forEach((r) => { obj[r.temp_id] = v })
                      setChecked(obj)
                    }}
                  />
                </th>
                <th className="px-3 py-2">Kode Akun</th>
                <th className="px-3 py-2">Nama Akun</th>
                <th className="px-3 py-2 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Tidak ada data</td></tr>
              ) : rows.map((r) => (
                <tr key={r.temp_id} className="border-t">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!checked[r.temp_id]}
                      onChange={(e) => setChecked((prev) => ({ ...prev, [r.temp_id]: e.target.checked }))}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{r.account_code}</td>
                  <td className="px-3 py-2">{r.account_name}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="text"
                      inputMode="numeric"
                      className="input text-right"
                      value={formatNumberID(r.amount)}
                      onKeyDown={numKeyDown}
                      onFocus={(e) => { e.currentTarget.select(); e.currentTarget.value = String(r.amount) }}
                      onBlur={(e) => {
                        const raw = Number(e.currentTarget.value || 0)
                        const v = Math.max(0, raw)
                        setRows((prev) => prev.map((x) => (x.temp_id === r.temp_id ? { ...x, amount: v } : x)))
                      }}
                      onChange={(e) => {
                        const raw = e.currentTarget.value.replace(/\./g, '').replace(/,/g, '')
                        const n = Number(raw || 0)
                        setRows((prev) => prev.map((x) => (x.temp_id === r.temp_id ? { ...x, amount: n } : x)))
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t flex items-center justify-between text-sm shrink-0">
          <div>Dipilih: {selected.length} akun</div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50" onClick={() => setChecked({})}>Hapus Pilihan</button>
            <button className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white" onClick={() => onApply(selected)}>Terapkan</button>
          </div>
        </div>
      </div>
    </div>
  )
}
