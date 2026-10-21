"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Checkbox from '@/components/ui/Checkbox'
import Button from '@/components/ui/Button'
import FormHeader from '@/components/ui/FormHeader'

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
  const [pax, setPax] = useState<string>('')
  const [customerName, setCustomerName] = useState<string>('')
  const [pic, setPic] = useState<string>('')
  const [company, setCompany] = useState<string>('')
  const [phone, setPhone] = useState<string>('')
  const [dpAmount, setDpAmount] = useState<string>('')
  const [dpPaid, setDpPaid] = useState<boolean>(false)
  const [transferName, setTransferName] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [selectedFloors, setSelectedFloors] = useState<number[]>([])
  const [selectedTables, setSelectedTables] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [printPrompt, setPrintPrompt] = useState<{ number: string | null }>({ number: null })

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
        fetch('/api/meja?active=1&limit=200'),
      ])
      const floorsData = rf.ok ? await rf.json() : []
      const tablesData = rt.ok ? await rt.json() : []
      const fl = Array.isArray(floorsData) ? floorsData : (Array.isArray(floorsData?.rows) ? floorsData.rows : [])
      fl.sort((a: any, b: any) => (a.levelNo ?? 999) - (b.levelNo ?? 999))
      setFloors(fl)
      setTables(Array.isArray(tablesData) ? tablesData : (Array.isArray(tablesData?.rows) ? tablesData.rows : []))
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
    if (!selectedFloors.length) return []
    const floorSet = new Set(selectedFloors)
    return tables.filter(t => t.floor_id && floorSet.has(Number(t.floor_id)))
  }, [tables, selectedFloors])

  const totalCapacity = useMemo(() => {
    const map = new Map<number, TableItem>()
    for (const t of tables) map.set(t.id, t)
    return selectedTables.reduce((sum, id) => sum + (Number(map.get(id)?.capacity || 0)), 0)
  }, [tables, selectedTables])

  const toggleTable = (id: number) => {
    setSelectedTables(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const onSubmit = async () => {
    if (saving) return
    // Validasi required fields
    if (!customerName.trim()) { alert('Nama Customer wajib diisi'); return }
    if (!phone.trim()) { alert('No. Telp wajib diisi'); return }
    if (!pax || Number(pax) <= 0) { alert('Jumlah Tamu wajib diisi'); return }
    if (selectedTables.length === 0) { alert('Pilih minimal satu meja'); return }
    setSaving(true)
    try {
      const body = {
        date,
        start_time: startTime,
        end_time: endTime,
        pax: Math.max(0, parseInt((pax || '0'), 10) || 0),
        customer_name: customerName || null,
        pic: pic || null,
        company: company || null,
        phone: phone || null,
        notes: buildNotesWithPreorder(notes, selectedMenuIds, menus),
        transfer_name: transferName || null,
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
      setPrintPrompt({ number: result?.number || null })
    } catch (e) {
      console.error('Create reservation failed', e)
      alert('Gagal menyimpan reservasi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <FormHeader title="Tambah Booking Meja" subtitle="Isi detail reservasi, pilih lantai & meja, serta menu pre-order (opsional)" backHref="/reservasi/booking" />

      <div className="container-card p-3 text-xs space-y-3">
        {loading ? (
          <div className="text-slate-500">Memuat data...</div>
        ) : (
          <>
            {/* Reservasi Detail */}
            <div className="grid grid-cols-1 gap-3">
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Tanggal</span>
                <Input type="date" value={date} onChange={e=> setDate(e.target.value)} />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Jam Mulai</span>
                <Input type="time" value={startTime} onChange={e=> setStartTime(e.target.value)} className="max-w-[160px]" />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Jam Selesai</span>
                <Input type="time" value={endTime} onChange={e=> setEndTime(e.target.value)} className="max-w-[160px]" />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-28 text-slate-600 shrink-0">Jumlah Tamu <span className="text-red-500">*</span></span>
                <Input type="number" min={1} placeholder="0" value={pax} onChange={e=> setPax(e.target.value)} className="max-w-[120px]" />
              </label>
            </div>

            {/* Customer Info */}
            <div className="border-t pt-3">
              <div className="text-sm font-semibold text-slate-700 mb-3">Informasi Customer</div>
              <div className="grid grid-cols-1 gap-3">
                <label className="flex items-center gap-3">
                  <span className="w-28 text-slate-600 shrink-0">Nama Customer <span className="text-red-500">*</span></span>
                  <Input value={customerName} onChange={e=> setCustomerName(e.target.value)} />
                </label>
                <label className="flex items-center gap-3">
                  <span className="w-28 text-slate-600 shrink-0">PIC</span>
                  <Input value={pic} onChange={e=> setPic(e.target.value)} />
                </label>
                <label className="flex items-center gap-3">
                  <span className="w-28 text-slate-600 shrink-0">Perusahaan</span>
                  <Input value={company} onChange={e=> setCompany(e.target.value)} />
                </label>
                <label className="flex items-center gap-3">
                  <span className="w-28 text-slate-600 shrink-0">No. Telp <span className="text-red-500">*</span></span>
                  <Input value={phone} onChange={e=> setPhone(e.target.value)} />
                </label>
              </div>
            </div>

            {/* DP Info */}
            <div className="border-t pt-3">
              <div className="text-sm font-semibold text-slate-700 mb-3">Uang Muka (DP)</div>
              <div className="grid grid-cols-1 gap-3">
                <label className="flex items-center gap-3">
                  <span className="w-28 text-slate-600 shrink-0">Transfer A/N</span>
                  <Input placeholder="Opsional" value={transferName} onChange={e=> setTransferName(e.target.value)} />
                </label>
                <label className="flex items-center gap-3">
                  <span className="w-28 text-slate-600 shrink-0">Nominal DP</span>
                  <Input placeholder="0" value={dpAmount} onChange={e=> { const v = formatCurrencyId(e.target.value); setDpAmount(v) }} className="max-w-[200px]" />
                </label>
                <label className="flex items-center gap-3">
                  <span className="w-28 text-slate-600 shrink-0"></span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={dpPaid} onChange={e=> setDpPaid(e.target.checked)} />
                    <span className="text-slate-700">DP Terbayar</span>
                  </label>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t pt-3">
              <div className="text-sm font-semibold text-slate-700 mb-3">Catatan</div>
              <label className="flex items-start gap-3">
                <span className="w-28 text-slate-600 shrink-0 pt-2">Catatan</span>
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary min-h-[80px] resize-none" value={notes} onChange={e=> setNotes(e.target.value)} />
              </label>
            </div>

            {/* Floor & Table Selection */}
            <div className="border-t pt-3">
              <div className="text-sm font-semibold text-slate-700 mb-3">Pilih Lantai & Meja</div>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-28 text-slate-600 shrink-0 pt-2">Lantai</span>
                  <div className="flex-1">
                    <div className="border border-slate-300 rounded-lg px-3 py-2 max-h-32 overflow-auto space-y-1 bg-white">
                      {floors.length === 0 ? (
                        <div className="text-slate-500 text-xs py-1">Belum ada data lantai</div>
                      ) : (
                        floors.map(f => {
                          const checked = selectedFloors.includes(f.id)
                          return (
                            <div key={f.id} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer select-none" onClick={() => {
                              setSelectedFloors(prev => checked ? prev.filter(id => id !== f.id) : [...prev, f.id])
                            }}>
                              <Checkbox checked={checked} onChange={() => {}} />
                              <span>{f.code} — {f.name}</span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Selection */}
              <div className="mt-3">
                {!selectedFloors.length ? (
                  <div className="text-slate-500 text-xs">Pilih minimal satu lantai terlebih dahulu untuk menampilkan meja.</div>
                ) : filteredTables.length === 0 ? (
                  <div className="text-slate-500 text-xs">Belum ada meja aktif di lantai ini</div>
                ) : (
                  <>
                    <div className="text-xs text-slate-600 mb-2">Kapasitas total: {totalCapacity} pax</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {filteredTables.map(t => (
                        <button key={t.id}
                          type="button"
                          onClick={()=> toggleTable(t.id)}
                          className={`p-2 rounded-lg border text-left transition-colors ${selectedTables.includes(t.id) ? 'bg-teal-bg border-teal-primary' : 'bg-white hover:bg-slate-50 border-slate-300'}`}>
                          <div className="font-medium text-xs">{t.code} — {t.name}</div>
                          <div className="text-[11px] text-slate-600">Kapasitas: {t.capacity || 0}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Pre-order Menu */}
            <div className="border-t pt-3">
              <div className="text-sm font-semibold text-slate-700 mb-3">Pre-order Menu (Opsional)</div>
              <div className="relative">
                <div className="border border-slate-300 rounded-lg px-3 py-2 min-h-[40px] flex flex-wrap gap-1 items-center cursor-text bg-white hover:border-slate-400 focus-within:ring-2 focus-within:ring-teal-bg focus-within:border-teal-primary" onClick={()=> { setMenuOpen(true); setTimeout(()=> menuInputRef.current?.focus(), 0) }}>
                  {selectedMenuIds.map(id=>{
                    const m = selectedMenus.find((x:any)=> Number(x.id)===Number(id))
                    return (
                      <span key={id} className="inline-flex items-center gap-1 bg-teal-bg border border-teal-primary rounded-full px-2 py-0.5 text-[12px]">
                        <span className="truncate max-w-[140px]" title={m?.name}>{m?.name || id}</span>
                        <button type="button" className="text-slate-500 hover:text-red-600" onClick={(e)=>{e.stopPropagation(); setSelectedMenuIds(prev=> prev.filter(x=> x!== Number(id))); setSelectedMenus(prev=> prev.filter((x:any)=> Number(x.id)!==Number(id)))}}>×</button>
                      </span>
                    )
                  })}
                  <input ref={menuInputRef} className="flex-1 min-w-[120px] outline-none text-[12px]" placeholder="Pilih menu..." value={menuQ} onChange={e=> { setMenuQ(e.target.value); setMenuOpen(true) }} />
                </div>
                {menuOpen && (
                  <div className="absolute z-20 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg w-full max-h-64 overflow-auto">
                    <div className="sticky top-0 bg-white border-b flex items-center justify-between px-3 py-2 text-[12px]">
                      <span className="text-slate-600">Pilih menu</span>
                      <button type="button" className="px-2 py-0.5 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50" onClick={()=> { setMenuOpen(false); setTimeout(()=> menuInputRef.current?.blur(), 0) }}>Tutup</button>
                    </div>
                    {menus.length === 0 ? (
                      <div className="px-3 py-2 text-[12px] text-slate-500">Tidak ada data</div>
                    ) : (
                      menus.map((m:any)=>{
                        const price = m.prices && m.prices[0]?.price != null ? Number(m.prices[0].price) : null
                        const selected = selectedMenuIds.includes(Number(m.id))
                        return (
                          <button key={m.id} type="button" className={`w-full text-left px-3 py-2 text-[12px] hover:bg-teal-bg flex items-center justify-between ${selected? 'bg-teal-bg':''}`}
                            onClick={()=> { 
                              setSelectedMenuIds(prev=> selected? prev.filter(x=> x!== Number(m.id)) : [...prev, Number(m.id)]);
                              setSelectedMenus(prev=> selected? prev.filter((x:any)=> Number(x.id)!==Number(m.id)) : [...prev, { id: Number(m.id), code: m.code, name: m.name }]);
                              setMenuQ(''); setTimeout(()=> menuInputRef.current?.focus(), 0) 
                            }}>
                            <div className="pr-2 truncate">
                              <div className="font-medium truncate" title={m.name}>{m.name}</div>
                              <div className="text-slate-600">{price!=null? `Rp ${price.toLocaleString('id-ID')}` : '-'}</div>
                            </div>
                            <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full border ${selected? 'bg-teal-primary text-white border-teal-primary':'bg-white text-slate-600 border-slate-300'}`}>{selected? 'Dipilih':'Pilih'}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={()=> router.push('/reservasi/booking')}>Batal</Button>
              <Button onClick={onSubmit} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </>
        )}
      </div>
      {(printPrompt.number) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col">
            <div className="p-3 border-b flex items-center justify-between shrink-0">
              <div className="font-medium text-sm">Reservasi Tersimpan</div>
              <button onClick={() => { setPrintPrompt({ number: null }); router.push('/reservasi/booking') }} className="text-sm text-slate-500 hover:text-slate-700">Tutup</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-sm text-slate-700 mb-4">
                Reservasi <span className="font-mono font-semibold">{printPrompt.number}</span> berhasil dibuat.
                <br />
                Apakah ingin langsung cetak nota reservasi A5 sekarang?
              </p>
            </div>
            <div className="p-3 border-t flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={() => { setPrintPrompt({ number: null }); router.push('/reservasi/booking') }}>Tidak</Button>
              <Button onClick={async () => {
                const tablesForPrint = tables.filter(t => selectedTables.includes(t.id))
                const currentNumber = printPrompt.number || undefined
                setPrintPrompt({ number: null })
                try {
                  printReservationA5({
                    number: currentNumber,
                    date,
                    startTime,
                    endTime,
                    pax,
                    customerName,
                    pic,
                    company,
                    phone,
                    transferName,
                    dpAmount,
                    dpPaid,
                    notes,
                    tables: tablesForPrint,
                    selectedMenus,
                  })
                } catch (e) {
                  console.error('Gagal membuka nota reservasi untuk cetak', e)
                }
                router.push('/reservasi/booking')
              }}>Ya, Cetak</Button>
            </div>
          </div>
        </div>
      )}
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
    pic: string
    company: string
    phone: string
    transferName: string
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
    pic,
    company,
    phone,
    transferName,
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
        <tr><td class="label">PIC</td><td>: ${pic || '-'}</td></tr>
        <tr><td class="label">Perusahaan</td><td>: ${company || '-'}</td></tr>
        <tr><td class="label">No. Telp</td><td>: ${phone || '-'}</td></tr>
        <tr><td class="label">Transfer A/N</td><td>: ${transferName || '-'}</td></tr>
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
