import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanion.app'

export async function signInWithCredentials(
  email: string,
  password: string,
): Promise<void> {
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
    setCookie.includes('__Secure-authjs.session-token')
      ? '__Secure-authjs.session-token'
      : 'authjs.session-token'
  const match = setCookie.match(new RegExp(`${sessionCookieName}=([^;]+)`))
  const sessionToken = match?.[1]

  if (!sessionToken) throw new Error('No session cookie in sign-in response')

  // Store directly — no need to go through /api/auth/mobile-token for credentials flow
  await SecureStore.setItemAsync('cc-session-token', sessionToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync('cc-session-token')
}
