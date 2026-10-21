import type { CSSProperties } from 'react'
import type { LandingSettings } from '@/lib/repositories/promoRepository'

export function landingBgStyle(s: LandingSettings, kind: 'main' | 'menu'): CSSProperties {
  if (kind === 'main') {
    if (s.mainBackgroundType === 'color' && s.mainBackgroundValue) return { backgroundColor: s.mainBackgroundValue }
    if (s.mainBackgroundType === 'image' && s.mainBackgroundValue) return { backgroundImage: `url(${s.mainBackgroundValue})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
    return { backgroundColor: '#FAF7F2' }
  }
  if (s.menuBackgroundType === 'color' && s.menuBackgroundValue) return { backgroundColor: s.menuBackgroundValue }
  if (s.menuBackgroundType === 'image' && s.menuBackgroundValue) return { backgroundImage: `url(${s.menuBackgroundValue})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
  return {}
}
