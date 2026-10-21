"use client"

import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'

interface NeracaItem {
  id: number
  code: string
  name: string
  parent_id: number | null
  level: number
  is_header: number
  normal_balance: string
  balance: number
  saldo_awal: number
  debit: number
  kredit: number
}

interface NeracaData {
  aset: { total: number; akun: NeracaItem[] }
  kewajiban: { total: number; akun: NeracaItem[] }
  ekuitas: { total: number; akun: NeracaItem[] }
  total_aset: number
  total_kewajiban_ekuitas: number
  selisih: number
}

interface Periode {
  id: number; code: string; name: string; start_date: string; end_date: string
}

export default function NeracaPage() {
  const [periodId, setPeriodId] = useState<string>('')
  const [periods, setPeriods] = useState<Periode[]>([])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<NeracaData | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [showPopup, setShowPopup] = useState(false)
  const [popupMode, setPopupMode] = useState<'exists' | 'missing' | 'validation_error'>('missing')
  const [popupLoading, setPopupLoading] = useState(false)
  const [validationProblems, setValidationProblems] = useState<any[]>([])
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/periode')
      .then(r => r.json())
      .then(list => {
        if (Array.isArray(list)) setPeriods(list)
      })
      .catch(() => {})
    fetch('/api/settings?group=company')
      .then(r => r.json())
      .then(rows => {
        const map: Record<string, string> = {}
        ;(rows || []).forEach((r: any) => { map[r.setting_key] = String(r.setting_value ?? '') })
        setCompanyName(map['company_name'] || '')
      })
      .catch(() => {})
  }, [])

  const loadFromSnapshot = async () => {
    const id = periodId
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/snapshot?action=load&type=neraca&periodId=${id}`)
      if (!res.ok) throw new Error('No snapshot')
      const json = await res.json()
      setData(json)
    } catch {
      // fallback to direct calculation
      const res = await fetch(`/api/reports/neraca?periodId=${id}`)
      const json = await res.json()
      setData(json || null)
    } finally { setLoading(false) }
  }

  const calculateAndLoad = async () => {
    const id = periodId
    if (!id) return
    setPopupLoading(true)
    try {
      const res = await fetch(`/api/reports/snapshot?action=calculate&type=neraca&periodId=${id}`, { method: 'POST' })
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
    setValidationProblems([])
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/snapshot?action=check&type=neraca&periodId=${id}`)
      const json = await res.json()
      setPopupMode(json.exists ? 'exists' : 'missing')
      setShowPopup(true)
    } catch {
      await loadFromSnapshot()
    } finally { setLoading(false) }
  }

  const validateAndCalculate = async () => {
    const id = periodId
    if (!id) return
    setPopupLoading(true)
    try {
      const valRes = await fetch(`/api/reports/neraca/validate?periodId=${id}`)
      const valJson = await valRes.json()
      if (valJson.problems?.length > 0 || valJson.missing_map_groups?.length > 0) {
        setValidationProblems(valJson.problems || [])
        setPopupMode('validation_error')
        setPopupLoading(false)
        return
      }
    } catch {
      // jika validasi gagal, lanjutkan saja
    }
    await calculateAndLoad()
  }

  const loadReport = async () => {
    const id = periodId
    if (!id) return
    setLoading(true)
    setData(null)
    try {
      const res = await fetch(`/api/reports/neraca?periodId=${id}`)
      const json = await res.json()
      setData(json || null)
    } catch { setData(null) } finally { setLoading(false) }
  }

  const renderAkunRows = (akun: NeracaItem[]) => {
    akun = akun.filter(a => a.code !== '390-002-01' && a.code !== '390-003-01')
    const childrenOf = (parentId: number | null) => akun.filter(a => a.parent_id === parentId)
    const akunIds = new Set(akun.map(a => a.id))
    const roots = akun.filter(a => {
      if (a.parent_id === null) return true
      if (!akunIds.has(a.parent_id)) return true
      return false
    })
    const renderTree = (items: NeracaItem[], depth: number = 0): React.ReactNode[] => {
      return items.flatMap(a => {
        const childs = childrenOf(a.id)
        const isHeader = a.is_header === 1
        const isRoot = depth === 0
        const hideVal = false
        const hasChildren = childs.length > 0
        const namePad = isRoot ? 12 : 20 + (depth - 1) * 16
        const valPad = isRoot ? 0 : 12 + (depth - 2) * 12
        const bold = hasChildren
        return [
          <tr key={a.code || a.name} className={isRoot ? 'border-t border-b-2 border-slate-300' : 'border-t'}>
            <td className="px-3 py-1.5" style={{ paddingLeft: `${namePad}px` }}>
              <span className={bold ? 'font-bold' : ''}>{a.code ? `${a.code} - ${a.name}` : a.name}</span>
            </td>
            <td className="py-1.5 text-right" style={{ paddingLeft: `${valPad}px`, paddingRight: '8px' }}>
              {hideVal ? '' : <span className={bold ? 'font-bold' : ''}>{formatCurrency(a.saldo_awal)}</span>}
            </td>
            <td className="py-1.5 text-right" style={{ paddingLeft: `${valPad}px`, paddingRight: '8px' }}>
              {hideVal ? '' : <span className={bold ? 'font-bold' : ''}>{formatCurrency(a.debit)}</span>}
            </td>
            <td className="py-1.5 text-right" style={{ paddingLeft: `${valPad}px`, paddingRight: '8px' }}>
              {hideVal ? '' : <span className={bold ? 'font-bold' : ''}>{formatCurrency(a.kredit)}</span>}
            </td>
            <td className="py-1.5 text-right" style={{ paddingLeft: `${valPad}px`, paddingRight: '8px' }}>
              {hideVal ? '' : <span className={bold ? 'font-bold' : ''}>{formatCurrency(a.balance)}</span>}
            </td>
          </tr>,
          ...(childs.length > 0 ? renderTree(childs, depth + 1) : [])
        ]
      })
    }
    return renderTree(roots)
  }

  const renderSection = (title: string, akun: NeracaItem[], total: number, bgColor: string, textColor: string) => (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className={`p-3 ${bgColor} border-b border-slate-200`}>
        <h2 className={`font-bold text-sm ${textColor}`}>{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-3 py-1.5 text-left font-semibold text-slate-600">Akun</th>
              <th className="px-3 py-1.5 text-right font-semibold text-slate-600">Saldo Awal</th>
              <th className="px-3 py-1.5 text-right font-semibold text-slate-600">Debit</th>
              <th className="px-3 py-1.5 text-right font-semibold text-slate-600">Kredit</th>
              <th className="px-3 py-1.5 text-right font-semibold text-slate-600">Saldo</th>
            </tr>
          </thead>
          <tbody>{renderAkunRows(akun)}</tbody>
          <tfoot>
            <tr className={`border-t font-bold ${bgColor}`}>
              <td className="px-3 py-2">Total {title}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(total)}</td>
              <td />
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )

  const bgColors = ['bg-emerald-50', 'bg-red-50', 'bg-blue-50']
  const textColors = ['text-emerald-800', 'text-red-800', 'text-blue-800']

  const handlePrintPreview = () => {
    if (!data || !printRef.current) return
    const win = window.open('', '_blank', 'width=1000,height=700')
    if (!win) { alert('Popup diblokir browser. Izinkan popup untuk melanjutkan.'); return }

    const selectedPeriod = periods.find(p => String(p.id) === periodId)
    const periodLabel = selectedPeriod
      ? `${selectedPeriod.name} (${selectedPeriod.startDate} s.d ${selectedPeriod.endDate})`
      : ''

    const sectionsHtml = ['ASET', 'KEWAJIBAN', 'EKUITAS'].map((title, i) => {
      const section = title === 'ASET' ? data.aset : title === 'KEWAJIBAN' ? data.kewajiban : data.ekuitas
      const akun = section.akun.filter((a: NeracaItem) => a.code !== '390-002-01' && a.code !== '390-003-01')
      const total = section.total
      const childrenOf = (parentId: number | null) => akun.filter((a: NeracaItem) => a.parent_id === parentId)
      const akunIds = new Set(akun.map((a: NeracaItem) => a.id))
      const roots = akun.filter((a: NeracaItem) => {
        if (a.parent_id === null) return true
        if (!akunIds.has(a.parent_id)) return true
        return false
      })

      const renderTreeHtml = (items: NeracaItem[], depth: number): string => {
        return items.map(a => {
          const childs = childrenOf(a.id)
          const isHeader = a.is_header === 1
          const isRoot = depth === 0
          const hideVal = false
          const hasChildren = childs.length > 0
          const namePad = isRoot ? '0' : `${20 + (depth - 1) * 20}px`
          const valPad = depth <= 1 ? '0' : `${12 + (depth - 2) * 12}px`
          const label = a.code ? `${a.code} - ${a.name}` : a.name
          const bold = hasChildren ? 'font-bold' : ''
          const cls = isRoot ? 'class="level-1"' : isHeader ? 'class="level-h"' : ''
          const saldoAwal = hideVal ? '' : formatCurrency(a.saldo_awal)
          const debit = hideVal ? '' : formatCurrency(a.debit)
          const kredit = hideVal ? '' : formatCurrency(a.kredit)
          const balance = hideVal ? '' : formatCurrency(a.balance)
          const childrenHtml = childs.length > 0 ? renderTreeHtml(childs, depth + 1) : ''
          return `<tr ${cls}><td style="padding-left:${namePad}"><span>${label}</span></td><td class="text-right ${bold}" style="padding-left:${valPad}">${saldoAwal}</td><td class="text-right ${bold}" style="padding-left:${valPad}">${debit}</td><td class="text-right ${bold}" style="padding-left:${valPad}">${kredit}</td><td class="text-right ${bold}" style="padding-left:${valPad}">${balance}</td></tr>${childrenHtml}`
        }).join('')
      }

      const rowsHtml = renderTreeHtml(roots, 0)

      return `
        <div class="section">
          <h3>${title}</h3>
          <table class="neraca-table">
            <thead>
              <tr class="header-row"><th>Akun</th><th>Saldo Awal</th><th>Debit</th><th>Kredit</th><th>Saldo</th></tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr class="total-row"><td>Total ${title.charAt(0) + title.slice(1).toLowerCase()}</td><td class="text-right">${formatCurrency(total)}</td><td></td><td></td><td></td></tr>
            </tfoot>
          </table>
        </div>`
    }).join('')

    const grandTotalHtml = `
      <div class="grand-total">
        <div class="grand-row"><span>Total Aset</span><span>${formatCurrency(data.total_aset)}</span></div>
        <div class="grand-row"><span>Total Kewajiban + Ekuitas</span><span>${formatCurrency(data.total_kewajiban_ekuitas)}</span></div>
        ${data.selisih !== 0 ? `<div class="grand-row selisih"><span>Selisih</span><span>${formatCurrency(data.selisih)}</span></div>` : ''}
      </div>`

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Neraca - ${periodLabel}</title>
  <style>
    @page { size: A4 portrait; margin: 20mm 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      margin: 0; padding: 0;
      color: #111;
      font-size: 12px;
      line-height: 1.5;
    }
    .report-container {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #111;
    }
    .header .company {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .header .title {
      font-size: 14px;
      font-weight: 700;
      margin-top: 4px;
    }
    .header .period {
      font-size: 11px;
      color: #374151;
      margin-top: 2px;
    }
    .section {
      margin-bottom: 16px;
    }
    .section h3 {
      font-size: 12px;
      font-weight: 700;
      margin: 0 0 4px 0;
      padding: 6px 8px;
      background: #f0fdf4;
      border: 1px solid #d1d5db;
      border-bottom: none;
    }
    .section:nth-child(2) h3 { background: #fef2f2; }
    .section:nth-child(3) h3 { background: #eff6ff; }
    .neraca-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .neraca-table td {
      padding: 3px 8px;
      border: 1px solid #d1d5db;
    }
    .neraca-table .level-1 td {
      font-weight: 700;
      border-bottom: 2px solid #111;
    }
    .neraca-table .level-1 + tr td {
      border-top: none;
    }
    .neraca-table .level-h td {
      font-weight: 600;
    }
    .font-bold { font-weight: 700; }

    .total-row td {
      font-weight: 700;
      border-top: 2px solid #111;
      background: #f9fafb;
    }
    .text-right { text-align: right; }
    .header-row th {
      padding: 4px 8px;
      border: 1px solid #d1d5db;
      background: #f9fafb;
      font-weight: 600;
      font-size: 10px;
      text-align: center;
    }
    .header-row th:first-child { text-align: left; }
    .grand-total {
      margin-top: 16px;
      padding: 10px 12px;
      border: 2px solid #111;
    }
    .grand-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 700;
      padding: 2px 0;
    }
    .grand-row + .grand-row { border-top: 1px solid #d1d5db; padding-top: 4px; margin-top: 4px; }
    .selisih { color: #dc2626; }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div class="company">${companyName || 'PERUSAHAAN'}</div>
      <div class="title">NERACA</div>
      <div class="period">Periode: ${periodLabel}</div>
    </div>
    ${sectionsHtml}
    ${grandTotalHtml}
  </div>
</body>
</html>`

    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  const sections = data ? [
    { title: 'ASET', akun: data.aset.akun, total: data.aset.total },
    { title: 'KEWAJIBAN', akun: data.kewajiban.akun, total: data.kewajiban.total },
    { title: 'EKUITAS', akun: data.ekuitas.akun, total: data.ekuitas.total },
  ] : []

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Neraca</h1>
          <p className="text-xs text-slate-500">Laporan posisi keuangan</p>
        </div>
        {data && (
          <div className="flex gap-2">
            <button onClick={handlePrintPreview} className="px-3 py-1.5 text-xs rounded-pill bg-teal-primary hover:bg-teal-dark text-white">Cetak / Preview</button>
            <a
              href={`/api/reports/neraca/export?periodId=${periodId}`}
              className="px-3 py-1.5 text-xs rounded-pill border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg inline-block"
            >Export Excel</a>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px]">
            <label className="block text-[10px] text-slate-600 mb-1 font-bold">Periode</label>
            <select className="select-teal border border-slate-300 rounded-pill px-2 py-1.5 text-xs outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-[#E8F6F5] focus:border-[#2BA8A2] w-full" value={periodId} onChange={e => { setPeriodId(e.target.value); setData(null) }}>
              <option value="">-- Pilih Periode --</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.startDate} s.d {p.endDate})</option>
              ))}
            </select>
          </div>
          <button onClick={checkSnapshot} className="px-3 py-1.5 text-xs rounded-pill bg-teal-primary hover:bg-teal-dark text-white">Tampilkan</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-6">Memuat...</div>
      ) : !data ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center text-slate-500">
          {periodId ? 'Klik "Tampilkan" untuk melihat data' : 'Pilih periode terlebih dahulu'}
        </div>
      ) : (
        <div ref={printRef} className="space-y-4">
          {sections.map((s, i) => renderSection(s.title, s.akun, s.total, bgColors[i], textColors[i]))}

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
            <div className="flex items-center justify-between text-sm font-bold">
              <span>Total Aset</span>
              <span className="text-emerald-700">{formatCurrency(data.total_aset)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold mt-1">
              <span>Total Kewajiban + Ekuitas</span>
              <span className="text-blue-700">{formatCurrency(data.total_kewajiban_ekuitas)}</span>
            </div>
            {data.selisih !== 0 && (
              <div className="flex items-center justify-between text-sm font-bold mt-1 text-red-600">
                <span>Selisih</span>
                <span>{formatCurrency(data.selisih)}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            {popupLoading ? (
              <div className="text-center py-6">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-slate-600">Menghitung saldo...</p>
              </div>
            ) : popupMode === 'validation_error' ? (
              <>
                <div className="flex items-center gap-2 mb-3 text-red-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  <h3 className="text-base font-bold">Data Tidak Balance</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Terdapat nota yang tidak balance atau belum memiliki perkiraan akun. Perbaiki data berikut sebelum menampilkan Neraca:
                </p>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto border rounded p-2 bg-red-50">
                  {validationProblems.map((p, idx) => (
                    <div key={idx} className="text-xs bg-white rounded p-2 border border-red-200">
                      <div className="font-semibold text-red-700">{p.source_type} — {p.source_number}</div>
                      {!p.is_balanced && (
                        <div className="text-slate-600 mt-0.5">
                          Debit: {new Intl.NumberFormat('id-ID').format(p.total_debit)} | Kredit: {new Intl.NumberFormat('id-ID').format(p.total_credit)} <span className="text-red-500">(tidak balance)</span>
                        </div>
                      )}
                      {p.has_missing_account && (
                        <div className="text-red-500 mt-0.5">Beberapa item belum memiliki perkiraan akun</div>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowPopup(false)}
                  className="mt-4 w-full px-4 py-2 text-xs rounded-pill border border-slate-300 text-slate-700 hover:bg-slate-50">
                  Tutup
                </button>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-slate-800 mb-2">Hitung Saldo</h3>
                <p className="text-sm text-slate-600 mb-5">
                  {popupMode === 'exists'
                    ? 'Data saldo untuk periode ini sudah tersimpan. Hitung ulang?'
                    : 'Belum ada data saldo untuk periode ini. Hitung sekarang?'}
                </p>
                <div className="flex justify-end gap-2">
                  {popupMode === 'exists' ? (
                    <>
                      <button onClick={() => { setShowPopup(false); loadFromSnapshot() }}
                        className="px-4 py-2 text-xs rounded-pill border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg">
                        Gunakan Tersimpan
                      </button>
                      <button onClick={validateAndCalculate}
                        className="px-4 py-2 text-xs rounded-pill bg-teal-primary hover:bg-teal-dark text-white">
                        Ya, Hitung Ulang
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setShowPopup(false)}
                        className="px-4 py-2 text-xs rounded-pill border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg">
                        Batal
                      </button>
                      <button onClick={validateAndCalculate}
                        className="px-4 py-2 text-xs rounded-pill bg-teal-primary hover:bg-teal-dark text-white">
                        Ya, Hitung
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
