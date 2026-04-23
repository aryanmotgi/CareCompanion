// apps/mobile/app/_layout.tsx
import { initSentry } from '../src/lib/sentry'
import { useEffect, useState, useCallback } from 'react'

initSentry()
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar, ActivityIndicator, View } from 'react-native'
import { useTheme } from '../src/theme'
import { TestModeBanner } from '../src/components/TestModeBanner'
import { useShakeDetector } from '../src/hooks/useShakeDetector'
import { BugReportSheet } from '../src/components/BugReportSheet'

function AuthGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments()
  const router = useRouter()
  const theme = useTheme()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function check() {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const isAuthScreen = segments[0] === 'login' || segments[0] === 'signup'
      if (!token && !isAuthScreen) router.replace('/login')
      else if (token && isAuthScreen) router.replace('/(tabs)')
      setReady(true)
    }
    void check()
  }, [segments, router])

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  return <>{children}</>
}

function ThemedStatusBar() {
  const theme = useTheme()
  return <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
}

export default function RootLayout() {
  const segments = useSegments()
  const [bugReportVisible, setBugReportVisible] = useState(false)
  const currentScreen = segments.join('/')

  const handleShake = useCallback(() => {
    setBugReportVisible(true)
  }, [])

  useShakeDetector(handleShake)

  return (
    <SafeAreaProvider>
      <ThemedStatusBar />
      <TestModeBanner />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
      <BugReportSheet
        visible={bugReportVisible}
        currentScreen={currentScreen}
        onClose={() => setBugReportVisible(false)}
      />
    </SafeAreaProvider>
  )
}
