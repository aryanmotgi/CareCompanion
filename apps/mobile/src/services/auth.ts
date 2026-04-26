import * as SecureStore from 'expo-secure-store'

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

  const data = await res.json() as { token?: string; error?: string }

  if (!res.ok || !data.token) {
    throw new Error(data.error ?? 'Invalid email or password')
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
  await SecureStore.deleteItemAsync('cc-session-token')
  await SecureStore.deleteItemAsync('cc-profile')
  await SecureStore.deleteItemAsync('cc-csrf-token')
}
