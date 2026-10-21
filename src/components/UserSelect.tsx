"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'

type UserItem = { id: number; name: string; code?: string }

type Props = {
  placeholder?: string
  autoFocus?: boolean
  onSelect: (user: UserItem) => void
  onCancel?: () => void
  className?: string
}

export default function UserSelect({ placeholder='Cari nama user...', autoFocus, onSelect, onCancel, className='' }: Props){
  const [open, setOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<UserItem[]>([])
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement|null>(null)
  const inputRef = useRef<HTMLInputElement|null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent){
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as any)){
        setOpen(false)
        onCancel?.()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [onCancel])

  useEffect(() => { if (autoFocus) setTimeout(()=> inputRef.current?.focus(), 30) }, [autoFocus])

  useEffect(() => {
    const q = query.trim()
    if (!q){ setItems([]); return }
    const ctr = new AbortController()
    const t = setTimeout(async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`, { signal: ctr.signal })
        const data = res.ok ? await res.json() : []
        const arr = Array.isArray(data) ? data : []
        const mapped: UserItem[] = arr.map((u:any)=> ({ id: u.id, name: u.name || u.fullName || u.code || `User #${u.id}`, code: u.code }))
        setItems(mapped)
        setHighlight(0)
      } catch {} finally { setLoading(false) }
    }, 250)
    return () => { clearTimeout(t); ctr.abort() }
  }, [query])

  const visible = useMemo(()=> {
    const q = query.trim().toLowerCase()
    const filtered = !q ? items : items.filter(u => (u.name||'').toLowerCase().includes(q) || (u.code||'').toLowerCase().includes(q))
    return filtered.slice(0, 50)
  }, [items, query])

  function onKey(e: React.KeyboardEvent<HTMLInputElement>){
    if (!open) return
    if (e.key === 'ArrowDown'){ e.preventDefault(); setHighlight(h => Math.min(h+1, Math.max(0, visible.length-1))) }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); setHighlight(h => Math.max(h-1, 0)) }
    else if (e.key === 'Enter'){ e.preventDefault(); const u = visible[highlight]; if (u){ onSelect(u); setOpen(false) } }
    else if (e.key === 'Escape'){ setOpen(false); onCancel?.() }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e)=>{ setQuery(e.target.value); if (!open) setOpen(true) }}
        onKeyDown={onKey}
        placeholder={placeholder}
        className="w-full border rounded px-2 py-1.5 text-sm"
      />
      {open && query.trim() && (
        <div className="absolute z-20 mt-1 left-0 right-0 bg-white border rounded shadow max-h-56 overflow-auto">
          {loading && <div className="px-3 py-2 text-xs text-slate-500">Mencari...</div>}
          {!loading && visible.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500">Tidak ada hasil</div>
          )}
          {!loading && visible.map((u, idx) => (
            <button
              key={u.id}
              className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 ${idx===highlight? 'bg-slate-50' : ''}`}
              onMouseEnter={()=> setHighlight(idx)}
              onClick={()=> { onSelect(u); setOpen(false) }}
            >
              <div>
                <div className="text-sm font-medium">{u.name}</div>
                <div className="font-mono text-[11px] text-slate-500">ID #{u.id}{u.code? ` · ${u.code}`:''}</div>
              </div>
              <div className="text-[11px] text-slate-500">Pilih</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
