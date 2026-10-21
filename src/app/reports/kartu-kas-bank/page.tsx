"use client"

import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'

interface KartuEntry {
  tgl: string
  ref: string
  deskripsi: string
  debet: number
  kredit: number
  saldo: number
  sumber: string
}

interface Account {
  id: number; code: string; name: string; is_cash: number; is_bank_account: number
}

export default function KartuKasBankPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{
    account: Account; entries: KartuEntry[];
    total_debet: number; total_kredit: number; saldo_akhir: number
  } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/reports/kartu-kas-bank').then(r => r.json()).then(j => {
      if (j.accounts) setAccounts(j.accounts)
    }).catch(() => {})
  }, [])

  const loadReport = async () => {
    if (!accountId || !startDate || !endDate) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/kartu-kas-bank?accountId=${accountId}&startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) { setData(null); return }
      const json = await res.json()
      if (json.error) { setData(null); return }
      setData(json || null)
    } catch { setData(null) } finally { setLoading(false) }
  }

  const selectedAccount = accounts.find(a => String(a.id) === accountId)
  const label = selectedAccount
    ? (selectedAccount.is_bank_account ? 'BANK' : 'KAS') + ' - ' + selectedAccount.name
    : ''

  const handlePrint = () => {
    if (!data) return
    const win = window.open('', '_blank', 'width=1000,height=700')
    if (!win) { alert('Popup diblokir'); return }
    const rows = data.entries.map(e => `
      <tr>
        <td>${e.tgl}</td>
        <td>${e.ref}</td>
        <td>${e.deskripsi}</td>
        <td class="text-right">${e.debet > 0 ? e.debet.toLocaleString('id-ID', {minimumFractionDigits:0,maximumFractionDigits:2}) : ''}</td>
        <td class="text-right">${e.kredit > 0 ? e.kredit.toLocaleString('id-ID', {minimumFractionDigits:0,maximumFractionDigits:2}) : ''}</td>
        <td class="text-right">${e.saldo.toLocaleString('id-ID', {minimumFractionDigits:0,maximumFractionDigits:2})}</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Kartu ${label}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; margin: 0; padding: 0; color: #111; font-size: 11px; }
  .header { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #111; padding-bottom: 8px; }
  .header .title { font-size: 14px; font-weight: 700; }
  .header .period { font-size: 10px; color: #374151; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #d1d5db; padding: 3px 6px; text-align: left; }
  th { background: #f3f4f6; font-weight: 700; }
  .text-right { text-align: right; }
  .total-row td { font-weight: 700; border-top: 2px solid #111; background: #f9fafb; }
</style></head>
<body>
  <div class="header">
    <div class="title">KARTU ${label}</div>
    <div class="period">Periode: ${startDate} s.d ${endDate}</div>
  </div>
  <table>
    <thead><tr>
      <th>Tanggal</th><th>Ref</th><th>Deskripsi</th><th>Debet</th><th>Kredit</th><th>Saldo</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr class="total-row"><td colspan="3">Total</td>
        <td class="text-right">${data.total_debet.toLocaleString('id-ID', {minimumFractionDigits:0,maximumFractionDigits:2})}</td>
        <td class="text-right">${data.total_kredit.toLocaleString('id-ID', {minimumFractionDigits:0,maximumFractionDigits:2})}</td>
        <td class="text-right">${data.saldo_akhir.toLocaleString('id-ID', {minimumFractionDigits:0,maximumFractionDigits:2})}</td>
      </tr>
    </tfoot>
  </table>
</body></html>`
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Kartu Kas & Bank</h1>
          <p className="text-xs text-slate-500">Mutasi kas/bank per akun (rekening koran)</p>
        </div>
        {data && (
          <div className="flex gap-2">
            <button onClick={handlePrint} className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">Cetak</button>
            <a
              href={`/api/reports/kartu-kas-bank/export?accountId=${accountId}&startDate=${startDate}&endDate=${endDate}`}
              className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 inline-block"
            >Export Excel</a>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px]">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Akun Kas/Bank</label>
            <select className="input text-xs h-8 w-full" value={accountId} onChange={e => { setAccountId(e.target.value); setData(null) }}>
              <option value="">-- Pilih Akun --</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.is_bank_account ? '🏦' : '💰'} {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Dari Tanggal</label>
            <input type="date" className="input text-xs h-8 w-full" value={startDate} onChange={e => { setStartDate(e.target.value); setData(null) }} />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Sampai Tanggal</label>
            <input type="date" className="input text-xs h-8 w-full" value={endDate} onChange={e => { setEndDate(e.target.value); setData(null) }} />
          </div>
          <button onClick={loadReport} className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white h-8">Tampilkan</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-6">Memuat...</div>
      ) : !data ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center text-slate-500">
          {accountId && startDate && endDate ? 'Klik "Tampilkan" untuk melihat data' : 'Pilih akun dan periode terlebih dahulu'}
        </div>
      ) : (
        <div ref={printRef}>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-sm text-slate-800">KARTU {label}</span>
              <span className="text-xs text-slate-500">{startDate} s.d {endDate}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-2 py-1.5 whitespace-nowrap">Tanggal</th>
                    <th className="text-left px-2 py-1.5 whitespace-nowrap">Ref</th>
                    <th className="text-left px-2 py-1.5">Deskripsi</th>
                    <th className="text-right px-2 py-1.5 whitespace-nowrap">Debet (Masuk)</th>
                    <th className="text-right px-2 py-1.5 whitespace-nowrap">Kredit (Keluar)</th>
                    <th className="text-right px-2 py-1.5 whitespace-nowrap">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e, i) => (
                    <tr key={i} className="border-t hover:bg-slate-50">
                      <td className="px-2 py-1 whitespace-nowrap">{e.tgl}</td>
                      <td className="px-2 py-1 whitespace-nowrap font-mono text-[10px]">{e.ref}</td>
                      <td className="px-2 py-1">{e.deskripsi}</td>
                      <td className="px-2 py-1 text-right font-mono text-emerald-700">{e.debet > 0 ? formatCurrency(e.debet) : ''}</td>
                      <td className="px-2 py-1 text-right font-mono text-red-700">{e.kredit > 0 ? formatCurrency(e.kredit) : ''}</td>
                      <td className={`px-2 py-1 text-right font-mono font-bold ${e.saldo >= 0 ? '' : 'text-red-600'}`}>{formatCurrency(e.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-800 bg-slate-100 font-bold">
                    <td colSpan={3} className="px-2 py-1.5">Total</td>
                    <td className="px-2 py-1.5 text-right text-emerald-700">{formatCurrency(data.total_debet)}</td>
                    <td className="px-2 py-1.5 text-right text-red-700">{formatCurrency(data.total_kredit)}</td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(data.saldo_akhir)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
