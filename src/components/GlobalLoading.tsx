"use client"
import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function GlobalLoading() {
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Show loading when route changes
    setLoading(true)
    
    // Hide loading after a short delay
    const timer = setTimeout(() => {
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [pathname, searchParams])

  if (!loading) return null

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        
        {/* Text */}
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-800">Loading...</p>
          <p className="text-sm text-slate-500 mt-1">Memuat halaman</p>
        </div>
      </div>
    </div>
  )
}
