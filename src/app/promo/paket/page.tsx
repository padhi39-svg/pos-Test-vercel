import { getPaketItems, getLandingSettings } from '@/lib/repositories/promoRepository'
import { landingBgStyle } from '@/lib/promoLandingStyle'
import PaketLandingClient from '@/components/promo/PaketLandingClient'

export const dynamic = 'force-dynamic'

export default async function PaketLandingPage() {
  const [pakets, settings] = await Promise.all([
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
          <img src={settings.heroImage} alt="Hero paket" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        <div className="relative z-10 h-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pb-6 flex flex-col justify-end text-white">
          <h1 className="font-serif text-[30px] sm:text-4xl font-semibold tracking-tight leading-none drop-shadow-sm">Paket Hemat</h1>
          <p className="mt-1.5 font-serif text-sm text-white/85 leading-snug italic drop-shadow-sm">Pilihan paket lengkap untuk kebersamaan</p>
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 space-y-3">
        <PaketLandingClient
          pakets={pakets}
          menuStyle={menuStyle}
          cardBorderColor={settings.cardBorderColor}
          menuCardTextColor={settings.menuCardTextColor}
          menuPriceColor={settings.menuPriceColor}
          menuDescColor={settings.menuDescColor}
          menuCaptionColor={settings.menuCaptionColor}
        />
        <footer className="text-center text-[11px] text-[#9A8B7A] py-6 pb-8">
          Magnus • Paket
        </footer>
      </div>
    </div>
  )
}
