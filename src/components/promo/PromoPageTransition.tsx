'use client'

import { usePathname } from 'next/navigation'

export default function PromoPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="animate-promo-enter">
      {children}
    </div>
  )
}
