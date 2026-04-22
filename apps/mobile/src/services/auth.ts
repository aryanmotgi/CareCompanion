import * as WebBrowser from 'expo-web-browser'
import * as SecureStore from 'expo-secure-store'
import { apiClient } from './api'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanion.app'

/**
 * Google Sign-In:
 * 1. Opens web sign-in in ASWebAuthenticationSession (App Store safe)
 * 2. User completes Google OAuth on the web server
 * 3. App calls /api/auth/mobile-token to get a one-time code
 * 4. Exchanges code → session JWT → stores in SecureStore
 */
export async function signInWithGoogle(): Promise<void> {
  // Dismiss any stuck browser session from a previous attempt
  WebBrowser.dismissAuthSession()
  const callbackUrl = encodeURIComponent('/mobile-callback')
  const result = await WebBrowser.openAuthSessionAsync(
    `${API_BASE}/login?callbackUrl=${callbackUrl}`,
    'carecompanion://auth/callback'
  )
  if (result.type !== 'success') throw new Error('Sign-in cancelled')

  // Extract code from carecompanion://auth/callback?code=<code>
  const url = new URL(result.url)
  const code = url.searchParams.get('code')
  if (!code) throw new Error('No code in callback URL')

  const { sessionToken } = await apiClient.auth.exchangeCode(code)
  await SecureStore.setItemAsync('cc-session-token', sessionToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

export async function signInWithCredentials(
  email: string,
  password: string,
  mode: 'signin' | 'register'
): Promise<void> {
  if (mode === 'register') {
    await apiClient.auth.register({ email, password, displayName: email })
  }

  const csrfRes = await fetch(`${API_BASE}/api/auth/csrf`)
  const { csrfToken } = await csrfRes.json() as { csrfToken: string }

  const res = await fetch(`${API_BASE}/api/auth/signin/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, redirect: false, csrfToken }),
    // NOTE: React Native fetch silently ignores `credentials: 'include'`.
    // Cookies are NOT automatically stored. We must manually extract the
    // session cookie from the Set-Cookie response header.
  })
  if (!res.ok) throw new Error('Sign-in failed')

  // Manually extract the session token from the Set-Cookie header
  // (React Native does not implement automatic cookie storage)
  const setCookie = res.headers.get('set-cookie') ?? ''
  const sessionCookieName =
    setCookie.includes('__Secure-next-auth.session-token')
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token'
  const match = setCookie.match(new RegExp(`${sessionCookieName}=([^;]+)`))
  const sessionToken = match?.[1]

  if (!sessionToken) throw new Error('No session cookie in sign-in response')

  // Store directly — no need to go through /api/auth/mobile-token for credentials flow
  await SecureStore.setItemAsync('cc-session-token', sessionToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

async function generateAndStoreToken(): Promise<void> {
  const genRes = await fetch(`${API_BASE}/api/auth/mobile-token`, {
    method: 'POST',
  })
  if (!genRes.ok) throw new Error('Failed to generate mobile token')
  const { code } = await genRes.json() as { code: string }

  const { sessionToken } = await apiClient.auth.exchangeCode(code)

  await SecureStore.setItemAsync('cc-session-token', sessionToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync('cc-session-token')
}
