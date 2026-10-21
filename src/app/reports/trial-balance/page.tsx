"use client"

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'

interface BaseAccount {
  id: number
  code: string
  name: string
  parent_id: number | null
  level: number
  is_header: number
  normal_balance: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const CATEGORIES = [
  { golongan: ['aset_lancar_kas', 'aset_lancar_piutang', 'aset_lancar_persediaan', 'aset_lancar_lainnya', 'aset_tidak_lancar'], label: 'ASET', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { golongan: ['kewajiban_lancar', 'kewajiban_tidak_lancar'], label: 'KEWAJIBAN', color: 'bg-red-50 text-red-800 border-red-200' },
  { golongan: ['ekuitas'], label: 'EKUITAS', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  { golongan: ['pendapatan', 'pendapatan_lain'], label: 'PENDAPATAN', color: 'bg-green-50 text-green-800 border-green-200' },
  { golongan: ['hpp'], label: 'HARGA POKOK PENJUALAN', color: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  { golongan: ['beban', 'beban_lain'], label: 'BEBAN', color: 'bg-orange-50 text-orange-800 border-orange-200' },
]

function matchesCategory(item: { golongan?: string }, cat: typeof CATEGORIES[0]): boolean {
  return item.golongan ? cat.golongan.includes(item.golongan) : false
}

function renderTree(
  items: BaseAccount[],
  depth: number,
  parentId: number | null,
  renderCell: (item: BaseAccount) => React.ReactNode,
  monthCount: number,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
    const itemIds = new Set(items.map(i => Number(i.id)))
  for (const item of items) {
    const pid = item.parent_id !== null ? Number(item.parent_id) : null
    if (parentId === null) {
      if (pid !== null && itemIds.has(pid)) continue
    } else {
      if (pid !== parentId) continue
    }
    const isRoot = depth === 0
    const bg = isRoot ? 'font-bold text-slate-900 border-t-2 border-slate-300' :
               depth === 1 ? 'font-semibold text-slate-800' :
               'text-slate-600'
    const padLeft = Math.min(4 + depth * 16, 60)
    nodes.push(
      <tr key={item.code} className={`${bg} border-t border-slate-200`}>
        <td className="px-3 py-1 font-mono text-[10px] whitespace-nowrap" style={{ paddingLeft: padLeft }}>{item.code}</td>
        <td className="px-3 py-1" style={{ paddingLeft: padLeft }}>{item.name}</td>
        {renderCell(item)}
      </tr>
    )
    const hasChildren = items.some(c => Number(c.parent_id) === Number(item.id))
    if (hasChildren) {
      const childNodes = renderTree(items, depth + 1, Number(item.id), renderCell, monthCount)
      nodes.push(...childNodes)
    }
  }
  return nodes
}

export default function TrialBalancePage() {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [mode, setMode] = useState<'annual' | 'comparison'>('annual')
  const [loading, setLoading] = useState(false)
  const [allAccounts, setAllAccounts] = useState<any[]>([])
  const [monthNames, setMonthNames] = useState<string[]>([])
  const [compMeta, setCompMeta] = useState<any>(null)
  const [companyName, setCompanyName] = useState('')
  const [showPopup, setShowPopup] = useState(false)
  const [popupMode, setPopupMode] = useState<'exists' | 'missing'>('missing')
  const [popupLoading, setPopupLoading] = useState(false)

  useEffect(() => {
    fetch('/api/settings?group=company')
      .then(r => r.json())
      .then(rows => {
        const map: Record<string, string> = {}
        ;(rows || []).forEach((r: any) => { map[r.setting_key] = String(r.setting_value ?? '') })
        setCompanyName(map['company_name'] || '')
      })
      .catch(() => {})
  }, [])

  async function loadFromSnapshot() {
    setLoading(true)
    try {
      if (mode === 'comparison') throw new Error('Use direct API for comparison')
      const res = await fetch(`/api/reports/snapshot?action=load&type=trial_balance&periodId=${year}`)
      if (!res.ok) throw new Error('No snapshot')
      const json = await res.json()
      setMonthNames(json.monthNames || MONTHS)
      setAllAccounts(json.accounts || [])
      setCompMeta(null)
    } catch {
      // fallback to direct API
      const params = mode === 'annual' ? `year=${year}` : `year=${year}&month=${month}`
      const res = await fetch(`/api/reports/trial-balance?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat data')
      const json = await res.json()
      setMonthNames(json.monthNames || MONTHS)
      setAllAccounts(json.accounts || [])
      if (json.mode === 'comparison') {
        setCompMeta({ monthName: json.monthName, prevMonthName: json.prevMonthName, prevYear: json.prevYear, prevMonth: json.prevMonth, totals: json.totals })
      } else setCompMeta(null)
    } finally { setLoading(false) }
  }

  async function calculateAndLoad() {
    setPopupLoading(true)
    try {
      const res = await fetch(`/api/reports/snapshot?action=calculate&type=trial_balance&periodId=${year}`, { method: 'POST' })
      if (!res.ok) throw new Error('Gagal menghitung')
    } catch (e: any) { alert(e.message); setPopupLoading(false); setShowPopup(false); return }
    setPopupLoading(false)
    setShowPopup(false)
    await loadFromSnapshot()
  }

  async function checkSnapshot() {
    setShowPopup(false)
    try {
      const res = await fetch(`/api/reports/snapshot?action=check&type=trial_balance&periodId=${year}`)
      const json = await res.json()
      setPopupMode(json.exists ? 'exists' : 'missing')
      setShowPopup(true)
    } catch { await loadFromSnapshot() }
  }

  async function load() {
    setLoading(true)
    try {
      const params = mode === 'annual' ? `year=${year}` : `year=${year}&month=${month}`
      const res = await fetch(`/api/reports/trial-balance?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat data')
      const json = await res.json()
      setMonthNames(json.monthNames || MONTHS)
      setAllAccounts(json.accounts || [])
      if (json.mode === 'comparison') {
        setCompMeta({ monthName: json.monthName, prevMonthName: json.prevMonthName, prevYear: json.prevYear, prevMonth: json.prevMonth, totals: json.totals })
      } else setCompMeta(null)
    } catch (e: any) { alert(e.message) } finally { setLoading(false) }
  }

  function cellClass(nb: string, val: number): string {
    if (val === 0) return 'text-slate-400'
    if (nb === 'D') return 'text-slate-800 font-medium'
    return 'text-blue-700 font-medium'
  }

  function renderAnnualCard(cat: typeof CATEGORIES[0]) {
    const catAccounts = allAccounts.filter((a: any) => matchesCategory(a, cat))
    if (catAccounts.length === 0) return null
    const treeNodes = renderTree(catAccounts, 0, null, (item: any) => (
      <>
        {monthNames.map((_, mi) => (
          <td key={mi} className={`px-3 py-1 text-right ${cellClass(item.normal_balance, item.monthly?.[mi] || 0)}`}>
            {formatCurrency(item.monthly?.[mi] || 0)}
          </td>
        ))}
      </>
    ), 12)
    return (
      <div key={cat.golongan.join(',')} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className={`p-2.5 ${cat.color} border-b border-slate-200`}>
          <h2 className="font-bold text-sm">{cat.label}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="px-3 py-2 text-left font-semibold w-20">Kode</th>
                <th className="px-3 py-2 text-left font-semibold min-w-[200px]">Nama Akun</th>
                {monthNames.map((mn, i) => (
                  <th key={i} className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                    {mn}<br /><span className="text-[10px] font-normal text-slate-500">{year}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{treeNodes}</tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-slate-800 border-t border-slate-300">
                <td className="px-3 py-1.5" colSpan={2}>Total {cat.label}</td>
                {Array.from({ length: 12 }, (_, m) => {
                  const monthTotal = catAccounts
                    .filter((a: any) => Number(a.is_header) === 0)
                    .reduce((s, a) => s + (a.monthly?.[m] || 0), 0)
                  return <td key={m} className="px-3 py-1.5 text-right">{formatCurrency(monthTotal)}</td>
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  function renderComparisonCard(cat: typeof CATEGORIES[0]) {
    const catAccounts = allAccounts.filter((a: any) => matchesCategory(a, cat))
    if (catAccounts.length === 0) return null
    const treeNodes = renderTree(catAccounts, 0, null, (item: any) => {
      const cur = item.current || 0
      const prv = item.previous || 0
      const diff = item.difference || 0
      const pct = item.differencePercent || 0
      return (
        <>
          <td className={`px-3 py-1 text-right ${cellClass(item.normal_balance, cur)}`}>{formatCurrency(cur)}</td>
          <td className={`px-3 py-1 text-right ${cellClass(item.normal_balance, prv)}`}>{formatCurrency(prv)}</td>
          <td className={`px-3 py-1 text-right font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(diff)}</td>
          <td className={`px-3 py-1 text-right font-medium ${pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{pct}%</td>
        </>
      )
    }, 1)
    const posting = catAccounts.filter((a: any) => Number(a.is_header) === 0)
    const curTotal = posting.reduce((s: number, a: any) => s + (a.current || 0), 0)
    const prvTotal = posting.reduce((s: number, a: any) => s + (a.previous || 0), 0)
    const diffTotal = curTotal - prvTotal
    return (
      <div key={cat.golongan.join(',')} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className={`p-2.5 ${cat.color} border-b border-slate-200`}>
          <h2 className="font-bold text-sm">{cat.label}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="px-3 py-2 text-left font-semibold w-20">Kode</th>
                <th className="px-3 py-2 text-left font-semibold min-w-[200px]">Nama Akun</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                  {compMeta?.monthName}<br /><span className="text-[10px] font-normal text-slate-500">{year}</span>
                </th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                  {compMeta?.prevMonthName}<br /><span className="text-[10px] font-normal text-slate-500">{compMeta?.prevYear}</span>
                </th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Selisih</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">%</th>
              </tr>
            </thead>
            <tbody>{treeNodes}</tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-slate-800 border-t border-slate-300">
                <td className="px-3 py-1.5" colSpan={2}>Total {cat.label}</td>
                <td className="px-3 py-1.5 text-right">{formatCurrency(curTotal)}</td>
                <td className="px-3 py-1.5 text-right">{formatCurrency(prvTotal)}</td>
                <td className={`px-3 py-1.5 text-right font-medium ${diffTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(diffTotal)}</td>
                <td className="px-3 py-1.5 text-right font-medium text-slate-500">{prvTotal ? ((diffTotal / prvTotal) * 100).toFixed(1) : '-'}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  function renderAnnualCards() {
    return CATEGORIES.map(renderAnnualCard)
  }

  function renderComparisonCards() {
    return CATEGORIES.map(renderComparisonCard)
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Neraca Saldo</h1>
          {companyName && <p className="text-sm text-slate-500">{companyName}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm">
            {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {mode === 'comparison' && (
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm">
              {MONTHS.map((mn, i) => <option key={i} value={i + 1}>{mn}</option>)}
            </select>
          )}

          <button onClick={checkSnapshot} disabled={loading}
            className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-60">
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>

          <button onClick={() => setMode(mode === 'annual' ? 'comparison' : 'annual')}
            className={`px-3 py-1.5 rounded text-sm border ${mode === 'annual' ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
            {mode === 'annual' ? 'Banding Bulan' : '12 Bulan'}
          </button>

          <button onClick={async () => {
            if (!confirm('Hitung ulang saldo semua akun untuk semua tahun?')) return
            try {
              const res = await fetch('/api/reports/trial-balance/calculate-balance', { method: 'POST' })
              const json = await res.json()
              if (!res.ok) throw new Error(json.error || 'Gagal')
              alert(json.message || 'Selesai')
              load()
            } catch (e: any) { alert(e.message) }
          }}
            className="px-4 py-1.5 rounded bg-emerald-600 text-white text-sm">
            Hitung Saldo Semua
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-6">Memuat...</div>
      ) : allAccounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center text-slate-500">Tidak ada data</div>
      ) : mode === 'annual' ? (
        <div className="space-y-4">
          {renderAnnualCards()}
          <div className="space-y-2">
            {(() => {
              const posting = allAccounts.filter((a: any) => Number(a.is_header) === 0)
              const neracaGolongans = new Set(['aset_lancar_kas', 'aset_lancar_piutang', 'aset_lancar_persediaan', 'aset_lancar_lainnya', 'aset_tidak_lancar', 'kewajiban_lancar', 'kewajiban_tidak_lancar', 'ekuitas'])
              const neraca = posting.filter((a: any) => a.golongan && neracaGolongans.has(a.golongan))
              const labaRugi = posting.filter((a: any) => a.golongan && !neracaGolongans.has(a.golongan))
              const cols = (m: number) => (a: any) => a.monthly?.[m] || 0
              const fmtRow = (label: string, accounts: any[], bg: string) => (
                <div className={`${bg} rounded-lg shadow-sm border border-slate-300 p-2.5`}>
                  <table className="min-w-full text-xs">
                    <tfoot>
                      <tr className="font-bold text-slate-900">
                        <td className="px-3 py-1" colSpan={2}>{label}</td>
                        {Array.from({ length: 12 }, (_, m) => (
                          <td key={m} className="px-3 py-1 text-right">{formatCurrency(accounts.reduce((s, a) => s + cols(m)(a), 0))}</td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
              return (<>
                {fmtRow('TOTAL NERACA', neraca, 'bg-emerald-50')}
                {fmtRow('TOTAL LABA RUGI', labaRugi, 'bg-orange-50')}
              </>)
            })()}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {renderComparisonCards()}
          <div className="space-y-2">
            {(() => {
              const posting = allAccounts.filter((a: any) => Number(a.is_header) === 0)
              const neracaGolongans = new Set(['aset_lancar_kas', 'aset_lancar_piutang', 'aset_lancar_persediaan', 'aset_lancar_lainnya', 'aset_tidak_lancar', 'kewajiban_lancar', 'kewajiban_tidak_lancar', 'ekuitas'])
              const neraca = posting.filter((a: any) => a.golongan && neracaGolongans.has(a.golongan))
              const labaRugi = posting.filter((a: any) => a.golongan && !neracaGolongans.has(a.golongan))
              const fmtRow = (label: string, accounts: any[]) => {
                const cur = accounts.reduce((s, a) => s + (a.current || 0), 0)
                const prv = accounts.reduce((s, a) => s + (a.previous || 0), 0)
                const diff = cur - prv
                return (
                  <div className="bg-white rounded-lg shadow-sm border border-slate-300 p-2.5">
                    <table className="min-w-full text-xs">
                      <tfoot>
                        <tr className="font-bold text-slate-900">
                          <td className="px-3 py-1" colSpan={2}>{label}</td>
                          <td className="px-3 py-1 text-right">{formatCurrency(cur)}</td>
                          <td className="px-3 py-1 text-right">{formatCurrency(prv)}</td>
                          <td className={`px-3 py-1 text-right font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(diff)}</td>
                          <td className="px-3 py-1 text-right font-medium text-slate-500">{prv ? ((diff / prv) * 100).toFixed(1) : '-'}%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              }
              return (<>
                {fmtRow('TOTAL NERACA', neraca)}
                {fmtRow('TOTAL LABA RUGI', labaRugi)}
              </>)
            })()}
          </div>
        </div>
      )}

      <div className="text-[11px] text-slate-500 space-y-0.5">
        <p><span className="inline-block w-4 h-3 bg-blue-700 rounded-sm mr-1 align-middle"></span> Akun dengan saldo normal kredit (Kewajiban, Ekuitas, Pendapatan)</p>
        <p>Nilai positif = saldo normal.</p>
      </div>

      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-full mx-4">
            {popupLoading ? (
              <div className="text-center py-6">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-slate-600">Menghitung saldo...</p>
              </div>
            ) : (
              <>
                <h3 className="text-base font-bold text-slate-800 mb-2">Hitung Saldo</h3>
                <p className="text-sm text-slate-600 mb-5">
                  {popupMode === 'exists'
                    ? 'Data saldo untuk tahun ini sudah tersimpan. Hitung ulang?'
                    : 'Belum ada data saldo untuk tahun ini. Hitung sekarang?'}
                </p>
                <div className="flex justify-end gap-2">
                  {popupMode === 'exists' ? (
                    <>
                      <button onClick={() => { setShowPopup(false); loadFromSnapshot() }}
                        className="px-4 py-2 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200">
                        Gunakan Tersimpan
                      </button>
                      <button onClick={calculateAndLoad}
                        className="px-4 py-2 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">
                        Ya, Hitung Ulang
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setShowPopup(false)}
                        className="px-4 py-2 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200">
                        Batal
                      </button>
                      <button onClick={calculateAndLoad}
                        className="px-4 py-2 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">
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
