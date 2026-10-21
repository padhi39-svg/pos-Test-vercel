import { ReactNode } from 'react'

type Comparison = { pct: number; label: string } | null

export default function CardStat({ title, value, icon, comparison }: { title: string; value: string; icon: ReactNode; comparison?: Comparison }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8F6F5] p-2.5 md:p-3 shadow-[0_4px_20px_rgba(43,168,162,0.1)]">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-slate-500 text-[10px] md:text-[11px] leading-tight truncate">{title}</div>
          <div className="text-sm md:text-base font-semibold text-[#3C3C3C] mt-0.5 leading-tight truncate">{value}</div>
          {comparison && (() => {
            const isUp = comparison.pct > 0
            const isDown = comparison.pct < 0
            const color = isUp ? '#10B981' : isDown ? '#EF4444' : '#94A3B8'
            const arrow = isUp ? '\u2191' : isDown ? '\u2193' : ''
            return (
              <div className="text-[10px] mt-0.5" style={{ color }}>
                {arrow} {Math.abs(comparison.pct)}% {comparison.label}
              </div>
            )
          })()}
        </div>
        <div className="h-6 w-6 md:h-7 md:w-7 rounded-lg grid place-items-center shrink-0"
          style={{ backgroundColor: '#E8F6F5', color: '#2BA8A2' }}>
          {icon}
        </div>
      </div>
    </div>
  )
}
