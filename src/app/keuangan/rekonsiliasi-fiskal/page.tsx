'use client'

import { useEffect, useState } from 'react'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))

const fmtRp = (n: number) => {
  if (n === 0) return '0'
  const abs = Math.abs(n)
  const s = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(abs))
  return n < 0 ? `(${s})` : s
}

interface Correction {
  id: number
  type: 'positif' | 'negatif'
  account_name: string
  account_code: string | null
  amount: number
}

interface FiscalReport {
  tahun: number
  laba_komersial: number
  omzet: number
  corrections: {
    positif: Correction[]
    negatif: Correction[]
    total_positif: number
    total_negatif: number
  }
  laba_fiskal: number
  laba_fiskal_pembulatan: number
  fasilitas: {
    ratio: number
    laba_fasilitas: number
    laba_non_fasilitas: number
  }
  pajak: {
    pph_fasilitas: number
    pph_non_fasilitas: number
    total_terutang: number
    pph25: number
    kurang_bayar: number
  }
}

interface AccountBalance {
  code: string
  name: string
  balance: number
}

export default function RekonsiliasiFiskalPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [report, setReport] = useState<FiscalReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [accounts, setAccounts] = useState<AccountBalance[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editType, setEditType] = useState<'positif' | 'negatif'>('positif')
  const [editAccountCode, setEditAccountCode] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [omzet, setOmzet] = useState('')
  const [pph25, setPph25] = useState('')

  // Inline add form state per type: null = hidden, otherwise { account_code, amount }
  const [addPositif, setAddPositif] = useState<{ account_code: string; amount: string } | null>(null)
  const [addNegatif, setAddNegatif] = useState<{ account_code: string; amount: string } | null>(null)

  const loadReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/fiscal/report?year=${year}`)
      if (!res.ok) { setReport(null); return }
      const data = await res.json()
      setReport(data)
      setOmzet(fmtRp(data.omzet))
      setPph25(fmtRp(data.pajak.pph25))
    } finally {
      setLoading(false)
    }
  }

  const loadCorrections = async () => {
    try {
      const res = await fetch(`/api/fiscal/corrections?year=${year}`)
      if (!res.ok) return
      const data = await res.json()
      setCorrections(data.corrections || [])
    } catch {}
  }

  const loadAccounts = async () => {
    try {
      const res = await fetch(`/api/fiscal/account-balances?year=${year}`)
      if (!res.ok) return
      const data = await res.json()
      setAccounts(data.accounts || [])
    } catch {}
  }

  useEffect(() => { loadReport(); loadCorrections(); loadAccounts() }, [year])

  const getBalance = (code: string) => {
    const a = accounts.find(a => a.code === code)
    return a ? a.balance : 0
  }

  const handleAddAccountChange = (addState: any, setAddState: any, code: string) => {
    if (code) {
      setAddState({ account_code: code, amount: String(Math.round(getBalance(code))) })
    } else {
      setAddState({ account_code: '', amount: '' })
    }
  }

  const addCorrection = async (type: 'positif' | 'negatif') => {
    const form = type === 'positif' ? addPositif : addNegatif
    if (!form || !form.account_code || !form.amount) return
    const amt = parseFloat(form.amount.replace(/[^0-9\-]/g, ''))
    if (isNaN(amt)) return
    const acct = accounts.find(a => a.code === form.account_code)
    const account_name = acct ? `${acct.code} - ${acct.name}` : form.account_code
    const res = await fetch('/api/fiscal/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, type, account_code: form.account_code, account_name, amount: amt }),
    })
    if (!res.ok) { alert(await res.text().catch(()=>'Gagal')); return }
    if (type === 'positif') { setAddPositif(null) } else { setAddNegatif(null) }
    await loadCorrections(); await loadReport()
  }

  const deleteCorrection = async (id: number) => {
    const res = await fetch(`/api/fiscal/corrections/${id}`, { method: 'DELETE' })
    if (!res.ok) { alert(await res.text().catch(()=>'Gagal')); return }
    await loadCorrections(); await loadReport()
  }

  const startEdit = (c: Correction) => {
    setEditingId(c.id)
    setEditType(c.type)
    setEditAccountCode(c.account_code || '')
    setEditAmount(String(Math.round(c.amount)))
  }

  const saveEdit = async () => {
    if (!editingId || !editAccountCode || !editAmount) return
    const amt = parseFloat(editAmount.replace(/[^0-9\-]/g, ''))
    if (isNaN(amt)) return
    const editAcct = accounts.find(a => a.code === editAccountCode)
    const editName = editAcct ? `${editAcct.code} - ${editAcct.name}` : editAccountCode
    const res = await fetch(`/api/fiscal/corrections/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_code: editAccountCode, account_name: editName, amount: amt, type: editType }),
    })
    if (!res.ok) { alert(await res.text().catch(()=>'Gagal')); return }
    setEditingId(null)
    await loadCorrections(); await loadReport()
  }

  const saveSettings = async () => {
    const om = parseFloat(omzet.replace(/[^0-9\-]/g, ''))
    const pp = parseFloat(pph25.replace(/[^0-9\-]/g, ''))
    if (isNaN(om) || isNaN(pp)) return
    const res = await fetch('/api/fiscal/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, omzet: om, pph25: pp }),
    })
    if (!res.ok) { alert(await res.text().catch(()=>'Gagal')); return }
    await loadReport()
  }

  const correctionsPositif = corrections.filter(c => c.type === 'positif')
  const correctionsNegatif = corrections.filter(c => c.type === 'negatif')
  const totalPositif = correctionsPositif.reduce((s, c) => s + c.amount, 0)
  const totalNegatif = correctionsNegatif.reduce((s, c) => s + c.amount, 0)
  const labaKomersial = report?.laba_komersial ?? 0
  const labaFiskal = Math.round((labaKomersial + totalPositif - totalNegatif) * 100) / 100
  const labaFiskalPembulatan = Math.round(labaFiskal / 1000) * 1000

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold">Rekonsiliasi Fiskal</h1>

      {/* Year selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Tahun</label>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="border rounded px-3 py-1 text-sm">
          {Array.from({length: 10}, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button onClick={loadReport} disabled={loading} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300">
          {loading ? 'Loading...' : 'Hitung'}
        </button>
      </div>

      {report && (
        <>
          {/* Commercial Profit */}
          <section className="border rounded p-4 space-y-1 bg-white">
            <h2 className="font-semibold text-sm text-slate-500 mb-2">PERHITUNGAN FISKAL</h2>
            <Row label="LABA KOMERSIAL" value={report.laba_komersial} bold />
          </section>
        </>
      )}

      {/* Fiscal Corrections — always visible with inline add per subsection */}
      <section className="border rounded p-4 space-y-1 bg-white">
        <h2 className="font-semibold text-sm text-slate-500 mb-2">KOREKSI FISKAL</h2>

        <div className="ml-4 space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-xs text-slate-400">KOREKSI FISKAL POSITIF</h3>
            <button
              onClick={() => setAddPositif(addPositif ? null : { account_code: '', amount: '' })}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {addPositif ? 'Batal' : '+ Tambah'}
            </button>
          </div>
          {correctionsPositif.map(c => (
            <RowItem key={c.id} correction={c} accounts={accounts} onEdit={startEdit} onDelete={deleteCorrection} />
          ))}
          {addPositif && (
            <div className="flex items-center gap-1 text-xs ml-0">
              <select
                value={addPositif.account_code}
                onChange={e => handleAddAccountChange(addPositif, setAddPositif, e.target.value)}
                className="border rounded px-1 py-0.5 w-56"
              >
                <option value="">-- Pilih Akun --</option>
                {accounts.map(a => (
                  <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                ))}
              </select>
              <input
                value={addPositif.amount}
                onChange={e => setAddPositif({ ...addPositif, amount: e.target.value })}
                placeholder="Jumlah"
                className="border rounded px-1 py-0.5 w-28 text-right"
              />
              <button onClick={() => addCorrection('positif')} className="text-green-600 hover:text-green-800 text-xs font-medium">Simpan</button>
            </div>
          )}
        </div>

        <Row label="Total Koreksi Fiskal Positif" value={totalPositif} indent />

        <div className="ml-4 space-y-1 mt-2">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-xs text-slate-400">KOREKSI FISKAL NEGATIF</h3>
            <button
              onClick={() => setAddNegatif(addNegatif ? null : { account_code: '', amount: '' })}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {addNegatif ? 'Batal' : '+ Tambah'}
            </button>
          </div>
          {correctionsNegatif.map(c => (
            <RowItem key={c.id} correction={c} accounts={accounts} onEdit={startEdit} onDelete={deleteCorrection} />
          ))}
          {addNegatif && (
            <div className="flex items-center gap-1 text-xs ml-0">
              <select
                value={addNegatif.account_code}
                onChange={e => handleAddAccountChange(addNegatif, setAddNegatif, e.target.value)}
                className="border rounded px-1 py-0.5 w-56"
              >
                <option value="">-- Pilih Akun --</option>
                {accounts.map(a => (
                  <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                ))}
              </select>
              <input
                value={addNegatif.amount}
                onChange={e => setAddNegatif({ ...addNegatif, amount: e.target.value })}
                placeholder="Jumlah"
                className="border rounded px-1 py-0.5 w-28 text-right"
              />
              <button onClick={() => addCorrection('negatif')} className="text-green-600 hover:text-green-800 text-xs font-medium">Simpan</button>
            </div>
          )}
        </div>

        <Row label="Total Koreksi Fiskal Negatif" value={-totalNegatif} indent />

        <Row label="L/R FISKAL" value={labaFiskal} bold />
        <Row label="L/R FISKAL PEMBULATAN" value={labaFiskalPembulatan} bold />
      </section>

      {report && (
        <>
          {/* Taxable Income */}
          <section className="border rounded p-4 space-y-1 bg-white">
            <h2 className="font-semibold text-sm text-slate-500 mb-2">PERHITUNGAN LABA KENA PAJAK</h2>
            <div className="ml-4 space-y-1">
              <div className="text-xs">1. LABA MENDAPAT FASILITAS</div>
              <div className="ml-4 text-xs text-slate-600">
                {fmt(4800000000)} / {fmt(report.omzet)} × {fmt(report.laba_fiskal_pembulatan)} = {fmt(report.fasilitas.laba_fasilitas)}
              </div>
              <div className="ml-4 text-xs text-slate-600">
                (Peredaran Bruto: {fmt(report.omzet)})
              </div>
              <div className="text-xs mt-1">2. LABA TIDAK MENDAPAT FASILITAS</div>
              <div className="ml-4 text-xs text-slate-600">
                {fmt(report.laba_fiskal_pembulatan)} - {fmt(report.fasilitas.laba_fasilitas)} = {fmt(report.fasilitas.laba_non_fasilitas)}
              </div>
            </div>
          </section>

          {/* Tax Payable */}
          <section className="border rounded p-4 space-y-1 bg-white">
            <h2 className="font-semibold text-sm text-slate-500 mb-2">PERHITUNGAN PAJAK TERUTANG</h2>
            <Row label={`${fmt(report.fasilitas.laba_fasilitas)} × 11%`} value={report.pajak.pph_fasilitas} />
            <Row label={`${fmt(report.fasilitas.laba_non_fasilitas)} × 22%`} value={report.pajak.pph_non_fasilitas} />
            <Row label="TOTAL PAJAK TERUTANG" value={report.pajak.total_terutang} bold />
          </section>

          {/* Tax Installments */}
          <section className="border rounded p-4 space-y-1 bg-white">
            <h2 className="font-semibold text-sm text-slate-500 mb-2">ANGSURAN PAJAK</h2>
            <Row label="PPH PS 25" value={report.pajak.pph25} />
            <Row label="PPH BADAN KURANG BAYAR" value={report.pajak.kurang_bayar} bold />
          </section>
        </>
      )}

      {/* Settings — always visible */}
      <section className="border rounded p-4 space-y-2 bg-white">
        <h2 className="font-semibold text-sm text-slate-500 mb-2">SETTING</h2>
        <div className="flex items-center gap-2 text-sm">
          <label className="w-32">Omzet (Peredaran Bruto)</label>
          <input value={omzet} onChange={e => setOmzet(e.target.value)} className="border rounded px-2 py-1 w-40 text-right" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="w-32">PPh 25</label>
          <input value={pph25} onChange={e => setPph25(e.target.value)} className="border rounded px-2 py-1 w-40 text-right" />
        </div>
        <button onClick={saveSettings} className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">
          Simpan Setting
        </button>
      </section>

      {/* Inline Editor */}
      {editingId && editingId > 0 && (
        <section className="border rounded p-4 space-y-2 bg-yellow-50">
          <h2 className="font-semibold text-sm text-slate-500 mb-2">EDIT KOREKSI</h2>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <select value={editType} onChange={e => setEditType(e.target.value as any)} className="border rounded px-2 py-1">
              <option value="positif">Positif</option>
              <option value="negatif">Negatif</option>
            </select>
            <select value={editAccountCode} onChange={e => {
              const code = e.target.value
              setEditAccountCode(code)
              if (code) {
                setEditAmount(String(Math.round(getBalance(code))))
              }
            }} className="border rounded px-2 py-1 w-64">
              <option value="">-- Pilih Akun --</option>
              {accounts.map(a => (
                <option key={a.code} value={a.code}>{a.code} - {a.name} ({fmtRp(a.balance)})</option>
              ))}
            </select>
            <input value={editAmount} onChange={e => setEditAmount(e.target.value)} className="border rounded px-2 py-1 w-32 text-right" />
            <button onClick={saveEdit} className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">Simpan</button>
            <button onClick={() => setEditingId(null)} className="px-3 py-1 text-sm bg-slate-200 rounded hover:bg-slate-300">Batal</button>
          </div>
        </section>
      )}
    </div>
  )
}

function Row({ label, value, bold, indent }: { label: string; value: number; bold?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold border-t border-dashed pt-1 mt-1' : ''} ${indent ? 'ml-4' : ''}`}>
      <span>{label}</span>
      <span className="text-right tabular-nums">{fmtRp(value)}</span>
    </div>
  )
}

function RowItem({ correction, accounts, onEdit, onDelete }: { correction: Correction; accounts: AccountBalance[]; onEdit: (c: Correction) => void; onDelete: (id: number) => void }) {
  const displayName = correction.account_code
    ? `${correction.account_code} - ${correction.account_name.split(' - ').pop() || correction.account_name}`
    : correction.account_name
  return (
    <div className="flex items-center justify-between text-xs ml-4 group">
      <span className="flex-1">{displayName}</span>
      <span className="tabular-nums w-28 text-right">{fmtRp(correction.type === 'negatif' ? -correction.amount : correction.amount)}</span>
      <div className="flex gap-1 ml-2">
        <button onClick={() => onEdit(correction)} className="text-blue-500 hover:text-blue-700">Edit</button>
        <button onClick={() => onDelete(correction.id)} className="text-red-500 hover:text-red-700">Hapus</button>
      </div>
    </div>
  )
}
