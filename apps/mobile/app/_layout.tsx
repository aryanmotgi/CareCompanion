import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SecureStore from 'expo-secure-store'

function AuthGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const inLogin = segments[0] === 'login'
      if (!token && !inLogin) router.replace('/login')
      else if (token && inLogin) router.replace('/(tabs)')
    }
    check()
  }, [segments])

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <AuthGate>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthGate>
  )
}
