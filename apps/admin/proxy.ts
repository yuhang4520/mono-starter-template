import { NextRequest, NextResponse } from 'next/server'
import { isPublicAgreementPath } from '@/lib/public-routes'

export async function proxy(request: NextRequest) {
  if (isPublicAgreementPath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }
  const { auth } = await import('@/lib/auth')
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  // THIS IS NOT SECURE!
  // This is the recommended approach to optimistically redirect users
  // We recommend handling auth checks in each page/route
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Exclude API routes, static files, image optimizations, and login/signup pages
    '/((?!api|_next|_next/static|_next/image|favicon.ico|login|signup).*)',
  ],
}
