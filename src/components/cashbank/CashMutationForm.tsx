"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { printCashMutationById } from '@/lib/printCashMutation'
import SearchableSelect from '@/components/ui/SearchableSelect'
import type { SearchableSelectOption } from '@/components/ui/SearchableSelect'
import Input from '@/components/ui/Input'
import FormHeader from '@/components/ui/FormHeader'

type Account = { id: number; code: string; name: string }

type DetailLine = {
  temp_id: string
  account_id: number
  account_code: string
  account_name: string
  notes: string
  amount: number
}

type CashMutationFormMode = 'new' | 'edit' | 'view'

type CashMutationInitial = {
  id?: number
  mutation_number?: string
  mutation_date?: string
  cash_account_id?: number
  cash_account_code?: string
  cash_account_name?: string
  mutation_type?: 'MASUK' | 'KELUAR'
  notes?: string
  detail?: DetailLine[]
  status?: string
}

function KasBankPickerModal({ onClose, onPick }: { onClose: ()=>void; onPick: (a: Account)=>void }) {
  const [rows, setRows] = useState<Account[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const qs = query ? `?filter=kas_bank&q=${encodeURIComponent(query)}` : '?filter=kas_bank'
        const res = await fetch(`/api/accounts${qs}`, { cache: 'no-store' })
        const data = await res.json()
        const list: Account[] = (Array.isArray(data)? data: []).map((x:any)=>({ id:x.id, code:x.code, name:x.name }))
        setRows(list)
      } catch { setRows([]) }
    }
    load()
  }, [query])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-modal shadow-2xl w-[800px] max-w-[95vw] max-h-[85vh] flex flex-col">
        <div className="p-3 border-b flex items-center justify-between shrink-0">
          <div className="font-medium text-sm">Pilih Akun Kas/Bank</div>
          <button className="text-sm text-slate-500 hover:text-slate-700" onClick={onClose}>Tutup</button>
        </div>
        <div className="p-3 border-b shrink-0">
          <input className="w-full rounded-pill border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-primary focus:ring-2 focus:ring-teal-bg" placeholder="Cari kode/nama akun..." value={query} onChange={(e)=>setQuery(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2">Kode</th>
                <th className="px-3 py-2">Nama Akun</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length===0? (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">Tidak ada data</td></tr>
              ): rows.map(a => (
                <tr key={a.id} className="border-t hover:bg-teal-bg/50">
                  <td className="px-3 py-2 font-medium">{a.code}</td>
                  <td className="px-3 py-2">{a.name}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white text-xs" onClick={()=> onPick(a)}>Pilih</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PerkiraanPickerModal({ onClose, onApply }: { onClose: ()=>void; onApply: (rows: { temp_id: string; account_id: number; account_code: string; account_name: string }[])=>void }) {
  const [rows, setRows] = useState<any[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const qs = query ? `?q=${encodeURIComponent(query)}` : ''
        const res = await fetch(`/api/accounts${qs}`, { cache: 'no-store' })
        const data = await res.json()
        const list = Array.isArray(data) ? data : []
        setRows(list)
      } catch { setRows([]) }
    }
    load()
  }, [query])

  const selected = useMemo(() => rows.filter((r:any) => checked[String(r.id)]).map((a:any) => ({
    temp_id: `${a.id}`,
    account_id: a.id,
    account_code: a.code,
    account_name: a.name,
  })), [rows, checked])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-modal shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col">
        <div className="p-3 border-b flex items-center justify-between shrink-0">
          <div className="font-medium text-sm">Pilih Perkiraan</div>
          <button className="text-sm text-slate-500 hover:text-slate-700" onClick={onClose}>Tutup</button>
        </div>
        <div className="p-3 border-b shrink-0">
          <input className="w-full rounded-pill border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-primary focus:ring-2 focus:ring-teal-bg" placeholder="Cari kode/nama akun..." value={query} onChange={(e)=>setQuery(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2 w-10"><input type="checkbox" onChange={(e)=>{
                  const v = e.target.checked
                  const obj: Record<string, boolean> = {}
                  rows.forEach((r:any) => obj[String(r.id)] = v)
                  setChecked(obj)
                }} /></th>
                <th className="px-3 py-2">Kode</th>
                <th className="px-3 py-2">Nama Akun</th>
              </tr>
            </thead>
            <tbody>
              {rows.length===0? (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">Tidak ada data</td></tr>
              ): rows.map((r:any) => (
                <tr key={r.id} className="border-t hover:bg-teal-bg/50">
                  <td className="px-3 py-2"><input type="checkbox" checked={!!checked[String(r.id)]} onChange={(e)=> setChecked(prev => ({ ...prev, [String(r.id)]: e.target.checked }))} /></td>
                  <td className="px-3 py-2 font-medium">{r.code}</td>
                  <td className="px-3 py-2">{r.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t flex items-center justify-between text-sm shrink-0">
          <div>Dipilih: {selected.length} akun</div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50" onClick={()=> setChecked({})}>Hapus Pilihan</button>
            <button className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white" onClick={()=> onApply(selected)}>Terapkan</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CashMutationForm({
  mode,
  initial,
  mutationId,
  onSaved,
}: {
  mode: CashMutationFormMode
  initial?: CashMutationInitial
  mutationId?: number
  onSaved?: (info: { id: number; mutationNumber: string }) => void
}) {
  const isView = mode === 'view'
  const isEdit = mode === 'edit'
  const isNew = mode === 'new'
  const headerDisabled = isView || isEdit
  const isVoided = !!initial?.status && String(initial.status) === 'void'

  const [mutationCode, setMutationCode] = useState(initial?.mutation_number || 'Auto Generate MT/YYYY/NNNNNN')
  const [mutationDate, setMutationDate] = useState(initial?.mutation_date || new Date().toISOString().slice(0,10))
  const [allowBackdate, setAllowBackdate] = useState(true)
  const [kasBankId, setKasBankId] = useState<number|''>(initial?.cash_account_id ?? ('' as any))
  const [kasBankCode, setKasBankCode] = useState(initial?.cash_account_code || '')
  const [kasBankText, setKasBankText] = useState(initial?.cash_account_code && initial?.cash_account_name ? `${initial.cash_account_code} - ${initial.cash_account_name}` : '')
  const [mutationType, setMutationType] = useState<'MASUK'|'KELUAR'>(initial?.mutation_type || 'MASUK')
  const [notes, setNotes] = useState(initial?.notes || '')

  const [lines, setLines] = useState<DetailLine[]>(() => (initial?.detail || []).map((d, i) => ({ ...d, temp_id: d.temp_id || `init_${i}` })))
  const [accountOptions, setAccountOptions] = useState<SearchableSelectOption[]>([])
  const [accountsMap, setAccountsMap] = useState<Record<number, { code: string; name: string }>>({})
  const [showKasModal, setShowKasModal] = useState(false)
  const [showPerkModal, setShowPerkModal] = useState(false)
  const [printPrompt, setPrintPrompt] = useState<{ id: number; number: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingInit, setLoadingInit] = useState(false)
  const nextLineId = useRef(initial?.detail?.length || 0)

  const total = lines.reduce((a,b)=> a + (Number(b.amount)||0), 0)

  const addLine = () => {
    nextLineId.current += 1
    setLines(prev => [...prev, {
      temp_id: `new_${nextLineId.current}`,
      account_id: 0,
      account_code: '',
      account_name: '',
      notes: '',
      amount: 0,
    }])
  }

  const formatID = (n:number)=> new Intl.NumberFormat('id-ID').format(n)
  const numKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey||e.metaKey||['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return
    if (!/^\d$/.test(e.key)) e.preventDefault()
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setAllowBackdate(d.backdate_permissions?.['keu_mutasi_kas_bank'] ?? d.allow_backdate === true)
    }).catch(() => setAllowBackdate(false))
  }, [])

  useEffect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(data => {
        const list: any[] = Array.isArray(data) ? data : []
        const map: Record<number, { code: string; name: string }> = {}
        const opts: SearchableSelectOption[] = list.map(a => {
          map[a.id] = { code: a.code, name: a.name }
          return { value: a.id, label: `${a.code} - ${a.name}` }
        })
        setAccountsMap(map)
        setAccountOptions(opts)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!allowBackdate) {
      const today = new Date().toISOString().slice(0, 10)
      if (mutationDate !== today) setMutationDate(today)
    }
  }, [allowBackdate])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const detail = lines
        .filter(l => l.account_id && l.account_code && Number(l.amount) > 0)
        .map((l) => ({ account_id: l.account_id, account_code: l.account_code, notes: l.notes || '', amount: Number(l.amount)||0 }))
      if (!mutationDate || !kasBankId || !kasBankCode || detail.length===0) {
        alert('Lengkapi tanggal, kas/bank, dan minimal satu baris detail dengan nominal > 0')
        return
      }
      const payload = {
        mutation_date: mutationDate,
        cash_account_id: kasBankId,
        cash_account_code: kasBankCode,
        mutation_type: mutationType,
        notes,
        detail,
      }

      let result: any
      if (isEdit && mutationId) {
        const res = await fetch(`/api/cash-mutations/${mutationId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) { const t = await res.text(); throw new Error(t) }
        result = await res.json()
      } else {
        const res = await fetch('/api/cash-mutations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) { const t = await res.text(); throw new Error(t) }
        result = await res.json()
      }
      if (onSaved) {
        onSaved({ id: result.id, mutationNumber: result.mutation_number || '' })
      } else {
        setPrintPrompt({ id: result.id, number: result.mutation_number || '' })
      }
    } catch (e:any) {
      alert('Gagal menyimpan: ' + (e?.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const navigateToList = () => {
    window.location.href = '/keuangan/mutasi-kas-bank'
  }

  if (loadingInit) return <PageLoading />

  return (
    <div className="space-y-4">
      <FormHeader
        title={isView ? 'Detail Mutasi Kas/Bank' : isEdit ? 'Edit Mutasi Kas/Bank' : 'Mutasi Kas/Bank - Baru'}
        subtitle={isView ? 'Informasi mutasi kas/bank' : isEdit ? 'Ubah data mutasi kas/bank' : 'Buat mutasi kas/bank baru'}
        backHref="/keuangan/mutasi-kas-bank"
      />

      {isVoided && (
        <div className="bg-pink-50 text-pink-800 px-4 py-2 rounded-lg text-sm font-medium">Mutasi ini sudah void</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="container-card p-3 text-xs space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Kode Nota</span>
            <Input disabled value={mutationCode} onChange={(e: any) => setMutationCode(e.target.value)} className="text-xs" />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Tanggal</span>
            {headerDisabled ? (
              <Input type="text" disabled value={mutationDate} className="text-xs" />
            ) : (
              <input type="date" className="input text-xs" value={mutationDate} onChange={(e) => setMutationDate(e.target.value)} />
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Kas/Bank</span>
            {headerDisabled ? (
              <Input disabled value={kasBankText || '-'} className="text-xs" />
            ) : (
              <div className="flex-1 flex gap-2">
                <Input readOnly placeholder="Pilih kas/bank..." value={kasBankText} className="text-xs flex-1" />
                <button type="button" className="px-2 py-1 text-xs rounded-pill border border-slate-300 hover:bg-slate-50" onClick={()=> setShowKasModal(true)}>Cari</button>
                {kasBankId && (
                  <button type="button" className="px-2 py-1 text-xs rounded-pill border border-slate-300 hover:bg-slate-50" onClick={()=> { setKasBankId('' as any); setKasBankCode(''); setKasBankText('') }}>Reset</button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Mutasi</span>
            {headerDisabled ? (
              <Input disabled value={mutationType === 'MASUK' ? 'Masuk' : 'Keluar'} className="text-xs" />
            ) : (
              <select className="input text-xs" value={mutationType} onChange={(e)=> setMutationType(e.target.value as any)}>
                <option value="MASUK">Masuk</option>
                <option value="KELUAR">Keluar</option>
              </select>
            )}
          </div>
        </div>

        <div className="container-card p-3 text-xs space-y-3">
          <div className="font-medium text-sm">Ringkasan</div>
          <div className="p-1.5 rounded bg-teal-bg">
            <div className="text-slate-500 text-xs">Total Nominal</div>
            <div className="text-lg font-semibold text-teal-dark">{formatID(total)}</div>
            <div className="mt-1 text-[11px] text-slate-500">Jenis Mutasi: {mutationType}</div>
          </div>
        </div>
      </div>

      <div className="container-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Detail Mutasi</div>
            <div className="text-xs text-slate-500">Akun lawan mutasi kas/bank</div>
          </div>
          {!isView && !isVoided && (
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50" onClick={addLine}>+ Tambah Baris</button>
              <button className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white" onClick={()=> setShowPerkModal(true)}>Pilih Perkiraan</button>
            </div>
          )}
        </div>
        <div className="max-h-[440px] overflow-auto border rounded">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2 w-[220px]">Perkiraan</th>
                <th className="px-3 py-2">Keterangan</th>
                <th className="px-3 py-2 text-right w-[130px]">Nominal</th>
                {!isView && !isVoided && <th className="px-3 py-2 text-right w-[60px]">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {lines.length===0? (
                <tr><td colSpan={isView ? 3 : 4} className="px-3 py-6 text-center text-slate-500">Belum ada baris</td></tr>
              ) : lines.map(x => (
                <tr key={x.temp_id} className="border-t hover:bg-teal-bg/50">
                  <td className="px-3 py-2 w-[220px]">
                    {isView || isVoided ? (
                      <span className="text-sm">{x.account_code ? `${x.account_code} - ${x.account_name}` : '-'}</span>
                    ) : (
                      <SearchableSelect
                        options={accountOptions}
                        value={x.account_id || null}
                        onChange={(v) => {
                          const acct = v ? accountsMap[Number(v)] : null
                          setLines(prev => prev.map(r =>
                            r.temp_id === x.temp_id
                              ? { ...r, account_id: Number(v) || 0, account_code: acct?.code || '', account_name: acct?.name || '' }
                              : r
                          ))
                        }}
                        placeholder="Cari perkiraan..."
                        allowClear={false}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isView || isVoided ? (
                      <span>{x.notes || '-'}</span>
                    ) : (
                      <input className="w-full border border-slate-300 rounded-pill px-2 py-1 text-xs" value={x.notes} onChange={(e)=> setLines(prev => prev.map(r => r.temp_id===x.temp_id? { ...r, notes: e.target.value }: r))} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right w-[130px]">
                    {isView || isVoided ? (
                      <span className="font-medium">{formatID(x.amount)}</span>
                    ) : (
                      <input
                        type="text" inputMode="numeric"
                        className="input text-right border-teal-primary/40 focus:ring-teal-primary/30"
                        value={formatID(x.amount)}
                        onKeyDown={numKeyDown}
                        onFocus={(e)=>{ e.currentTarget.select(); e.currentTarget.value = String(x.amount) }}
                        onClick={(e)=>{ (e.currentTarget as HTMLInputElement).select() }}
                        onBlur={(e)=>{
                          const raw = Number((e.currentTarget.value||'0').toString().replace(/\./g,'').replace(/,/g,''))
                          const v = Math.max(0, raw)
                          setLines(prev => prev.map(r => r.temp_id===x.temp_id? { ...r, amount: v }: r))
                        }}
                        onChange={(e)=>{
                          const raw = (e.currentTarget.value||'').toString().replace(/\./g,'').replace(/,/g,'')
                          const n = Number(raw||0)
                          setLines(prev => prev.map(r => r.temp_id===x.temp_id? { ...r, amount: n }: r))
                        }}
                      />
                    )}
                  </td>
                  {!isView && !isVoided && (
                    <td className="px-3 py-2 text-right w-[60px]">
                      <button className="text-xs text-red-600 hover:text-red-800" onClick={()=> setLines(prev => prev.filter(r => r.temp_id !== x.temp_id))}>Hapus</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!isView && !isVoided && (
        <div className="container-card p-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Catatan</span>
            <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary min-h-[56px] resize-none" value={notes} onChange={(e)=> setNotes(e.target.value)} />
          </div>
        </div>
      )}
      {isView && notes && (
        <div className="container-card p-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Catatan</span>
            <div className="text-xs">{notes}</div>
          </div>
        </div>
      )}

      {!isView && !isVoided && (
        <div className="sticky bottom-0 bg-white p-3 border-t flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="text-slate-600 text-xs">Total</div>
            <div className="font-semibold text-teal-primary text-lg">{formatID(total)}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { window.location.href = '/keuangan/mutasi-kas-bank' }} className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50">Batal</button>
            <button onClick={handleSave} disabled={saving || !kasBankId || lines.length===0 || lines.every(l => !l.account_id || !l.amount)} className={`px-3 py-1.5 rounded-pill text-white ${saving || !kasBankId || lines.length===0 || lines.every(l => !l.account_id || !l.amount) ? 'bg-slate-400 cursor-not-allowed' : 'bg-teal-primary hover:bg-teal-dark'}`}>
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan'}
            </button>
          </div>
        </div>
      )}
      {isView && (
        <div className="flex justify-end">
          <Link href="/keuangan/mutasi-kas-bank" className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50">Kembali</Link>
        </div>
      )}

      {showKasModal && (
        <KasBankPickerModal
          onClose={()=> setShowKasModal(false)}
          onPick={(a)=>{ setKasBankId(a.id as any); setKasBankCode(a.code); setKasBankText(`${a.code} - ${a.name}`); setShowKasModal(false) }}
        />
      )}

      {showPerkModal && (
        <PerkiraanPickerModal
          onClose={()=> setShowPerkModal(false)}
          onApply={(rows)=>{
            setLines(prev => {
              const map = new Map(prev.map(x => [x.temp_id, x]))
              rows.forEach(r => {
                const existing = map.get(r.temp_id)
                map.set(r.temp_id, {
                  temp_id: r.temp_id,
                  account_id: r.account_id,
                  account_code: r.account_code,
                  account_name: r.account_name,
                  notes: existing?.notes || '',
                  amount: Number(existing?.amount || 0),
                })
              })
              return Array.from(map.values())
            })
            setShowPerkModal(false)
          }}
        />
      )}

      {printPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl w-[420px] max-w-[95vw]">
            <div className="p-3 border-b font-medium text-sm">Cetak Slip Mutasi Kas/Bank</div>
            <div className="p-4 text-sm">
              <div className="text-slate-600 mb-1">Nomor: {printPrompt.number}</div>
              <div className="text-slate-600">Apakah Anda ingin langsung mencetak slip mutasi kas/bank (A5)?</div>
            </div>
            <div className="p-3 border-t flex items-center justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50"
                onClick={() => { window.location.href = '/keuangan/mutasi-kas-bank' }}
              >Tidak</button>
              <button
                className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white"
                onClick={async () => {
                  await printCashMutationById(printPrompt.id)
                  window.location.href = '/keuangan/mutasi-kas-bank'
                }}
              >Ya, Cetak</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
