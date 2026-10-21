import { getBanners, getActivePromosWithItems, getMenuItemsGrouped, getLandingSettings, getPaketItems } from '@/lib/repositories/promoRepository'
import PromoLandingClient from '@/components/promo/PromoLandingClient'
import { landingBgStyle } from '@/lib/promoLandingStyle'

export const dynamic = 'force-dynamic'

export default async function PromoLandingPage() {
  const [banners, promos, menu, pakets, settings] = await Promise.all([
    getBanners(),
    getActivePromosWithItems(),
    getMenuItemsGrouped(),
    getPaketItems(),
    getLandingSettings(),
  ])

  const mainStyle = landingBgStyle(settings, 'main')
  const menuStyle = landingBgStyle(settings, 'menu')

  const pageStyle: React.CSSProperties = mainStyle.backgroundColor || mainStyle.backgroundImage ? mainStyle : { backgroundColor: '#FAF7F2' }

  return (
    <div className="min-h-screen w-full" style={pageStyle}>
      <section className="relative h-[268px] sm:h-[320px] overflow-hidden bg-stone-900 rounded-b-[16px]">
        {settings.heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.heroImage} alt="Hero restoran" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        <div className="relative z-10 h-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pb-6 flex flex-col justify-end text-white">
          <h1 className="font-serif text-[30px] sm:text-4xl font-semibold tracking-tight leading-none drop-shadow-sm">{settings.heroTitle != null ? settings.heroTitle : 'Klapa Manis'}</h1>
          <p className="mt-1.5 font-serif text-sm text-white/85 leading-snug italic drop-shadow-sm">{settings.heroSubtitle != null ? settings.heroSubtitle : 'Tradisi Rasa, Kehangatan Bersama'}</p>
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 space-y-3">
        <PromoLandingClient
          banners={banners}
          promos={promos}
          menu={menu}
          pakets={pakets}
          menuStyle={menuStyle}
          promoHeaderBg={settings.promoHeaderBg}
          menuHeaderBg={settings.menuHeaderBg}
          promoDiscountBg={settings.promoDiscountBg}
          menuPriceColor={settings.menuPriceColor}
          cardBorderColor={settings.cardBorderColor}
          dividerColor={settings.dividerColor}
          promoCardTextColor={settings.promoCardTextColor}
          promoCardDescriptionColor={settings.promoCardDescriptionColor}
          promoCardPriceColor={settings.promoCardPriceColor}
          menuCardTextColor={settings.menuCardTextColor}
          promoCardBg={settings.promoCardBg}
          menuDescColor={settings.menuDescColor}
          menuCaptionColor={settings.menuCaptionColor}
          categoryActiveBg={settings.categoryActiveBg}
          categoryActiveText={settings.categoryActiveText}
          categoryInactiveBg={settings.categoryInactiveBg}
          categoryInactiveText={settings.categoryInactiveText}
          categoryInactiveBorder={settings.categoryInactiveBorder}
          categoryLabelBg={settings.categoryLabelBg}
          categoryLabelText={settings.categoryLabelText}
          categoryLabelBorder={settings.categoryLabelBorder}
        />
        <footer className="text-center text-[11px] text-[#9A8B7A] py-6 pb-8">
          Magnus • Media Promosi
        </footer>
      </div>
    </div>
  )
}
