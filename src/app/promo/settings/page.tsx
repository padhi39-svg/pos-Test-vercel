'use client'

import { useAuthGuard } from '@/components/promo/useAuthGuard'

const items = [
  { href: '/promo/settings/banner', title: 'Banner', desc: 'Slide header landing (auto-play)' },
  { href: '/promo/settings/promo', title: 'Promo', desc: 'Kampanye diskon & item barang jadi' },
  { href: '/promo/settings/menu', title: 'Menu', desc: 'Kurasi barang jadi yang tampil di landing' },
  { href: '/promo/settings/paket', title: 'Paket', desc: 'Paket banner dengan multi-foto carousel' },
  { href: '/promo/settings/tampilan', title: 'Tampilan', desc: 'Background utama & background tiap menu' },
]

export default function SettingsIndexPage() {
  const ready = useAuthGuard()
  if (!ready) return <div className="p-4 text-center text-slate-400">Memuat...</div>
  return (
    <div className="min-h-screen w-full bg-surface-base">
      <div className="max-w-3xl mx-auto px-3 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Setting Promo & Media</h1>
            <p className="text-xs text-slate-500">Kelola banner, promo, dan menu landing</p>
          </div>
          <a href="/promo" className="text-xs text-teal-primary hover:underline">← Lihat Landing</a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {items.map((it) => (
            <a key={it.href} href={it.href} className="container-card p-4 hover:border-teal-primary transition-colors block">
              <div className="font-medium text-slate-800">{it.title}</div>
              <div className="text-xs text-slate-500 mt-1">{it.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
