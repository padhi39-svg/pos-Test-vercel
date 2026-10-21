'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'
import type { PaketLanding } from '@/lib/repositories/promoRepository'
import { PaketCard, DetailModal, type DetailData } from '@/components/promo/MenuCards'
import type { CSSProperties } from 'react'

export default function PaketLandingClient({
  pakets,
  menuStyle,
  cardBorderColor,
  menuCardTextColor,
  menuPriceColor,
  menuDescColor,
  menuCaptionColor,
}: {
  pakets: PaketLanding[]
  menuStyle: CSSProperties
  cardBorderColor?: string | null
  menuCardTextColor?: string | null
  menuPriceColor?: string | null
  menuDescColor?: string | null
  menuCaptionColor?: string | null
}) {
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [search, setSearch] = useState('')
  const normalized = search.trim().toLowerCase()
  const filtered = pakets.filter((p) => !normalized || `${p.name} ${p.deskripsi || ''}`.toLowerCase().includes(normalized))

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

  return (
    <>
      <div className="relative mb-3">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A8B7A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" /></svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari paket..."
          className="w-full rounded-full bg-white border border-[#E8E0C8] pl-10 pr-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#9A8B7A] outline-none focus:border-[#D4C9AA] focus:ring-2 focus:ring-[#F6F2EA] shadow-[inset_0_1px_2px_rgba(44,62,45,0.06)]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#EEE8D8] bg-white p-6 text-center text-[#9A8B7A] text-sm">
          {pakets.length === 0 ? 'Belum ada paket yang ditampilkan' : 'Tidak ada paket sesuai pencarian'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 promo-stagger">
          {filtered.map((p) => (
            <PaketCard
              key={p.id}
              paket={p}
              menuStyle={menuStyle}
              cardBorderColor={cardBorderColor}
              menuCardTextColor={menuCardTextColor}
              menuPriceColor={menuPriceColor}
              menuDescColor={menuDescColor}
              menuCaptionColor={menuCaptionColor}
              onOpen={openPaket}
            />
          ))}
        </div>
      )}

      <DetailModal data={detail} onClose={() => setDetail(null)} cardBorderColor={cardBorderColor} />
    </>
  )
}
