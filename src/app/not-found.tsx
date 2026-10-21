'use client'

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#FAFAFA]">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-md w-full mx-4 text-center">
        <h2 className="text-lg font-semibold text-[#3C3C3C] mb-2">Halaman Tidak Ditemukan</h2>
        <p className="text-slate-500 text-sm mb-6">Halaman yang Anda cari tidak tersedia.</p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-2 bg-[#FFA16C] text-white rounded-lg hover:bg-[#FF8F55] transition-colors text-sm font-medium"
        >
          Ke Dashboard
        </Link>
      </div>
    </div>
  )
}
