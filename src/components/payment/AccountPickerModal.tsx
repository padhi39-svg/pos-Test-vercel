"use client"
import { useEffect, useMemo, useState } from 'react'

export type AccountPick = {
  temp_id: string
  account_id: number
  account_code: string
  account_name: string
}

export default function AccountPickerModal({
  title = 'Pilih Akun Perkiraan',
  onClose,
  onApply,
}: {
  title?: string
  onClose: () => void
  onApply: (rows: AccountPick[]) => void
}) {
  const [rows, setRows] = useState<any[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const qs = query ? `?q=${encodeURIComponent(query)}` : ''
        const res = await fetch(`/api/accounts${qs}`, { cache: 'no-store' })
        const data = await res.json()
        setRows(Array.isArray(data) ? data : [])
      } catch {
        setRows([])
      }
    }
    load()
  }, [query])

  const selected = useMemo(
    () =>
      rows
        .filter((r: any) => checked[String(r.id)])
        .map((a: any) => ({
          temp_id: `${a.id}`,
          account_id: a.id,
          account_code: a.code,
          account_name: a.name,
        })),
    [rows, checked]
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-modal shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col">
        <div className="p-3 border-b flex items-center justify-between shrink-0">
          <div className="font-medium text-sm">{title}</div>
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
                      rows.forEach((r: any) => { obj[String(r.id)] = v })
                      setChecked(obj)
                    }}
                  />
                </th>
                <th className="px-3 py-2">Kode Akun</th>
                <th className="px-3 py-2">Nama Akun</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">Tidak ada data</td></tr>
              ) : rows.map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!checked[String(r.id)]}
                      onChange={(e) => setChecked((prev) => ({ ...prev, [String(r.id)]: e.target.checked }))}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{r.code}</td>
                  <td className="px-3 py-2">{r.name}</td>
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
