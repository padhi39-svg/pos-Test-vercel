import { ArrowRightIcon } from '@heroicons/react/24/outline'

type Color = 'blue' | 'green' | 'indigo' | 'amber'
type Props = { label: string; color?: Color; badge?: number; onClick?: () => void }

export default function QuickAction({ label, color = 'blue', badge, onClick }: Props) {
  const colorMap: Record<Color, string> = {
    blue: 'bg-[#2BA8A2] hover:bg-[#1E8C86] focus-visible:ring-[#2BA8A2]/40 shadow-[0_4px_20px_rgba(43,168,162,0.3)]',
    green: 'bg-[#3C3C3C] hover:bg-[#2A2A2A] focus-visible:ring-[#3C3C3C]/40 shadow-[0_4px_16px_rgba(60,60,60,0.2)]',
    indigo: 'bg-[#5DADE2] hover:bg-[#4A9FD1] focus-visible:ring-[#5DADE2]/40 shadow-[0_4px_16px_rgba(93,173,226,0.3)]',
    amber: 'bg-[#EF6C4A] hover:bg-[#D45233] focus-visible:ring-[#EF6C4A]/40 shadow-[0_4px_20px_rgba(239,108,74,0.35)]',
  }
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center justify-between w-full h-12 md:h-14 px-4 md:px-5 rounded-xl text-sm md:text-base text-white font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ${colorMap[color]}`}
    >
      <span>{label}</span>
      <ArrowRightIcon className="w-4 h-4 md:w-5 md:h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
      {typeof badge === 'number' && (
        <span className="absolute -top-2 -right-2 min-w-6 h-6 px-2 rounded-full bg-white text-[#3C3C3C] text-[11px] grid place-items-center shadow">
          {badge}
        </span>
      )}
    </button>
  )
}
