import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

const SEVEN_DAYS_SECS = 7 * 24 * 60 * 60

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    // base64url → base64
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function refreshTokenIfNeeded(): Promise<void> {
  const token = await SecureStore.getItemAsync('cc-session-token')
  if (!token) return

  const payload = decodeJwtPayload(token)
  if (!payload) return

  const exp = payload.exp
  if (typeof exp !== 'number') return

  const nowSecs = Math.floor(Date.now() / 1000)
  if (exp - nowSecs > SEVEN_DAYS_SECS) return

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) return

    const data = await res.json() as { token?: string }
    if (!data.token) return

    await SecureStore.setItemAsync('cc-session-token', data.token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
  } catch {
    // Non-fatal — user still has their existing token
  }
}
