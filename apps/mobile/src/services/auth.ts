import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

export async function signInWithCredentials(
  email: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/mobile-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  })

  const data = await res.json() as {
    token?: string; error?: string; code?: string; provider?: string
  }

  if (!res.ok || !data.token) {
    const err = new Error(data.error ?? 'Invalid email or password') as Error & {
      code?: string; provider?: string; status?: number
    }
    err.status = res.status
    if (data.code) err.code = data.code
    if (data.provider) err.provider = data.provider
    throw err
  }

  // Clear previous session cache before storing new token
  await SecureStore.deleteItemAsync('cc-profile')
  await SecureStore.deleteItemAsync('cc-csrf-token')
  await SecureStore.setItemAsync('cc-session-token', data.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

export async function signInWithCareGroup(
  groupName: string,
  groupPassword: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/mobile-care-group-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupName: groupName.trim(), groupPassword }),
  })

  const data = await res.json() as { token?: string; error?: string }

  if (!res.ok || !data.token) {
    throw new Error(data.error ?? 'Invalid Care Group name or password')
  }

  await SecureStore.deleteItemAsync('cc-profile')
  await SecureStore.deleteItemAsync('cc-csrf-token')
  await SecureStore.setItemAsync('cc-session-token', data.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

export async function signOut(): Promise<void> {
  // Clear secure tokens
  await Promise.all([
    SecureStore.deleteItemAsync('cc-session-token'),
    SecureStore.deleteItemAsync('cc-profile'),
    SecureStore.deleteItemAsync('cc-csrf-token'),
  ])

  // Clear local onboarding/preference flags so next user starts fresh.
  // Keeping 'cc-welcome-seen' would skip the welcome scenes on re-login;
  // wiping it sends them back to the marketing flow on next launch.
  await Promise.all([
    AsyncStorage.removeItem('cc-welcome-seen'),
    SecureStore.deleteItemAsync('cc-user-type'),
    AsyncStorage.removeItem('cc-caregiver-joined'),
    AsyncStorage.removeItem('cc-records-onboarded'),
    AsyncStorage.removeItem('cc-setup-skipped'),
    AsyncStorage.removeItem('cc-healthkit-connected'),
    AsyncStorage.removeItem('tour_completed'),
  ])
}
