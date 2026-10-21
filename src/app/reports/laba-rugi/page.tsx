"use client"

import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'

interface AkunTotal {
  code: string
  name: string
  balance: number
}

interface LabaRugiSection {
  total: number
  akun: AkunTotal[]
}

interface LabaRugiData {
  pendapatan: LabaRugiSection
  harga_pokok_penjualan: LabaRugiSection
  beban: LabaRugiSection
  beban_lain: LabaRugiSection
  laba_kotor: number
  laba_bersih: number
  previous?: LabaRugiData
  prevPeriodName?: string
}

interface Periode {
  id: number
  code: string
  name: string
  start_date: string
  end_date: string
}

export default function LabaRugiPage() {
  const [periodId, setPeriodId] = useState<string>('')
  const [periods, setPeriods] = useState<Periode[]>([])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LabaRugiData | null>(null)
  const [compare, setCompare] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [popupMode, setPopupMode] = useState<'exists' | 'missing'>('missing')
  const [popupLoading, setPopupLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/periode')
      .then(r => r.json())
      .then(list => {
        if (Array.isArray(list)) {
          setPeriods(list)
          const aktif = list.find((p: any) => p.is_active)
          if (aktif) setPeriodId(String(aktif.id))
        }
      })
      .catch(() => {})
  }, [])

  const loadFromSnapshot = async () => {
    const id = periodId
    if (!id) return
    setLoading(true)
    try {
      const url = `/api/reports/snapshot?action=load&type=laba_rugi&periodId=${id}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('No snapshot')
      const json = await res.json()
      setData(json || null)
    } catch {
      const res = await fetch(`/api/reports/laba-rugi?periodId=${id}&compare=false`)
      const json = await res.json()
      setData(json || null)
    } finally { setLoading(false) }
  }

  const calculateAndLoad = async () => {
    const id = periodId
    if (!id) return
    setPopupLoading(true)
    try {
      const res = await fetch(`/api/reports/snapshot?action=calculate&type=laba_rugi&periodId=${id}`, { method: 'POST' })
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
    try {
      const res = await fetch(`/api/reports/snapshot?action=check&type=laba_rugi&periodId=${id}`)
      const json = await res.json()
      setPopupMode(json.exists ? 'exists' : 'missing')
      setShowPopup(true)
    } catch {
      await loadFromSnapshot()
    }
  }

  const loadReport = async (pid?: string) => {
    const id = pid || periodId
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/laba-rugi?periodId=${id}&compare=false`)
      const json = await res.json()
      setData(json || null)
    } catch { setData(null) } finally { setLoading(false) }
  }

  const handlePrintPreview = () => {
    if (!data || !printRef.current) return
    const win = window.open('', '_blank', 'width=1000,height=700')
    if (!win) { alert('Popup diblokir browser. Izinkan popup untuk melanjutkan.'); return }

    const selectedPeriod = periods.find(p => String(p.id) === periodId)
    const periodLabel = selectedPeriod
      ? selectedPeriod.name + ' (' + selectedPeriod.start_date + ' s.d ' + selectedPeriod.end_date + ')'
      : ''

    const makeRowsHtml = (section: LabaRugiSection) => {
      return section.akun
        .filter(a => a.balance !== 0)
        .map(a => '<tr><td style="padding-left:20px">' + a.code + ' - ' + a.name + '</td><td class="text-right">' + formatCurrency(a.balance) + '</td></tr>')
        .join('')
    }

    const makeTableHtml = (title: string, section: LabaRugiSection) => {
      const rows = makeRowsHtml(section)
      return '<div class="section"><h3>' + title + '</h3><table class="lr-table"><thead><tr class="header-row"><th>Akun</th><th>Saldo</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr class="total-row"><td>Total ' + title.charAt(0).toLowerCase() + title.slice(1) + '</td><td class="text-right">' + formatCurrency(section.total) + '</td></tr></tfoot></table></div>'
    }

    var sectionsHtml = ''
    sectionsHtml += makeTableHtml('PENDAPATAN', data.pendapatan)
    sectionsHtml += makeTableHtml('HARGA POKOK PENJUALAN', data.harga_pokok_penjualan)
    sectionsHtml += '<div class="section grand"><span>LABA KOTOR</span><span>' + formatCurrency(data.laba_kotor) + '</span></div>'
    sectionsHtml += makeTableHtml('BEBAN OPERASIONAL', data.beban)
    sectionsHtml += makeTableHtml('BEBAN LAIN-LAIN', data.beban_lain)
    sectionsHtml += '<div class="section grand border-2"><span>LABA (RUGI) BERSIH</span><span>' + formatCurrency(data.laba_bersih) + '</span></div>'

    var html = '<!DOCTYPE html>'
    html += '<html><head><meta charset="utf-8"><title>Laba Rugi - ' + periodLabel + '</title>'
    html += '<style>'
    html += '@page { size: A4 portrait; margin: 20mm 15mm; }'
    html += '* { box-sizing: border-box; }'
    html += 'body { font-family: "Times New Roman", Times, serif; margin: 0; padding: 0; color: #111; font-size: 12px; line-height: 1.5; }'
    html += '.report-container { width: 100%; max-width: 190mm; margin: 0 auto; }'
    html += '.header { text-align: center; margin-bottom: 20px; }'
    html += '.header h1 { font-size: 16px; margin: 0 0 4px; text-transform: uppercase; }'
    html += '.header p { margin: 0; font-size: 12px; color: #444; }'
    html += '.section { margin-bottom: 16px; }'
    html += '.section h3 { font-size: 13px; margin: 0 0 6px; padding: 4px 8px; background: #f1f5f9; border-bottom: 1px solid #ccc; }'
    html += '.lr-table { width: 100%; border-collapse: collapse; }'
    html += '.lr-table th, .lr-table td { padding: 3px 8px; border: 1px solid #ccc; }'
    html += '.lr-table th { background: #e2e8f0; font-weight: bold; text-align: left; }'
    html += '.lr-table td.text-right { text-align: right; }'
    html += '.lr-table .total-row td { font-weight: bold; border-top: 2px solid #333; }'
    html += '.grand { display: flex; justify-content: space-between; padding: 8px; border: 1px solid #ccc; font-weight: bold; font-size: 13px; }'
    html += '.border-2 { border-width: 2px; border-color: #333; }'
    html += '.footer { text-align: center; margin-top: 30px; font-size: 11px; color: #888; }'
    html += '</style></head><body>'
    html += '<div class="report-container">'
    html += '<div class="header"><h1>Laporan Laba Rugi</h1><p>Periode: ' + periodLabel + '</p></div>'
    html += sectionsHtml
    html += '<div class="footer">Dicetak dari Sistem</div>'
    html += '</div></body></html>'

    win.document.write(html)
    win.document.close()
  }

  const renderSection = (title: string, current: LabaRugiSection, prev?: LabaRugiSection, color?: string) => {
    const merged = new Map<string, { name: string; cur: number; prv: number }>()
    for (const a of current.akun) {
      merged.set(a.code, { name: a.name, cur: a.balance, prv: 0 })
    }
    if (prev) {
      for (const a of prev.akun) {
        const existing = merged.get(a.code)
        if (existing) existing.prv = a.balance
        else merged.set(a.code, { name: a.name, cur: 0, prv: a.balance })
      }
    }
    const rows = Array.from(merged.entries()).filter(([_, v]) => v.cur !== 0 || v.prv !== 0)

    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className={`p-3 ${color || 'bg-slate-50'} border-b border-slate-200`}>
          <h2 className="font-bold text-sm">{title}</h2>
        </div>
        <table className="min-w-full text-xs">
          <thead>
            {compare && (
              <tr className="bg-slate-50 text-slate-500">
                <th className="px-3 py-1 text-left font-semibold">Akun</th>
                <th className="px-3 py-1 text-right font-semibold">Periode Ini</th>
                <th className="px-3 py-1 text-right font-semibold">Periode Lalu</th>
                <th className="px-3 py-1 text-right font-semibold">Selisih</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={compare ? 4 : 2} className="px-3 py-3 text-center text-slate-400">Tidak ada transaksi</td></tr>
            )}
            {rows.map(([code, v]) => {
              const diff = v.cur - v.prv
              const diffPct = v.prv !== 0 ? Math.round((diff / v.prv) * 100) : 0
              return (
                <tr key={code} className="border-t">
                  <td className="px-3 py-1.5">{code} - {v.name}</td>
                  <td className="px-3 py-1.5 text-right">{formatCurrency(v.cur)}</td>
                  {compare && (
                    <>
                      <td className="px-3 py-1.5 text-right">{formatCurrency(v.prv)}</td>
                      <td className={`px-3 py-1.5 text-right font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(diff)} {diffPct !== 0 && `(${diffPct}%)`}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
          {(() => {
            const diff = current.total - (prev?.total || 0)
            return (
              <tfoot>
                <tr className="border-t font-bold bg-slate-50">
                  <td className="px-3 py-2">Total {title}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(current.total)}</td>
                  {compare && (
                    <>
                      <td className="px-3 py-2 text-right">{formatCurrency(prev?.total || 0)}</td>
                      <td className={`px-3 py-2 text-right ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(diff)}</td>
                    </>
                  )}
                </tr>
              </tfoot>
            )
          })()}
        </table>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Laba Rugi</h1>
          <p className="text-xs text-slate-500">Laporan laba rugi periode</p>
        </div>
        {data && (
          <div className="flex gap-2">
            <button onClick={handlePrintPreview} className="px-3 py-1.5 text-xs rounded-pill bg-teal-primary hover:bg-teal-dark text-white">Cetak / Preview</button>
            <a
              href={`/api/reports/laba-rugi/export?periodId=${periodId}`}
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
          <button onClick={() => setCompare(!compare)}
            className={`px-3 py-1.5 rounded-pill text-xs ${compare ? 'bg-teal-primary text-white border border-teal-primary' : 'border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg'}`}>
            {compare ? 'Banding Periode ON' : 'Banding Periode'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-6">Memuat...</div>
      ) : !data ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center text-slate-500">Tidak ada data</div>
      ) : (
        <div ref={printRef} className="space-y-4">
          {renderSection('PENDAPATAN', data.pendapatan, data.previous?.pendapatan, 'bg-green-50 text-green-800')}
          {renderSection('HARGA POKOK PENJUALAN', data.harga_pokok_penjualan, data.previous?.harga_pokok_penjualan, 'bg-yellow-50 text-yellow-800')}

          {(() => {
            const labaKotor = data.laba_kotor
            const prevLabaKotor = data.previous?.laba_kotor || 0
            const diff = labaKotor - prevLabaKotor
            return (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex items-center justify-between text-sm font-bold">
                <span>LABA KOTOR</span>
                <div className="flex items-center gap-4">
                  <span className={labaKotor >= 0 ? 'text-emerald-700' : 'text-red-600'}>{formatCurrency(labaKotor)}</span>
                  {compare && (
                    <>
                      <span className="text-slate-400 font-normal">{formatCurrency(prevLabaKotor)}</span>
                      <span className={diff >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(diff)}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          {renderSection('BEBAN OPERASIONAL', data.beban, data.previous?.beban, 'bg-red-50 text-red-800')}
          {renderSection('BEBAN LAIN-LAIN', data.beban_lain, data.previous?.beban_lain, 'bg-orange-50 text-orange-800')}

          {(() => {
            const lb = data.laba_bersih
            const prevLb = data.previous?.laba_bersih || 0
            const diff = lb - prevLb
            return (
              <div className="bg-white rounded-lg shadow-sm border-2 border-slate-300 p-4 flex items-center justify-between text-base font-bold">
                <span>LABA (RUGI) BERSIH</span>
                <div className="flex items-center gap-4">
                  <span className={lb >= 0 ? 'text-emerald-700' : 'text-red-600'}>{formatCurrency(lb)}</span>
                  {compare && (
                    <>
                      <span className="text-slate-400 font-normal">{formatCurrency(prevLb)}</span>
                      <span className={diff >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(diff)}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-full mx-4">
            {popupLoading ? (
              <div className="text-center py-6">
                <div className="animate-spin w-8 h-8 border-4 border-teal-primary border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-slate-600">Menghitung saldo...</p>
              </div>
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
                      <button onClick={calculateAndLoad}
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
                      <button onClick={calculateAndLoad}
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
