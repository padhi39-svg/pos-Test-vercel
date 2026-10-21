"use client"

type SummaryCardProps = {
  label: string
  value: string | number
  valueColor?: string
  size?: 'sm' | 'lg'
}

export default function SummaryCard({ label, value, valueColor = 'text-slate-800', size = 'lg' }: SummaryCardProps) {
  return (
    <div className="bg-white p-2 rounded-lg shadow border border-slate-200">
      <div className="text-[10px] text-slate-600 mb-1 font-bold">{label}</div>
      <div className={`${size === 'sm' ? 'text-sm' : 'text-lg'} font-bold ${valueColor}`}>{value}</div>
    </div>
  )
}
