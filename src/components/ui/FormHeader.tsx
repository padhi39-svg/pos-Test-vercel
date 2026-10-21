"use client"
import { useRouter } from 'next/navigation'

export default function FormHeader({
  title,
  subtitle,
  backHref,
  basePath,
}: {
  title: string
  subtitle?: string
  backHref?: string
  basePath?: string
}) {
  const router = useRouter()
  const href = backHref ?? basePath ?? ''

  return (
    <div className="flex items-start gap-3">
      <button
        onClick={() => router.push(href)}
        className="mt-1 w-7 h-7 flex items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-teal-bg hover:border-teal-primary transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}
