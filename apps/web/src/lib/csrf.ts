import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const CSRF_COOKIE = 'cc-csrf-token'
const CSRF_HEADER = 'x-csrf-token'

function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

export async function ensureCsrfToken(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(CSRF_COOKIE)
  if (existing) return existing.value

  const token = generateToken()
  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: false, // Client needs to read it
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  })
  return token
}

export async function validateCsrf(req: Request): Promise<{ valid: boolean; error?: NextResponse }> {
  const cookieStore = await cookies()
  let cookieToken = cookieStore.get(CSRF_COOKIE)?.value
  const headerToken = req.headers.get(CSRF_HEADER)

  // Fallback: parse CSRF token from raw Cookie header (mobile apps send cookies manually)
  if (!cookieToken) {
    const rawCookie = req.headers.get('cookie') || ''
    const match = rawCookie.match(new RegExp(`${CSRF_COOKIE}=([^;]+)`))
    if (match) cookieToken = match[1]
  }

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return {
      valid: false,
      error: NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }),
    }
  }
  return { valid: true }
}
