/**
 * Uses the Edge-safe auth config (auth.config.ts) — no Node.js-only imports.
 * The full server auth config (auth.ts) is only used in route handlers.
 */
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

// Everything NOT in this list requires authentication.
// Add new public routes here — never forget to protect something new.
const PUBLIC_PATHS = [
  '/',               // Landing page (signOut returns here after Cognito logout)
  '/login',
  '/chat/guest',
  '/api/auth',       // Auth.js callback routes — prefix covers /api/auth/callback/cognito etc.
  '/api/chat/guest', // Guest chat API
  '/api/e2e',        // E2E production monitor auth (gated by E2E_AUTH_SECRET, not session)
  '/demo-walkthrough',
  '/about',
  '/privacy',
  '/terms',
  '/contact',
  '/conditions',  // Public SEO treatment guides
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/api/cron',               // Cron jobs (protected by verifyCronRequest internally)
  '/api/notifications/generate', // Notification cron
  '/api/reminders/check',    // Reminder cron
  '/api/share/',             // Public share links with token (e.g. /api/share/abc123) — POST /api/share itself is protected
  '/shared',                 // Public share pages
]

export default auth((req) => {
  const { pathname } = req.nextUrl

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

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
  // Catch everything except Next.js internals and static assets.
  // PUBLIC_PATHS list above handles allow/deny — not this matcher.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$|.*\\.webp$).*)'],
}
