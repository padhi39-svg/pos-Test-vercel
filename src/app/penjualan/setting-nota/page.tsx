'use client'

import ReceiptSettings from '@/components/keuangan/ReceiptSettings'

export default function SettingNotaPage() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Setting Nota & Printer POS</h1>
        <p className="text-sm text-slate-500">Atur printer thermal, layout struk, caption order, dan dapur</p>
      </div>
      <ReceiptSettings />
    </div>
  )
}
