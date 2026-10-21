'use client'

import { useState, useRef } from 'react'
import { formatCurrency } from '@/lib/regionalNumber'
import type { MenuItemLanding, PromoItemLanding, PromoLanding, PaketLanding } from '@/lib/repositories/promoRepository'
import type { CSSProperties } from 'react'

function AddToCartControl({
  qty,
  onAdd,
  onInc,
  onDec,
  color,
}: {
  qty: number
  onAdd: () => void
  onInc: () => void
  onDec: () => void
  color?: string | null
}) {
  const primary = color || '#00AA13'
  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onAdd() }}
        className="px-3.5 py-1 rounded-full bg-white border text-xs font-bold shadow-sm hover:shadow active:scale-95 transition-all whitespace-nowrap"
        style={{ borderColor: primary, color: primary }}
      >
        + Tambah
      </button>
    )
  }
  return (
    <div
      className="flex items-center rounded-full bg-white border shadow-sm overflow-hidden"
      style={{ borderColor: primary }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Kurangi"
        onClick={onDec}
        className="w-7 h-7 flex items-center justify-center font-bold text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors"
        style={{ color: primary }}
      >
        −
      </button>
      <span className="px-1.5 text-xs font-bold text-slate-900 min-w-[20px] text-center">{qty}</span>
      <button
        type="button"
        aria-label="Tambah"
        onClick={onInc}
        className="w-7 h-7 flex items-center justify-center font-bold text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors"
        style={{ color: primary }}
      >
        +
      </button>
    </div>
  )
}

export type DetailData = {
  name: string
  photoUrl: string | null
  kategori: string | null
  harga: number | null
  promoHarga?: number | null
  deskripsi: string | null
  badge?: string | null
  accentColor?: string | null
  textColor?: string | null
  descriptionColor?: string | null
}

export function DetailModal({ data, onClose, cardBorderColor }: { data: DetailData | null; onClose: () => void; cardBorderColor?: string | null }) {
  if (!data) return null
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-promo-fade" onClick={onClose}>
      <div
        className="bg-white rounded-modal shadow-2xl w-[480px] max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden border-2 animate-promo-scale"
        style={{ borderColor: cardBorderColor || '#E8F6F5' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-56 sm:h-64 bg-teal-bg shrink-0">
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photoUrl} alt={data.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-teal-bg to-stone-100">
              <svg className="w-8 h-8 text-teal-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="text-xs text-slate-400">Tanpa foto</span>
            </div>
          )}
          {data.badge && (
            <span
              className="absolute top-3 left-3 px-2.5 py-1 rounded-pill text-white text-xs font-semibold shadow"
              style={{ backgroundColor: data.accentColor || '#f97316' }}
            >
              {data.badge}
            </span>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center justify-center hover:bg-black/60"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
        <div className="p-3 space-y-1.5 overflow-y-auto">
          <div>
            <div className="text-sm font-semibold leading-tight" style={{ color: data.textColor || '#1e293b' }}>{data.name}</div>
            {data.kategori && <div className="text-[11px] mt-0.5" style={{ color: data.descriptionColor || '#64748b' }}>{data.kategori}</div>}
          </div>
          {(data.harga != null || data.promoHarga != null) && (
            <div className="flex items-baseline gap-1.5">
              {data.promoHarga != null ? (
                <>
                  <span className="text-base font-semibold" style={{ color: data.accentColor || '#c2410c' }}>
                    {formatCurrency(data.promoHarga)}
                  </span>
                  {data.harga != null && <span className="text-xs text-slate-400 line-through">{formatCurrency(data.harga)}</span>}
                </>
              ) : (
                <span className="text-base font-semibold" style={{ color: data.accentColor || '#0F766E' }}>
                  {data.harga != null ? formatCurrency(data.harga) : '-'}
                </span>
              )}
            </div>
          )}
          <div className="text-xs leading-snug whitespace-pre-wrap" style={{ color: data.descriptionColor || '#475569' }}>
            {data.deskripsi ? data.deskripsi : <span className="text-slate-400 italic">Belum ada deskripsi</span>}
          </div>
        </div>
        <div className="p-2 border-t flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 rounded-pill border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg text-sm">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

export function MenuCard({
  it, onOpen, menuStyle, cardBorderColor, menuCardTextColor, menuPriceColor, menuDescColor, menuCaptionColor,
}: {
  it: MenuItemLanding
  onOpen: (it: MenuItemLanding) => void
  menuStyle: CSSProperties
  cardBorderColor?: string | null
  menuCardTextColor?: string | null
  menuPriceColor?: string | null
  menuDescColor?: string | null
  menuCaptionColor?: string | null
}) {
  const showImage = Boolean(it.photoUrl)
  const primary = menuPriceColor || '#1E3124'
  const diskon = Number(it.diskon) || 0
  const hasDiskon = diskon > 0 && it.harga != null
  const hargaDiskon = hasDiskon ? Math.round((it.harga as number) * (1 - diskon / 100)) : null
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(it)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(it) } }}
      className="group text-left rounded-2xl border flex flex-row items-stretch overflow-hidden cursor-pointer transition-all duration-150 hover:-translate-y-0.5 active:translate-y-[2px]"
      style={{
        borderColor: cardBorderColor || '#EEE8D8',
        boxShadow: '0 2px 10px rgba(44,62,45,0.08), 0 4px 0 rgba(44,62,45,0.14)',
        ...menuStyle,
        ...(menuStyle.backgroundColor ? {} : { backgroundColor: '#FFFFFF' }),
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 16px rgba(44,62,45,0.12), 0 6px 0 rgba(44,62,45,0.14)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(44,62,45,0.08), 0 4px 0 rgba(44,62,45,0.14)' }}
    >
      <div className="relative shrink-0 w-[40%] self-stretch bg-[#F6F2EA]">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={it.photoUrl as string} alt={it.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2">
            <svg className="w-6 h-6 text-[#C9BFA8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-[9px] text-[#9A8B7A] text-center">Tanpa foto</span>
          </div>
        )}
        {hasDiskon && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1E3124] text-white shadow-sm">-{diskon}%</span>
        )}
      </div>
      <div className="w-[60%] min-w-0 flex flex-col gap-1 p-3">
        <div className="text-[14px] font-bold leading-snug line-clamp-2 text-[#1E1B18]" style={{ color: menuCardTextColor || '#1E1B18' }}>{it.name}</div>
        {it.deskripsi ? (
          <div className="text-[12px] leading-snug break-words whitespace-normal" style={{ color: menuDescColor || (menuCardTextColor ? `${menuCardTextColor}99` : '#8B7F6A') }}>{it.deskripsi}</div>
        ) : (
          <div className="text-[12px] leading-snug" style={{ color: menuCaptionColor || '#9A8B7A' }}>Tanpa deskripsi</div>
        )}
        {it.kategori && <span className="text-[11px]" style={{ color: menuCaptionColor || '#9A8B7A' }}>{it.kategori}</span>}
        <div className="mt-auto flex items-baseline gap-1.5 flex-wrap">
          {hasDiskon && <span className="text-[11px] line-through" style={{ color: menuCaptionColor || '#9A8B7A' }}>{formatCurrency(it.harga as number)}</span>}
          <span className="text-[15px] font-extrabold" style={{ color: primary }}>{hasDiskon ? formatCurrency(hargaDiskon as number) : (it.harga != null ? formatCurrency(it.harga) : '-')}</span>
        </div>
      </div>
    </div>
  )
}

export function RecommendedCard({
  it, onOpen, menuStyle, cardBorderColor, menuCardTextColor, menuPriceColor, menuDescColor, menuCaptionColor, className,
}: {
  it: MenuItemLanding
  onOpen: (it: MenuItemLanding) => void
  menuStyle: CSSProperties
  cardBorderColor?: string | null
  menuCardTextColor?: string | null
  menuPriceColor?: string | null
  menuDescColor?: string | null
  menuCaptionColor?: string | null
  className?: string
}) {
  const priceColor = menuPriceColor || '#1E3124'
  const diskon = Number(it.diskon) || 0
  const hasDiskon = diskon > 0 && it.harga != null
  const hargaDiskon = hasDiskon ? Math.round((it.harga as number) * (1 - diskon / 100)) : null
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(it)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(it) } }}
      className={['group text-left rounded-2xl overflow-hidden border flex flex-col transition-all duration-150 cursor-pointer hover:-translate-y-0.5 active:translate-y-[2px]', className || 'shrink-0 w-[160px]'].join(' ')}
      style={{
        borderColor: cardBorderColor || '#EEE8D8',
        boxShadow: '0 2px 10px rgba(44,62,45,0.08), 0 4px 0 rgba(44,62,45,0.14)',
        ...menuStyle,
        ...(menuStyle.backgroundColor ? {} : { backgroundColor: '#FFFFFF' }),
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 16px rgba(44,62,45,0.12), 0 6px 0 rgba(44,62,45,0.14)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(44,62,45,0.08), 0 4px 0 rgba(44,62,45,0.14)' }}
    >
      <div className="relative h-[112px] overflow-hidden bg-[#F6F2EA]">
        {it.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={it.photoUrl} alt={it.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[#F6F2EA]">
            <svg className="w-7 h-7 text-[#C9BFA8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        )}
        {hasDiskon && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1E3124] text-white shadow-sm">
            -{diskon}%
          </span>
        )}
      </div>
      <div className="p-2.5 flex flex-col gap-1" style={{ backgroundColor: (menuStyle.backgroundColor as string) || '#FFFFFF' }}>
        <div className="text-[13px] font-bold leading-tight line-clamp-1" style={{ color: menuCardTextColor || '#1E3124' }}>{it.name}</div>
        {it.deskripsi && <div className="text-[11px] leading-snug break-words whitespace-normal" style={{ color: menuDescColor || '#8B7F6A' }}>{it.deskripsi}</div>}
        <div className="flex items-baseline gap-1.5 mt-0.5">
          {hasDiskon && <span className="text-[11px] line-through" style={{ color: menuCaptionColor || '#9A8B7A' }}>{formatCurrency(it.harga as number)}</span>}
          <span className="text-[13px] font-extrabold" style={{ color: priceColor }}>{hasDiskon ? formatCurrency(hargaDiskon as number) : (it.harga != null ? formatCurrency(it.harga) : '-')}</span>
        </div>
      </div>
    </div>
  )
}

export function PaketCard({
  paket, menuStyle, cardBorderColor, menuCardTextColor, menuPriceColor, menuDescColor, menuCaptionColor, onOpen,
}: {
  paket: PaketLanding
  menuStyle: CSSProperties
  cardBorderColor?: string | null
  menuCardTextColor?: string | null
  menuPriceColor?: string | null
  menuDescColor?: string | null
  menuCaptionColor?: string | null
  onOpen?: (p: PaketLanding) => void
}) {
  const [idx, setIdx] = useState(0)
  const touchX = useRef<number | null>(null)
  const photos = paket.photos?.length ? paket.photos : paket.photoUrl ? [paket.photoUrl] : []
  const hasMultiple = photos.length > 1
  const diskon = Number((paket as any).diskon) || 0
  const hasDiskon = diskon > 0 && paket.harga != null
  const hargaDiskon = hasDiskon ? Math.round((paket.harga as number) * (1 - diskon / 100)) : null
  const go = (dir: number) => {
    setIdx((v) => {
      const n = photos.length
      return (v + dir + n) % n
    })
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(paket)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(paket) } }}
      className="group text-left rounded-2xl overflow-hidden border flex flex-col transition-all duration-150 w-full cursor-pointer hover:-translate-y-0.5 active:translate-y-[2px]"
      style={{
        borderColor: cardBorderColor || '#EEE8D8',
        boxShadow: '0 2px 10px rgba(44,62,45,0.08), 0 4px 0 rgba(44,62,45,0.14)',
        ...menuStyle,
        ...(menuStyle.backgroundColor ? {} : { backgroundColor: '#FFFFFF' }),
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 16px rgba(44,62,45,0.12), 0 6px 0 rgba(44,62,45,0.14)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(44,62,45,0.08), 0 4px 0 rgba(44,62,45,0.14)' }}
    >
      <div className="relative h-[190px] sm:h-[220px] overflow-hidden bg-[#F6F2EA]">
        {photos.length > 0 ? (
          <div className="w-full h-full overflow-hidden">
            <div
              className="flex h-full paket-slide-track"
              style={{ transform: `translateX(-${idx * 100}%)` }}
              onTouchStart={(e) => { touchX.current = (e as any).touches[0].clientX }}
              onTouchEnd={(e) => {
                if (touchX.current === null) return
                const dx = (e as any).changedTouches[0].clientX - touchX.current
                if (dx > 40) go(-1)
                else if (dx < -40) go(1)
                touchX.current = null
              }}
            >
              {photos.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt={`${paket.name} ${i + 1}`} className="w-full h-full object-cover shrink-0" draggable={false} />
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[#F6F2EA]">
            <svg className="w-8 h-8 text-[#C9BFA8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-xs text-[#9A8B7A]">Tanpa foto</span>
          </div>
        )}
        {hasDiskon && !hasMultiple && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1E3124] text-white shadow-sm">-{diskon}%</span>
        )}
        {hasDiskon && hasMultiple && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1E3124] text-white shadow-sm z-10">-{diskon}%</span>
        )}
        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label="Prev"
              onClick={(e) => { e.stopPropagation(); go(-1) }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-all active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={(e) => { e.stopPropagation(); go(1) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-all active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/30 backdrop-blur-md rounded-full px-2 py-1">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Ke foto ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); setIdx(i) }}
                  className={['block rounded-full transition-all duration-300', i === idx ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/60 hover:bg-white/80'].join(' ')}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1.5" style={{ backgroundColor: (menuStyle.backgroundColor as string) || '#FFFFFF' }}>
        <div className="text-[15px] font-bold leading-tight break-words" style={{ color: menuCardTextColor || '#1E1B18' }}>{paket.name}</div>
        {paket.deskripsi ? (
          <div className="text-[12px] leading-snug break-words whitespace-normal" style={{ color: menuDescColor || (menuCardTextColor ? `${menuCardTextColor}99` : '#8B7F6A') }}>{paket.deskripsi}</div>
        ) : (
          <div className="text-[12px] leading-snug" style={{ color: menuCaptionColor || '#9A8B7A' }}>Tanpa deskripsi</div>
        )}
        <div className="mt-1 flex items-baseline gap-1.5">
          {hasDiskon && <span className="text-[12px] line-through" style={{ color: menuCaptionColor || '#9A8B7A' }}>{formatCurrency(paket.harga as number)}</span>}
          <span className="text-[15px] font-extrabold" style={{ color: menuPriceColor || '#1E3124' }}>{hasDiskon ? formatCurrency(hargaDiskon as number) : (paket.harga != null ? formatCurrency(paket.harga) : '-')}</span>
        </div>
      </div>
    </div>
  )
}

export function PromoCard({
  p, it, onOpen, promoCardBg, cardBorderColor, promoDiscountBg, promoCardTextColor, promoCardDescriptionColor, promoCardPriceColor,
}: {
  p: PromoLanding
  it: PromoItemLanding
  onOpen: (it: PromoItemLanding, p: PromoLanding) => void
  promoCardBg?: string | null
  cardBorderColor?: string | null
  promoDiscountBg?: string | null
  promoCardTextColor?: string | null
  promoCardDescriptionColor?: string | null
  promoCardPriceColor?: string | null
}) {
  return (
    <button
      onClick={() => onOpen(it, p)}
      className="group text-left w-full rounded-2xl overflow-hidden border flex flex-col hover:shadow-md transition-all bg-[#F8F9FA]"
      style={{ borderColor: cardBorderColor || '#F1F5F9', backgroundColor: promoCardBg || '#F8F9FA', boxShadow: '0 1px 3px rgba(16,24,40,0.06)' }}
    >
      <div className="relative h-[148px] sm:h-[180px] overflow-hidden bg-slate-100">
        {(it.photoUrl || p.bannerImage) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(it.photoUrl || p.bannerImage) as string} alt={it.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-50">
            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-xs text-slate-400">Tanpa foto</span>
          </div>
        )}
        <span
          className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold text-white shadow-sm"
          style={{ backgroundColor: promoDiscountBg || '#EA580C' }}
        >
          {p.tipeDiskon === 'persen' ? `-${p.nilaiDiskon}%` : `-${formatCurrency(p.nilaiDiskon)}`}
        </span>
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-1 bg-[#F8F9FA]">
        <div className="text-[14px] font-bold leading-tight line-clamp-2 text-slate-900" style={{ color: promoCardTextColor || '#0f172a' }}>{it.name}</div>
        {p.deskripsi && <div className="text-xs leading-relaxed line-clamp-1 text-slate-500" style={{ color: promoCardDescriptionColor || '#64748b' }}>{p.deskripsi}</div>}
        <div className="mt-1 flex items-end gap-1.5">
          <span className="text-[15px] font-extrabold" style={{ color: promoCardPriceColor || '#059669' }}>
            {it.promoHarga != null ? formatCurrency(it.promoHarga) : '-'}
          </span>
          {it.harga != null && <span className="text-xs text-slate-400 line-through">{formatCurrency(it.harga)}</span>}
        </div>
      </div>
    </button>
  )
}
