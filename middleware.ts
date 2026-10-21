import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Paths that do not require authentication
const PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
])

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true
  // Allow Next.js internals and static assets
  if (pathname.startsWith('/_next')) return true
  if (pathname.startsWith('/favicon')) return true
  if (pathname.startsWith('/assets')) return true
  if (pathname.startsWith('/images')) return true
  if (pathname.startsWith('/public')) return true
  // Allow self-order without auth
  if (pathname === '/self-order' || pathname.startsWith('/self-order/')) return true
  return false
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get('session_token')?.value

  // If visiting /login and already authenticated, go to /dashboard
  // We'll validate token below before redirecting

  // If visiting public paths, allow
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Let API routes pass through (adjust later if API needs auth)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // If no token, redirect to /login
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    // Preserve original destination
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Validate token by calling internal auth/me endpoint
  // If invalid or expired, clear cookie and redirect to /login
  return fetch(new URL('/api/auth/me', req.url).toString(), {
    headers: { cookie: req.headers.get('cookie') || '' },
    cache: 'no-store',
  }).then(async (r) => {
    let isValid = false
    try {
      const d = await r.json()
      isValid = !!d?.user
    } catch {}
    if (!isValid) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      const res = NextResponse.redirect(url)
      res.cookies.set('session_token', '', { path: '/', maxAge: 0 })
      return res
    }

    // If heading to /login but token valid, redirect to /dashboard
    if (pathname === '/login') {
      const url = req.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
