import { NextResponse, NextRequest } from 'next/server'

function isAssetPath(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/icons') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js')
  )
}

function isPublicPath(pathname: string) {
  // Allow access to login page and its API
  if (pathname.startsWith('/login')) return true
  if (pathname.startsWith('/api/auth/')) return true
  // Landing promo/public (tanpa login). Setting tetap di-guard di client & API.
  if (pathname === '/promo' || pathname.startsWith('/promo/')) return true
  // Self-order (tanpa login)
  if (pathname === '/self-order' || pathname.startsWith('/self-order/')) return true
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl
  
  // Skip middleware for assets and public paths
  if (isAssetPath(pathname) || isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Redirect legacy path to the new Stok Opname list
  if (pathname === '/stock/opname/process') {
    return NextResponse.redirect(new URL('/stock/opname', req.url))
  }

  // For API calls (except auth), inject x-user-id header from cookies if present
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth/')) {
    const requestHeaders = new Headers(req.headers)
    
    // Try to get user ID from various cookie sources
    const cookies = req.cookies
    let userId = ''
    
    // Try numeric cookies first
    const numericCookies = ['x-user-id', 'user_id', 'userId', 'userid', 'uid']
    for (const cookieName of numericCookies) {
      const value = cookies.get(cookieName)?.value
      if (value && !isNaN(Number(value))) {
        userId = String(Number(value))
        break
      }
    }
    
    // Try JSON cookies if no numeric found
    if (!userId) {
      const jsonCookies = ['current_user', 'user', 'session_user']
      for (const cookieName of jsonCookies) {
        const value = cookies.get(cookieName)?.value
        if (value) {
          try {
            const obj = JSON.parse(decodeURIComponent(value))
            const id = Number(obj?.id ?? obj?.user_id)
            if (Number.isFinite(id) && id > 0) {
              userId = String(id)
              break
            }
          } catch {}
        }
      }
    }
    
    if (userId) {
      requestHeaders.set('x-user-id', userId)
    }
    
    return NextResponse.next({
      request: { headers: requestHeaders }
    })
  }

  // Check for session token for protected pages
  const sessionToken = req.cookies.get('session_token')?.value
  
  // If no session token, redirect to login
  if (!sessionToken) {
    const loginUrl = new URL('/login', origin)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Validate session token exists and is not expired
  // Note: We can't use SQLite directly in middleware (edge runtime)
  // So we just check if token exists and let API routes validate further
  // The session validation is done server-side in API routes
  
  // Inject x-user-id header from cookies for protected pages too
  const requestHeaders = new Headers(req.headers)
  const userIdCookie = req.cookies.get('x-user-id')?.value
  if (userIdCookie && !isNaN(Number(userIdCookie))) {
    requestHeaders.set('x-user-id', userIdCookie)
  }
  
  return NextResponse.next({
    request: { headers: requestHeaders }
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
