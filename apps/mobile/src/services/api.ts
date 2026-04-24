import { createApiClient } from '@carecompanion/api'
import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

export const apiClient = createApiClient({
  baseUrl: API_BASE,
  getToken: () => SecureStore.getItemAsync('cc-session-token'),
})
