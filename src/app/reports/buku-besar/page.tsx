"use client"

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'
import SearchableSelect from '@/components/ui/SearchableSelect'
import type { SearchableSelectOption } from '@/components/ui/SearchableSelect'

interface Row {
  entry_date: string
  source_number: string
  description: string
  debit: number
  credit: number
  balance: number
  is_balance: boolean
}

interface AccountGroup {
  account_code: string
  account_name: string
  rows: Row[]
}

export default function BukuBesarPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [accountCode, setAccountCode] = useState('')
  const [accounts, setAccounts] = useState<SearchableSelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([])
  const [singleRows, setSingleRows] = useState<Row[]>([])
  const [singleAccountLabel, setSingleAccountLabel] = useState('')
  const [mode, setMode] = useState<'single' | 'all'>('all')

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const res = await fetch('/api/accounts')
        const data = await res.json()
        const list = Array.isArray(data) ? data.filter((a: any) => a.code && a.name) : []
        setAccounts([
          { value: '', label: '-- Semua Perkiraan --' },
          ...list.map((a: any) => ({
            value: a.code,
            label: `${a.code} - ${a.name}`,
            description: a.golongan || '',
          }))
        ])
      } catch {}
    }
    loadAccounts()
  }, [])

  const load = async () => {
    if (!from || !to) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate: from, endDate: to })
      if (accountCode) params.set('accountCode', accountCode)
      const res = await fetch(`/api/reports/buku-besar?${params.toString()}`)
      const json = await res.json()
      if (json?.mode === 'all') {
        setAccountGroups(json.accounts || [])
        setSingleRows([])
        setMode('all')
      } else if (json?.mode === 'single') {
        setSingleRows(json.rows || [])
        setSingleAccountLabel(json.account_code ? `${json.account_code} - ${json.account_name}` : '')
        setAccountGroups([])
        setMode('single')
      } else {
        setAccountGroups([])
        setSingleRows([])
      }
    } catch {
      setAccountGroups([])
      setSingleRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (accountCode) load() }, [])

  const rows = mode === 'single' ? singleRows : accountGroups.flatMap(g => g.rows)
  const visible = rows.length > 0

  const handleExportExcel = () => {
    if (!from || !to) return
    const params = new URLSearchParams({ startDate: from, endDate: to })
    if (accountCode) params.set('accountCode', accountCode)
    window.open(`/api/reports/buku-besar/export?${params.toString()}`, '_blank')
  }

  const renderTable = (dataRows: Row[]) => (
    <table className="min-w-full text-xs">
      <thead>
        <tr className="bg-slate-50 border-b">
          <th className="text-left px-2 py-1.5 whitespace-nowrap">Tanggal</th>
          <th className="text-left px-2 py-1.5 whitespace-nowrap">Kode Nota</th>
          <th className="text-left px-2 py-1.5">Keterangan</th>
          <th className="text-right px-2 py-1.5 whitespace-nowrap">Debit</th>
          <th className="text-right px-2 py-1.5 whitespace-nowrap">Kredit</th>
          <th className="text-right px-2 py-1.5 whitespace-nowrap">Saldo</th>
        </tr>
      </thead>
      <tbody>
        {dataRows.map((r, i) => {
          const isNewNota = i > 0 && dataRows[i-1].source_number !== r.source_number
          return (
          <tr key={i} className={`${isNewNota ? 'border-t-2 border-slate-400' : 'border-t'} hover:bg-slate-50 ${r.is_balance ? 'bg-slate-100 font-semibold' : ''}`}>
            <td className="px-2 py-1 whitespace-nowrap">{r.entry_date}</td>
            <td className={`px-2 py-1 whitespace-nowrap font-mono text-[10px] ${r.is_balance ? '' : ''}`}>
              {r.source_number || '-'}
            </td>
            <td className={`px-2 py-1 ${r.is_balance ? '' : 'text-slate-500'}`}>
              {r.description || '-'}
            </td>
            <td className="px-2 py-1 text-right font-mono text-emerald-700">
              {r.debit > 0 ? formatCurrency(r.debit) : ''}
            </td>
            <td className="px-2 py-1 text-right font-mono text-red-700">
              {r.credit > 0 ? formatCurrency(r.credit) : ''}
            </td>
            <td className={`px-2 py-1 text-right font-mono font-bold ${r.balance >= 0 ? '' : 'text-red-600'}`}>
              {formatCurrency(r.balance)}
            </td>
          </tr>
          );
        })}
      </tbody>
    </table>
  )

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Buku Besar</h1>
          <p className="text-xs text-slate-500">Mutasi per akun perkiraan</p>
        </div>
        {visible && (
          <button onClick={handleExportExcel} className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700">Export Excel</button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px]">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Perkiraan</label>
            <SearchableSelect
              options={accounts}
              value={accountCode}
              onChange={(v) => setAccountCode(String(v || ''))}
              placeholder="Cari perkiraan..."
              allowClear={false}
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Dari Tanggal</label>
            <input type="date" className="input text-xs h-8" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Sampai Tanggal</label>
            <input type="date" className="input text-xs h-8" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button onClick={load} className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white h-8">Tampilkan</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-6">Memuat...</div>
      ) : !visible ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center text-slate-500">
          {accountCode && from && to ? 'Tidak ada data untuk periode ini' : 'Pilih periode dan klik "Tampilkan"'}
        </div>
      ) : mode === 'single' ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-sm text-slate-800">
              {singleAccountLabel}
            </span>
            <span className="text-xs text-slate-500">{from} s.d {to}</span>
          </div>
          <div className="overflow-x-auto">
            {renderTable(singleRows)}
          </div>
          <div className="px-3 py-1.5 bg-slate-100 border-t border-slate-200 font-bold text-xs flex justify-between">
            <span>Saldo Akhir</span>
            <span className="font-mono">{formatCurrency(singleRows[singleRows.length - 1]?.balance || 0)}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {accountGroups.map(group => {
            const lastRow = group.rows[group.rows.length - 1]
            return (
              <div key={group.account_code} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-800">
                    {group.account_code} - {group.account_name}
                  </span>
                  <span className="text-xs text-slate-500">{from} s.d {to}</span>
                </div>
                <div className="overflow-x-auto">
                  {renderTable(group.rows)}
                </div>
                {lastRow && (
                  <div className="px-3 py-1.5 bg-slate-100 border-t border-slate-200 font-bold text-xs flex justify-between">
                    <span>Saldo Akhir</span>
                    <span className="font-mono">{formatCurrency(lastRow.balance)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
