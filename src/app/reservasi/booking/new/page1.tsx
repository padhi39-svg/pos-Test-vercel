"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Floor = { id:number; code:string; name:string; level_no?:number }
type TableItem = { id:number; code:string; name:string; floor_id?:number; capacity?:number; floor_name?:string }

export default function NewBookingPage() {
  const router = useRouter()
  const [floors, setFloors] = useState<Floor[]>([])
  const [tables, setTables] = useState<TableItem[]>([])
  const [menus, setMenus] = useState<any[]>([])
  const [menuQ, setMenuQ] = useState<string>('')
  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([])
  const [selectedMenus, setSelectedMenus] = useState<any[]>([])
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const menuInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)

  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,10))
  const [startTime, setStartTime] = useState<string>('18:00')
  const [endTime, setEndTime] = useState<string>('20:00')
  const [pax, setPax] = useState<number>(2)
  const [customerName, setCustomerName] = useState<string>('')
  const [phone, setPhone] = useState<string>('')
  const [pic, setPic] = useState<string>('')
  const [dpAmount, setDpAmount] = useState<string>('')
  const [dpPaid, setDpPaid] = useState<boolean>(false)
  const [notes, setNotes] = useState<string>('')
  const [selectedFloor, setSelectedFloor] = useState<number | ''>('')
  const [selectedTables, setSelectedTables] = useState<number[]>([])

  const toTitleCase = (s:string) => s.replace(/\s+/g,' ').trim().toLowerCase().replace(/(^|\s)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase())
  const formatCurrencyId = (raw:string) => {
    const digits = raw.replace(/[^0-9]/g,'')
    if (digits === '') return ''
    const n = Number(digits)
    return n.toLocaleString('id-ID')
  }

  const load = async () => {
    try {
      setLoading(true)
      const [rf, rt] = await Promise.all([
        fetch('/api/floors'),
        fetch('/api/meja?active=1'),
      ])
      const floorsData = rf.ok ? await rf.json() : []
      const tablesData = rt.ok ? await rt.json() : []
      setFloors(Array.isArray(floorsData) ? floorsData : [])
      setTables(Array.isArray(tablesData) ? tablesData : [])
    } catch (e) {
      console.error('Load floors/tables failed', e)
      setFloors([])
      setTables([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Load menu items (aktif + tampil_menu) with optional search
  useEffect(() => {
    let ignore = false
    const run = async () => {
      try {
        const res = await fetch(`/api/reservations/preorder-menus${menuQ?`?q=${encodeURIComponent(menuQ)}`:''}`)
        const data = res.ok ? await res.json() : []
        const list = Array.isArray(data) ? data : []
        if(!ignore) setMenus(list)
      } catch {
        if(!ignore) setMenus([])
      }
    }
    run()
    return () => { ignore = true }
  }, [menuQ])

  const filteredTables = useMemo(() => {
    return tables.filter(t => !selectedFloor || t.floor_id === selectedFloor)
  }, [tables, selectedFloor])

  const totalCapacity = useMemo(() => {
    const map = new Map<number, TableItem>()
    for (const t of tables) map.set(t.id, t)
    return selectedTables.reduce((sum, id) => sum + (Number(map.get(id)?.capacity || 0)), 0)
  }, [tables, selectedTables])

  const toggleTable = (id: number) => {
    setSelectedTables(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const onSubmit = async () => {
    try {
      const body = {
        date,
        start_time: startTime,
        end_time: endTime,
        pax,
        customer_name: customerName || null,
        phone: phone || null,
        pic: pic || null,
        notes: buildNotesWithPreorder(notes, selectedMenuIds, menus),
        dp_amount: dpAmount !== '' ? Number(dpAmount.replace(/\./g,'').replace(/,/g,'.')) : null,
        dp_paid: dpPaid,
        table_ids: selectedTables,
      }
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(()=>({}))
        alert(err?.error || 'Gagal menyimpan reservasi')
        return
      }
      const result = await res.json().catch(()=>null) as any
      // Cetak nota reservasi ukuran A5
      try {
        const tablesForPrint = tables.filter(t => selectedTables.includes(t.id))
        printReservationA5({
          number: result?.number,
          date,
          startTime,
          endTime,
          pax,
          customerName,
          phone,
          pic,
          dpAmount,
          dpPaid,
          notes,
          tables: tablesForPrint,
          selectedMenus,
        })
      } catch (e) {
        console.error('Gagal membuka nota reservasi untuk cetak', e)
      }
      alert('Reservasi berhasil dibuat')
      router.push('/reservasi/booking')
    } catch (e) {
      console.error('Create reservation failed', e)
      alert('Gagal menyimpan reservasi')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tambah Booking Meja</h1>
          <p className="text-slate-500 text-xs mt-1">Isi detail reservasi, pilih lantai & meja, serta menu pre-order (opsional)</p>
        </div>
      </div>

      <div className="container-card p-3 space-y-4 text-xs min-h-[calc(100vh-200px)]">
        {loading ? (
          <div className="text-slate-500">Memuat data...</div>
        ) : (
          <>
            {/* Reservation detail */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="block">
                  <span className="block text-slate-600 mb-1">Tanggal</span>
                  <input type="date" className="w-full border rounded px-2 py-1" value={date} onChange={e=> setDate(e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-slate-600 mb-1">Mulai</span>
                    <input type="time" className="w-full border rounded px-2 py-1" value={startTime} onChange={e=> setStartTime(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="block text-slate-600 mb-1">Selesai</span>
                    <input type="time" className="w-full border rounded px-2 py-1" value={endTime} onChange={e=> setEndTime(e.target.value)} />
                  </label>
                </div>
                <label className="block">
                  <span className="block text-slate-600 mb-1">Jumlah Tamu (Pax)</span>
                  <input type="number" min={1} className="w-full border rounded px-2 py-1" value={pax} onChange={e=> setPax(parseInt(e.target.value||'0')||0)} />
                </label>
              </div>

              <div className="space-y-2">
                <label className="block">
                  <span className="block text-slate-600 mb-1">Nama Customer</span>
                  <input className="w-full border rounded px-2 py-1" value={customerName} onChange={e=> setCustomerName(e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-slate-600 mb-1">No. Telp</span>
                    <input className="w-full border rounded px-2 py-1" value={phone} onChange={e=> setPhone(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="block text-slate-600 mb-1">PIC</span>
                    <input className="w-full border rounded px-2 py-1" value={pic} onChange={e=> setPic(e.target.value)} />
                  </label>
                </div>
                <label className="flex items-end gap-2">
                  <input type="checkbox" className="h-4 w-4" checked={dpPaid} onChange={e=> setDpPaid(e.target.checked)} />
                  <span className="text-slate-700">DP Terbayar</span>
                </label>
                <label className="block">
                  <span className="block text-slate-600 mb-1">DP (opsional)</span>
                  <input className="w-full border rounded px-2 h-9" placeholder="0" value={dpAmount}
                    onChange={e=> { const v = formatCurrencyId(e.target.value); setDpAmount(v); const n = Number(v.replace(/\./g,'')); setDpPaid(n>0) }} />
                </label>
              </div>

              <div className="space-y-2">
                <label className="block">
                  <span className="block text-slate-600 mb-1">Catatan</span>
                  <textarea className="w-full border rounded px-2 py-1 h-[84px]" value={notes} onChange={e=> setNotes(e.target.value)} />
                </label>
                <label className="block">
                  <span className="block text-slate-600 mb-1">Pilih Lantai</span>
                  <select className="w-full border rounded px-2 py-1" value={selectedFloor as any} onChange={e=> setSelectedFloor(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">- Pilih Lantai -</option>
                    {floors.map(f => <option key={f.id} value={f.id}>{f.code} - {f.name}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {/* Table selection (requires floor) */}
            <div>
              <div className="text-slate-600 mb-2">Pilih Meja {selectedFloor? `(Kapasitas total: ${totalCapacity})` : ''}</div>
              {!selectedFloor ? (
                <div className="text-slate-500">Pilih lantai terlebih dahulu untuk menampilkan meja.</div>
              ) : filteredTables.length === 0 ? (
                <div className="text-slate-500">Belum ada meja aktif di lantai ini</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {filteredTables.map(t => (
                    <button key={t.id}
                      type="button"
                      onClick={()=> toggleTable(t.id)}
                      className={`p-2 rounded border text-left ${selectedTables.includes(t.id) ? 'bg-emerald-50 border-emerald-300' : 'bg-white hover:bg-slate-50'}`}>
                      <div className="font-medium">{t.code} — {t.name}</div>
                      <div className="text-[11px] text-slate-600">Kapasitas: {t.capacity || 0}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pre-order Menu (Multi-select dropdown, tanpa qty) */}
            <div className="space-y-2">
              <div className="text-slate-600">Pre-order Menu (opsional)</div>
              <div className="relative">
                <div className="border rounded px-2 py-1 min-h-[36px] flex flex-wrap gap-1 items-center cursor-text" onClick={()=> { setMenuOpen(true); setTimeout(()=> menuInputRef.current?.focus(), 0) }}>
                  {selectedMenuIds.map(id=>{
                    const m = selectedMenus.find((x:any)=> Number(x.id)===Number(id))
                    return (
                      <span key={id} className="inline-flex items-center gap-1 bg-slate-100 border rounded px-2 py-0.5 text-[12px]">
                        <span className="truncate max-w-[140px]" title={m?.name}>{m?.name || id}</span>
                        <button type="button" className="text-slate-500 hover:text-red-600" onClick={(e)=>{e.stopPropagation(); setSelectedMenuIds(prev=> prev.filter(x=> x!== Number(id))); setSelectedMenus(prev=> prev.filter((x:any)=> Number(x.id)!==Number(id)))}}>×</button>
                      </span>
                    )
                  })}
                  <input ref={menuInputRef} className="flex-1 min-w-[120px] outline-none text-[12px]" placeholder="Pilih menu..." value={menuQ} onChange={e=> { setMenuQ(e.target.value); setMenuOpen(true) }} />
                </div>
                {menuOpen && (
                  <div className="absolute z-20 mt-1 bg-white border rounded shadow w-full max-h-64 overflow-auto">
                    <div className="sticky top-0 bg-white border-b flex items-center justify-between px-2 py-1 text-[12px]">
                      <span className="text-slate-600">Pilih menu</span>
                      <button type="button" className="px-2 py-0.5 border rounded" onClick={()=> { setMenuOpen(false); setTimeout(()=> menuInputRef.current?.blur(), 0) }}>Tutup</button>
                    </div>
                    {menus.length === 0 ? (
                      <div className="px-2 py-2 text-[12px] text-slate-500">Tidak ada data</div>
                    ) : (
                      menus.map((m:any)=>{
                        const price = m.prices && m.prices[0]?.price != null ? Number(m.prices[0].price) : null
                        const selected = selectedMenuIds.includes(Number(m.id))
                        return (
                          <button key={m.id} type="button" className={`w-full text-left px-2 py-1 text-[12px] hover:bg-slate-50 flex items-center justify-between ${selected? 'bg-emerald-50':''}`}
                            onClick={()=> { 
                              setSelectedMenuIds(prev=> selected? prev.filter(x=> x!== Number(m.id)) : [...prev, Number(m.id)]);
                              setSelectedMenus(prev=> selected? prev.filter((x:any)=> Number(x.id)!==Number(m.id)) : [...prev, { id: Number(m.id), code: m.code, name: m.name }]);
                              setMenuQ(''); setTimeout(()=> menuInputRef.current?.focus(), 0) 
                            }}>
                            <div className="pr-2 truncate">
                              <div className="font-medium truncate" title={m.name}>{m.name}</div>
                              <div className="text-slate-600">{price!=null? `Rp ${price.toLocaleString('id-ID')}` : '-'}</div>
                            </div>
                            <span className={`ml-2 text-[10px] px-2 py-0.5 rounded border ${selected? 'bg-emerald-600 text-white border-emerald-600':'bg-white text-slate-600'}`}>{selected? 'Dipilih':'Pilih'}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-slate-600 text-xs">Pastikan pilih lantai terlebih dahulu, jam tidak bertabrakan, dan kapasitas ≥ pax.</div>
              <div className="flex gap-2">
                <button onClick={()=> router.push('/reservasi/booking')} className="px-3 py-1.5 rounded border">Batal</button>
                <button onClick={onSubmit} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white">Simpan</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function buildNotesWithPreorder(base: string, selectedIds: number[], menus: any[]){
  const items = (selectedIds||[]).map((id:number)=>{
    const m = menus.find((x:any)=> Number(x.id)===Number(id))
    return { id: Number(id), code: m?.code, name: m?.name }
  })
  if(items.length===0) return base || null
  const tag = `PREORDER: ${JSON.stringify(items)}`
  return base ? `${base}\n${tag}` : tag
}

function printReservationA5(params: {
    number?: string
    date: string
    startTime: string
    endTime: string
    pax: number
    customerName: string
    phone: string
    pic: string
    dpAmount: string
    dpPaid: boolean
    notes: string
    tables: { code:string; name:string }[]
    selectedMenus: any[]
  }) {
  if (typeof window === 'undefined') return
  const {
    number,
    date,
    startTime,
    endTime,
    pax,
    customerName,
    phone,
    pic,
    dpAmount,
    dpPaid,
    notes,
    tables,
    selectedMenus,
  } = params
  const tableText = tables.length ? tables.map(t => `${t.code} - ${t.name}`).join(', ') : '-'
  const preorderText = selectedMenus.length
    ? selectedMenus.map((m:any, idx:number) => `${idx+1}. ${m.name || m.code || ''}`).join('<br/>')
    : '<span style="color:#999">(Tidak ada)</span>'
  const dpText = dpAmount ? `Rp ${dpAmount}` : '-'
  const dpStatus = dpAmount ? (dpPaid ? 'SUDAH DIBAYAR' : 'BELUM DIBAYAR') : '-'
  const safeNotes = (notes || '').replace(/\n/g,'<br/>') || '<span style="color:#999">(Tidak ada)</span>'

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charSet="utf-8" />
  <title>Nota Reservasi</title>
  <style>
    @page { size: 21cm 15cm; margin: 3mm; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; color: #111827; }
    .wrapper { width: 100%; }
    .header { text-align: center; margin-bottom: 14px; }
    .header h1 { font-size: 24px; margin: 0; }
    .header small { color: #6b7280; font-size: 14px; }
    .section { margin-bottom: 12px; }
    .section-title { font-weight: 600; font-size: 16px; margin-bottom: 4px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; }
    table.meta { width: 100%; border-collapse: collapse; }
    table.meta td { padding: 3px 0; vertical-align: top; font-size: 16px; }
    table.meta td.label { width: 32%; color: #4b5563; }
    .meta-two-cols td.col { width: 50%; padding-right: 8px; }
    .meta-two-cols td.col:last-child { padding-right: 0; padding-left: 8px; }
    .preorder, .notes { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; min-height: 60px; }
  </style>
</head>
<body onload="window.print(); window.close();">
  <div class="wrapper">
    <div class="header">
      <h1>Nota Reservasi</h1>
      <small>${number ? `No: ${number}` : ''}</small>
    </div>
    <div class="section">
      <table class="meta meta-two-cols">
        <tr>
          <td class="col">
            <table class="meta">
              <tr><td class="label">Tanggal</td><td>: ${date}</td></tr>
              <tr><td class="label">Jam</td><td>: ${startTime} - ${endTime}</td></tr>
              <tr><td class="label">Jumlah Tamu</td><td>: ${pax}</td></tr>
            </table>
          </td>
          <td class="col">
            <table class="meta">
              <tr><td class="label">DP Nominal</td><td>: ${dpText}</td></tr>
              <tr><td class="label">DP Status</td><td>: ${dpStatus}</td></tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
    <div class="section">
      <div class="section-title">Customer</div>
      <table class="meta">
        <tr><td class="label">Nama</td><td>: ${customerName || '-'}</td></tr>
        <tr><td class="label">No. Telp</td><td>: ${phone || '-'}</td></tr>
        <tr><td class="label">PIC</td><td>: ${pic || '-'}</td></tr>
      </table>
    </div>
    <div class="section">
      <div class="section-title">Meja</div>
      <div>${tableText}</div>
    </div>
    <div class="section">
      <div class="section-title">Catatan</div>
      <div class="notes">${safeNotes}</div>
    </div>
    <div class="section">
      <div class="section-title">Pre-order Menu</div>
      <div class="preorder">${preorderText}</div>
    </div>
  </div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=800,height=600')
  if (!w) {
    alert('Popup untuk cetak diblokir browser. Izinkan popup untuk melanjutkan.')
    return
  }
  w.document.write(html)
  w.document.close()
}
