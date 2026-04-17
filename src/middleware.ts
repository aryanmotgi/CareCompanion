import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl

  const publicPaths = ['/login', '/chat/guest', '/api/chat/guest', '/demo-walkthrough', '/about', '/privacy', '/terms']
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (!req.auth && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (req.auth && pathname === '/login') {
    // Don't redirect if there's an error param — let the login page show the error
    const errorParam = req.nextUrl.searchParams.get('error')
    if (!errorParam) {
      const url = req.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  const response = NextResponse.next()

  if (!req.cookies.get('cc-csrf-token')) {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const token = Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
    response.cookies.set('cc-csrf-token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
  }

  return response
})

export const config = {
  matcher: ['/chat', '/profile', '/setup', '/login', '/settings', '/dashboard', '/care', '/medications', '/appointments', '/scans', '/connect', '/manual-setup', '/onboarding', '/consent', '/api/chat', '/api/chat/guest', '/api/consent', '/chat/guest'],
}
