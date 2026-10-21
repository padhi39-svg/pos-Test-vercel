"use client"

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'

interface NeracaItem {
  id: number; code: string; name: string; parent_id: number | null
  level: number; is_header: number; normal_balance: string; balance: number
}

interface LaporanData {
  neraca: {
    aset: { total: number; akun: NeracaItem[] }
    kewajiban: { total: number; akun: NeracaItem[] }
    ekuitas: { total: number; akun: NeracaItem[] }
    total_aset: number
    total_kewajiban_ekuitas: number
    laba_periode_berjalan: number
    selisih: number
  }
  laba_rugi: {
    pendapatan: { total: number; akun: { code: string; name: string; balance: number }[] }
    harga_pokok_penjualan: { total: number; akun: { code: string; name: string; balance: number }[] }
    beban: { total: number; akun: { code: string; name: string; balance: number }[] }
    beban_lain: { total: number; akun: { code: string; name: string; balance: number }[] }
    laba_kotor: number
    laba_bersih: number
  }
}

interface Periode {
  id: number; code: string; name: string; start_date: string; end_date: string
}

export default function NeracaLabaRugiPage() {
  const [periodId, setPeriodId] = useState('')
  const [periods, setPeriods] = useState<Periode[]>([])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LaporanData | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [showPopup, setShowPopup] = useState(false)
  const [popupMode, setPopupMode] = useState<'exists' | 'missing'>('missing')
  const [popupLoading, setPopupLoading] = useState(false)

  useEffect(() => {
    fetch('/api/periode').then(r => r.json()).then(list => { if (Array.isArray(list)) setPeriods(list) }).catch(() => {})
    fetch('/api/settings?group=company').then(r => r.json()).then(rows => {
      const map: Record<string, string> = {}
      ;(rows || []).forEach((r: any) => { map[r.setting_key] = String(r.setting_value ?? '') })
      setCompanyName(map['company_name'] || '')
    }).catch(() => {})
  }, [])

  const loadFromSnapshot = async () => {
    const id = periodId
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/snapshot?action=load&type=neraca_labarugi&periodId=${id}`)
      if (!res.ok) throw new Error('No snapshot')
      const json = await res.json()
      setData(json)
    } catch {
      const res = await fetch(`/api/reports/neraca-labarugi?periodId=${id}`)
      const json = await res.json()
      setData(json || null)
    } finally { setLoading(false) }
  }

  const calculateAndLoad = async () => {
    const id = periodId
    if (!id) return
    setPopupLoading(true)
    try {
      const res = await fetch(`/api/reports/snapshot?action=calculate&type=neraca_labarugi&periodId=${id}`, { method: 'POST' })
      if (!res.ok) throw new Error('Gagal menghitung')
    } catch (e: any) {
      alert(e.message)
      setPopupLoading(false)
      setShowPopup(false)
      return
    }
    setPopupLoading(false)
    setShowPopup(false)
    await loadFromSnapshot()
  }

  const checkSnapshot = async () => {
    const id = periodId
    if (!id) return
    setShowPopup(false)
    setData(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/snapshot?action=check&type=neraca_labarugi&periodId=${id}`)
      const json = await res.json()
      if (json.exists) {
        setPopupMode('exists')
      } else {
        setPopupMode('missing')
      }
      setShowPopup(true)
    } catch {
      await loadFromSnapshot()
    } finally { setLoading(false) }
  }

  const renderNeracaTree = (akun: NeracaItem[]) => {
    const filteredAkun = akun.filter(a => a.code !== '390-002-01' && a.code !== '390-003-01')
    const childrenOf = (parentId: number | null) => filteredAkun.filter(a => a.parent_id === parentId)
    const roots = filteredAkun.filter(a => a.parent_id === null && a.level <= 1)
    const renderTree = (items: NeracaItem[], depth: number): React.ReactNode[] =>
      items.flatMap(a => {
        const childs = childrenOf(a.id)
        const isHeader = a.is_header === 1
        return [
          <tr key={`nr-${a.code || a.id}`}>
            <td style={{ paddingLeft: `${depth === 0 ? 8 : 12 + depth * 12}px` }}>
              <span className={depth <= 1 || isHeader ? 'font-bold' : ''}>{a.code ? `${a.code} - ${a.name}` : a.name}</span>
            </td>
            <td className="text-right" style={{ paddingLeft: `${depth <= 1 ? 0 : 8 + (depth - 2) * 8}px`, paddingRight: '8px' }}>
              {isHeader && depth === 0 ? '' : <span className={depth <= 1 ? 'font-bold' : ''}>{formatCurrency(a.balance)}</span>}
            </td>
          </tr>,
          ...(childs.length > 0 ? renderTree(childs, depth + 1) : [])
        ]
      })
    return renderTree(roots, 0)
  }

  const handlePrintPreview = () => {
    if (!data) return
    const win = window.open('', '_blank', 'width=1000,height=700')
    if (!win) { alert('Popup diblokir browser. Izinkan popup untuk melanjutkan.'); return }

    const selectedPeriod = periods.find(p => String(p.id) === periodId)
    const periodLabel = selectedPeriod ? `${selectedPeriod.name} (${selectedPeriod.startDate} s.d ${selectedPeriod.endDate})` : ''

    const renderHtmlTree = (title: string, akun: NeracaItem[], total: number, akunLaba?: number) => {
      const filteredAkun = akun.filter(a => a.code !== '390-002-01' && a.code !== '390-003-01')
      const childrenOf = (parentId: number | null) => filteredAkun.filter(a => a.parent_id === parentId)
      const roots = filteredAkun.filter(a => a.parent_id === null && a.level <= 1)
      const renderTree = (items: NeracaItem[], depth: number): string =>
        items.map(a => {
          const childs = childrenOf(a.id)
          const isH = a.is_header === 1
          const np = depth === 0 ? '0' : `${12 + depth * 12}px`
          const vp = depth <= 1 ? '0' : `${8 + (depth - 2) * 8}px`
          const label = a.code ? `${a.code} - ${a.name}` : a.name
          const value = isH && depth === 0 ? '' : formatCurrency(a.balance)
          const cls = depth <= 1 ? 'class="bold-row"' : isH ? 'class="bold-row"' : ''
          const vb = depth <= 1 ? 'class="bold-right"' : 'class="text-right"'
          const ch = childs.length > 0 ? renderTree(childs, depth + 1) : ''
          return `<tr ${cls}><td style="padding-left:${np}"><span>${label}</span></td><td ${vb} style="padding-left:${vp}">${value}</td></tr>${ch}`
        }).join('')
      let rows = renderTree(roots, 0)
      if (akunLaba !== undefined) {
        rows += `<tr class="bold-row"><td style="padding-left:36px"><span>Laba Periode Berjalan</span></td><td class="bold-right" style="padding-left:0">${formatCurrency(akunLaba)}</td></tr>`
      }
      return `
        <div class="section">
          <h3>${title}</h3>
          <table class="rpt-table">
            <tbody>${rows}</tbody>
            <tfoot>
              <tr class="total-row"><td>Total ${title.charAt(0).toUpperCase() + title.slice(1).toLowerCase()}</td><td class="text-right">${formatCurrency(total)}</td></tr>
            </tfoot>
          </table>
        </div>`
    }

    const renderLrSection = (title: string, items: { code: string; name: string; balance: number }[], total: number) => {
      const rows = items.map(a =>
        `<tr><td style="padding-left:12px"><span>${a.code} - ${a.name}</span></td><td class="text-right">${formatCurrency(a.balance)}</td></tr>`
      ).join('')
      return `
        <div class="section">
          <h3>${title}</h3>
          <table class="rpt-table">
            <tbody>${rows}</tbody>
            <tfoot>
              ${total !== undefined ? `<tr class="total-row"><td>Total ${title.charAt(0).toUpperCase() + title.slice(1).toLowerCase()}</td><td class="text-right">${formatCurrency(total)}</td></tr>` : ''}
            </tfoot>
          </table>
        </div>`
    }

    const n = data.neraca
    const lr = data.laba_rugi
    const neracaHtml = renderHtmlTree('ASET', n.aset.akun, n.aset.total) +
      renderHtmlTree('KEWAJIBAN', n.kewajiban.akun, n.kewajiban.total) +
      renderHtmlTree('EKUITAS', n.ekuitas.akun, n.ekuitas.total, n.laba_periode_berjalan)

    const neracaTotal = n.total_aset
    const pasivaTotal = n.total_kewajiban_ekuitas + n.laba_periode_berjalan

    const neracaGrandHtml = `
      <div class="grand-total">
        <div class="grand-row"><span>Total Aset</span><span>${formatCurrency(neracaTotal)}</span></div>
        <div class="grand-row"><span>Total Pasiva (Kewajiban + Ekuitas + Laba)</span><span>${formatCurrency(pasivaTotal)}</span></div>
        ${n.selisih !== 0 ? `<div class="grand-row selisih"><span>Selisih</span><span>${formatCurrency(n.selisih)}</span></div>` : `<div class="grand-row"><span>Selisih</span><span>${formatCurrency(0)}</span></div>`}
      </div>`

    const lbKotor = lr.laba_kotor
    const lbBersih = lr.laba_bersih
    const labaRugiHtml = renderLrSection('PENDAPATAN', lr.pendapatan.akun, lr.pendapatan.total) +
      renderLrSection('HARGA POKOK PENJUALAN', lr.harga_pokok_penjualan.akun, lr.harga_pokok_penjualan.total) +
      `<div class="subtotal-row"><span>Laba Kotor</span><span>${formatCurrency(lbKotor)}</span></div>` +
      renderLrSection('BEBAN', lr.beban.akun, lr.beban.total) +
      renderLrSection('BEBAN LAIN-LAIN', lr.beban_lain.akun, lr.beban_lain.total) +
      `<div class="grand-total"><div class="grand-row"><span>Laba Bersih</span><span>${formatCurrency(lbBersih)}</span></div></div>`

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Neraca & Laba Rugi - ${periodLabel}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      margin: 0; padding: 0;
      color: #111; font-size: 11px; line-height: 1.5;
    }
    .report-container { width: 100%; max-width: 190mm; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 2px solid #111;
    }
    .header .company { font-size: 15px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    .header .title { font-size: 13px; font-weight: 700; margin-top: 4px; }
    .header .period { font-size: 10px; color: #374151; margin-top: 2px; }
    .section { margin-bottom: 10px; }
    .section h3 {
      font-size: 11px; font-weight: 700; margin: 0 0 2px 0;
      padding: 4px 8px; border: 1px solid #d1d5db; border-bottom: none;
      background: #f0fdf4;
    }
    .section:nth-child(2) h3 { background: #fef2f2; }
    .section:nth-child(3) h3 { background: #eff6ff; }
    .rpt-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .rpt-table td { padding: 2px 8px; border: 1px solid #d1d5db; }
    .rpt-table tbody tr:first-child td { border-top: none; }
    .bold-row td { font-weight: 700; }
    .bold-row td:first-child { border-top: 1px solid #d1d5db; }
    .text-right { text-align: right; }
    .bold-right { text-align: right; font-weight: 700; }
    .total-row td { font-weight: 700; border-top: 2px solid #111; background: #f9fafb; }
    .subtotal-row {
      display: flex; justify-content: space-between;
      font-weight: 700; font-size: 11px;
      padding: 4px 8px; margin: 4px 0;
      border: 1px solid #d1d5db;
    }
    .grand-total {
      margin-top: 10px;
      padding: 8px 10px;
      border: 2px solid #111;
    }
    .grand-row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; padding: 2px 0; }
    .grand-row + .grand-row { border-top: 1px solid #d1d5db; padding-top: 4px; margin-top: 4px; }
    .selisih { color: #dc2626; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div class="company">${companyName || 'PERUSAHAAN'}</div>
      <div class="title">NERACA & LABA RUGI</div>
      <div class="period">Periode: ${periodLabel}</div>
    </div>
    <h2 style="font-size:12px;font-weight:700;margin:0 0 6px 0">NERACA</h2>
    ${neracaHtml}
    ${neracaGrandHtml}
    <div class="page-break"></div>
    <h2 style="font-size:12px;font-weight:700;margin:0 0 6px 0">LABA RUGI</h2>
    ${labaRugiHtml}
  </div>
</body>
</html>`

    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  const handleExportExcel = () => {
    if (!periodId) return
    window.open(`/api/reports/neraca-labarugi/export?periodId=${periodId}`, '_blank')
  }

  const selectedPeriod = periods.find(p => String(p.id) === periodId)

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Neraca & Laba Rugi</h1>
          <p className="text-xs text-slate-500">Laporan posisi keuangan dan laba rugi (S-Laporan)</p>
        </div>
        {data && (
          <div className="flex gap-2">
            <button onClick={handlePrintPreview} className="px-3 py-1.5 text-xs rounded bg-[#3C3C3C] text-white hover:bg-[#2A2A2A]">Cetak / Preview</button>
            <button onClick={handleExportExcel} className="px-3 py-1.5 text-xs rounded bg-[#FFA16C] text-white hover:bg-[#FF8F55]">Export Excel</button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px]">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Periode</label>
            <select className="input text-xs h-8 w-full" value={periodId} onChange={e => { setPeriodId(e.target.value); setData(null) }}>
              <option value="">-- Pilih Periode --</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.startDate} s.d {p.endDate})</option>
              ))}
            </select>
          </div>
          <button onClick={checkSnapshot} disabled={loading} className="px-3 py-1.5 text-xs rounded bg-[#3C3C3C] text-white h-8">{loading ? 'Memuat...' : 'Tampilkan'}</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-6">Memuat...</div>
      ) : !data ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center text-slate-500">
          {periodId ? 'Klik "Tampilkan" untuk melihat data' : 'Pilih periode terlebih dahulu'}
        </div>
      ) : (
        <div className="space-y-4">
          {/* NERACA SECTION */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 bg-slate-100 border-b border-slate-200">
              <h2 className="font-bold text-sm text-slate-800">NERACA</h2>
            </div>
            <div className="p-3 space-y-3">
              <NeracaSection title="ASET" akun={data.neraca.aset.akun} total={data.neraca.aset.total} bgColor="bg-emerald-50" textColor="text-emerald-800" />
              <NeracaSection title="KEWAJIBAN" akun={data.neraca.kewajiban.akun} total={data.neraca.kewajiban.total} bgColor="bg-red-50" textColor="text-red-800" />
              <NeracaSection
                title="EKUITAS"
                akun={data.neraca.ekuitas.akun}
                total={data.neraca.ekuitas.total + data.neraca.laba_periode_berjalan}
                bgColor="bg-blue-50"
                textColor="text-blue-800"
                extraRows={[{ label: 'Laba Periode Berjalan', balance: data.neraca.laba_periode_berjalan }]}
              />
              <div className="bg-white border border-slate-200 p-3 rounded">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Total Aset</span>
                  <span className="text-emerald-700">{formatCurrency(data.neraca.total_aset)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold mt-1">
                  <span>Total Pasiva (Kewajiban + Ekuitas + Laba)</span>
                  <span className="text-blue-700">{formatCurrency(data.neraca.total_kewajiban_ekuitas + data.neraca.laba_periode_berjalan)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold mt-1">
                  <span>Selisih</span>
                  <span className={data.neraca.selisih !== 0 ? 'text-red-600' : 'text-slate-600'}>{formatCurrency(data.neraca.selisih)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* LABA RUGI SECTION */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 bg-slate-100 border-b border-slate-200">
              <h2 className="font-bold text-sm text-slate-800">LABA RUGI</h2>
            </div>
            <div className="p-3 space-y-3">
              <LrSection title="PENDAPATAN" items={data.laba_rugi.pendapatan.akun} total={data.laba_rugi.pendapatan.total} />
              <LrSection title="HARGA POKOK PENJUALAN" items={data.laba_rugi.harga_pokok_penjualan.akun} total={data.laba_rugi.harga_pokok_penjualan.total} />
              <div className="flex items-center justify-between text-sm font-bold px-1">
                <span>Laba Kotor</span>
                <span>{formatCurrency(data.laba_rugi.laba_kotor)}</span>
              </div>
              <LrSection title="BEBAN" items={data.laba_rugi.beban.akun} total={data.laba_rugi.beban.total} />
              <LrSection title="BEBAN LAIN-LAIN" items={data.laba_rugi.beban_lain.akun} total={data.laba_rugi.beban_lain.total} />
              <div className="flex items-center justify-between text-sm font-bold border-t-2 border-slate-800 pt-2">
                <span>Laba Bersih</span>
                <span className="text-blue-700">{formatCurrency(data.laba_rugi.laba_bersih)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Popup */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-slate-800 mb-2">
              {popupMode === 'exists' ? 'Data Tersimpan Ditemukan' : 'Data Belum Tersimpan'}
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              {popupMode === 'exists'
                ? 'Terdapat data neraca & laba rugi yang tersimpan. Gunakan data tersimpan atau hitung ulang?'
                : 'Belum ada data tersimpan. Hitung ulang untuk menyimpan data neraca & laba rugi periode ini.'}
            </p>
            <div className="flex justify-end gap-2">
              {popupMode === 'exists' ? (
                <>
                  <button
                    onClick={() => { setShowPopup(false); loadFromSnapshot() }}
                    className="px-4 py-2 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    Gunakan Tersimpan
                  </button>
                  <button
                    onClick={calculateAndLoad}
                    disabled={popupLoading}
                    className="px-4 py-2 text-xs rounded bg-[#3C3C3C] text-white hover:bg-[#2A2A2A] disabled:opacity-60"
                  >
                    {popupLoading ? 'Menghitung...' : 'Ya, Hitung Ulang'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowPopup(false)}
                    className="px-4 py-2 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    Batal
                  </button>
                  <button
                    onClick={calculateAndLoad}
                    disabled={popupLoading}
                    className="px-4 py-2 text-xs rounded bg-[#3C3C3C] text-white hover:bg-[#2A2A2A] disabled:opacity-60"
                  >
                    {popupLoading ? 'Menghitung...' : 'Ya, Hitung'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NeracaSection({ title, akun, total, bgColor, textColor, extraRows }: {
  title: string
  akun: NeracaItem[]
  total: number
  bgColor: string
  textColor: string
  extraRows?: { label: string; balance: number }[]
}) {
  const filteredAkun = akun.filter(a => a.code !== '390-002-01' && a.code !== '390-003-01')
  const childrenOf = (parentId: number | null) => filteredAkun.filter(a => a.parent_id === parentId)
  const roots = filteredAkun.filter(a => a.parent_id === null && a.level <= 1)
  const renderTree = (items: NeracaItem[], depth: number): React.ReactNode[] =>
    items.flatMap(a => {
      const childs = childrenOf(a.id)
      const isHeader = a.is_header === 1
      return [
        <tr key={`nr-${a.code || a.id}`}>
          <td className="px-2 py-1" style={{ paddingLeft: `${depth === 0 ? 4 : 8 + depth * 10}px` }}>
            <span className={`text-xs ${depth <= 1 || isHeader ? 'font-bold' : ''}`}>{a.code ? `${a.code} - ${a.name}` : a.name}</span>
          </td>
          <td className="text-right text-xs" style={{ paddingLeft: `${depth <= 1 ? 0 : 6 + (depth - 2) * 6}px`, paddingRight: '8px' }}>
            {isHeader && depth === 0 ? '' : <span className={depth <= 1 ? 'font-bold' : ''}>{formatCurrency(a.balance)}</span>}
          </td>
        </tr>,
        ...(childs.length > 0 ? renderTree(childs, depth + 1) : [])
      ]
    })

  return (
    <div className={`rounded border border-slate-200 overflow-hidden ${bgColor}`}>
      <div className={`px-2 py-1 border-b border-slate-200 ${textColor}`}>
        <span className="font-bold text-xs">{title}</span>
      </div>
      <table className="min-w-full">
        <tbody>{renderTree(roots, 0)}</tbody>
        <tfoot>
          {(extraRows || []).map((r, i) => (
            <tr key={`extra-${i}`} className="border-t">
              <td className="px-2 py-1 font-bold text-xs" style={{ paddingLeft: '36px' }}>{r.label}</td>
              <td className="text-right px-2 py-1 font-bold text-xs">{formatCurrency(r.balance)}</td>
            </tr>
          ))}
          <tr className="border-t font-bold text-xs">
            <td className="px-2 py-1">Total {title.charAt(0).toUpperCase() + title.slice(1).toLowerCase()}</td>
            <td className="text-right px-2 py-1">{formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function LrSection({ title, items, total }: {
  title: string
  items: { code: string; name: string; balance: number }[]
  total: number
}) {
  return (
    <div className="rounded border border-slate-200 overflow-hidden bg-slate-50">
      <div className="px-2 py-1 border-b border-slate-200 bg-slate-100">
        <span className="font-bold text-xs text-slate-700">{title}</span>
      </div>
      <table className="min-w-full">
        <tbody>
          {items.map(a => (
            <tr key={a.code}>
              <td className="px-2 py-1 text-xs" style={{ paddingLeft: '12px' }}>{a.code} - {a.name}</td>
              <td className="text-right px-2 py-1 text-xs">{formatCurrency(a.balance)}</td>
            </tr>
          ))}
        </tbody>
        {total !== undefined && (
          <tfoot>
            <tr className="border-t font-bold text-xs">
              <td className="px-2 py-1">Total {title.charAt(0).toUpperCase() + title.slice(1).toLowerCase()}</td>
              <td className="text-right px-2 py-1">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
