"use client"

import { useRouter } from "next/navigation"

export default function SelfOrderRootPage() {
  const router = useRouter()
  return (
    <div className="space-y-4 m-4">
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold text-slate-700 mb-1">Kode Meja Diperlukan</h2>
        <p className="text-sm text-slate-500">Silakan scan QR code di meja Anda</p>
      </div>
    </div>
  )
}
