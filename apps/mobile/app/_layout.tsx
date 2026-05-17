// apps/mobile/app/_layout.tsx
import { initSentry } from '../src/lib/sentry'
import { initAnalytics } from '../src/lib/analytics'
import { useEffect, useState, useCallback, useRef, createContext, useContext } from 'react'

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
import { DisclaimerModal } from '../components/DisclaimerModal'
import { ProfileProvider, useProfile } from '../src/context/ProfileContext'
import { refreshTokenIfNeeded } from '../src/services/token-refresh'
import {
  registerNotificationCategories,
  onNotificationResponse,
  scheduleDailyCheckin,
} from '../src/services/notifications'
import {
  defineSyncTask,
  registerBackgroundSync,
} from '../src/services/background-sync'
import { syncHealthKitData } from '../src/services/healthkit'
import {
  defineWellnessTask,
  registerWellnessBackgroundSync,
  drainWellnessRetryQueue,
} from '../src/services/wellnessVitals'
import { WELCOME_SEEN_KEY } from './welcome'

// Module-load: declare the JS handler the OS will invoke when iOS wakes us up.
// Must run before any RootLayout render — TaskManager requires the task to be
// registered at JS bootstrap time, not lazily in a useEffect.
defineSyncTask(async () => {
  try {
    const { synced } = await syncHealthKitData()
    return synced > 0 ? 'new-data' : 'no-data'
  } catch {
    return 'failed'
  }
})

// Wellness vitals (steps/HR/sleep) — separate 6h task. Must also be defined at
// JS bootstrap time so TaskManager can route OS wake-ups to the JS handler.
defineWellnessTask()

// API base for direct-fetch flows that run outside React context (notification
// action handlers). The api client expects in-memory config; here we just need
// a bare POST to /api/checkins so we read the env var directly.
const CHECKIN_API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

/**
 * Translate a numeric mobile-side value into the categorical bucket that
 * /api/checkins expects. Returns null when the value is unparseable.
 */
function bucketEnergy(n: number): 'low' | 'medium' | 'high' | null {
  if (Number.isNaN(n)) return null
  if (n <= 2) return 'low'
  if (n === 3) return 'medium'
  if (n >= 4) return 'high'
  return null
}
function bucketSleep(n: number): 'bad' | 'ok' | 'good' | null {
  if (Number.isNaN(n)) return null
  if (n <= 2) return 'bad'
  if (n === 3) return 'ok'
  if (n >= 4) return 'good'
  return null
}

/**
 * Handle a CHECKIN_* inline-reply action from the daily check-in notification.
 * Resolves careProfileId + auth/csrf tokens from SecureStore (these are kept
 * fresh by ProfileContext on every fetch), parses the user's reply, and POSTs
 * to /api/checkins. mood defaults to 3 (neutral) since the notification only
 * captures pain/energy/sleep.
 *
 * Best-effort: failures are logged and swallowed — we won't retry from here.
 */
async function postCheckinFromNotification(
  actionId: 'CHECKIN_PAIN' | 'CHECKIN_ENERGY' | 'CHECKIN_SLEEP',
  rawText: string | null,
): Promise<void> {
  if (!rawText) return
  const n = parseInt(rawText.trim(), 10)
  if (Number.isNaN(n)) return

  try {
    const [token, csrfToken, profileRaw] = await Promise.all([
      SecureStore.getItemAsync('cc-session-token'),
      SecureStore.getItemAsync('cc-csrf-token'),
      SecureStore.getItemAsync('cc-profile'),
    ])
    if (!token || !csrfToken || !profileRaw) return
    const profile = JSON.parse(profileRaw) as { careProfileId?: string }
    if (!profile.careProfileId) return

    // Defaults for the fields not provided by the notification action.
    // /api/checkins requires all four wellness fields, so we send neutral
    // values for whichever ones the user didn't supply in this tap.
    const body: Record<string, unknown> = {
      careProfileId: profile.careProfileId,
      mood: 3,
      pain: 0,
      energy: 'medium',
      sleep: 'ok',
    }
    if (actionId === 'CHECKIN_PAIN') {
      const v = Math.max(0, Math.min(10, n))
      body.pain = v
    } else if (actionId === 'CHECKIN_ENERGY') {
      const e = bucketEnergy(Math.max(1, Math.min(5, n)))
      if (!e) return
      body.energy = e
    } else if (actionId === 'CHECKIN_SLEEP') {
      const s = bucketSleep(Math.max(1, Math.min(5, n)))
      if (!s) return
      body.sleep = s
    }

    const isSecure = CHECKIN_API_BASE.startsWith('https://')
    const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'
    await fetch(`${CHECKIN_API_BASE}/api/checkins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Cookie': `${cookieName}=${token}`,
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.warn('[checkin-notif] failed:', err)
  }
}

// Welcome-seen state lives in a context so updates from welcome.tsx are visible
// to AuthGate in the same render — avoids a redirect-back-to-welcome race when
// the user taps Get Started.
type WelcomeState = 'loading' | 'seen' | 'unseen'
const WelcomeContext = createContext<{ state: WelcomeState; markSeen: () => void; reset: () => void }>({
  state: 'loading',
  markSeen: () => {},
  reset: () => {},
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

  const reset = useCallback(() => {
    setState('unseen')
    AsyncStorage.removeItem(WELCOME_SEEN_KEY).catch(() => {})
  }, [])

  return (
    <WelcomeContext.Provider value={{ state, markSeen, reset }}>{children}</WelcomeContext.Provider>
  )
}

// Tracks whether the user has finished the post-signup medical-records
// onboarding step. Gate keeps /(tabs) inaccessible until this is 'onboarded'.
const RECORDS_KEY = 'cc-records-onboarded'
type RecordsState = 'loading' | 'onboarded' | 'pending'
const RecordsContext = createContext<{ state: RecordsState; markOnboarded: () => void; reset: () => void }>({
  state: 'loading',
  markOnboarded: () => {},
  reset: () => {},
})
export const useRecordsContext = () => useContext(RecordsContext)

// User-type axis (migration 012). Decided at /care-type: are they the patient
// being cared for, or a caregiver joining someone else's care circle? Drives
// onboarding routing.
const USER_TYPE_KEY = 'cc-user-type'
type UserType = 'patient' | 'caregiver' | 'self'
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
        if (v === 'patient' || v === 'caregiver' || v === 'self') setState(v as UserType)
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

  const reset = useCallback(() => {
    setState('pending')
    AsyncStorage.removeItem(RECORDS_KEY).catch(() => {})
  }, [])

  return (
    <RecordsContext.Provider value={{ state, markOnboarded, reset }}>{children}</RecordsContext.Provider>
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

  const route = segments[0] as string | undefined
  const onWelcome = route === 'welcome'
  const isPublicRoute =
    route === 'login' ||
    route === 'signup' ||
    route === 'welcome' ||
    route === 'care-type'
  // Mandatory post-signup patient screen — user can't reach (tabs) until they
  // explicitly Connect or Skip on this screen.
  const onRecordsOnboarding = route === 'onboarding-records'
  // Caregiver lane onboarding screens — must complete before reaching (tabs).
  const onCaregiverOnboarding = route === 'care-group-join' || route === 'care-relationship'
  // Optional in-app screens that should also tolerate token-clears mid-flow.
  const isOnboardingRoute =
    route === 'health-connect' ||
    route === 'health-consent' ||
    route === 'setup' ||
    route === 'share-invite' ||
    onRecordsOnboarding ||
    onCaregiverOnboarding
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
  const isSelf = userTypeState === 'self'
  // Signed-in user who hasn't picked patient-or-caregiver yet (post-signup or
  // returning user on a fresh device) needs to go through /care-type before
  // any onboarding can happen.
  const onCareType = route === 'care-type'
  const needsCareTypePick =
    tokenState === 'present' &&
    userTypeState === 'unset' &&
    !onCareType &&
    welcomeState === 'seen'
  const needsRecordsOnboarding = (isPatient || isSelf) && recordsState === 'pending' && onTabs
  const needsCaregiverOnboarding = isCaregiver && caregiverJoinedState === 'pending' && onTabs
  const needsTabs =
    tokenState === 'present' &&
    isPublicRoute &&
    (
      ((isPatient || isSelf) && recordsState !== 'pending') ||
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
    ((isPatient || isSelf) && recordsState === 'onboarded') ||
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
  else if (needsCareTypePick) redirectTo = '/care-type'
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

export const SETUP_SKIPPED_KEY = 'cc-setup-skipped'

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useProfile()
  const segments = useSegments()
  const router = useRouter()
  const { state: userTypeState } = useUserTypeContext()
  const [setupSkipped, setSetupSkipped] = useState<boolean | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(SETUP_SKIPPED_KEY)
      .then((v) => setSetupSkipped(v === '1'))
      .catch(() => setSetupSkipped(false))
  }, [segments])

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (setupSkipped === null) return
    // Caregivers have their own onboarding lane (care-group-join + care-relationship).
    // Patients and self-care users both need the cancer profile wizard.
    // Users who explicitly skipped setup persist that choice locally.
    if (userTypeState === 'loading') return
    if (userTypeState === 'caregiver') return
    if (setupSkipped) return
    const seg = segments[0] as string | undefined
    const onSetup =
      seg === 'setup' ||
      seg === 'health-consent' ||
      seg === 'health-connect' ||
      seg === 'onboarding-records' ||
      seg === 'care-type' ||
      seg === 'care-group-join' ||
      seg === 'care-relationship' ||
      seg === 'share-invite'
    if (!profile.onboardingCompleted && !onSetup) {
      router.replace('/setup')
    }
  }, [profile, loading, segments, router, userTypeState, setupSkipped])

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

  useEffect(() => {
    void refreshTokenIfNeeded()
  }, [])

  // Register notification action categories + listen for user taps on action
  // buttons (Mark taken / Snooze / Skip / daily check-in inline replies).
  // Listener stays alive for app lifetime.
  useEffect(() => {
    void (async () => {
      try {
        await registerNotificationCategories()
        // Schedule the 8pm check-in if the user has already granted permission.
        // scheduleDailyCheckin no-ops when permission is missing — so first-run
        // users won't get a prompt here.
        await scheduleDailyCheckin()
      } catch {
        // expo-notifications native module unavailable (simulator) — skip silently
      }
    })()
    const unsub = onNotificationResponse(async (resp) => {
      const actionId = resp.actionId
      if (
        actionId === 'CHECKIN_PAIN' ||
        actionId === 'CHECKIN_ENERGY' ||
        actionId === 'CHECKIN_SLEEP'
      ) {
        await postCheckinFromNotification(actionId, resp.userText)
        return
      }
      // Other action handlers (dose / appointment) — left as TODO until
      // the corresponding endpoints land.
      if (__DEV__) console.log('[notif-action]', resp.actionId)
    })
    return unsub
  }, [])

  // Best-effort background HealthKit sync. iOS may invoke the task as often as
  // every ~15 min or as rarely as once a day depending on app usage signal.
  useEffect(() => {
    void registerBackgroundSync(60 * 60)
  }, [])

  // Wellness vitals — separate 6h cadence (steps/HR/sleep).
  useEffect(() => {
    void registerWellnessBackgroundSync()
    // Drain any wellness payloads queued from prior failed posts on boot, since
    // the 6h task may not fire for a while. Clinical drain runs inside
    // syncHealthKitData itself.
    void drainWellnessRetryQueue()
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
                    <OnboardingGate>
                      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
                        {/* Logged-in tabs root: block iOS swipe-back to /welcome.
                            Exit only via explicit Sign out. */}
                        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
                        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
                        {/* Onboarding lane — swipe-back would let the user
                            escape AuthGate/OnboardingGate guards and end up
                            on an inconsistent route. Disable the gesture so
                            every back step is a deliberate button press. */}
                        <Stack.Screen name="care-type" options={{ gestureEnabled: false }} />
                        <Stack.Screen name="onboarding-records" options={{ gestureEnabled: false }} />
                        <Stack.Screen name="health-consent" options={{ gestureEnabled: false }} />
                        <Stack.Screen name="health-connect" options={{ gestureEnabled: false }} />
                        <Stack.Screen name="care-group-join" options={{ gestureEnabled: false }} />
                        <Stack.Screen name="care-relationship" options={{ gestureEnabled: false }} />
                        <Stack.Screen name="setup" options={{ gestureEnabled: false }} />
                        <Stack.Screen name="share-invite" options={{ gestureEnabled: false }} />
                      </Stack>
                    </OnboardingGate>
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
      <DisclaimerModal />
    </SafeAreaProvider>
  )
}
