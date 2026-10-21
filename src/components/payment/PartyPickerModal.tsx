"use client"
import { useEffect, useMemo, useState } from 'react'

export type PartyType = 'customer' | 'supplier'

export type Party = { id: number; name: string }

const PARTY_CONFIG: Record<PartyType, { title: string; endpoint: string; singular: string }> = {
  customer: { title: 'Pilih Customer', endpoint: '/api/customer', singular: 'customer' },
  supplier: { title: 'Pilih Supplier', endpoint: '/api/master/supplier', singular: 'supplier' },
}

export default function PartyPickerModal({
  type,
  onClose,
  onPick,
}: {
  type: PartyType
  onClose: () => void
  onPick: (party: Party) => void
}) {
  const cfg = PARTY_CONFIG[type]
  const [rows, setRows] = useState<Party[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(cfg.endpoint, { cache: 'no-store' })
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data?.rows || [])
        setRows(list.map((it: any) => ({ id: it.id, name: it.name })))
      } catch {
        setRows([])
      }
    }
    load()
  }, [cfg.endpoint])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((r) => !q || r.name.toLowerCase().includes(q))
  }, [rows, query])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-modal shadow-2xl w-[700px] max-w-[95vw] max-h-[85vh] flex flex-col">
        <div className="p-3 border-b flex items-center justify-between shrink-0">
          <div className="font-medium text-sm">{cfg.title}</div>
          <button className="text-sm text-slate-500 hover:text-slate-700" onClick={onClose}>Tutup</button>
        </div>
        <div className="p-3 border-b shrink-0">
          <input
            className="w-full rounded-pill border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-primary focus:ring-2 focus:ring-teal-bg"
            placeholder={`Cari nama ${cfg.singular}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center text-slate-500 py-6 text-xs">Tidak ada data</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => onPick(c)}
                className="w-full text-left p-3 rounded-pill hover:bg-teal-bg border border-transparent hover:border-teal-primary transition-colors"
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
