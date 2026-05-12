import * as AppleAuthentication from 'expo-apple-authentication'
import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanion.app'

/**
 * Sign in with Apple on iOS.
 * Gets an Apple identity token + user info, sends it to the backend
 * which verifies the token, creates/finds the user, and returns a session.
 */
export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  })

  const { identityToken, fullName, email } = credential

  if (!identityToken) {
    throw new Error('Apple Sign-In failed: no identity token received')
  }

  // Build display name from Apple's name components (only provided on first sign-in)
  const displayName =
    fullName?.givenName && fullName?.familyName
      ? `${fullName.givenName} ${fullName.familyName}`
      : fullName?.givenName ?? undefined

  // Send the Apple identity token to our backend for verification + session creation
  const res = await fetch(`${API_BASE}/api/auth/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'apple',
      identityToken,
      email: email ?? undefined,
      displayName,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as {
      error?: string; code?: string; existingProvider?: string
    }
    const err = new Error(data.error ?? 'Apple Sign-In failed') as Error & {
      code?: string; existingProvider?: string; status?: number
    }
    err.status = res.status
    if (data.code) err.code = data.code
    if (data.existingProvider) err.existingProvider = data.existingProvider
    throw err
  }

  const data = await res.json()

  if (!data.token) {
    throw new Error('No session token received from Apple Sign-In')
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

/**
 * Check if Apple Sign-In is available on this device.
 * Returns false on Android or older iOS versions.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync()
}
