"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { printMemorialJournalById } from '@/lib/printMemorialJournal'
import SearchableSelect from '@/components/ui/SearchableSelect'
import type { SearchableSelectOption } from '@/components/ui/SearchableSelect'
import Input from '@/components/ui/Input'
import FormHeader from '@/components/ui/FormHeader'

type DetailLine = {
  temp_id: string
  account_id: number
  account_code: string
  account_name: string
  notes: string
  debit: number
  credit: number
}

type MemorialJournalFormMode = 'new' | 'edit' | 'view'

type MemorialJournalInitial = {
  id?: number
  journal_number?: string
  journal_date?: string
  notes?: string
  detail?: DetailLine[]
  status?: string
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

export default function MemorialJournalForm({
  mode,
  initial,
  journalId,
  onSaved,
}: {
  mode: MemorialJournalFormMode
  initial?: MemorialJournalInitial
  journalId?: number
  onSaved?: (info: { id: number; journalNumber: string }) => void
}) {
  const isView = mode === 'view'
  const isEdit = mode === 'edit'
  const headerDisabled = isView || isEdit
  const isVoided = !!initial?.status && String(initial.status) === 'void'

  const [journalCode, setJournalCode] = useState(initial?.journal_number || 'Auto Generate JM/YYYY/NNNNNN')
  const [journalDate, setJournalDate] = useState(initial?.journal_date || new Date().toISOString().slice(0, 10))
  const [allowBackdate, setAllowBackdate] = useState(true)
  const [notes, setNotes] = useState(initial?.notes || '')

  const [lines, setLines] = useState<DetailLine[]>(() => (initial?.detail || []).map((d, i) => ({ ...d, temp_id: d.temp_id || `init_${i}` })))
  const [accountOptions, setAccountOptions] = useState<SearchableSelectOption[]>([])
  const [accountsMap, setAccountsMap] = useState<Record<number, { code: string; name: string }>>({})
  const [showPerkModal, setShowPerkModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const nextLineId = useRef(initial?.detail?.length || 0)

  const formatID = (n:number)=> new Intl.NumberFormat('id-ID').format(n)
  const numKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.ctrlKey||e.metaKey||['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return; if (!/^\d$/.test(e.key)) e.preventDefault() }

  const addLine = () => {
    nextLineId.current += 1
    setLines(prev => [...prev, {
      temp_id: `new_${nextLineId.current}`,
      account_id: 0,
      account_code: '',
      account_name: '',
      notes: '',
      debit: 0,
      credit: 0,
    }])
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setAllowBackdate(d.backdate_permissions?.['keu_jurnal_memorial'] ?? d.allow_backdate === true)
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
      if (journalDate !== today) setJournalDate(today)
    }
  }, [allowBackdate])

  const totalDebit = useMemo(() => lines.reduce((a, b) => a + (Number(b.debit) || 0), 0), [lines])
  const totalCredit = useMemo(() => lines.reduce((a, b) => a + (Number(b.credit) || 0), 0), [lines])
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.0001 && totalDebit > 0

  const canSave = useMemo(() => {
    if (!journalDate) return false
    const valid = lines.filter(l => l.account_id && l.account_code && ((l.debit > 0) !== (l.credit > 0)))
    if (valid.length === 0) return false
    return isBalanced
  }, [journalDate, lines, isBalanced])

  const handleSave = async () => {
    if (saving) return
    if (!canSave) { alert('Jurnal belum balance atau tidak ada baris valid'); return }
    setSaving(true)
    try {
      const detail = lines
        .filter(l => l.account_id && l.account_code)
        .map(l => ({
          account_id: l.account_id,
          account_code: l.account_code,
          notes: l.notes || '',
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        }))
      const payload = { journal_date: journalDate, notes, detail }

      let result: any
      if (isEdit && journalId) {
        const res = await fetch(`/api/memorial-journals/${journalId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) { const t = await res.text(); throw new Error(t) }
        result = await res.json()
      } else {
        const res = await fetch('/api/memorial-journals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) { const t = await res.text(); throw new Error(t) }
        result = await res.json()
      }
      if (onSaved) {
        onSaved({ id: result.id, journalNumber: result.journal_number || '' })
      } else {
        setPrintPrompt({ id: result.id, number: result.journal_number || '' })
      }
    } catch (e: any) {
      alert('Gagal menyimpan: ' + (e?.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const [printPrompt, setPrintPrompt] = useState<{ id: number; number: string } | null>(null)

  const navigateToList = () => {
    window.location.href = '/keuangan/jurnal-memorial'
  }

  return (
    <div className="space-y-4">
      <FormHeader
        title={isView ? 'Detail Jurnal Memorial' : isEdit ? 'Edit Jurnal Memorial' : 'Jurnal Memorial - Baru'}
        subtitle={isView ? 'Informasi jurnal memorial' : isEdit ? 'Ubah jurnal memorial' : 'Buat jurnal memorial baru'}
        backHref="/keuangan/jurnal-memorial"
      />

      {isVoided && (
        <div className="bg-coral-bg text-coral-dark px-4 py-2 rounded-lg text-sm font-medium">Jurnal ini sudah void</div>
      )}

      <div className="container-card p-3 text-xs space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-28 text-slate-600 shrink-0">Kode Nota</span>
          <Input disabled value={journalCode} className="text-xs" />
        </div>
        <div className="flex items-center gap-3">
          <span className="w-28 text-slate-600 shrink-0">Tanggal</span>
          {headerDisabled ? (
            <Input type="text" disabled value={journalDate} className="text-xs" />
          ) : (
            <input type="date" className="input text-xs" value={journalDate} onChange={(e) => setJournalDate(e.target.value)} />
          )}
        </div>
      </div>

      <div className="container-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Detail Jurnal</div>
            <div className="text-xs text-slate-500">Entri jurnal (debit = kredit)</div>
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
                <th className="px-3 py-2 text-right w-[130px]">Debit</th>
                <th className="px-3 py-2 text-right w-[130px]">Kredit</th>
                {!isView && !isVoided && <th className="px-3 py-2 text-right w-[60px]">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {lines.length===0? (
                <tr><td colSpan={isView ? 4 : 5} className="px-3 py-6 text-center text-slate-500">Belum ada baris</td></tr>
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
                      <span className="font-medium text-emerald-700">{formatID(x.debit)}</span>
                    ) : (
                      <input
                        type="text" inputMode="numeric"
                        className="input text-right border-teal-primary/40 focus:ring-teal-primary/30"
                        value={formatID(x.debit)}
                        onKeyDown={numKeyDown}
                        onFocus={(e)=>{ e.currentTarget.select(); e.currentTarget.value = String(x.debit) }}
                        onClick={(e)=>{ (e.currentTarget as HTMLInputElement).select() }}
                        onBlur={(e)=>{
                          const raw = Number((e.currentTarget.value||'0').toString().replace(/\./g,'').replace(/,/g,''))
                          const v = Math.max(0, raw)
                          setLines(prev => prev.map(r => r.temp_id===x.temp_id? { ...r, debit: v, credit: v>0 ? 0 : r.credit }: r))
                        }}
                        onChange={(e)=>{
                          const raw = (e.currentTarget.value||'').toString().replace(/\./g,'').replace(/,/g,'')
                          const n = Number(raw||0)
                          setLines(prev => prev.map(r => r.temp_id===x.temp_id? { ...r, debit: n, credit: n>0 ? 0 : r.debit }: r))
                        }}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right w-[130px]">
                    {isView || isVoided ? (
                      <span className="font-medium text-red-700">{formatID(x.credit)}</span>
                    ) : (
                      <input
                        type="text" inputMode="numeric"
                        className="input text-right border-teal-primary/40 focus:ring-teal-primary/30"
                        value={formatID(x.credit)}
                        onKeyDown={numKeyDown}
                        onFocus={(e)=>{ e.currentTarget.select(); e.currentTarget.value = String(x.credit) }}
                        onClick={(e)=>{ (e.currentTarget as HTMLInputElement).select() }}
                        onBlur={(e)=>{
                          const raw = Number((e.currentTarget.value||'0').toString().replace(/\./g,'').replace(/,/g,''))
                          const v = Math.max(0, raw)
                          setLines(prev => prev.map(r => r.temp_id===x.temp_id? { ...r, credit: v, debit: v>0 ? 0 : r.debit }: r))
                        }}
                        onChange={(e)=>{
                          const raw = (e.currentTarget.value||'').toString().replace(/\./g,'').replace(/,/g,'')
                          const n = Number(raw||0)
                          setLines(prev => prev.map(r => r.temp_id===x.temp_id? { ...r, credit: n, debit: n>0 ? 0 : r.debit }: r))
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

      <div className="container-card p-3 space-y-3">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-slate-600">Total Debit</span>
            <span className="ml-2 font-semibold text-emerald-700">{formatID(totalDebit)}</span>
          </div>
          <div>
            <span className="text-slate-600">Total Kredit</span>
            <span className="ml-2 font-semibold text-red-700">{formatID(totalCredit)}</span>
          </div>
          {!isBalanced && totalDebit > 0 && (
            <span className="text-xs text-coral-dark font-medium">Belum balance</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="w-28 text-slate-600 shrink-0">Catatan</span>
          {isView || isVoided ? (
            <div className="text-xs">{notes || '-'}</div>
          ) : (
            <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary min-h-[56px] resize-none" value={notes} onChange={(e)=> setNotes(e.target.value)} />
          )}
        </div>
      </div>

      {!isView && !isVoided && (
        <div className="sticky bottom-0 bg-white p-3 border-t flex items-center justify-end z-10">
          <div className="flex gap-2">
            <button onClick={() => { window.location.href = '/keuangan/jurnal-memorial' }} className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50">Batal</button>
            <button onClick={handleSave} disabled={saving || !canSave} className={`px-3 py-1.5 rounded-pill text-white ${saving || !canSave ? 'bg-slate-400 cursor-not-allowed' : 'bg-teal-primary hover:bg-teal-dark'}`}>
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan'}
            </button>
          </div>
        </div>
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
                  debit: Number(existing?.debit || 0),
                  credit: Number(existing?.credit || 0),
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
            <div className="p-3 border-b font-medium text-sm">Cetak Jurnal Memorial</div>
            <div className="p-4 text-sm">
              <div className="text-slate-600 mb-1">Nomor: {printPrompt.number}</div>
              <div className="text-slate-600">Apakah Anda ingin langsung mencetak jurnal memorial (A5)?</div>
            </div>
            <div className="p-3 border-t flex items-center justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50"
                onClick={() => { window.location.href = '/keuangan/jurnal-memorial' }}
              >Tidak</button>
              <button
                className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white"
                onClick={async () => {
                  await printMemorialJournalById(printPrompt.id)
                  window.location.href = '/keuangan/jurnal-memorial'
                }}
              >Ya, Cetak</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
