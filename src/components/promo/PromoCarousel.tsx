'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

type Banner = {
  id: number
  imageUrl: string
  title: string | null
  subtitle: string | null
  linkUrl: string | null
}

export default function PromoCarousel({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  const count = banners.length

  const go = useCallback((idx: number) => {
    if (count === 0) return
    setCurrent(((idx % count) + count) % count)
  }, [count])

  useEffect(() => {
    if (count <= 1 || paused) return
    const t = setInterval(() => setCurrent((c) => (c + 1) % count), 5000)
    return () => clearInterval(t)
  }, [count, paused])

  if (count === 0) {
    return (
      <div className="w-full aspect-video bg-teal-bg flex items-center justify-center text-teal-dark text-sm rounded-card">
        Belum ada banner promosi
      </div>
    )
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-slate-100"
      style={{ boxShadow: '0 1px 3px rgba(16,24,40,0.06)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${current * 100}%)`, transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}
      >
        {banners.map((b) => (
          <div key={b.id} className="w-full shrink-0 relative">
            <div className="aspect-video w-full bg-teal-bg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.imageUrl} alt={b.title || 'banner'} className="w-full h-full object-cover" />
            </div>
            {(b.title || b.subtitle) && (
              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 bg-gradient-to-t from-black/55 to-transparent pointer-events-none">
                {b.title && <div className="text-white font-semibold text-lg sm:text-2xl drop-shadow">{b.title}</div>}
                {b.subtitle && <div className="text-white/90 text-xs sm:text-sm mt-1 drop-shadow">{b.subtitle}</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* swipe (diletakkan di bawah tombol agar tidak menutupi klik) */}
      <div
        className="absolute inset-0 z-0"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          if (dx > 40) go(current - 1)
          else if (dx < -40) go(current + 1)
          touchX.current = null
        }}
      />

      {count > 1 && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 bg-black/30 backdrop-blur-md px-2.5 py-1.5 rounded-full flex items-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Ke slide ${i + 1}`}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'bg-white w-5' : 'bg-white/60 w-1.5'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
