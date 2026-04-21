// apps/mobile/app/_layout.tsx
import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'react-native'
import { useTheme } from '../src/theme'

WebBrowser.maybeCompleteAuthSession()

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
    void check()
  }, [segments, router])

  return <>{children}</>
}

function ThemedStatusBar() {
  const theme = useTheme()
  return <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemedStatusBar />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
    </SafeAreaProvider>
  )
}
