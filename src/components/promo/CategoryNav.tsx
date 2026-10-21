'use client'

import Link from 'next/link'

const ITEMS: [string, string][] = [
  ['promo', 'Promo'],
  ['Makanan', 'Makanan'],
  ['Minuman', 'Minuman'],
  ['Paket', 'Paket'],
  ['Baru', 'Baru'],
]

export default function CategoryNav({ active = '' }: { active?: string }) {
  return (
    <nav className="flex w-full gap-4 overflow-x-auto pb-1 scrollbar-none px-1 justify-center" aria-label="Navigasi media promo" style={{ scrollbarWidth: 'none' }}>
      {ITEMS.map(([value, label]) => {
        const isActive = active.toLowerCase() === value.toLowerCase()
        return (
          <Link
            key={value}
            href={value === 'promo' ? '/promo' : `/promo/kategori/${value.toLowerCase()}`}
            className="shrink-0 flex flex-col items-center gap-1 min-w-[56px]"
          >
            <div
              className={[
                'w-14 h-14 rounded-full flex items-center justify-center border-2 overflow-hidden transition-all duration-150',
                'shadow-[0_4px_0_rgba(30,49,36,0.18)] hover:shadow-[0_6px_0_rgba(30,49,36,0.18)] hover:-translate-y-0.5 active:shadow-[0_1px_0_rgba(30,49,36,0.18)] active:translate-y-[2px]',
                isActive
                  ? 'bg-[#1E3124] border-[#1E3124] shadow-[0_4px_0_rgba(16,27,20,0.4)]'
                  : 'bg-gradient-to-b from-[#FAF7F2] to-[#F6F2EA] border-[#E8E0C8] hover:to-[#EDE6D6]',
              ].join(' ')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/icons/${label}.png`}
                alt={label}
                className={['w-[30px] h-[30px] object-contain shrink-0 transition-all duration-200', isActive ? 'brightness-0 invert' : ''].join(' ')}
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            </div>
            <span className={['text-[11px] whitespace-nowrap font-bold', isActive ? 'text-[#1E3124]' : 'text-[#1E3124]'].join(' ')}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
