import Link from 'next/link'
import { getBanners, getMenuItemsGrouped, getActivePromosWithItems, getLandingSettings, getPaketItems } from '@/lib/repositories/promoRepository'
import { landingBgStyle } from '@/lib/promoLandingStyle'
import MenuListClient from '@/components/promo/MenuListClient'
import PromoListClient from '@/components/promo/PromoListClient'
import PaketKategoriClient from '@/components/promo/PaketKategoriClient'
import PromoCarousel from '@/components/promo/PromoCarousel'
import CategoryNav from '@/components/promo/CategoryNav'

export const dynamic = 'force-dynamic'

const SLUG_LABELS: Record<string, string> = {
  makanan: 'Makanan',
  minuman: 'Minuman',
  paket: 'Paket',
  baru: 'Baru',
  promo: 'Promo',
}

export default async function KategoriPage({ params }: { params: { slug: string } }) {
  const slug = (params.slug || '').toLowerCase()
  const label = SLUG_LABELS[slug] || 'Menu'
  const [grouped, settings, promos, banners, pakets] = await Promise.all([
    getMenuItemsGrouped(),
    getLandingSettings(),
    getActivePromosWithItems(),
    getBanners(),
    slug === 'paket' ? getPaketItems() : Promise.resolve([] as any),
  ])
  const mainStyle = landingBgStyle(settings, 'main')
  const menuStyle = landingBgStyle(settings, 'menu')

  const allItems = grouped.flatMap((g) => g.items)
  let isPromo = false
  let isPaket = false
  let items = allItems
  if (slug === 'promo') isPromo = true
  else if (slug === 'paket') isPaket = true
  else if (slug === 'baru') items = allItems.filter((it) => it.isNew === 1)
  else items = (grouped.find((g) => g.kategori.toLowerCase() === slug)?.items) || []

  return (
    <div className="min-h-screen w-full" style={mainStyle}>
      <section className="relative h-[268px] sm:h-[320px] overflow-hidden bg-stone-900 rounded-b-[16px]">
        {settings.heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.heroImage} alt="Hero" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        <div className="relative z-10 h-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pb-6 flex flex-col justify-end text-white">
          <div className="text-[10px] tracking-[0.18em] uppercase text-white/70 font-medium mb-1">Kategori</div>
          <h1 className="font-serif text-[30px] sm:text-4xl font-semibold tracking-tight leading-none drop-shadow-sm">{label}</h1>
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 space-y-3">
        <CategoryNav active={slug} />
        {(slug !== 'makanan' && slug !== 'minuman' && slug !== 'paket') && (
          <Link href="/promo" className="inline-flex items-center gap-1 text-xs text-[#1E3124] hover:underline font-medium">← Kembali ke Media Promo</Link>
        )}
        <PromoCarousel banners={banners} />
        {isPromo ? (
          <PromoListClient
            promos={promos}
            promoCardBg={settings.promoCardBg}
            cardBorderColor={settings.cardBorderColor}
            promoDiscountBg={settings.promoDiscountBg}
            promoCardTextColor={settings.promoCardTextColor}
            promoCardDescriptionColor={settings.promoCardDescriptionColor}
            promoCardPriceColor={settings.promoCardPriceColor}
          />
        ) : isPaket ? (
          <PaketKategoriClient
            pakets={pakets}
            menuStyle={menuStyle}
            cardBorderColor={settings.cardBorderColor}
            menuCardTextColor={settings.menuCardTextColor}
            menuPriceColor={settings.menuPriceColor}
            menuDescColor={settings.menuDescColor}
            menuCaptionColor={settings.menuCaptionColor}
          />
        ) : (
          <MenuListClient
            items={items}
            layout="horizontal"
            menuStyle={menuStyle}
            cardBorderColor={settings.cardBorderColor}
            menuCardTextColor={settings.menuCardTextColor}
            menuPriceColor={settings.menuPriceColor}
            searchPlaceholder={`Cari di ${label}...`}
          />
        )}
        <footer className="text-center text-[11px] text-slate-400 py-4">Magnus • Media Promosi</footer>
      </div>
    </div>
  )
}
