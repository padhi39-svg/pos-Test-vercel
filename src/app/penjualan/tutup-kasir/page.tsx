"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/regionalNumber'
import { showError, showSuccess } from '@/lib/notification'

type SummaryData = {
  total_penjualan: number
  total_tunai: number
  total_transfer: number
  total_kembalian: number
  jumlah_transaksi: number
  sudah_closing: boolean
}

type ClosingRow = {
  id: number
  tanggal: string
  user_id: number
  user_name?: string
  total_penjualan: number
  total_tunai: number
  total_transfer: number
  total_kembalian: number
  jumlah_transaksi: number
  tunai_di_kasir: number
  selisih?: number
  notes?: string
  created_at?: string
}

export default function TutupKasirPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<number>(0)
  const [userName, setUserName] = useState('')
  const [allowBackdate, setAllowBackdate] = useState(false)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [tanggal, setTanggal] = useState(today)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [lastClosing, setLastClosing] = useState<ClosingRow | null>(null)
  const [tunaiDiKasir, setTunaiDiKasir] = useState('')
  const [notes, setNotes] = useState('')
  const [history, setHistory] = useState<ClosingRow[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const meRes = await fetch('/api/auth/me')
        const me = meRes.ok ? await meRes.json() : null
        if (me?.user) {
          setUserId(Number(me.user.id))
          setUserName(String(me.user.name || ''))
          setAllowBackdate(me.user.backdate_permissions?.['cashier_closing'] ?? me.user.allow_backdate === true)
        }
      } catch { /* ignore */ }
    })()
  }, [])

  useEffect(() => {
    if (!userId) return
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const [sumRes, histRes] = await Promise.all([
          fetch(`/api/cashier-closing/summary?userId=${userId}&tanggal=${tanggal}`),
          fetch(`/api/cashier-closing?page=1&limit=10`),
        ])
        if (!alive) return
        if (sumRes.ok) {
          const s = await sumRes.json()
          setSummary(s)
          if (s.sudah_closing) {
            const closeRes = await fetch(`/api/cashier-closing?page=1&limit=1&user_id=${userId}&tanggal=${tanggal}`)
            if (closeRes.ok) {
              const rows = await closeRes.json()
              const list = Array.isArray(rows) ? rows : Array.isArray(rows?.rows) ? rows.rows : []
              setLastClosing(list[0] || null)
            }
          } else {
            setLastClosing(null)
          }
        }
        if (histRes.ok) {
          const h = await histRes.json()
          const rows = Array.isArray(h) ? h : Array.isArray(h?.rows) ? h.rows : []
          setHistory(rows)
        }
      } catch { /* ignore */ } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [userId, tanggal])

  const tunaiDiKasirNum = useMemo(() => {
    const v = parseFloat(tunaiDiKasir.replace(/[^0-9,]/g, '').replace(',', '.'))
    return isNaN(v) ? 0 : v
  }, [tunaiDiKasir])

  const tunaiSeharusnya = useMemo(() => {
    if (!summary) return 0
    return (summary.total_tunai || 0) - (summary.total_kembalian || 0)
  }, [summary])

  const selisih = useMemo(() => tunaiDiKasirNum - tunaiSeharusnya, [tunaiDiKasirNum, tunaiSeharusnya])

  const handleSimpan = async () => {
    if (!tunaiDiKasir.trim()) { showError('Uang Tunai Di Kasir wajib diisi'); return }
    try {
      setSaving(true)
      const res = await fetch('/api/cashier-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal, user_id: userId, tunai_di_kasir: tunaiDiKasirNum, notes }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showError(err?.error || 'Gagal menyimpan tutup kasir')
        return
      }
      showSuccess('Tutup kasir berhasil disimpan')
      setTunaiDiKasir('')
      setNotes('')
      // reload
      const [sumRes, histRes] = await Promise.all([
        fetch(`/api/cashier-closing/summary?userId=${userId}&tanggal=${tanggal}`),
        fetch(`/api/cashier-closing?page=1&limit=10`),
      ])
      if (sumRes.ok) {
        const s = await sumRes.json()
        setSummary(s)
        if (s.sudah_closing) {
          const closeRes = await fetch(`/api/cashier-closing?page=1&limit=1&user_id=${userId}&tanggal=${tanggal}`)
          if (closeRes.ok) {
            const rows = await closeRes.json()
            const list = Array.isArray(rows) ? rows : Array.isArray(rows?.rows) ? rows.rows : []
            setLastClosing(list[0] || null)
          }
        }
      }
      if (histRes.ok) {
        const h = await histRes.json()
        const rows = Array.isArray(h) ? h : Array.isArray(h?.rows) ? h.rows : []
        setHistory(rows)
      }
    } catch (e: any) {
      showError(e?.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const SelisihBadge = ({ value }: { value: number }) => (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
      value === 0 ? 'bg-teal-bg text-teal-dark' :
      value > 0 ? 'bg-gold-primary/10 text-gold-dark' :
      'bg-coral-bg text-coral-dark'
    }`}>
      {formatCurrency(value)}
    </span>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-800">Tutup Kasir</h1>

      {loading ? (
        <div className="text-center text-slate-500 text-xs py-6">Memuat...</div>
      ) : summary?.sudah_closing && lastClosing ? (
        <div className="bg-teal-bg border border-teal-bg rounded-card p-4">
          <div className="flex items-center gap-2 text-teal-dark font-semibold text-sm mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Tutup Kasir hari ini sudah dilakukan
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div><span className="text-slate-500">Total Penjualan</span><div className="font-semibold text-slate-800">{formatCurrency(lastClosing.total_penjualan)}</div></div>
            <div><span className="text-slate-500">Tunai Seharusnya</span><div className="font-semibold text-slate-800">{formatCurrency((lastClosing.total_tunai || 0) - (lastClosing.total_kembalian || 0))}</div></div>
            <div><span className="text-slate-500">Tunai Di Kasir</span><div className="font-semibold text-slate-800">{formatCurrency(lastClosing.tunai_di_kasir)}</div></div>
            <div><span className="text-slate-500">Selisih</span><div><SelisihBadge value={(lastClosing.tunai_di_kasir || 0) - ((lastClosing.total_tunai || 0) - (lastClosing.total_kembalian || 0))} /></div></div>
          </div>
          {lastClosing.notes && <div className="mt-2 text-xs text-slate-500">Catatan: {lastClosing.notes}</div>}
        </div>
      ) : !summary ? (
        <div className="text-center text-slate-500 text-xs py-6">Tidak ada data penjualan untuk tanggal ini</div>
      ) : (
        <>
          {/* User & Date Info */}
          <div className="bg-white rounded-card shadow-card border border-teal-bg p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">User ID</label>
                <input value={userId} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-teal-bg text-teal-dark/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama User</label>
                <input value={userName} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-teal-bg text-teal-dark/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal</label>
                <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={'w-full px-2 py-1.5 border border-teal-bg rounded text-xs' } />
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-card shadow-card border border-teal-bg p-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Total Penjualan</div>
              <div className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(summary.total_penjualan)}</div>
              <div className="text-[10px] text-slate-400">{summary.jumlah_transaksi} transaksi</div>
            </div>
            <div className="bg-white rounded-card shadow-card border border-teal-bg p-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Tunai Seharusnya</div>
              <div className="text-lg font-bold text-teal-dark mt-1">{formatCurrency(tunaiSeharusnya)}</div>
              <div className="text-[10px] text-slate-400">tunai - kembalian</div>
            </div>
            <div className="bg-white rounded-card shadow-card border border-teal-bg p-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Total Transfer</div>
              <div className="text-lg font-bold text-teal-dark mt-1">{formatCurrency(summary.total_transfer)}</div>
            </div>
            <div className="bg-white rounded-card shadow-card border border-teal-bg p-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Jumlah Transaksi</div>
              <div className="text-lg font-bold text-slate-800 mt-1">{summary.jumlah_transaksi}</div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-card shadow-card border border-teal-bg p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Uang Tunai Di Kasir *</label>
                <input
                  type="text"
                  value={tunaiDiKasir}
                  onChange={e => setTunaiDiKasir(e.target.value.replace(/[^0-9,]/g, ''))}
                  placeholder="0"
                  className="w-full px-2 py-1.5 border border-teal-bg rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-2 py-1.5 border border-teal-bg rounded text-xs" rows={3} placeholder="Catatan (opsional)" />
              </div>
            </div>

            {/* Calculation Preview */}
            <div className="mt-4 bg-teal-bg border border-teal-bg rounded p-3">
              <div className="text-xs font-semibold text-slate-700 mb-2">Perhitungan</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>Tunai Seharusnya</span><span className="font-medium">{formatCurrency(tunaiSeharusnya)}</span></div>
                <div className="flex justify-between"><span>Tunai Di Kasir</span><span className="font-medium">{tunaiDiKasirNum > 0 ? formatCurrency(tunaiDiKasirNum) : '-'}</span></div>
                <div className="flex justify-between items-center border-t pt-1 mt-1">
                  <span className="font-semibold">Selisih</span>
                  <SelisihBadge value={selisih} />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => router.push('/penjualan')} className="px-3 py-1.5 rounded-pill border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg text-xs">Batal</button>
              <button disabled={saving} onClick={handleSimpan} className="px-4 py-1.5 bg-teal-primary hover:bg-teal-dark text-white rounded-pill text-xs disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan Tutup Kasir'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* History Table */}
      <div className="bg-white rounded-card shadow-card border border-teal-bg">
        <div className="px-3 py-2 border-b">
          <h2 className="text-sm font-semibold text-slate-800">Riwayat Tutup Kasir</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-teal-primary text-white">
                <th className="px-2 py-1.5 text-left">Tanggal</th>
                <th className="px-2 py-1.5 text-left">User</th>
                <th className="px-2 py-1.5 text-right">Total Penjualan</th>
                <th className="px-2 py-1.5 text-right">Tunai</th>
                <th className="px-2 py-1.5 text-right">Transfer</th>
                <th className="px-2 py-1.5 text-right">Tunai Di Kasir</th>
                <th className="px-2 py-1.5 text-center">Selisih</th>
                <th className="px-2 py-1.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr><td colSpan={8} className="px-2 py-6 text-center text-slate-500">Belum ada riwayat</td></tr>
              )}
              {history.map((r, i) => {
                const s = (r.tunai_di_kasir || 0) - ((r.total_tunai || 0) - (r.total_kembalian || 0))
                return (
                  <tr key={r.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-teal-bg/30'} hover:bg-teal-bg cursor-pointer`} onClick={() => router.push(`/penjualan/tutup-kasir/${r.id}`)}>
                    <td className="px-2 py-1">{r.tanggal}</td>
                    <td className="px-2 py-1">{r.user_name || `#${r.user_id}`}</td>
                    <td className="px-2 py-1 text-right">{formatCurrency(r.total_penjualan)}</td>
                    <td className="px-2 py-1 text-right">{formatCurrency(r.total_tunai)}</td>
                    <td className="px-2 py-1 text-right">{formatCurrency(r.total_transfer)}</td>
                    <td className="px-2 py-1 text-right">{formatCurrency(r.tunai_di_kasir)}</td>
                    <td className="px-2 py-1 text-center"><SelisihBadge value={s} /></td>
                    <td className="px-2 py-1 text-center">
                      <Link href={`/penjualan/tutup-kasir/${r.id}`} className="text-teal-primary hover:text-teal-dark text-xs">
                        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Lihat
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
