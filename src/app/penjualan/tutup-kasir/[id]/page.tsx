"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/regionalNumber'
import { showError } from '@/lib/notification'

type Transaction = {
  id: number
  transaction_number?: string
  total: number
  payment_method?: string
  created_at?: string
}

type ClosingDetail = {
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
  notes?: string
  created_at?: string
  transactions?: Transaction[]
}

export default function TutupKasirDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params?.id || 0)
  const [data, setData] = useState<ClosingDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/cashier-closing/${id}`)
        if (!res.ok) {
          showError('Data tidak ditemukan')
          return
        }
        const d = await res.json()
        if (alive) setData(d)
      } catch {
        showError('Gagal memuat data')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id])

  if (loading) return <div className="text-center text-slate-500 text-xs py-6">Memuat...</div>
  if (!data) return <div className="text-center text-coral-primary text-xs py-6">Data tidak ditemukan</div>

  const tunaiSeharusnya = (data.total_tunai || 0) - (data.total_kembalian || 0)
  const selisih = (data.tunai_di_kasir || 0) - tunaiSeharusnya

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
      {/* Header Card */}
      <div className="bg-teal-primary text-white rounded-card p-3 md:p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-90">Tutup Kasir #{data.id}</div>
            <div className="text-lg md:text-xl font-bold">{data.tanggal}</div>
            <div className="text-xs opacity-90">User: {data.user_name || `#${data.user_id}`}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded text-[11px] font-semibold bg-teal-bg text-teal-dark">Closed</span>
            <button onClick={() => router.push('/penjualan/tutup-kasir')} className="px-3 py-1.5 rounded-pill bg-white/20 hover:bg-white/30 text-white text-xs">Kembali</button>
          </div>
        </div>
        {data.notes && <div className="text-xs mt-2 opacity-80">Catatan: {data.notes}</div>}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-card shadow-card border border-teal-bg p-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Total Penjualan</div>
          <div className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(data.total_penjualan)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card border border-teal-bg p-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Tunai Seharusnya</div>
          <div className="text-lg font-bold text-teal-dark mt-1">{formatCurrency(tunaiSeharusnya)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card border border-teal-bg p-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Transfer</div>
          <div className="text-lg font-bold text-teal-dark mt-1">{formatCurrency(data.total_transfer)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card border border-teal-bg p-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Kembalian</div>
          <div className="text-lg font-bold text-coral-primary mt-1">{formatCurrency(data.total_kembalian)}</div>
        </div>
      </div>

      {/* Actual / Input */}
      <div className="bg-white rounded-card shadow-card border border-teal-bg p-3">
        <h2 className="text-xs font-semibold text-slate-700 mb-2">Kas Fisik</h2>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-xs text-slate-500">Tunai Di Kasir</span>
            <div className="font-bold text-slate-800">{formatCurrency(data.tunai_di_kasir)}</div>
          </div>
          <div>
            <span className="text-xs text-slate-500">Selisih</span>
            <div className="mt-0.5"><SelisihBadge value={selisih} /></div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-card shadow-card border border-teal-bg">
        <div className="px-3 py-2 border-b">
          <h2 className="text-xs font-semibold text-slate-700">Transaksi ({data.jumlah_transaksi || 0})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-teal-primary text-white">
                <th className="px-2 py-1.5 text-center w-10">No</th>
                <th className="px-2 py-1.5 text-left">Transaksi</th>
                <th className="px-2 py-1.5 text-right">Total</th>
                <th className="px-2 py-1.5 text-left">Pembayaran</th>
                <th className="px-2 py-1.5 text-left">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {(!data.transactions || data.transactions.length === 0) && (
                <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-500">Tidak ada transaksi</td></tr>
              )}
              {data.transactions?.map((tx, i) => (
                <tr key={tx.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-teal-bg/30'} hover:bg-teal-bg`}>
                  <td className="px-2 py-1 text-center">{i + 1}</td>
                  <td className="px-2 py-1 font-medium">{tx.transaction_number || `#${tx.id}`}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(tx.total)}</td>
                  <td className="px-2 py-1">{tx.payment_method || '-'}</td>
                  <td className="px-2 py-1">{tx.created_at ? new Date(tx.created_at).toLocaleDateString('id-ID') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
