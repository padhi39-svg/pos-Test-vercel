'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const d = await res.json().catch(() => ({}))
        const allowed: string[] = Array.isArray(d?.user?.allowedPaths) ? d.user.allowedPaths : []
        const perms: any[] = Array.isArray(d?.user?.permissions) ? d.user.permissions : []

        const can = (code: string) => perms.some((p: any) => String(p.menu_code) === code && Number(p.can_view) === 1)
        const allowPath = (p: string) => allowed.includes('/') || allowed.includes(p) || allowed.some(a => p.startsWith(a + '/'))

        // Prioritas: Dashboard data jika diizinkan
        if (allowPath('/dashboard') || can('dashboard')) {
          if (mounted) router.replace('/dashboard')
          return
        }
        // Kedua: Welcome jika diizinkan
        if (allowPath('/welcome') || can('dashboard_welcome')) {
          if (mounted) router.replace('/welcome')
          return
        }
        // Fallback: path pertama yang diizinkan, jika ada
        if (allowed.length > 0) {
          if (mounted) router.replace(allowed[0])
          return
        }
        // Jika tidak ada sesi / izin, arahkan ke login
        if (mounted) router.replace('/login')
      } catch {
        if (mounted) router.replace('/login')
      }
    })()
    return () => { mounted = false }
  }, [router])

  return (
    <div className="p-6 text-center text-slate-600">Memuat...</div>
  )
}
