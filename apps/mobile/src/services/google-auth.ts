import * as AuthSession from 'expo-auth-session'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? ''

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
}

/**
 * Sign in with Google using expo-auth-session.
 * Opens the Google OAuth flow, gets an ID token, and sends it to the backend.
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectUri = AuthSession.makeRedirectUri()
  const codeVerifier = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    Math.random().toString(36) + Date.now().toString(36),
  )

  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.IdToken,
    extraParams: { nonce: codeVerifier },
  })

  const result = await request.promptAsync(discovery)

  if (result.type !== 'success' || !result.params?.id_token) {
    throw new Error('Google Sign-In was cancelled or failed')
  }

  const idToken = result.params.id_token

  const res = await fetch(`${API_BASE}/api/auth/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'google',
      identityToken: idToken,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as {
      error?: string; code?: string; existingProvider?: string
    }
    const err = new Error(data.error ?? 'Google Sign-In failed') as Error & {
      code?: string; existingProvider?: string; status?: number
    }
    err.status = res.status
    if (data.code) err.code = data.code
    if (data.existingProvider) err.existingProvider = data.existingProvider
    throw err
  }

  const data = await res.json()

  if (!data.token) {
    throw new Error('No session token received from Google Sign-In')
  }

  await SecureStore.setItemAsync('cc-session-token', data.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })

  if (data.user?.id) {
    await SecureStore.setItemAsync('cc-user-id', data.user.id, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
  }
  if (data.user?.email) {
    await SecureStore.setItemAsync('cc-user-email', data.user.email, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
  }
}
