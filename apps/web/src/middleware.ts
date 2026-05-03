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
  '/signup',         // Registration page — must be public or new users loop into login
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
  '/api/test',               // Test/reset endpoints (gated internally by env + isDemo check)
  '/api/cron',               // Cron jobs (protected by verifyCronRequest internally)
  '/api/notifications/generate', // Notification cron
  '/api/reminders/check',    // Reminder cron
  // Public: token-based access — auth is enforced at handler level for /weekly
  '/api/share/',             // Public share links with token (e.g. /api/share/abc123) — POST /api/share itself is protected
  '/api/demo/start',         // Demo session creation — no auth needed to start a demo
  '/api/feedback',           // Bug report submissions — works without auth
  // '/api/debug-auth' intentionally omitted — dev-only, requires NODE_ENV check internally
  '/shared',                 // Public share pages
  '/reset-password',          // Password reset pages
]

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Detect RSC prefetch requests — these must not be redirected or they produce a
  // MIME type console error (prefetch client expects RSC payload, not HTML redirect).
  // Next-Router-Prefetch: 1 is the documented signal for RSC prefetch requests.
  const isPrefetch = req.headers.get('Next-Router-Prefetch') === '1'

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

  if (!req.auth && !isPublic) {
    if (isPrefetch) {
      // RSC prefetch to a protected route: return empty 204 instead of redirecting.
      // A redirect returns HTML which the browser tries to execute as a script → MIME error.
      // 204 has no content, so there is nothing to parse — Next.js falls back gracefully.
      return new NextResponse(null, { status: 204 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect pre-feature users (no role) to /set-role — only on private pages.
  // Skip for demo users (isDemo=true) — they don't need a role.
  // Skip for public paths — no reason to gate them.
  const isDemo = (req.auth?.user as { isDemo?: boolean } | undefined)?.isDemo === true
  if (
    req.auth?.user &&
    !isDemo &&
    !(req.auth.user as { role?: string | null }).role &&
    !isPublic &&
    !pathname.startsWith('/set-role') &&
    !isPrefetch
  ) {
    const url = req.nextUrl.clone()
    url.pathname = '/set-role'
    return NextResponse.redirect(url)
  }

  if (req.auth && pathname === '/login') {
    // Don't redirect if there's an error param — let the login page show the error
    const errorParam = req.nextUrl.searchParams.get('error')
    if (!errorParam && !isPrefetch) {
      const url = req.nextUrl.clone()
      const cb = req.nextUrl.searchParams.get('callbackUrl')
      url.search = ''
      url.pathname = (cb && cb.startsWith('/') && !cb.startsWith('//')) ? cb : '/dashboard'
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
  // Also exclude bare .js/.css files so Vercel-injected scripts (e.g. Speed
  // Insights /{buildId}/script.js) are never redirected to /login, which
  // causes a MIME-type error in the browser when the redirect returns HTML.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$|.*\\.webp$|.*\\.js$|.*\\.css$).*)'],
}
