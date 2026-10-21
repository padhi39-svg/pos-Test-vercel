"use client"
import { useState, useEffect, useRef } from 'react'

export type SOItem = { id: number; so_number: string; customer_name?: string; so_date?: string; customer_id?: number; sales_id?: number; warehouse_id?: number; discount_percent?: number; items?: any[] }

export default function SOPickerModal({
  open, customerId, onSelect, onClose,
}: {
  open: boolean
  customerId?: number | null
  onSelect: (so: SOItem) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [list, setList] = useState<SOItem[]>([])
  const [loading, setLoading] = useState(false)
  const cache = useRef<Map<number, any>>(new Map())
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!open) { setSearch(''); setList([]); return }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const fetchSO = async () => {
        setLoading(true)
        try {
          const params = new URLSearchParams({ so_status: 'outstanding', limit: '50' })
          if (search) params.set('q', search)
          if (customerId) params.set('customer_id', String(customerId))
          const res = await fetch(`/api/sales-orders?${params.toString()}`)
          if (!res.ok) { setList([]); return }
          const data = await res.json()
          const rows = Array.isArray(data?.rows) ? data.rows : []
          rows.forEach((so: any) => cache.current.set(so.id, so))
          setList(rows)
        } catch { setList([]) }
        finally { setLoading(false) }
      }
      fetchSO()
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, customerId, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[70vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 shrink-0">
          <h3 className="text-base font-semibold text-slate-800">Pilih Sales Order</h3>
          <p className="text-xs text-slate-500 mt-0.5">Ketik nomor SO atau nama customer</p>
        </div>
        <div className="p-4 pb-0 shrink-0">
          <input
            type="text"
            placeholder="Cari nomor SO / nama customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-sm text-slate-500 py-8">Memuat...</div>
          ) : list.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-8">
              {search ? 'SO tidak ditemukan' : 'Tidak ada SO confirmed'}
            </div>
          ) : (
            <div className="space-y-1">
              {list.map((so) => (
                <button
                  key={so.id}
                  type="button"
                  onClick={() => { onSelect(so); setSearch('') }}
                  className="w-full text-left p-3 rounded-pill hover:bg-teal-bg border border-transparent hover:border-teal-primary transition-colors"
                >
                  <div className="text-sm font-medium text-slate-800">
                    {so.so_number}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {so.customer_name || '-'} • {(so.so_date || '').slice(0, 10)}
                    {so.so_status && (
                      <span className={`ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded ${so.so_status === 'realisasi' ? 'bg-teal-bg text-teal-dark' : 'bg-amber-50 text-amber-700'}`}>
                        {so.so_status}
                      </span>
                    )}
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
