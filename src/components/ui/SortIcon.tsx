import React from 'react'

export type SortOrder = 'asc' | 'desc'

export default function SortIcon({ active, order, className }: { active: boolean; order?: SortOrder; className?: string }) {
  const common = `inline-block align-middle ${className || 'w-3 h-3'}`
  if (!active || !order) {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 15l5 5 5-5" />
        <path d="M7 9l5-5 5 5" />
      </svg>
    )
  }
  if (order === 'asc') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 15l5 5 5-5" />
      </svg>
    )
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 9l5-5 5 5" />
    </svg>
  )
}
