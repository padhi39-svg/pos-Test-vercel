import PromoPageTransition from '@/components/promo/PromoPageTransition'

export default function PromoLayout({ children }: { children: React.ReactNode }) {
  return <PromoPageTransition>{children}</PromoPageTransition>
}
