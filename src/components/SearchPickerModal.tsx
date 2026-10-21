"use client"

import { useEffect, useMemo, useRef, useState, ReactNode } from 'react'

export type SearchPickerColumn = {
  key: string
  label: string
  render?: (row: any) => ReactNode
  className?: string
}

type Props = {
  open: boolean
  title: string
  subtitle?: string
  placeholder?: string
  columns?: SearchPickerColumn[]
  data: any[]
  searchKeys?: string[]
  renderItem?: (row: any, onPick: (row: any) => void) => ReactNode
  onPick: (row: any) => void
  onClose: () => void
}

export default function SearchPickerModal({ open, title, subtitle, placeholder = 'Ketik untuk mencari...', columns, data, searchKeys, renderItem, onPick, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setQ('')
  }, [open])

  const filtered = useMemo(() => {
    if (!q.trim()) return data
    const s = q.trim().toLowerCase()
    const keys = searchKeys || columns?.map(c => c.key) || []
    return data.filter((row: any) =>
      keys.some(k => String(row[k] ?? '').toLowerCase().includes(s))
    )
  }, [data, q, columns, searchKeys])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-600 mt-1">{subtitle}</p>}
        </div>
        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#E8F6F5] focus:border-[#2BA8A2]"
          />
          <div className="flex-1 overflow-y-auto">
            {renderItem ? (
              <div className="space-y-2">
                {filtered.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">{q ? 'Data tidak ditemukan' : 'Ketik untuk mencari'}</div>
                ) : (
                  filtered.map((row: any, idx: number) => (
                    <div key={row.id ?? idx}>{renderItem(row, onPick)}</div>
                  ))
                )}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    {columns?.map((col) => (
                      <th key={col.key} className={`px-3 py-2 text-left font-semibold text-slate-700 ${col.className || ''}`}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={columns?.length || 1} className="px-3 py-8 text-center text-slate-500">
                        {q ? 'Data tidak ditemukan' : 'Ketik untuk mencari'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row: any, idx: number) => (
                      <tr key={row.id ?? idx} className="hover:bg-slate-50 cursor-pointer" onClick={() => onPick(row)}>
                        {columns?.map((col) => (
                          <td key={col.key} className={`px-3 py-2 ${col.className || ''}`}>
                            {col.render ? col.render(row) : row[col.key] ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="p-6 border-t border-slate-200 flex justify-between items-center">
          <div className="text-xs text-slate-600">Ditemukan: <span className="font-semibold">{filtered.length}</span></div>
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-pill font-medium">Tutup</button>
        </div>
      </div>
    </div>
  )
}
