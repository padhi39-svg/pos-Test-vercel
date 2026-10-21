"use client"
import { useEffect, useMemo, useState } from 'react'
import { formatNumberID } from '@/lib/formatNumber'

export type InvoicePick = {
  id: string
  source_type: string
  source_id: number
  invoice_number: string
  invoice_supplier_number?: string
  invoice_date: string
  total_amount: number
  due_amount: number
  pay_amount: number
  remarks?: string
}

export type PaymentType = 'ar' | 'ap'

const TYPE_CONFIG: Record<PaymentType, {
  title: string
  endpoint: (partyId: number) => string
  allowedSourceTypes: string[]
  returLabel: string
}> = {
  ar: {
    title: 'Pilih Nota Outstanding',
    endpoint: (partyId) => `/api/ar-payments/outstanding?customer_id=${partyId}`,
    allowedSourceTypes: ['transaction', 'ar_opening', 'sales_return'],
    returLabel: '(Retur)',
  },
  ap: {
    title: 'Pilih Nota Outstanding',
    endpoint: (partyId) => `/api/ap-payments/outstanding?supplier_id=${partyId}`,
    allowedSourceTypes: ['purchase', 'ap_opening', 'purchase_return'],
    returLabel: '(Retur)',
  },
}

export default function InvoicePickerModal({
  type,
  partyId,
  preselectedIds,
  onClose,
  onApply,
}: {
  type: PaymentType
  partyId: number
  preselectedIds?: Set<string>
  onClose: () => void
  onApply: (rows: InvoicePick[]) => void
}) {
  const cfg = TYPE_CONFIG[type]
  const [rows, setRows] = useState<InvoicePick[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(cfg.endpoint(partyId), { cache: 'no-store' })
        const data = await res.json()
        const list = Array.isArray(data) ? data : (Array.isArray((data as any)?.data) ? (data as any).data : [])
        const filtered = list.filter((x: any) => {
          if (!cfg.allowedSourceTypes.includes(String(x.source_type || ''))) return false
          if (Number(x.due_amount || 0) === 0) return false
          return true
        })
        const mapped: InvoicePick[] = filtered.map((r: any) => {
          const st = String(r.source_type || 'transaction')
          const due = Number(r.due_amount || 0)
          return {
            id: `${st}-${r.id}`,
            source_type: st,
            source_id: Number(r.id),
            invoice_number: String(r.invoice_number || ''),
            invoice_supplier_number: String(r.invoice_supplier_number || ''),
            invoice_date: String(r.invoice_date || '').slice(0, 10),
            total_amount: Number(r.amount || 0),
            due_amount: due,
            pay_amount: 0,
            remarks: '',
          }
        })
        setRows(mapped)
        if (preselectedIds && preselectedIds.size > 0) {
          const init: Record<string, boolean> = {}
          mapped.forEach((r) => { if (preselectedIds.has(r.id)) init[r.id] = true })
          setChecked(init)
        }
      } catch {
        setRows([])
      }
    }
    if (partyId) load()
  }, [partyId, preselectedIds, cfg])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((r) =>
      !q ||
      r.invoice_number.toLowerCase().includes(q) ||
      (r.invoice_supplier_number || '').toLowerCase().includes(q)
    )
  }, [rows, query])

  const selected = useMemo(() => filtered.filter((r) => checked[r.id]), [filtered, checked])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-modal shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col">
        <div className="p-3 border-b flex items-center justify-between shrink-0">
          <div className="font-medium text-sm">{cfg.title}</div>
          <button className="text-sm text-slate-500 hover:text-slate-700" onClick={onClose}>Tutup</button>
        </div>
        <div className="p-3 border-b shrink-0">
          <input
            className="w-full rounded-pill border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-primary focus:ring-2 focus:ring-teal-bg"
            placeholder="Cari no. invoice / invoice supplier..."
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
                      filtered.forEach((r) => { obj[r.id] = v })
                      setChecked(obj)
                    }}
                  />
                </th>
                <th className="px-3 py-2">No. Invoice</th>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2 text-right">Total Nota</th>
                <th className="px-3 py-2 text-right">Sisa</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Tidak ada data</td></tr>
              ) : filtered.map((r) => {
                const isRetur = r.source_type.endsWith('_return')
                const displayDue = isRetur ? -Math.abs(r.due_amount) : r.due_amount
                return (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!checked[r.id]}
                      onChange={(e) => setChecked((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                    />
                  </td>
                  <td className={`px-3 py-2 font-medium ${isRetur ? 'text-red-600' : ''}`}>
                    {r.invoice_number}
                    {isRetur ? <span className="ml-1 text-xs">{cfg.returLabel}</span> : ''}
                  </td>
                  <td className="px-3 py-2">{r.invoice_date}</td>
                  <td className={`px-3 py-2 text-right ${isRetur ? 'text-red-600' : ''}`}>{formatNumberID(r.total_amount || 0)}</td>
                  <td className={`px-3 py-2 text-right ${isRetur ? 'text-red-600' : ''}`}>{formatNumberID(displayDue)}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t flex items-center justify-between text-sm shrink-0">
          <div>Dipilih: {selected.length} nota</div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50" onClick={() => setChecked({})}>Hapus Pilihan</button>
            <button className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white" onClick={() => onApply(selected)}>Terapkan</button>
          </div>
        </div>
      </div>
    </div>
  )
}
