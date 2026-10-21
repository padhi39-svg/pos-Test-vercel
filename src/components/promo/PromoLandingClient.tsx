'use client'

import { useState } from 'react'
import Link from 'next/link'

import type { BannerRow, PromoLanding, PromoItemLanding, MenuItemLanding, PaketLanding } from '@/lib/repositories/promoRepository'
import PromoCarousel from '@/components/promo/PromoCarousel'
import CategoryNav from '@/components/promo/CategoryNav'
import { MenuCard, RecommendedCard, PaketCard, DetailModal, type DetailData } from '@/components/promo/MenuCards'
import type { CSSProperties } from 'react'

export default function PromoLandingClient({
  banners,
  promos,
  menu,
  pakets,
  menuStyle,
  promoHeaderBg,
  menuHeaderBg,
  promoDiscountBg,
  menuPriceColor,
  cardBorderColor,
  dividerColor,
  promoCardTextColor,
  promoCardDescriptionColor,
  promoCardPriceColor,
  menuCardTextColor,
  promoCardBg,
  menuDescColor,
  menuCaptionColor,
  categoryActiveBg,
  categoryActiveText,
  categoryInactiveBg,
  categoryInactiveText,
  categoryInactiveBorder,
  categoryLabelBg,
  categoryLabelText,
  categoryLabelBorder,
}: {
  banners: BannerRow[]
  promos: PromoLanding[]
  menu: { kategori: string; items: MenuItemLanding[] }[]
  pakets: PaketLanding[]
  menuStyle: CSSProperties
  promoHeaderBg?: string | null
  menuHeaderBg?: string | null
  promoDiscountBg?: string | null
  menuPriceColor?: string | null
  cardBorderColor?: string | null
  dividerColor?: string | null
  promoCardTextColor?: string | null
  promoCardDescriptionColor?: string | null
  promoCardPriceColor?: string | null
  menuCardTextColor?: string | null
  promoCardBg?: string | null
  menuDescColor?: string | null
  menuCaptionColor?: string | null
  categoryActiveBg?: string | null
  categoryActiveText?: string | null
  categoryInactiveBg?: string | null
  categoryInactiveText?: string | null
  categoryInactiveBorder?: string | null
  categoryLabelBg?: string | null
  categoryLabelText?: string | null
  categoryLabelBorder?: string | null
}) {
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [menuSearch, setMenuSearch] = useState('')

  const openMenu = (it: MenuItemLanding) => {
    const textColor = menuCardTextColor || null
    const diskon = Number(it.diskon) || 0
    const hasDiskon = diskon > 0 && it.harga != null
    const hargaDiskon = hasDiskon ? Math.round((it.harga as number) * (1 - diskon / 100)) : null
    setDetail({
      name: it.name,
      photoUrl: it.photoUrl,
      kategori: it.kategori,
      harga: it.harga,
      promoHarga: hasDiskon ? hargaDiskon : null,
      deskripsi: it.deskripsi,
      badge: hasDiskon ? `-${diskon}%` : null,
      accentColor: menuPriceColor || null,
      textColor,
      descriptionColor: menuDescColor || textColor,
    })
  }

  const openPaket = (p: PaketLanding) => {
    const diskon = Number((p as any).diskon) || 0
    const hasDiskon = diskon > 0 && p.harga != null
    const hargaDiskon = hasDiskon ? Math.round((p.harga as number) * (1 - diskon / 100)) : null
    setDetail({
      name: p.name,
      photoUrl: p.photos[0] || p.photoUrl,
      kategori: p.kategori,
      harga: p.harga,
      promoHarga: hasDiskon ? hargaDiskon : null,
      deskripsi: p.deskripsi,
      badge: hasDiskon ? `-${diskon}%` : null,
      accentColor: menuPriceColor || null,
      textColor: menuCardTextColor || null,
      descriptionColor: menuDescColor || null,
    })
  }

  const normalizedSearch = menuSearch.trim().toLowerCase()
  const matchesSearch = (it: MenuItemLanding) => !normalizedSearch || `${it.name} ${it.deskripsi || ''}`.toLowerCase().includes(normalizedSearch)
  const matchesPaket = (p: PaketLanding) => !normalizedSearch || `${p.name} ${p.deskripsi || ''}`.toLowerCase().includes(normalizedSearch)
  const allMenuItems = menu.flatMap((g) => g.items)
  const recommendedItems = allMenuItems.filter((it) => it.isRecommended === 1 && matchesSearch(it))
  const baruItems = allMenuItems.filter((it) => it.isNew === 1 && matchesSearch(it))
  const paketFiltered = pakets.filter(matchesPaket)

  return (
    <>
      <CategoryNav />
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A8B7A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" /></svg>
        <input
          value={menuSearch}
          onChange={(e) => setMenuSearch(e.target.value)}
          placeholder="Cari menu favoritmu..."
          className="w-full rounded-full bg-white border border-[#E8E0C8] pl-10 pr-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#9A8B7A] outline-none focus:border-[#D4C9AA] focus:ring-2 focus:ring-[#F6F2EA] shadow-[inset_0_1px_2px_rgba(44,62,45,0.06)]"
        />
      </div>
      <PromoCarousel banners={banners} />
      {recommendedItems.length > 0 && (
        <section className="mb-4" id="recommendation-content">
          <div className="flex items-center justify-between mb-2">
            <span className="font-serif text-[16px] font-semibold text-[#1E3124]">Rekomendasi Untukmu</span>
            <Link href="/promo/rekomendasi" className="text-xs text-[#1E3124] hover:underline font-medium">Lihat Semua</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            {recommendedItems.slice(0, 8).map((it) => (
              <RecommendedCard key={it.id} it={it} onOpen={openMenu} menuStyle={menuStyle} cardBorderColor={cardBorderColor} menuCardTextColor={menuCardTextColor} menuPriceColor={menuPriceColor} menuDescColor={menuDescColor} menuCaptionColor={menuCaptionColor} />
            ))}
          </div>
        </section>
      )}

      {/* Paket - preview 4 banner cards */}
      <section id="paket-content" className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-serif text-[16px] font-semibold text-[#1E3124]">Paket Hemat</span>
          <Link href="/promo/kategori/paket" className="text-xs text-[#1E3124] hover:underline font-medium">Lihat Semua</Link>
        </div>
        {paketFiltered.length === 0 ? (
          <div className="rounded-2xl border border-[#EEE8D8] bg-white p-4 text-center text-[#9A8B7A] text-sm">Belum ada paket</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 promo-stagger">
            {paketFiltered.slice(0, 6).map((p) => (
              <PaketCard key={p.id} paket={p} menuStyle={menuStyle} cardBorderColor={cardBorderColor} menuCardTextColor={menuCardTextColor} menuPriceColor={menuPriceColor} menuDescColor={menuDescColor} menuCaptionColor={menuCaptionColor} onOpen={openPaket} />
            ))}
          </div>
        )}
      </section>

      {/* Baru - preview 4 menu */}
      <section id="baru-content" className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="font-serif text-[16px] font-semibold text-[#1E3124]">Baru</span>
          <Link href="/promo/kategori/baru" className="text-xs text-[#1E3124] hover:underline font-medium">Lihat Semua</Link>
        </div>
        {baruItems.length === 0 ? (
          <div className="rounded-2xl border border-[#EEE8D8] bg-white p-4 text-center text-[#9A8B7A] text-sm">Belum ada menu baru</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 promo-stagger">
            {baruItems.slice(0, 6).map((it) => (
              <MenuCard key={it.id} it={it} onOpen={openMenu} menuStyle={menuStyle} cardBorderColor={cardBorderColor} menuCardTextColor={menuCardTextColor} menuPriceColor={menuPriceColor} menuDescColor={menuDescColor} menuCaptionColor={menuCaptionColor} />
            ))}
          </div>
        )}
      </section>

      <DetailModal data={detail} onClose={() => setDetail(null)} cardBorderColor={cardBorderColor} />
    </>
  )
}
