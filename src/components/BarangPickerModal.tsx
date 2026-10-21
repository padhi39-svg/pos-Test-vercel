"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'

export type BarangLite = { id: number; code: string; name: string; aktif?: boolean; isdelete?: boolean }

type Props = {
  open: boolean
  onClose: () => void
  onPick: (item: BarangLite) => void
}

export default function BarangPickerModal({ open, onClose, onPick }: Props){
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<BarangLite[]>([])
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement|null>(null)

  // autofocus on open
  useEffect(()=>{
    if (open) {
      setTimeout(()=> inputRef.current?.focus(), 50)
    } else {
      setQ('')
      setItems([])
      setHighlight(0)
    }
  }, [open])

  // fetch data with debounce
  useEffect(()=>{
    if (!open) return
    const ctr = new AbortController()
    const t = setTimeout(async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/barang?q=${encodeURIComponent(q)}`, { signal: ctr.signal })
        const data = res.ok ? await res.json() : []
        const arr: BarangLite[] = (Array.isArray(data) ? data : []).map((x:any)=> ({ id: x.id, code: x.code, name: x.name, aktif: x.aktif, isdelete: x.isdelete }))
        const filtered = arr.filter(x => (x.aktif ?? true) && !(x.isdelete ?? false))
        setItems(filtered)
        setHighlight(0)
      } catch {} finally { setLoading(false) }
    }, 250)
    return ()=> { clearTimeout(t); ctr.abort() }
  }, [q, open])

  const visible = useMemo(()=>{
    const s = q.trim().toLowerCase()
    const byText = !s ? items : items.filter(x => (x.name||'').toLowerCase().includes(s) || (x.code||'').toLowerCase().includes(s))
    return byText.slice(0, 100)
  }, [q, items])

  function keyDown(e: React.KeyboardEvent<HTMLInputElement>){
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h+1, Math.max(0, visible.length-1))) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h-1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); const it = visible[highlight]; if (it) onPick(it) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40">
      <div className="w-full md:max-w-2xl bg-white rounded-lg shadow-lg border border-slate-200 mx-2 mt-10 md:mt-0">
        <div className="p-3 md:p-4 border-b flex items-center gap-2">
          <input
            ref={inputRef}
            value={q}
            onChange={(e)=> setQ(e.target.value)}
            onKeyDown={keyDown}
            placeholder="Ketik nama atau kode barang..."
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <button onClick={onClose} className="px-3 py-2 text-sm rounded border hover:bg-slate-50">Tutup</button>
        </div>
        <div className="max-h-[60vh] overflow-auto divide-y">
          {loading && <div className="px-4 py-3 text-sm text-slate-500">Mencari...</div>}
          {!loading && visible.length === 0 && (
            <div className="px-4 py-8 text-sm text-slate-500 text-center">Tidak ada hasil</div>
          )}
          {!loading && visible.map((it, idx) => (
            <button
              key={it.id}
              onClick={()=> onPick(it)}
              onMouseEnter={()=> setHighlight(idx)}
              className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between ${idx===highlight? 'bg-slate-50' : ''}`}
            >
              <div>
                <div className="text-sm font-medium">{it.name}</div>
                <div className="font-mono text-[11px] text-slate-500">{it.code}</div>
              </div>
              <div className="text-[11px] text-slate-500">Pilih</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
