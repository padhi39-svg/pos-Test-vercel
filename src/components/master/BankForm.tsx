"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { smartTitleCase, onlyDigits } from '@/lib/textFormat'

export type BankFormData = {
  bankName: string
  ownerName: string | null
  accountNumber?: string | null
  accountId?: number | null
}

export default function BankForm({
  title,
  basePath,
  initial,
  onSubmit,
  readonly = false,
  currentId,
}: {
  title: string
  basePath: string
  initial?: Partial<BankFormData>
  onSubmit: (data: BankFormData) => Promise<void> | void
  readonly?: boolean
  currentId?: number
}) {
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''
  const [bankName, setBankName] = useState(initial?.bankName?.toUpperCase() || '')
  const [ownerName, setOwnerName] = useState(initial?.ownerName || '')
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber || '')
  const [accountId, setAccountId] = useState<number | null>((initial as any)?.accountId ?? null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [accQuery, setAccQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/keuangan/perkiraan', { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) setAccounts(data)
      } catch {
        if (!cancelled) setAccounts([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filteredAccounts = useMemo(() => {
    const q = accQuery.trim().toLowerCase()
    const rows = accounts.filter((a:any) => {
      if (Number(a.is_header) === 1) return false
      return a.posting_allowed === undefined || Number(a.posting_allowed) === 1
    })
    if (!q) return rows.slice(0, 100)
    return rows.filter((a:any) => String(a.code).toLowerCase().includes(q) || String(a.name).toLowerCase().includes(q)).slice(0, 100)
  }, [accounts, accQuery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    const msgs: string[] = []
    if (!bankName || !bankName.trim()) msgs.push('Nama bank wajib diisi')
    if (msgs.length) {
      setError(msgs.join('\n'))
      return
    }
    setError(null)
    setLoading(true)
    try {
      await onSubmit({
        bankName: bankName.toUpperCase(),
        ownerName: ownerName ? smartTitleCase(ownerName) : null,
        accountNumber: accountNumber ? onlyDigits(accountNumber) : null,
        accountId: accountId ?? null,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-slate-500 text-xs mt-1">{readonly ? 'Detail data bank.' : 'Lengkapi data bank lalu simpan.'}</p>
      </div>

      <form id="bank-form" onSubmit={handleSubmit} className="container-card p-3 text-xs space-y-3">
        {error && (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs">{error.split('\n').map((m,i)=>(<div key={i}>{m}</div>))}</div>
        )}
        <div className="grid grid-cols-1 gap-3">
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Nama Bank</span>
            <input
              value={bankName}
              onChange={(e)=> setBankName(e.target.value.toUpperCase())}
              placeholder="Nama Bank"
              disabled={readonly}
              className="w-full border border-slate-300 rounded-pill px-3 py-1.5 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary disabled:bg-slate-100 disabled:text-slate-500 uppercase"
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Pemilik</span>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(smartTitleCase(e.target.value))}
              placeholder="Nama Pemilik"
              disabled={readonly}
              className="w-full border border-slate-300 rounded-pill px-3 py-1.5 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary disabled:bg-slate-100 disabled:text-slate-500 capitalize"
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">No. Rekening</span>
            <input
              value={accountNumber}
              onChange={(e)=> setAccountNumber(onlyDigits(e.target.value))}
              placeholder="1234567890"
              inputMode="numeric"
              disabled={readonly}
              className="w-full border border-slate-300 rounded-pill px-3 py-1.5 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary disabled:bg-slate-100 disabled:text-slate-500"
            />
          </label>
          <div className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Perkiraan</span>
            <div className="relative flex-1">
              <input
                value={accQuery}
                onChange={(e)=> setAccQuery(e.target.value)}
                onFocus={()=> setOpen(true)}
                placeholder={accountId ? `Akun terpilih: ${accounts.find((a)=>a.id===accountId)?.code || ''} - ${accounts.find((a)=>a.id===accountId)?.name || ''}` : 'Cari kode/nama akun...'}
                disabled={readonly}
                className="w-full border border-slate-300 rounded-pill px-3 py-1.5 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-teal-bg focus:border-teal-primary disabled:bg-slate-100 disabled:text-slate-500"
              />
              {open && !readonly && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {filteredAccounts.map((a:any) => (
                    <button
                      type="button"
                      key={a.id}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-teal-bg transition-colors ${accountId===a.id? 'bg-teal-primary text-white' : ''}`}
                      onClick={()=>{ setAccountId(a.id); setAccQuery(`${a.code} - ${a.name}`); setOpen(false) }}
                    >{a.code} - {a.name}</button>
                  ))}
                  {filteredAccounts.length===0 && (
                    <div className="px-3 py-1.5 text-xs text-slate-500">Tidak ada hasil</div>
                  )}
                </div>
              )}
              {!readonly && accountId && (
                <div className="text-[10px] text-slate-500 mt-1">Akun dipilih: {accounts.find((a)=>a.id===accountId)?.code} - {accounts.find((a)=>a.id===accountId)?.name}</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {readonly ? (
            <>
              <Button variant="outline" onClick={() => router.push(basePath + '?' + returnQuery)}>Kembali</Button>
              {currentId && <Button onClick={() => router.push(`${basePath}/${currentId}/edit?return=${encodeURIComponent(returnQuery)}`)}>Edit</Button>}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => router.push(basePath + '?' + returnQuery)}>Batal</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan'}</Button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
