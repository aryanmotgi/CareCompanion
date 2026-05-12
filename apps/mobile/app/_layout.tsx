// apps/mobile/app/_layout.tsx
import { initSentry } from '../src/lib/sentry'
import { initAnalytics } from '../src/lib/analytics'
import { useEffect, useState, useCallback, useRef, createContext, useContext } from 'react'

initSentry()
import { Stack, Redirect, useSegments } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar, ActivityIndicator, View, Platform } from 'react-native'
import { useTheme } from '../src/theme'
import { TestModeBanner } from '../src/components/TestModeBanner'
import { useShakeDetector } from '../src/hooks/useShakeDetector'
import { BugReportSheet } from '../src/components/BugReportSheet'
import { ProfileProvider } from '../src/context/ProfileContext'
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

// User-type axis (migration 011). Decided at /care-type: are they the patient
// being cared for, or a caregiver joining someone else's care circle? Drives
// onboarding routing.
const USER_TYPE_KEY = 'cc-user-type'
type UserType = 'patient' | 'caregiver'
type UserTypeState = 'loading' | UserType | 'unset'
const UserTypeContext = createContext<{
  state: UserTypeState
  setUserType: (t: UserType) => void
  reset: () => void
}>({
  state: 'loading',
  setUserType: () => {},
  reset: () => {},
})
export const useUserTypeContext = () => useContext(UserTypeContext)

function UserTypeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UserTypeState>(Platform.OS === 'web' ? 'unset' : 'loading')

  useEffect(() => {
    if (Platform.OS === 'web') return
    let cancelled = false
    AsyncStorage.getItem(USER_TYPE_KEY)
      .then((v) => {
        if (cancelled) return
        if (v === 'patient' || v === 'caregiver') setState(v)
        else setState('unset')
      })
      .catch(() => { if (!cancelled) setState('unset') })
    return () => { cancelled = true }
  }, [])

  const setUserType = useCallback((t: UserType) => {
    setState(t)
    AsyncStorage.setItem(USER_TYPE_KEY, t).catch(() => {})
  }, [])

  const reset = useCallback(() => {
    setState('unset')
    AsyncStorage.removeItem(USER_TYPE_KEY).catch(() => {})
  }, [])

  return (
    <UserTypeContext.Provider value={{ state, setUserType, reset }}>{children}</UserTypeContext.Provider>
  )
}

// Caregiver joined state — has the caregiver successfully attached to a
// patient's care group yet? Mirrors the records-onboarded pattern but for
// the caregiver lane.
const CAREGIVER_JOINED_KEY = 'cc-caregiver-joined'
type CaregiverJoinedState = 'loading' | 'joined' | 'pending'
const CaregiverJoinedContext = createContext<{
  state: CaregiverJoinedState
  markJoined: () => void
  reset: () => void
}>({
  state: 'loading',
  markJoined: () => {},
  reset: () => {},
})
export const useCaregiverJoinedContext = () => useContext(CaregiverJoinedContext)

function CaregiverJoinedProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CaregiverJoinedState>(Platform.OS === 'web' ? 'joined' : 'loading')

  useEffect(() => {
    if (Platform.OS === 'web') return
    let cancelled = false
    AsyncStorage.getItem(CAREGIVER_JOINED_KEY)
      .then((v) => { if (!cancelled) setState(v === '1' ? 'joined' : 'pending') })
      .catch(() => { if (!cancelled) setState('pending') })
    return () => { cancelled = true }
  }, [])

  const markJoined = useCallback(() => {
    setState('joined')
    AsyncStorage.setItem(CAREGIVER_JOINED_KEY, '1').catch(() => {})
  }, [])

  const reset = useCallback(() => {
    setState('pending')
    AsyncStorage.removeItem(CAREGIVER_JOINED_KEY).catch(() => {})
  }, [])

  return (
    <CaregiverJoinedContext.Provider value={{ state, markJoined, reset }}>{children}</CaregiverJoinedContext.Provider>
  )
}

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
  const { state: userTypeState } = useUserTypeContext()
  const { state: caregiverJoinedState } = useCaregiverJoinedContext()

  const route = segments[0]
  const onWelcome = route === 'welcome'
  const isPublicRoute =
    route === 'login' ||
    route === 'signup' ||
    route === 'welcome' ||
    route === 'care-type' ||
    route === 'care-role'
  // Mandatory post-signup patient screen — user can't reach (tabs) until they
  // explicitly Connect or Skip on this screen.
  const onRecordsOnboarding = route === 'onboarding-records'
  // Caregiver lane onboarding screens — must complete before reaching (tabs).
  const onCaregiverOnboarding = route === 'care-group-join' || route === 'care-relationship'
  // Optional in-app screens that should also tolerate token-clears mid-flow.
  const isOnboardingRoute =
    route === 'health-connect' || route === 'setup' || onRecordsOnboarding || onCaregiverOnboarding
  const onTabs = route === '(tabs)' || route === undefined

  // Welcome takes priority over any token state. On iOS Simulator, SecureStore
  // (Keychain) survives `simctl uninstall`, so a fresh install can find a stale
  // token and skip welcome. Same protects against stale tokens from backup
  // restores on real devices.
  const needsWelcome = welcomeState === 'unseen' && !onWelcome && !isOnboardingRoute
  const needsLogin = tokenState === 'absent' && welcomeState === 'seen' && !isPublicRoute && !isOnboardingRoute
  // Hard gates by user type:
  //   - patient → records onboarding gate (existing)
  //   - caregiver → care-group join gate (NEW)
  // Both prevent reaching (tabs) until their respective onboarding completes.
  const isCaregiver = userTypeState === 'caregiver'
  const isPatient = userTypeState === 'patient'
  const needsRecordsOnboarding = isPatient && recordsState === 'pending' && onTabs
  const needsCaregiverOnboarding = isCaregiver && caregiverJoinedState === 'pending' && onTabs
  const needsTabs =
    tokenState === 'present' &&
    isPublicRoute &&
    (
      (isPatient && recordsState !== 'pending') ||
      (isCaregiver && caregiverJoinedState === 'joined')
    )

  // Cold-launch funnel restart. Until the user completes records onboarding,
  // every cold launch routes to /welcome. That covers two cases:
  //   1. No token: expo-router can restore to an onboarding route, and the
  //      `!isOnboardingRoute` exemption on `needsLogin` would leave an
  //      unauthenticated user stuck there. Force /welcome instead.
  //   2. Token + records pending: the user created an account but hasn't
  //      finished onboarding. Resuming mid-flow on cold launch is unwanted
  //      product behavior — restart the funnel so they see the carousel and
  //      can sign back in (or get started), then land back on
  //      /onboarding-records via the gate below.
  // Fully-onboarded users (tokenState='present' AND recordsState='onboarded')
  // are unaffected — they go straight to /(tabs).
  const hasCommittedSettled = useRef(false)
  const allStatesReady =
    welcomeState !== 'loading' &&
    tokenState !== 'loading' &&
    recordsState !== 'loading' &&
    userTypeState !== 'loading' &&
    caregiverJoinedState !== 'loading'
  useEffect(() => {
    if (allStatesReady) hasCommittedSettled.current = true
  }, [allStatesReady])
  const onboardingComplete =
    (isPatient && recordsState === 'onboarded') ||
    (isCaregiver && caregiverJoinedState === 'joined')
  const needsFunnelRestart =
    allStatesReady &&
    !hasCommittedSettled.current &&
    (tokenState === 'absent' || !onboardingComplete) &&
    !onWelcome

  // The Stack must mount on the first render (otherwise expo-router throws
  // "Attempted to navigate before mounting the Root Layout"). We render it
  // unconditionally and use <Redirect> as a sibling to drive navigation, plus
  // an overlay during the initial read so the underlying route never flashes.
  const loading = tokenState === 'loading' || welcomeState === 'loading' || recordsState === 'loading'

  // Single redirect target with explicit priority. Funnel restart trumps
  // everything; then welcome; then user-type-specific onboarding gates; then
  // login; then tabs. Rendering multiple <Redirect> siblings produces
  // undefined ordering — only one should ever be active per render.
  let redirectTo: string | null = null
  if (needsFunnelRestart) redirectTo = '/welcome'
  else if (needsWelcome) redirectTo = '/welcome'
  else if (needsLogin) redirectTo = '/login'
  else if (needsRecordsOnboarding) redirectTo = '/onboarding-records'
  else if (needsCaregiverOnboarding) redirectTo = '/care-group-join'
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
            <UserTypeProvider>
              <CaregiverJoinedProvider>
                <AuthGate>
                  <ProfileProvider>
                    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }} />
                  </ProfileProvider>
                </AuthGate>
              </CaregiverJoinedProvider>
            </UserTypeProvider>
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
