"use client"

import type { SVGProps } from 'react'

export default function PrintIcon(props: SVGProps<SVGSVGElement>) {
  const { className = 'w-4 h-4', ...rest } = props
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...rest}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V4h12v5M6 18h12v-5H6v5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 14H5a2 2 0 01-2-2v-1a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2h-1" />
    </svg>
  )
}
