"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'

export type BarangItem = {
  id: number
  code: string
  name: string
}

type BarangSelectProps = {
  placeholder?: string
  autoFocus?: boolean
  onSelect: (item: BarangItem) => void
  onCancel?: () => void
  className?: string
}

export default function BarangSelect({ placeholder = 'Cari nama barang...', autoFocus, onSelect, onCancel, className = '' }: BarangSelectProps){
  const [open, setOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<BarangItem[]>([])
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement|null>(null)
  const inputRef = useRef<HTMLInputElement|null>(null)

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent){
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as any)) {
        setOpen(false)
        onCancel?.()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [onCancel])

  // Autofocus
  useEffect(()=>{ if (autoFocus) setTimeout(()=> inputRef.current?.focus(), 50) }, [autoFocus])

  // Fetch barang with debounce
  useEffect(() => {
    const q = query.trim()
    const ctr = new AbortController()
    const t = setTimeout(async () => {
      try {
        setLoading(true)
        const url = q ? `/api/barang?q=${encodeURIComponent(q)}` : `/api/barang?q=`
        const res = await fetch(url, { signal: ctr.signal })
        const data = res.ok ? await res.json() : []
        const arr = Array.isArray(data) ? data : []
        // Only include active items (aktif === true) and not deleted if provided
        const filtered = arr.filter((x:any)=> {
          const aktif = typeof x.aktif === 'boolean' ? x.aktif : Number(x.aktif) === 1
          const isdelete = typeof x.isdelete === 'boolean' ? x.isdelete : Number(x.isdelete) === 1
          return aktif && !isdelete
        })
        // Normalize to {id,code,name}
        const mapped = filtered.map((x:any)=> ({ id: x.id, code: x.code || x.kode || x.item_code || '', name: x.name || x.nama || '' }))
        setItems(mapped)
        setHighlight(0)
      } catch { /* ignore */ } finally { setLoading(false) }
    }, 250)
    return () => { clearTimeout(t); ctr.abort() }
  }, [query])

  const visible = useMemo(()=> {
    const q = query.trim().toLowerCase()
    const filtered = !q
      ? items
      : items.filter(it =>
          (it.name || '').toLowerCase().includes(q) || (it.code || '').toLowerCase().includes(q)
        )
    // Limit to first 50 results for responsiveness
    return filtered.slice(0, 50)
  }, [items, query])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>){
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h+1, Math.max(0, visible.length-1))) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h-1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const it = visible[highlight]
      if (it) { onSelect(it); setOpen(false) }
    } else if (e.key === 'Escape') { setOpen(false); onCancel?.() }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="flex-1">
        <input
          ref={inputRef}
          value={query}
          onChange={(e)=>{ setQuery(e.target.value); if (!open) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </div>
      {open && query.trim().length > 0 && (
        <div className="absolute z-20 mt-1 left-0 right-0 bg-white border rounded shadow max-h-60 overflow-auto">
          {loading && <div className="px-3 py-2 text-xs text-slate-500">Mencari...</div>}
          {!loading && visible.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500">Tidak ada hasil</div>
          )}
          {!loading && visible.map((it, idx) => (
            <button
              key={it.id}
              className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 ${idx===highlight? 'bg-slate-50' : ''}`}
              onMouseEnter={()=> setHighlight(idx)}
              onClick={()=>{ onSelect(it); setOpen(false) }}
            >
              <div>
                <div className="text-sm font-medium">{it.name}</div>
                <div className="font-mono text-[11px] text-slate-500">{it.code}</div>
              </div>
              <div className="text-[11px] text-slate-500">Pilih</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
