"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { showError, showSuccess } from "@/lib/notification"

export default function MobileOpnameByIdPage(){
  const { id } = useParams<{ id: string }>()
  const opnameId = Number(id)
  const router = useRouter()
  const [me, setMe] = useState<any>(null)
  const [doc, setDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  // input
  const [q, setQ] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [allowedItems, setAllowedItems] = useState<{ id:number; code:string; name:string }[]>([])
  const [lines, setLines] = useState<{ id:number; code:string; name:string; qty:number; unit_id?: number|null; unit_ratio?: number|null; unit_name?: string|null }[]>([])
  const [selected, setSelected] = useState<{ id:number; code:string; name:string }|null>(null)
  const [editingId, setEditingId] = useState<number|null>(null)
  const [qty, setQty] = useState<string>("")
  type UnitRow = { id:number; barang_id:number; unit:string; ratio:number; is_base:number }
  const [units, setUnits] = useState<UnitRow[]>([])
  const [unitId, setUnitId] = useState<number|undefined>(undefined)
  const [unitRatio, setUnitRatio] = useState<number|undefined>(undefined)
  const [unitName, setUnitName] = useState<string>("")

  // Helper: lengkapi unit_name jika kosong dengan memanggil master units
  async function enrichUnitsForLines(list: { id:number; code:string; name:string; qty:number; unit_id?: number|null; unit_ratio?: number|null; unit_name?: string|null }[]) {
    const need = list.filter(l=> !l.unit_name || String(l.unit_name).trim()==='')
    if (need.length===0) return list
    const updated = [...list]
    await Promise.all(need.map(async (l)=>{
      try{
        const res = await fetch(`/api/barang/${l.id}/units`)
        const data = res.ok? await res.json(): null
        if (Array.isArray(data) && data.length){
          const base = data.find((u:any)=> Number(u.ratio)===1) || data[0]
          const idx = updated.findIndex(x=> x.id===l.id)
          if (idx>=0){
            updated[idx] = { ...updated[idx], unit_id: updated[idx].unit_id ?? base.id, unit_ratio: updated[idx].unit_ratio ?? Number(base.ratio), unit_name: updated[idx].unit_name ?? String(base.unit) }
          }
        }
      }catch{}
    }))
    return updated
  }

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        const [m, d, lc] = await Promise.all([
          fetch('/api/auth/me', { cache: 'no-store' }),
          fetch(`/api/stock-opname/${opnameId}`),
          fetch(`/api/stock-opname/${opnameId}/counts`),
        ])
        const um = m.ok ? await m.json() : null
        const dd = d.ok ? await d.json() : null
        const last = lc.ok ? await lc.json() : null
        if (alive){ setMe(um?.user || null); setDoc(dd || null) }
        // siapkan daftar item yang diperbolehkan dari draft
        try{
          const arr = Array.isArray(dd?.items) ? dd.items : []
          const mapped = arr.map((x:any)=>({ id: Number(x.barang_id || x.id), code: String(x.barang_code || x.code || ''), name: String(x.barang_name || x.name || '') }))
          if (alive) setAllowedItems(mapped)
        }catch{}
        // hydrate lines from last counts
        try{
          const arr = Array.isArray(last?.rows)? last.rows: []
          const map = new Map<number,{qty:number; unit_id?:number; unit_ratio?:number; unit_name?:string|null}>()
          arr.forEach((x:any)=>{
            map.set(Number(x.barang_id), {
              qty: Number(x.qty)||0,
              unit_id: x.unit_id==null? undefined : Number(x.unit_id),
              unit_ratio: x.unit_ratio==null? undefined : Number(x.unit_ratio),
              unit_name: (x.unit_name ?? x.unit_label) ?? null,
            })
          })
          const draftItems = Array.isArray(dd?.items)? dd.items: []
          const pre: { id:number; code:string; name:string; qty:number; unit_id?: number|null; unit_ratio?: number|null; unit_name?: string|null }[] = []
          const used = new Set<number>()
          if (draftItems.length){
            for (const it of draftItems){
              const id = Number(it.barang_id || it.id)
              const code = String(it.barang_code || it.code || id)
              const name = String(it.barang_name || it.name || `Barang #${id}`)
              const ex = map.get(id)
              if (ex){ pre.push({ id, code, name, qty: ex.qty, unit_id: ex.unit_id, unit_ratio: ex.unit_ratio, unit_name: ex.unit_name||undefined }); used.add(id) }
            }
          }
          // Masukkan sisa counts yang belum ter-cover oleh draft items
          if (arr.length){
            for (const x of arr){
              const id = Number(x.barang_id)
              if (used.has(id)) continue
              pre.push({ id, code: String(x.code||x.barang_code||id), name: String(x.name||x.barang_name||`Barang #${id}`), qty: Number(x.qty||0), unit_id: x.unit_id==null? undefined:Number(x.unit_id), unit_ratio: x.unit_ratio==null? undefined:Number(x.unit_ratio), unit_name: (x.unit_name ?? x.unit_label) ?? undefined })
            }
          }
          if (alive && pre.length){
            const filled = await enrichUnitsForLines(pre)
            if (alive) setLines(filled)
          }
        }catch{}

        // auth: manager or in assignees
        let ok = false
        try{
          const ids = JSON.parse(String(dd?.header?.assignees ?? dd?.assignees ?? '[]'))
          if (Array.isArray(ids) && ids.length && um?.user?.id){
            ok = ids.includes(Number(um.user.id))
          }
          if (String(um?.user?.role) === 'manager') ok = true
        }catch{}
        if (alive) setAuthorized(ok)
      }catch(e){ console.error(e) }
      finally{ if (alive) setLoading(false) }
    })()
    return ()=>{ alive=false }
  },[opnameId])

  // search barang (hanya yang ada di draft/allowedItems)
  useEffect(()=>{
    const qq = q.trim()
    if (!qq){ setResults([]); return }
    setSearching(true)
    const t = setTimeout(()=>{
      try{
        const ql = qq.toLowerCase()
        const filtered = allowedItems.filter((x)=> `${x.code||''} ${x.name||''}`.toLowerCase().includes(ql))
        setResults(filtered)
      }finally{ setSearching(false) }
    },200)
    return ()=>{ clearTimeout(t) }
  },[q, allowedItems])

  // load units ketika memilih item
  useEffect(()=>{
    (async()=>{
      if (!selected){ setUnits([]); setUnitId(undefined); setUnitRatio(undefined); setUnitName(""); setQty(""); setEditingId(null); return }
      try{
        const res = await fetch(`/api/barang/${selected.id}/units`)
        const data = res.ok ? await res.json() : null
        if (Array.isArray(data) && data.length){
          setUnits(data)
          const base = data.find((u:UnitRow)=> Number(u.ratio)===1) || data[0]
          setUnitId(base.id)
          setUnitRatio(Number(base.ratio))
          setUnitName(base.unit)
        } else {
          setUnits([])
          setUnitId(undefined)
          setUnitRatio(undefined)
          setUnitName("")
        }
      }catch{}
    })()
  },[selected])

  function addLine(){
    try{
      if (!selected){ showError('Pilih barang terlebih dahulu'); return }
      const qtyNum = Number(qty || '0')
      if (!qtyNum || qtyNum<=0){ showError('Qty tidak valid'); return }
      const exists = lines.some(l=> l.id===selected.id)
      if (editingId && editingId===selected.id){
        // update baris yang sedang diedit
        setLines(prev=> prev.map(l=> l.id===editingId? ({ ...l, qty: qtyNum, unit_id: unitId, unit_ratio: unitRatio, unit_name: unitName }): l))
      } else {
        if (exists){ showError('Barang sudah ada di entri'); return }
        setLines(prev=> [...prev, { id:selected.id, code:selected.code, name:selected.name, qty: qtyNum, unit_id: unitId, unit_ratio: unitRatio, unit_name: unitName }])
      }
      setSelected(null); setEditingId(null); setQty(""); setUnitName("")
    }catch(e:any){ showError(e?.message || 'Gagal menambah') }
  }

  async function submit(){
    try{
      if (!authorized){ showError('Tidak berwenang'); return }
      if (!lines.length){ showError('Belum ada entri'); return }
      for (const ln of lines){
        const res = await fetch(`/api/stock-opname/${opnameId}/counts`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ barang_id: ln.id, qty: ln.qty, unit_id: ln.unit_id, unit_ratio: ln.unit_ratio, method: 'manual' })
        })
        const d = await res.json().catch(()=>({}))
        if (!res.ok){ throw new Error(d?.error || 'Gagal menyimpan hitung') }
      }
      // Recalculate draft items totals based on all counts
      await fetch(`/api/stock-opname/${opnameId}/recalc`, { method:'POST' }).catch(()=>{})
      showSuccess('Pencatatan tersimpan')
      setLines([])
      router.push(`/stock/draftopname`)
    }catch(e:any){ showError(e?.message || 'Gagal menyimpan') }
  }

  const totalQty = useMemo(()=> lines.reduce((a,b)=> a + Number(b.qty||0), 0), [lines])

  if (loading) return (<div className="p-3 text-sm">Memuat...</div>)
  if (!doc) return (<div className="p-3 text-sm text-red-600">Dokumen tidak ditemukan</div>)

  return (
    <div className="w-full max-w-none mx-0 px-0 py-0 bg-slate-50 overflow-x-hidden">
      {/* Outer wrapper edge-to-edge sampai footer */}
      <div className="w-full bg-white rounded-none border border-slate-200 shadow-md px-3 sm:px-4 py-3 space-y-3 min-h-[calc(100vh-88px)] pb-24">
        <div className="bg-emerald-600 text-white rounded-lg p-3">
          <div className="text-xs opacity-80">Mobile Stok Opname</div>
          <div className="text-lg font-semibold">{doc?.header?.number || doc?.number || '-'}</div>
          <div className="text-xs opacity-80">Tanggal: {doc?.header?.tdate || doc?.tdate || '-'}</div>
        </div>

        {!authorized && (
          <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200 text-sm">
            Anda tidak berwenang mencatat pada draft ini.
          </div>
        )}

        <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
          <div className="text-sm font-semibold mb-2">Tambah Pencatatan</div>
          <div className="flex items-center gap-2">
            <input disabled={!authorized} value={q} onChange={e=>setQ(e.target.value)} className="flex-1 border rounded px-2 py-2" placeholder="Cari kode / nama barang..." />
            <button className="px-3 py-2 border rounded" disabled>Scan</button>
          </div>
          {/* Tombol 'Muat entri sebelumnya' disembunyikan sesuai permintaan */}
          {q && (
            <div className="mt-2 border rounded max-h-60 overflow-auto">
              {searching && <div className="p-2 text-xs text-slate-500">Mencari...</div>}
              {!searching && results.length===0 && <div className="p-2 text-xs text-slate-500">Tidak ada hasil</div>}
              {results.map(r => (
                <button key={r.id} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between" onClick={()=>{
                  const exist = lines.find(l=> l.id===r.id)
                  setSelected({ id:r.id, code:r.code, name:r.name })
                  if (exist){
                    setQty(String(exist.qty))
                    if (exist.unit_id) setUnitId(exist.unit_id)
                    if (exist.unit_ratio) setUnitRatio(exist.unit_ratio)
                    if (exist.unit_name) setUnitName(exist.unit_name)
                    setLines(prev=> prev.filter(x=> x.id!==r.id))
                  } else {
                    setQty("")
                  }
                  setQ('')
                  setResults([])
                }}>
                  <div>
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="font-mono text-[11px] text-slate-500">{r.code}</div>
                  </div>
                  <div className="text-[11px] text-slate-500">Tambah</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-3 border">
          <div className="text-sm font-semibold mb-2">Entri Sesi Ini</div>
          {selected && (
            <div className="mb-3 border rounded-lg p-2 bg-slate-50">
              <div className="text-sm font-medium">{selected.name}</div>
              <div className="font-mono text-[11px] text-slate-500">{selected.code}</div>
              <div className="mt-2 grid grid-cols-5 gap-2 items-end">
                <div className="col-span-3">
                  <label className="block text-[11px] text-slate-600 mb-1">Qty</label>
                  <input type="number" min={0} step={1} value={qty} onChange={e=> setQty(e.target.value)} className="w-full h-10 border rounded px-3 text-sm text-right" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-600 mb-1">Satuan</label>
                  <select value={unitId || ''} onChange={e=>{ const val = Number(e.target.value); setUnitId(Number.isNaN(val)? undefined: val); const u = units.find(u=>u.id===val); if (u){ setUnitRatio(Number(u.ratio)); setUnitName(u.unit) } }} className="w-full h-10 border rounded px-2 text-xs">
                    <option value="" disabled>Pilih</option>
                    {units.map(u=> (<option key={u.id} value={u.id}>{u.unit} (×{u.ratio})</option>))}
                  </select>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={()=>{ setSelected(null); setEditingId(null); setQty(""); setUnitName("") }} className="px-3 py-1.5 text-xs border rounded">Batal</button>
                <button onClick={addLine} className="px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white">Tambah</button>
              </div>
            </div>
          )}
          {lines.length===0 && <div className="text-xs text-slate-500">Belum ada entri. Tambahkan dari pencarian di atas.</div>}
          <div className="space-y-2">
            {lines.map(l => (
              <div
                key={l.id}
                className="flex items-center gap-2"
                onDoubleClick={() => {
                  // edit tanpa menghapus baris
                  setSelected({ id: l.id, code: l.code, name: l.name })
                  setEditingId(l.id)
                  setQty(String(l.qty))
                  if (l.unit_id) setUnitId(l.unit_id)
                  if (l.unit_ratio) setUnitRatio(l.unit_ratio)
                  if (l.unit_name) setUnitName(l.unit_name)
                }}
                onClick={() => {
                  // single tap: masuk mode edit tanpa menghapus baris
                  setSelected({ id: l.id, code: l.code, name: l.name })
                  setEditingId(l.id)
                  setQty(String(l.qty))
                  if (l.unit_id) setUnitId(l.unit_id)
                  if (l.unit_ratio) setUnitRatio(l.unit_ratio)
                  if (l.unit_name) setUnitName(l.unit_name)
                }}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">{l.name}</div>
                  <div className="font-mono text-[11px] text-slate-500">{l.code}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} step={1} value={l.qty} disabled className="w-24 text-sm text-right bg-transparent border-0 px-0 py-0 appearance-none select-none" />
                  {l.unit_name && (<span className="text-xs text-slate-600">{l.unit_name}</span>)}
                </div>
                <button className="px-2 py-1 border rounded text-xs" onClick={()=> setLines(prev=> prev.filter(x=> x.id!==l.id))}>Hapus</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer fix di paling bawah layar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-full px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-600">Total Entri: {lines.length} · Total Qty: {totalQty}</div>
          <div className="flex items-center gap-2">
            <Link href="/stock/draftopname" className="px-4 py-2 rounded border text-sm">Kembali</Link>
            <button disabled={!authorized || lines.length===0} onClick={submit} className="px-4 py-2 rounded bg-emerald-600 text-white text-sm disabled:opacity-50">Simpan</button>
          </div>
        </div>
      </div>

      {/* Spacer agar konten tidak tertutup footer */}
      <div className="h-24" />
    </div>
  )
}
