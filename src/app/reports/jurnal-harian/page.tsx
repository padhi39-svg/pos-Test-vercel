"use client"

import { useState } from 'react'

interface LineRow {
  id: number
  entry_date: string
  source_number: string
  source_type: string
  account_code: string
  account_name: string
  description: string
  debit: number
  credit: number
  balance: number
}

interface ApiResponse {
  rows: LineRow[]
  openingBalance: number
  totalDebit: number
  totalCredit: number
}

export default function JurnalHarianPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [journalNumber, setJournalNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [regenLoading, setRegenLoading] = useState(false)
  const [regenMessage, setRegenMessage] = useState('')

  const load = async () => {
    if (!from || !to) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate: from, endDate: to })
      if (journalNumber) params.set('journalNumber', journalNumber)
      const res = await fetch(`/api/reports/jurnal-harian?${params.toString()}`)
      const json = await res.json()
      setData(json?.rows ? json : null)
    } catch { setData(null) } finally { setLoading(false) }
  }



  const handlePrint = () => {
    if (!data?.rows.length) return
    const win = window.open('', '_blank', 'width=1000,height=700')
    if (!win) { alert('Popup diblokir'); return }

    const fmt = (n: number) => n.toLocaleString('id-ID', {minimumFractionDigits:0,maximumFractionDigits:2})
    let lastDoc = ''
    const rowsHtml = data.rows.map(r => {
      const isFirst = r.source_number !== lastDoc
      lastDoc = r.source_number
      return `<tr${isFirst ? '' : ' class="same-doc"'}>
        <td>${isFirst ? r.entry_date : ''}</td>
        <td>${isFirst ? r.source_number : ''}</td>
        <td class="font-mono text-[10px]">${r.account_code}</td>
        <td>${r.account_name}</td>
        <td class="text-right">${r.debit > 0 ? fmt(r.debit) : ''}</td>
        <td class="text-right">${r.credit > 0 ? fmt(r.credit) : ''}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Jurnal Harian</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; margin: 0; padding: 10px; color: #111; font-size: 10px; }
  .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #111; padding-bottom: 6px; }
  .header .title { font-size: 14px; font-weight: 700; }
  .header .period { font-size: 10px; color: #374151; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th, td { border: 1px solid #d1d5db; padding: 2px 4px; text-align: left; }
  th { background: #f3f4f6; font-weight: 700; text-align: center; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .font-mono { font-family: monospace; }
  .font-bold { font-weight: 700; }
  .same-doc td:first-child, .same-doc td:nth-child(2) { border-top: none; }
  .total-row td { font-weight: 700; border-top: 2px solid #111; background: #f9fafb; }
  .balance-row td { font-weight: 700; background: #f0fdf4; }
  .opening-row td { font-style: italic; background: #fef9c3; }
</style></head>
<body>
  <div class="header">
    <div class="title">JURNAL HARIAN</div>
    <div class="period">Periode: ${from} s.d ${to}</div>
  </div>
  <table>
    <thead>
      <tr><th>Tanggal</th><th>Kode Nota</th><th>Kode Akun</th><th>Perkiraan</th><th>Debit</th><th>Kredit</th></tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr class="total-row"><td colspan="4" class="text-right">Total</td><td class="text-right">${fmt(data.totalDebit)}</td><td class="text-right">${fmt(data.totalCredit)}</td></tr>
    </tfoot>
  </table>
</body></html>`
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  const rows = data?.rows || []

  // Track last source_number for merging display
  let lastDoc = ''

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Jurnal Harian</h1>
          <p className="text-xs text-slate-500">Daftar jurnal berdasarkan rentang tanggal</p>
        </div>
        {rows.length > 0 && (
          <div className="flex gap-2">
            <button onClick={handlePrint} className="px-3 py-1.5 text-xs rounded-pill bg-teal-primary hover:bg-teal-dark text-white">Cetak / Preview</button>
            <a
              href={`/api/reports/jurnal-harian/export?startDate=${from}&endDate=${to}`}
              className="px-3 py-1.5 text-xs rounded-pill border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg inline-block"
            >Export Excel</a>
            <button onClick={async () => {
              if (!confirm('Regenerate ulang semua jurnal? Data jurnal akan dihapus dan digenerate ulang dari awal. Lanjutkan?')) return
              if (regenLoading) return
              setRegenLoading(true)
              setRegenMessage('')
              try {
                const res = await fetch('/api/journal-backfill', { method: 'POST' })
                const json = await res.json()
                if (json.success) {
                  setRegenMessage(json.message || 'Berhasil')
                  load()
                } else {
                  setRegenMessage(json.error || 'Gagal')
                }
              } catch (e: any) {
                setRegenMessage(e?.message || 'Gagal')
              } finally {
                setRegenLoading(false)
              }
            }} className="px-3 py-1.5 text-xs rounded-pill bg-amber-500 hover:bg-amber-600 text-white">
              {regenLoading ? 'Regenerating...' : 'Regenerate Jurnal'}
            </button>
          </div>
        )}
        {regenMessage && (
          <div className="text-xs text-slate-600 mt-1">{regenMessage}</div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Dari Tanggal</label>
            <input type="date" className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary text-sm" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Sampai Tanggal</label>
            <input type="date" className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary text-sm" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Kode Nota</label>
            <input type="text" className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary text-sm w-44" placeholder="Cari kode nota..." value={journalNumber} onChange={e => setJournalNumber(e.target.value)} />
          </div>
          <button onClick={load} className="px-3 py-1.5 text-xs rounded-pill bg-teal-primary hover:bg-teal-dark text-white h-8">Tampilkan</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-6">Memuat...</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center text-slate-500">Tidak ada data jurnal</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-teal-primary text-white">
                  <th className="px-2 py-1 text-left font-semibold whitespace-nowrap w-28">Tanggal</th>
                  <th className="px-2 py-1 text-left font-semibold whitespace-nowrap w-36">Kode Nota</th>
                  <th className="px-2 py-1 text-left font-semibold whitespace-nowrap w-20">Kode</th>
                  <th className="px-2 py-1 text-left font-semibold">Perkiraan</th>
                  <th className="px-2 py-1 text-right font-semibold whitespace-nowrap w-28">Debit</th>
                  <th className="px-2 py-1 text-right font-semibold whitespace-nowrap w-28">Kredit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const showDoc = r.source_number !== lastDoc
                  if (showDoc) lastDoc = r.source_number
                  return (
                    <tr key={r.id} className={`${showDoc ? 'border-t-2 border-slate-400' : 'border-t border-slate-200'} hover:bg-slate-50`}>
                      <td className="px-2 py-1 whitespace-nowrap text-slate-700">{showDoc ? r.entry_date : ''}</td>
                      <td className="px-2 py-1 whitespace-nowrap font-mono text-[10px] text-slate-700">
                        {showDoc ? r.source_number : ''}
                      </td>
                      <td className="px-2 py-1 font-mono text-[10px] text-slate-500">{r.account_code}</td>
                      <td className="px-2 py-1 text-slate-700">{r.account_name}</td>
                      <td className="px-2 py-1 text-right font-mono text-emerald-700">{r.debit > 0 ? r.debit.toLocaleString('id-ID') : ''}</td>
                      <td className="px-2 py-1 text-right font-mono text-red-700">{r.credit > 0 ? r.credit.toLocaleString('id-ID') : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td colSpan={4} className="px-2 py-1 text-right text-slate-700">Total</td>
                  <td className="px-2 py-1 text-right font-mono text-slate-800">{data.totalDebit.toLocaleString('id-ID')}</td>
                  <td className="px-2 py-1 text-right font-mono text-slate-800">{data.totalCredit.toLocaleString('id-ID')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
