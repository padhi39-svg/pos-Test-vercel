'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'
import { PromoCard, DetailModal, type DetailData } from '@/components/promo/MenuCards'
import type { PromoLanding, PromoItemLanding } from '@/lib/repositories/promoRepository'

export default function PromoListClient({
  promos, promoCardBg, cardBorderColor, promoDiscountBg, promoCardTextColor, promoCardDescriptionColor, promoCardPriceColor,
}: {
  promos: PromoLanding[]
  promoCardBg?: string | null
  cardBorderColor?: string | null
  promoDiscountBg?: string | null
  promoCardTextColor?: string | null
  promoCardDescriptionColor?: string | null
  promoCardPriceColor?: string | null
}) {
  const [detail, setDetail] = useState<DetailData | null>(null)
  const openPromo = (it: PromoItemLanding, p: PromoLanding) => {
    const badge = p.tipeDiskon === 'persen' ? `-${p.nilaiDiskon}%` : `-${formatCurrency(p.nilaiDiskon)}`
    setDetail({ name: it.name, photoUrl: it.photoUrl || p.bannerImage, kategori: it.kategori, harga: it.harga, promoHarga: it.promoHarga, deskripsi: p.deskripsi, badge, accentColor: promoDiscountBg || null })
  }
  return (
    <div className="space-y-3">
      {promos.length === 0 ? (
        <div className="rounded-card border border-white/10 bg-white/5 p-6 text-center text-white/50 text-sm">Belum ada promo</div>
      ) : promos.map((p) => (
        <div key={p.id} className="space-y-2">
          <div className="text-sm font-semibold text-white/90">{p.nama}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {p.items.map((it) => (
              <PromoCard
                key={it.id}
                p={p}
                it={it}
                onOpen={openPromo}
                promoCardBg={promoCardBg}
                cardBorderColor={cardBorderColor}
                promoDiscountBg={promoDiscountBg}
                promoCardTextColor={promoCardTextColor}
                promoCardDescriptionColor={promoCardDescriptionColor}
                promoCardPriceColor={promoCardPriceColor}
              />
            ))}
          </div>
        </div>
      ))}
      <DetailModal data={detail} onClose={() => setDetail(null)} cardBorderColor={cardBorderColor} />
    </div>
  )
}
