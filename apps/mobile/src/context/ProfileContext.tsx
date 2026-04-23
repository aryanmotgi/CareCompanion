import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as SecureStore from 'expo-secure-store'
import { useRouter } from 'expo-router'
import { createApiClient } from '@carecompanion/api'

const apiClient = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org',
  getToken: () => SecureStore.getItemAsync('cc-session-token'),
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
}

interface ProfileContextValue {
  profile: Profile | null
  loading: boolean
  error: Error | null
  csrfToken: string | null
  refetch: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  loading: true,
  error: null,
  csrfToken: null,
  refetch: async () => {},
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

      // Fetch profile and CSRF token in parallel
      const [profileData, csrfData] = await Promise.all([
        apiClient.me(),
        apiClient.csrfToken(),
      ])

      setProfile(profileData)
      setCsrfToken(csrfData.csrfToken)

      // Cache in SecureStore
      await SecureStore.setItemAsync('cc-profile', JSON.stringify(profileData))
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load profile')

      // If 401/403, clear auth and redirect to login
      if (error.message.includes('401') || error.message.includes('403')) {
        await SecureStore.deleteItemAsync('cc-session-token')
        await SecureStore.deleteItemAsync('cc-profile')
        router.replace('/login')
        return
      }

      // Try to load cached profile as fallback
      const cached = await SecureStore.getItemAsync('cc-profile')
      if (cached) {
        try {
          setProfile(JSON.parse(cached))
        } catch {
          // corrupt cache, ignore
        }
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
    <ProfileContext.Provider value={{ profile, loading, error, csrfToken, refetch: fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}
