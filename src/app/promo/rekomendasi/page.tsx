import { getMenuItemsGrouped, getLandingSettings } from '@/lib/repositories/promoRepository'
import { landingBgStyle } from '@/lib/promoLandingStyle'
import MenuListClient from '@/components/promo/MenuListClient'
import CategoryNav from '@/components/promo/CategoryNav'

export const dynamic = 'force-dynamic'

export default async function RekomendasiPage() {
  const [grouped, settings] = await Promise.all([
    getMenuItemsGrouped(),
    getLandingSettings(),
  ])
  const mainStyle = landingBgStyle(settings, 'main')
  const menuStyle = landingBgStyle(settings, 'menu')
  const items = grouped.flatMap((g) => g.items).filter((it) => it.isRecommended === 1)

  return (
    <div className="min-h-screen w-full" style={mainStyle}>
      <section className="relative h-[268px] sm:h-[320px] overflow-hidden bg-stone-900 rounded-b-[16px]">
        {settings.heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.heroImage} alt="Hero" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        <div className="relative z-10 h-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pb-6 flex flex-col justify-end text-white">
          <div className="text-[10px] tracking-[0.18em] uppercase text-white/70 font-medium mb-1">Menu</div>
          <h1 className="font-serif text-[30px] sm:text-4xl font-semibold tracking-tight leading-none drop-shadow-sm">Rekomendasi Untukmu</h1>
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 space-y-2">
        <CategoryNav />
        <MenuListClient
          items={items}
          layout="vertical"
          menuStyle={menuStyle}
          cardBorderColor={settings.cardBorderColor}
          menuCardTextColor={settings.menuCardTextColor}
          menuPriceColor={settings.menuPriceColor}
          searchPlaceholder="Cari rekomendasi..."
        />
        <footer className="text-center text-[11px] text-slate-400 py-4">Magnus • Media Promosi</footer>
      </div>
    </div>
  )
}
