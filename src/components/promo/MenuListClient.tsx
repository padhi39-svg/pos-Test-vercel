'use client'

import { useState } from 'react'
import { MenuCard, RecommendedCard, DetailModal, type DetailData } from '@/components/promo/MenuCards'
import type { MenuItemLanding } from '@/lib/repositories/promoRepository'
import type { CSSProperties } from 'react'

export default function MenuListClient({
  items, layout = 'horizontal', menuStyle, cardBorderColor, menuCardTextColor, menuPriceColor, searchPlaceholder = 'Cari menu...',
}: {
  items: MenuItemLanding[]
  layout?: 'horizontal' | 'vertical'
  menuStyle: CSSProperties
  cardBorderColor?: string | null
  menuCardTextColor?: string | null
  menuPriceColor?: string | null
  searchPlaceholder?: string
}) {
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<DetailData | null>(null)
  const norm = search.trim().toLowerCase()
  const filtered = items.filter((it) => !norm || `${it.name} ${it.deskripsi || ''}`.toLowerCase().includes(norm))
  const openMenu = (it: MenuItemLanding) => {
    const textColor = menuCardTextColor || null
    const diskon = Number(it.diskon) || 0
    const hasDiskon = diskon > 0 && it.harga != null
    const hargaDiskon = hasDiskon ? Math.round((it.harga as number) * (1 - diskon / 100)) : null
    setDetail({ name: it.name, photoUrl: it.photoUrl, kategori: it.kategori, harga: it.harga, promoHarga: hasDiskon ? hargaDiskon : null, deskripsi: it.deskripsi, badge: hasDiskon ? `-${diskon}%` : null, accentColor: menuPriceColor || null, textColor, descriptionColor: textColor })
  }
  return (
    <div className="space-y-3 animate-promo-enter">
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A8B7A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" /></svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-full bg-white border border-[#E8E0C8] pl-10 pr-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#9A8B7A] outline-none focus:border-[#D4C9AA] focus:ring-2 focus:ring-[#F6F2EA] shadow-[inset_0_1px_2px_rgba(44,62,45,0.06)]"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#EEE8D8] bg-white p-6 text-center text-[#9A8B7A] text-sm">Belum ada menu</div>
      ) : layout === 'vertical' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 promo-stagger">
          {filtered.map((it) => (
            <RecommendedCard key={it.id} it={it} onOpen={openMenu} menuStyle={menuStyle} cardBorderColor={cardBorderColor} menuCardTextColor={menuCardTextColor} menuPriceColor={menuPriceColor} className="w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 promo-stagger">
          {filtered.map((it) => (
            <MenuCard key={it.id} it={it} onOpen={openMenu} menuStyle={menuStyle} cardBorderColor={cardBorderColor} menuCardTextColor={menuCardTextColor} menuPriceColor={menuPriceColor} />
          ))}
        </div>
      )}
      <DetailModal data={detail} onClose={() => setDetail(null)} cardBorderColor={cardBorderColor} />
    </div>
  )
}
