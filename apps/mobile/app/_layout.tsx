// apps/mobile/app/_layout.tsx
import { initSentry } from '../src/lib/sentry'
import { initAnalytics } from '../src/lib/analytics'
import { useEffect, useState, useCallback, createContext, useContext } from 'react'

initSentry()
import { Stack, Redirect, useSegments, useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar, ActivityIndicator, View, Platform } from 'react-native'
import { useTheme } from '../src/theme'
import { TestModeBanner } from '../src/components/TestModeBanner'
import { useShakeDetector } from '../src/hooks/useShakeDetector'
import { BugReportSheet } from '../src/components/BugReportSheet'
import { ProfileProvider, useProfile } from '../src/context/ProfileContext'
import { refreshTokenIfNeeded } from '../src/services/token-refresh'
import { WELCOME_SEEN_KEY } from './welcome'

// Welcome-seen state lives in a context so updates from welcome.tsx are visible
// to AuthGate in the same render — avoids a redirect-back-to-welcome race when
// the user taps Get Started.
type WelcomeState = 'loading' | 'seen' | 'unseen'
const WelcomeContext = createContext<{ state: WelcomeState; markSeen: () => void }>({
  state: 'loading',
  markSeen: () => {},
})
export const useWelcomeContext = () => useContext(WelcomeContext)

function WelcomeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WelcomeState>(Platform.OS === 'web' ? 'seen' : 'loading')

  useEffect(() => {
    if (Platform.OS === 'web') return
    let cancelled = false
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then((v) => { if (!cancelled) setState(v === '1' ? 'seen' : 'unseen') })
      .catch(() => { if (!cancelled) setState('unseen') })
    return () => { cancelled = true }
  }, [])

  const markSeen = useCallback(() => {
    setState('seen')
    AsyncStorage.setItem(WELCOME_SEEN_KEY, '1').catch(() => {})
  }, [])

  return (
    <WelcomeContext.Provider value={{ state, markSeen }}>{children}</WelcomeContext.Provider>
  )
}

// Tracks whether the user has finished the post-signup medical-records
// onboarding step. Gate keeps /(tabs) inaccessible until this is 'onboarded'.
const RECORDS_KEY = 'cc-records-onboarded'
type RecordsState = 'loading' | 'onboarded' | 'pending'
const RecordsContext = createContext<{ state: RecordsState; markOnboarded: () => void }>({
  state: 'loading',
  markOnboarded: () => {},
})
export const useRecordsContext = () => useContext(RecordsContext)

function RecordsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RecordsState>(Platform.OS === 'web' ? 'onboarded' : 'loading')

  useEffect(() => {
    if (Platform.OS === 'web') return
    let cancelled = false
    AsyncStorage.getItem(RECORDS_KEY)
      .then((v) => { if (!cancelled) setState(v === '1' ? 'onboarded' : 'pending') })
      .catch(() => { if (!cancelled) setState('pending') })
    return () => { cancelled = true }
  }, [])

  const markOnboarded = useCallback(() => {
    setState('onboarded')
    AsyncStorage.setItem(RECORDS_KEY, '1').catch(() => {})
  }, [])

  return (
    <RecordsContext.Provider value={{ state, markOnboarded }}>{children}</RecordsContext.Provider>
  )
}

// Same pattern for the session token — auth handlers call markSignedIn() right
// after writing the token to SecureStore so AuthGate sees the new state on the
// very next render (no /login flash between signup and /health-connect).
type TokenState = 'loading' | 'present' | 'absent'
const TokenContext = createContext<{
  state: TokenState
  markSignedIn: () => void
  markSignedOut: () => void
}>({
  state: 'loading',
  markSignedIn: () => {},
  markSignedOut: () => {},
})
export const useTokenContext = () => useContext(TokenContext)

function TokenProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TokenState>(Platform.OS === 'web' ? 'absent' : 'loading')

  useEffect(() => {
    if (Platform.OS === 'web') return
    let cancelled = false
    SecureStore.getItemAsync('cc-session-token')
      .then((t) => { if (!cancelled) setState(t ? 'present' : 'absent') })
      .catch(() => { if (!cancelled) setState('absent') })
    return () => { cancelled = true }
  }, [])

  const markSignedIn = useCallback(() => setState('present'), [])
  const markSignedOut = useCallback(() => setState('absent'), [])

  return (
    <TokenContext.Provider value={{ state, markSignedIn, markSignedOut }}>
      {children}
    </TokenContext.Provider>
  )
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments()
  const theme = useTheme()
  const { state: welcomeState } = useWelcomeContext()
  const { state: tokenState } = useTokenContext()
  const { state: recordsState } = useRecordsContext()

  useEffect(() => {
    void refreshTokenIfNeeded()
  }, [])

  const route = segments[0] as string | undefined
  const onWelcome = route === 'welcome'
  const isPublicRoute =
    route === 'login' ||
    route === 'signup' ||
    route === 'welcome' ||
    route === 'care-type' ||
    route === 'care-role'
  // Mandatory post-signup screen — user can't reach (tabs) until they
  // explicitly Connect or Skip on this screen.
  const onRecordsOnboarding = route === 'onboarding-records'
  // Optional in-app screens that should also tolerate token-clears mid-flow.
  const isOnboardingRoute = route === 'health-connect' || route === 'setup' || onRecordsOnboarding
  const onTabs = route === '(tabs)' || route === undefined

  // Welcome takes priority over any token state. On iOS Simulator, SecureStore
  // (Keychain) survives `simctl uninstall`, so a fresh install can find a stale
  // token and skip welcome. Same protects against stale tokens from backup
  // restores on real devices.
  const needsWelcome = welcomeState === 'unseen' && !onWelcome && !isOnboardingRoute
  const needsLogin = tokenState === 'absent' && welcomeState === 'seen' && !isPublicRoute && !isOnboardingRoute
  // Hard gate: if records onboarding isn't complete, no access to the tab bar.
  const needsRecordsOnboarding = recordsState === 'pending' && onTabs
  const needsTabs = tokenState === 'present' && isPublicRoute && recordsState !== 'pending'

  // The Stack must mount on the first render (otherwise expo-router throws
  // "Attempted to navigate before mounting the Root Layout"). We render it
  // unconditionally and use <Redirect> as a sibling to drive navigation, plus
  // an overlay during the initial read so the underlying route never flashes.
  const loading = tokenState === 'loading' || welcomeState === 'loading' || recordsState === 'loading'

  // Single redirect target with explicit priority: welcome trumps records
  // onboarding, which trumps login, etc. Rendering multiple <Redirect> siblings
  // produces undefined ordering — only one should ever be active per render.
  let redirectTo: string | null = null
  if (needsWelcome) redirectTo = '/welcome'
  else if (needsLogin) redirectTo = '/login'
  else if (needsRecordsOnboarding) redirectTo = '/onboarding-records'
  // needsTabs already requires recordsState !== 'pending', so always /(tabs).
  else if (needsTabs) redirectTo = '/(tabs)'

  return (
    <>
      {redirectTo && <Redirect href={redirectTo as any} />}
      {children}
      {loading && (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: theme.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={theme.accent} />
        </View>
      )}
    </>
  )
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useProfile()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!profile) return
    const onSetup = segments[0] === 'setup' || segments[0] === 'health-consent' || segments[0] === 'health-connect'
    if (!profile.onboardingCompleted && !onSetup) {
      router.replace('/setup')
    }
  }, [profile, loading, segments, router])

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

  useEffect(() => {
    void initAnalytics()
  }, [])

  const handleShake = useCallback(() => {
    setBugReportVisible(true)
  }, [])

  useShakeDetector(handleShake)

  const theme = useTheme()

  return (
    <SafeAreaProvider style={{ backgroundColor: theme.bg }}>
      <ThemedStatusBar />
      <TestModeBanner />
      <WelcomeProvider>
        <TokenProvider>
          <RecordsProvider>
            <AuthGate>
              <ProfileProvider>
                <OnboardingGate>
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }} />
                </OnboardingGate>
              </ProfileProvider>
            </AuthGate>
          </RecordsProvider>
        </TokenProvider>
      </WelcomeProvider>
      <BugReportSheet
        visible={bugReportVisible}
        currentScreen={currentScreen}
        onClose={() => setBugReportVisible(false)}
      />
    </SafeAreaProvider>
  )
}
