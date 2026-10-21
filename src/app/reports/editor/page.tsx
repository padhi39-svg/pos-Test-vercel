"use client"

import { useEffect, useMemo, useState } from "react"
import { formatCurrency } from "@/lib/regionalNumber"

// MVP Report Editor (client-side)
// - Datasource: /api/sales-detail-report
// - Fitur: pilih field, filter (periode, no transaksi), groupBy, agregasi SUM, sort, preview
// - Simpan definisi di localStorage (per device)

type FieldKey =
  | "transaction_date"
  | "transaction_number"
  | "customer_name"
  | "sales_type"
  | "kategori_name"
  | "item_name"
  | "quantity"
  | "unit_price"
  | "subtotal"

type AggFn = "sum" | "count" | "none"

interface EditorField {
  key: FieldKey
  label: string
  type: "text" | "number" | "date"
  defaultAgg?: AggFn
}

const FIELD_CATALOG: EditorField[] = [
  { key: "transaction_date", label: "Tgl Transaksi", type: "date" },
  { key: "transaction_number", label: "No. Transaksi", type: "text" },
  { key: "customer_name", label: "Pelanggan", type: "text" },
  { key: "sales_type", label: "Tipe Penjualan", type: "text" },
  { key: "kategori_name", label: "Kategori", type: "text" },
  { key: "item_name", label: "Nama Barang", type: "text" },
  { key: "quantity", label: "Qty", type: "number", defaultAgg: "sum" },
  { key: "unit_price", label: "Harga", type: "number" },
  { key: "subtotal", label: "Subtotal", type: "number", defaultAgg: "sum" },
]

interface DetailRow {
  transaction_id: number
  transaction_number: string
  transaction_date: string
  customer_name: string
  sales_type: string
  item_name: string
  quantity: number
  unit: string
  unit_price: number
  discount_percent: number
  discount_total: number
  ppn_amount: number
  subtotal: number
  kategori_name?: string
}

interface Definition {
  name: string
  from: string
  to: string
  transactionNumber?: string
  fields: FieldKey[]
  groupBy: FieldKey[]
  aggregations: { [K in FieldKey]?: AggFn }
  sort?: { key: FieldKey; dir: "asc" | "desc" }
}

const LS_KEY = "report_editor.mgr.definition"

export default function ReportEditorPage() {
  // Role gate (MVP: hanya UI gate)
  // TODO: ganti dengan gate berdasarkan auth/role sebenarnya
  const [role] = useState<"manager" | "staff" | "admin">("manager")

  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [transactionNumber, setTransactionNumber] = useState("")
  const [rows, setRows] = useState<DetailRow[]>([])
  const [loading, setLoading] = useState(false)

  // Editor state
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>(["transaction_date", "item_name", "quantity", "subtotal"]) 
  const [groupBy, setGroupBy] = useState<FieldKey[]>(["transaction_date"])
  const [aggregations, setAggregations] = useState<Definition["aggregations"]>({ quantity: "sum", subtotal: "sum" })
  const [sortKey, setSortKey] = useState<FieldKey>("transaction_date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // Load defaults current month
  useEffect(() => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const fromDate = firstDay.toISOString().split("T")[0]
    const toDate = lastDay.toISOString().split("T")[0]
    setFrom(fromDate)
    setTo(toDate)
  }, [])

  // Load definition from localStorage
  useEffect(() => {
    try {
      const s = window.localStorage.getItem(LS_KEY)
      if (s) {
        const json = JSON.parse(s) as Definition
        if (json) {
          setSelectedFields(json.fields || selectedFields)
          setGroupBy(json.groupBy || groupBy)
          setAggregations(json.aggregations || aggregations)
          if (json.sort) { setSortKey(json.sort.key); setSortDir(json.sort.dir) }
          if (json.from) setFrom(json.from)
          if (json.to) setTo(json.to)
          if (json.transactionNumber) setTransactionNumber(json.transactionNumber)
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save definition to localStorage
  const saveDefinition = () => {
    const def: Definition = {
      name: "Draft Laporan",
      from,
      to,
      transactionNumber,
      fields: selectedFields,
      groupBy,
      aggregations,
      sort: { key: sortKey, dir: sortDir },
    }
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(def)) } catch {}
  }

  const fetchRows = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      if (transactionNumber) params.set("transaction_number", transactionNumber)
      const res = await fetch(`/api/sales-detail-report?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRows(Array.isArray(data.rows) ? data.rows : [])
      } else setRows([])
    } catch (e) {
      console.error(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // Utility helpers
  const toggleArray = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])

  const preview = useMemo(() => {
    // Client-side group & aggregate
    if (!rows.length) return [] as any[]

    // Step 1: filter fields and build groups
    const groupKeys = groupBy
    const keyOf = (r: DetailRow) => JSON.stringify(groupKeys.map(k => (r as any)[k] ?? ""))
    const groups = new Map<string, { key: string; rows: DetailRow[] }>()
    for (const r of rows) {
      const k = keyOf(r)
      const g = groups.get(k) || { key: k, rows: [] }
      g.rows.push(r)
      groups.set(k, g)
    }

    // Step 2: aggregate per group
    const records: any[] = []
    for (const g of groups.values()) {
      const rec: any = {}
      // Fill group key fields
      const vals = JSON.parse(g.key) as any[]
      groupKeys.forEach((k, i) => { rec[k] = vals[i] })
      // Aggregate selected fields
      for (const f of selectedFields) {
        const cat = FIELD_CATALOG.find(c => c.key === f)
        const agg: AggFn = aggregations[f] || (cat?.defaultAgg || "none")
        if (groupKeys.includes(f)) {
          // already in rec via group key
          continue
        }
        if (agg === "sum") {
          rec[f] = g.rows.reduce((a, r) => a + (Number((r as any)[f]) || 0), 0)
        } else if (agg === "count") {
          rec[f] = g.rows.length
        } else {
          // none: take first value
          rec[f] = (g.rows[0] as any)[f]
        }
      }
      records.push(rec)
    }

    // Step 3: sort
    records.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir
      const sa = String(av ?? "").toLowerCase(), sb = String(bv ?? "").toLowerCase()
      if (sa < sb) return -1 * dir
      if (sa > sb) return 1 * dir
      return 0
    })

    return records
  }, [rows, selectedFields, groupBy, aggregations, sortKey, sortDir])

  const displayColumns = useMemo(() => {
    // columns = groupBy union selectedFields (unique, keep order: groupBy first)
    const set = new Set<FieldKey>([...groupBy, ...selectedFields])
    return Array.from(set)
  }, [groupBy, selectedFields])

  if (role !== "manager" && role !== "admin") {
    return (
      <div className="p-4">
        <h1 className="text-lg font-semibold">Report Editor</h1>
        <p className="text-sm text-slate-600">Anda tidak memiliki akses ke fitur ini.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-3 md:px-0">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Report Editor (MVP)</h1>
        <p className="text-sm text-slate-500">Susun laporan dari data Sales Detail. Simpan definisi untuk digunakan kembali.</p>
      </div>

      {/* Filters & Actions */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2 md:grid-cols-3 md:items-end">
        <div className="space-y-2">
          <label className="block text-[11px] text-slate-600">Periode</label>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-slate-300" />
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-slate-300" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-[11px] text-slate-600">No. Transaksi</label>
          <input value={transactionNumber} onChange={e=>setTransactionNumber(e.target.value)} placeholder="Cari nomor transaksi" className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-slate-300" />
        </div>
        <div className="flex gap-2 md:justify-end">
          <button onClick={fetchRows} className="px-3 py-1.5 text-sm rounded-pill bg-teal-primary text-white">Preview</button>
          <button onClick={saveDefinition} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300">Simpan</button>
        </div>
      </div>

      {/* Builder Panels */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700">Field</div>
          <div className="text-[11px] text-slate-500">Pilih field yang ingin ditampilkan. Field numerik bisa dijumlah (SUM).</div>
          <div className="max-h-72 overflow-auto pr-1 space-y-1">
            {FIELD_CATALOG.map(f => (
              <label key={f.key} className="flex items-center justify-between gap-2 text-xs py-1">
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="accent-teal-primary" checked={selectedFields.includes(f.key)} onChange={()=>setSelectedFields(prev=>toggleArray(prev, f.key))} />
                  <span>{f.label}</span>
                </div>
                {f.type === "number" && (
                  <select className="text-xs border border-slate-300 rounded px-1 py-0.5" value={aggregations[f.key] || f.defaultAgg || "none"} onChange={e=>setAggregations(prev=>({...prev, [f.key]: e.target.value as AggFn}))}>
                    <option value="none">None</option>
                    <option value="sum">SUM</option>
                    <option value="count">COUNT</option>
                  </select>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700">Group By</div>
          <div className="text-[11px] text-slate-500">Pilih kolom pengelompokan.</div>
          <div className="max-h-72 overflow-auto pr-1 space-y-1">
            {FIELD_CATALOG.map(f => (
              <label key={f.key} className="flex items-center gap-2 text-xs py-1">
                <input type="checkbox" className="accent-teal-primary" checked={groupBy.includes(f.key)} onChange={()=>setGroupBy(prev=>toggleArray(prev, f.key))} />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700">Sort</div>
          <div className="text-[11px] text-slate-500">Urutkan hasil.</div>
          <div className="flex gap-2">
            <select className="text-xs border border-slate-300 rounded px-2 py-1" value={sortKey} onChange={e=>setSortKey(e.target.value as FieldKey)}>
              {FIELD_CATALOG.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <select className="text-xs border border-slate-300 rounded px-2 py-1" value={sortDir} onChange={e=>setSortDir(e.target.value as any)}>
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
          </div>
          <div className="pt-2 text-[11px] text-slate-500">Catatan: Kolom seperti meja/waiter/metode pembayaran akan tersedia pada tahap berikutnya (perluasan datasource).</div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <div className="px-3 py-2 text-xs text-slate-600 flex items-center gap-2">
          <span>Preview</span>
          {loading && <span className="text-[11px] text-slate-500">Memuat...</span>}
          {!loading && !rows.length && <span className="text-[11px] text-slate-500">Tidak ada data. Klik Preview untuk memuat.</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed">
            <thead className="bg-teal-primary text-white">
              <tr>
                {displayColumns.map(col => {
                  const meta = FIELD_CATALOG.find(f=>f.key===col)
                  return (
                    <th key={col} className="px-2 py-2 text-left text-xs font-semibold">{meta?.label || col}</th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {preview.map((rec, idx) => (
                <tr key={idx} className={idx>0?"border-t":""}>
                  {displayColumns.map(col => {
                    const meta = FIELD_CATALOG.find(f=>f.key===col)
                    const v = rec[col]
                    if (meta?.type === "number") {
                      // format subtotal, unit_price as currency, quantity plain
                      if (col === "subtotal" || col === "unit_price") return (<td key={col} className="px-2 py-1.5 text-xs text-right">{formatCurrency(Number(v)||0)}</td>)
                      return (<td key={col} className="px-2 py-1.5 text-xs text-right">{Number(v)||0}</td>)
                    }
                    return (<td key={col} className="px-2 py-1.5 text-xs">{String(v ?? "")}</td>)
                  })}
                </tr>
              ))}
              {!loading && rows.length>0 && preview.length===0 && (
                <tr><td className="px-2 py-3 text-center text-slate-500 text-xs" colSpan={displayColumns.length}>Tidak ada hasil untuk konfigurasi saat ini</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
