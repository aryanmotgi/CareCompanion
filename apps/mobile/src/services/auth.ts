import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanion.app'

export async function signInWithCredentials(
  email: string,
  password: string,
): Promise<void> {
  // Step 1: Get CSRF token AND its cookie (React Native doesn't store cookies automatically)
  const csrfRes = await fetch(`${API_BASE}/api/auth/csrf`)
  const { csrfToken } = await csrfRes.json() as { csrfToken: string }
  const csrfCookies = csrfRes.headers.get('set-cookie') ?? ''

  // Step 2: Sign in with credentials, forwarding the CSRF cookie
  const res = await fetch(`${API_BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': csrfCookies,
    },
    body: new URLSearchParams({
      email,
      password,
      csrfToken,
      redirect: 'false',
      json: 'true',
    }).toString(),
    redirect: 'manual',
  })

  // NextAuth returns a 302 redirect on successful login with Set-Cookie headers
  // On failure it redirects to /login?error=...
  const setCookie = res.headers.get('set-cookie') ?? ''

  // Look for the session token in the response cookies
  const sessionCookieName =
    setCookie.includes('__Secure-authjs.session-token')
      ? '__Secure-authjs.session-token'
      : 'authjs.session-token'
  const match = setCookie.match(new RegExp(`${sessionCookieName}=([^;]+)`))
  const sessionToken = match?.[1]

  if (!sessionToken) {
    // Check if it was a credential error (redirect to /login?error=)
    const location = res.headers.get('location') ?? ''
    if (location.includes('error=')) {
      throw new Error('Invalid email or password')
    }
    throw new Error('No session cookie in sign-in response')
  }

  await SecureStore.setItemAsync('cc-session-token', sessionToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync('cc-session-token')
}
