"use client"
import { useState, useMemo } from 'react'

export type Customer = { id: number; code: string; name: string; discountPercent: number; term?: number; salesId?: number | null }

export default function CustomerPickerModal({
  open,
  customerList,
  onSelect,
  onClose,
}: {
  open: boolean
  customerList: Customer[]
  onSelect: (customer: Customer) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return customerList.filter(c => {
      if (!q) return true
      return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    })
  }, [customerList, search])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 shrink-0">
          <h3 className="text-base font-semibold text-slate-800">Pilih Customer</h3>
          <p className="text-xs text-slate-500 mt-0.5">Ketik nama atau kode customer</p>
        </div>
        <div className="p-4 pb-0 shrink-0">
          <input
            type="text"
            placeholder="Ketik nama/kode customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-8">
              {search ? 'Customer tidak ditemukan' : 'Tidak ada data customer'}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onSelect(c); setSearch('') }}
                  className="w-full text-left p-3 rounded-pill hover:bg-teal-bg border border-transparent hover:border-teal-primary transition-colors"
                >
                  <div className="text-sm font-medium text-slate-800">
                    {c.code + ' - ' + c.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {c.discountPercent ? `Diskon ${c.discountPercent}%` : 'Diskon 0%'}
                    {c.term ? ` | Term ${c.term} hari` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => { onClose(); setSearch('') }}
            className="px-4 py-2 text-sm rounded-pill border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
