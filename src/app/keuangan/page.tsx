"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function KeuanganHomePage() {
  const [canViewPaymentRecapAr, setCanViewPaymentRecapAr] = useState(false)
  const [canViewPaymentDetailAr, setCanViewPaymentDetailAr] = useState(false)

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json().catch(() => ({}))
        const perms = Array.isArray(data?.user?.permissions) ? data.user.permissions : []
        
        // Check payment_recap_ar permissions
        const recapPerm = perms.find((x: any) => String(x.menu_code || '').toLowerCase().trim() === 'payment_recap_ar')
        setCanViewPaymentRecapAr(Number(recapPerm?.can_view) === 1)
        
        // Check payment_detail_ar permissions  
        const detailPerm = perms.find((x: any) => String(x.menu_code || '').toLowerCase().trim() === 'payment_detail_ar')
        setCanViewPaymentDetailAr(Number(detailPerm?.can_view) === 1)
      } catch {}
    }
    loadPermissions()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Keuangan</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Hutang Section */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Hutang</h2>
          <div className="space-y-2">
            <Link href="/keuangan/saldo-awal-hutang" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Saldo Awal Hutang</div>
              <div className="text-xs text-slate-500">Manajemen saldo awal hutang</div>
            </Link>
            <Link href="/keuangan/pembayaran-hutang" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Pembayaran Hutang</div>
              <div className="text-xs text-slate-500">Pembayaran hutang supplier</div>
            </Link>
            {canViewPaymentRecapAr && (
              <Link href="/reports/payment-recap-ar" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <div className="font-medium text-slate-800">Laporan Rekap Pembayaran Hutang</div>
                <div className="text-xs text-slate-500">Rekapitulasi pembayaran hutang</div>
              </Link>
            )}
            {canViewPaymentDetailAr && (
              <Link href="/reports/payment-detail-ar" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <div className="font-medium text-slate-800">Laporan Detail Pembayaran Hutang</div>
                <div className="text-xs text-slate-500">Detail pembayaran hutang per item</div>
              </Link>
            )}
          </div>
        </div>

        {/* Piutang Section */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Piutang</h2>
          <div className="space-y-2">
            <Link href="/keuangan/saldo-awal-piutang" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Saldo Awal Piutang</div>
              <div className="text-xs text-slate-500">Manajemen saldo awal piutang</div>
            </Link>
            <Link href="/keuangan/pembayaran-piutang" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Pembayaran Piutang</div>
              <div className="text-xs text-slate-500">Pembayaran piutang customer</div>
            </Link>
          </div>
        </div>

        {/* Kas & Bank Section */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Kas & Bank</h2>
          <div className="space-y-2">
            <Link href="/keuangan/mutasi-kas-bank" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Mutasi Kas/Bank</div>
              <div className="text-xs text-slate-500">Mutasi rekening kas dan bank</div>
            </Link>
            <Link href="/keuangan/uang-muka-customer" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Uang Muka Customer</div>
              <div className="text-xs text-slate-500">Manajemen uang muka customer</div>
            </Link>
            <Link href="/keuangan/uang-muka-supplier" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Uang Muka Supplier</div>
              <div className="text-xs text-slate-500">Manajemen uang muka supplier</div>
            </Link>
          </div>
        </div>

        {/* Jurnal Section */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Jurnal</h2>
          <div className="space-y-2">
            <Link href="/keuangan/jurnal-memorial" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Jurnal Memorial</div>
              <div className="text-xs text-slate-500">Jurnal memorial manual</div>
            </Link>
            <Link href="/reports/jurnal-harian" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Jurnal Harian</div>
              <div className="text-xs text-slate-500">Laporan jurnal harian</div>
            </Link>
          </div>
        </div>

        {/* Laporan Section */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Laporan</h2>
          <div className="space-y-2">
            <Link href="/reports/buku-besar" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Buku Besar</div>
              <div className="text-xs text-slate-500">Mutasi per akun perkiraan</div>
            </Link>
            <Link href="/reports/neraca" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Neraca</div>
              <div className="text-xs text-slate-500">Laporan posisi keuangan</div>
            </Link>
            <Link href="/reports/laba-rugi" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Laba Rugi</div>
              <div className="text-xs text-slate-500">Laporan laba rugi periode</div>
            </Link>
            <Link href="/reports/neraca-labarugi" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Neraca & Laba Rugi</div>
              <div className="text-xs text-slate-500">Laporan posisi keuangan dan laba rugi (S-Laporan)</div>
            </Link>
            <Link href="/reports/kartu-kas-bank" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Kartu Kas & Bank</div>
              <div className="text-xs text-slate-500">Mutasi kas/bank per akun (rekening koran)</div>
            </Link>
          </div>
        </div>

        {/* Master Section */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Master</h2>
          <div className="space-y-2">
            <Link href="/keuangan/perkiraan" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Master Perkiraan</div>
              <div className="text-xs text-slate-500">Daftar akun perkiraan</div>
            </Link>
            <Link href="/keuangan/setting-perkiraan" className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-800">Setting Perkiraan</div>
              <div className="text-xs text-slate-500">Pengaturan perkiraan</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
