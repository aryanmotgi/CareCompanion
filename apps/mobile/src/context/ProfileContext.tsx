import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { useRouter } from 'expo-router'
import { createApiClient } from '@carecompanion/api'

// SecureStore is native-only — provide no-op shims for web
const store = {
  getItem: (key: string) =>
    Platform.OS === 'web' ? Promise.resolve(null) : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    Platform.OS === 'web' ? Promise.resolve() : SecureStore.setItemAsync(key, value),
  deleteItem: (key: string) =>
    Platform.OS === 'web' ? Promise.resolve() : SecureStore.deleteItemAsync(key),
}

const apiClient = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org',
  getToken: () => store.getItem('cc-session-token'),
})

export interface Profile {
  userId: string
  email: string
  displayName: string
  careProfileId: string | null
  patientName: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  cancerType: string | null
  cancerStage: string | null
  treatmentPhase: string | null
  allergies: string | null
  conditions: string | null
  role: string
  caregiverForName: string | null
  onboardingCompleted: boolean
}

interface ProfileContextValue {
  profile: Profile | null
  loading: boolean
  error: Error | null
  csrfToken: string | null
  refetch: () => Promise<void>
  apiClient: ReturnType<typeof createApiClient>
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  loading: true,
  error: null,
  csrfToken: null,
  refetch: async () => {},
  apiClient,
})

export function useProfile() {
  return useContext(ProfileContext)
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const router = useRouter()

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [profileData, csrfData] = await Promise.all([
        apiClient.me(),
        apiClient.csrfToken(),
      ])

      setProfile(profileData)
      setCsrfToken(csrfData.csrfToken)
      await store.setItem('cc-profile', JSON.stringify(profileData))
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load profile')

      if (error.message.includes('401') || error.message.includes('403')) {
        await store.deleteItem('cc-session-token')
        await store.deleteItem('cc-profile')
        router.replace('/login')
        return
      }

      const cached = await store.getItem('cc-profile')
      if (cached) {
        try { setProfile(JSON.parse(cached)) } catch { /* corrupt cache */ }
      }

      setError(error)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return (
    <ProfileContext.Provider value={{ profile, loading, error, csrfToken, refetch: fetchProfile, apiClient }}>
      {children}
    </ProfileContext.Provider>
  )
}
