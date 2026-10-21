"use client"
import PerkiraanTree from '@/components/keuangan/PerkiraanTree'

export default function MasterPerkiraanPage() {
  return (
    <div className="p-3 space-y-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Master Perkiraan</h1>
        <p className="text-slate-600 text-sm">Kelola Chart of Accounts (COA) dengan format kode 3-3-2 sesuai standar Indonesia.</p>
      </div>
      <PerkiraanTree />
    </div>
  )
}
