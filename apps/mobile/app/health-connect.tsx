import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  Linking,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  requestHealthKitPermissions,
  markHealthKitConnected,
  replaceHealthKitData,
  subscribeSyncState,
  getLastSyncedAt,
  formatLastSynced,
  type SyncState,
} from '../src/services/healthkit'
import { requestWellnessPermissions } from '../src/services/wellnessVitals'
import {
  requestCalendarPermissions,
  syncMedicalCalendarEvents,
} from '../src/services/calendar'
import { apiClient } from '../src/services/api'
import { useProfile } from '../src/context/ProfileContext'
import { useRecordsContext } from './_layout'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = SCREEN_WIDTH - 56

// ---------------------------------------------------------------------------
// Tutorial step data — mirrors the real iOS HealthKit authorization flow
// ---------------------------------------------------------------------------

interface TutorialStep {
  step: number
  instruction: string
  mockup: 'shareEmpty' | 'getStarted' | 'searchInstitution' | 'shareAdded' | 'permissions' | 'autoShare'
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    step: 1,
    instruction: "Tap 'Add Account' to connect your health provider",
    mockup: 'shareEmpty',
  },
  {
    step: 2,
    instruction: "Tap 'Get Started' to begin linking your records",
    mockup: 'getStarted',
  },
  {
    step: 3,
    instruction: 'Search for your hospital or health network',
    mockup: 'searchInstitution',
  },
  {
    step: 4,
    instruction: "Your institution is added — tap 'Next' to continue",
    mockup: 'shareAdded',
  },
  {
    step: 5,
    instruction: "Allow all categories and tap 'Share'",
    mockup: 'permissions',
  },
  {
    step: 6,
    instruction: "Select 'Automatically Share' then tap 'Done'",
    mockup: 'autoShare',
  },
]

// ---------------------------------------------------------------------------
// Phone mockup frames
// ---------------------------------------------------------------------------

function DarkFrame({ children, backLabel }: { children: React.ReactNode; backLabel?: string }) {
  return (
    <View style={[mockStyles.phone, { backgroundColor: '#1C1C1E' }]}>
      <View style={mockStyles.statusBar}>
        <Text style={mockStyles.statusTime}>6:49</Text>
        <View style={mockStyles.statusRight}>
          <Ionicons name="cellular" size={10} color="#fff" />
          <Ionicons name="wifi" size={10} color="#fff" />
          <Ionicons name="battery-full" size={10} color="#fff" />
        </View>
      </View>
      {backLabel && (
        <View style={{ paddingHorizontal: 10, paddingBottom: 2 }}>
          <Text style={{ color: '#007AFF', fontSize: 10 }}>◀ {backLabel}</Text>
        </View>
      )}
      {children}
    </View>
  )
}

function LightFrame({ children, backLabel }: { children: React.ReactNode; backLabel?: string }) {
  return (
    <View style={[mockStyles.phone, { backgroundColor: '#F2F2F7' }]}>
      <View style={mockStyles.statusBar}>
        <Text style={[mockStyles.statusTime, { color: '#000' }]}>6:49</Text>
        <View style={mockStyles.statusRight}>
          <Ionicons name="cellular" size={10} color="#000" />
          <Ionicons name="wifi" size={10} color="#000" />
          <Ionicons name="battery-full" size={10} color="#000" />
        </View>
      </View>
      {backLabel && (
        <View style={{ paddingHorizontal: 10, paddingBottom: 2 }}>
          <Text style={{ color: '#007AFF', fontSize: 10 }}>◀ {backLabel}</Text>
        </View>
      )}
      {children}
    </View>
  )
}

// Shared dark iOS-style navigation bar (back + counter + close)
function DarkNavBar({ counter }: { counter: string }) {
  return (
    <View style={mockStyles.darkNav}>
      <View style={mockStyles.darkNavBtn}>
        <Ionicons name="chevron-back" size={11} color="#fff" />
      </View>
      <Text style={mockStyles.darkNavCounter}>{counter}</Text>
      <View style={mockStyles.darkNavBtn}>
        <Ionicons name="close" size={11} color="#fff" />
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Share Health Records (empty, "Add Account")
// ---------------------------------------------------------------------------
function ShareEmptyMockup() {
  return (
    <DarkFrame>
      <DarkNavBar counter="1 of 4" />
      <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
        <Text style={mockStyles.iosTitle}>Share Health Records</Text>
        <Text style={mockStyles.iosSubtitle}>
          Add your provider accounts to grant "CareCompanion" access to the requested health records.
        </Text>
        <View style={mockStyles.emptyPill}>
          <Text style={mockStyles.emptyPillText}>No Accounts Added</Text>
        </View>
      </View>
      <View style={mockStyles.iosBottomBtn}>
        <View style={mockStyles.iosBlueBtn}>
          <Text style={mockStyles.iosBlueBtnText}>Add Account</Text>
        </View>
      </View>
    </DarkFrame>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Health Records "Get Started" (light mode)
// ---------------------------------------------------------------------------
function GetStartedMockup() {
  return (
    <LightFrame backLabel="CareCompanion">
      <View style={mockStyles.lightNav}>
        <Text style={mockStyles.lightNavTitle}>Health Records</Text>
        <View style={mockStyles.lightNavCheck}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      </View>
      <View style={{ paddingHorizontal: 10 }}>
        <View style={mockStyles.lightCard}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
            <View style={mockStyles.healthRecordsIcon}>
              <Ionicons name="pulse" size={16} color="#007AFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={mockStyles.lightCardTitle}>Access Your Records</Text>
              <Text style={mockStyles.lightCardBody}>
                Connect to your provider to see your health records and get updates when there's a new entry.
              </Text>
            </View>
          </View>
          <Text style={mockStyles.lightCardLink}>About Health Records & Privacy</Text>
          <View style={mockStyles.getStartedBtn}>
            <Text style={mockStyles.getStartedBtnText}>Get Started</Text>
          </View>
        </View>
      </View>
    </LightFrame>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Search for institution (light mode)
// ---------------------------------------------------------------------------
function SearchInstitutionMockup() {
  const institutions = [
    'Sample Institution A',
    'Sample Institution B',
    'One Medical',
    'Labcorp',
  ]
  return (
    <LightFrame>
      <View style={mockStyles.lightSearchNav}>
        <View style={mockStyles.lightCloseBtn}>
          <Ionicons name="close" size={12} color="#000" />
        </View>
        <Text style={mockStyles.lightNavTitle}>Search</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={{ paddingHorizontal: 10 }}>
        <Text style={mockStyles.suggestionsLabel}>Suggestions</Text>
        <View style={mockStyles.lightList}>
          {institutions.map((name, i) => (
            <View key={i} style={[mockStyles.lightRow, i < institutions.length - 1 && mockStyles.lightRowBorder]}>
              <View style={mockStyles.institutionAvatar}>
                <Text style={mockStyles.institutionAvatarText}>S</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={mockStyles.institutionName}>{name}</Text>
                <Text style={mockStyles.institutionSub}>Sample Data</Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color="#C7C7CC" />
            </View>
          ))}
        </View>
      </View>
      <View style={mockStyles.lightSearchBar}>
        <Ionicons name="search" size={12} color="#8E8E93" />
        <Text style={mockStyles.lightSearchPlaceholder}>Hospitals, Networks, or Location…</Text>
      </View>
    </LightFrame>
  )
}

// ---------------------------------------------------------------------------
// Step 4 — Share Health Records (institution added)
// ---------------------------------------------------------------------------
function ShareAddedMockup() {
  return (
    <DarkFrame backLabel="Health">
      <DarkNavBar counter="1 of 4" />
      <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
        <Text style={mockStyles.iosTitle}>Share Health Records</Text>
        <Text style={mockStyles.iosSubtitle}>
          Add your provider accounts to grant "CareCompanion" access to the requested health records.
        </Text>
        <View style={mockStyles.darkList}>
          <View style={[mockStyles.darkRow, mockStyles.darkRowBorder]}>
            <View style={mockStyles.institutionAvatarDark}>
              <Text style={mockStyles.institutionAvatarText}>S</Text>
            </View>
            <Text style={mockStyles.darkRowText}>Sample Location A</Text>
            <Ionicons name="chevron-forward" size={11} color="rgba(255,255,255,0.3)" />
          </View>
          <View style={mockStyles.darkRow}>
            <View style={mockStyles.addIconCircle}>
              <Ionicons name="add" size={13} color="#fff" />
            </View>
            <Text style={mockStyles.addAccountText}>Add Account</Text>
          </View>
        </View>
      </View>
      <View style={mockStyles.iosBottomBtn}>
        <View style={mockStyles.iosBlueBtn}>
          <Text style={mockStyles.iosBlueBtnText}>Next</Text>
        </View>
      </View>
    </DarkFrame>
  )
}

// ---------------------------------------------------------------------------
// Step 5 — Permission toggles
// ---------------------------------------------------------------------------
function PermissionsMockup() {
  const items = ['Allergies', 'Clinical Vitals', 'Conditions', 'Immunizations', 'Lab Results', 'Medications']
  return (
    <DarkFrame backLabel="Health">
      <DarkNavBar counter="3 of 4" />
      <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
        <Text style={mockStyles.sectionLabel}>Allow "CareCompanion" to read</Text>
        <View style={mockStyles.darkList}>
          {items.map((label, i) => (
            <View key={i} style={[mockStyles.toggleRow, i < items.length - 1 && mockStyles.darkRowBorder]}>
              <Text style={mockStyles.toggleLabel}>{label}</Text>
              <View style={mockStyles.toggleOn}>
                <View style={mockStyles.toggleThumb} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={mockStyles.iosBottomBtn}>
        <View style={mockStyles.iosBlueBtn}>
          <Text style={mockStyles.iosBlueBtnText}>Share</Text>
        </View>
        <View style={[mockStyles.iosBlueBtn, { backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 5 }]}>
          <Text style={[mockStyles.iosBlueBtnText, { color: 'rgba(255,255,255,0.6)' }]}>Don't Share</Text>
        </View>
      </View>
    </DarkFrame>
  )
}

// ---------------------------------------------------------------------------
// Step 6 — New Health Records Requests (auto-share)
// ---------------------------------------------------------------------------
function AutoShareMockup() {
  return (
    <DarkFrame backLabel="Health">
      <DarkNavBar counter="4 of 4" />
      <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
        <Text style={mockStyles.iosTitle}>New Health Records Requests</Text>
        <Text style={mockStyles.iosSubtitle}>How would you like to share new records?</Text>
        <View style={mockStyles.darkList}>
          <View style={[mockStyles.darkRow, mockStyles.darkRowBorder]}>
            <Text style={mockStyles.darkRowText}>Ask Before Sharing</Text>
          </View>
          <View style={mockStyles.darkRow}>
            <Text style={mockStyles.darkRowText}>Automatically Share</Text>
            <Ionicons name="checkmark" size={13} color="#007AFF" />
          </View>
        </View>
        <Text style={mockStyles.autoShareNote}>
          "CareCompanion" will automatically receive access to new records.
        </Text>
      </View>
      <View style={mockStyles.iosBottomBtn}>
        <View style={mockStyles.iosBlueBtn}>
          <Text style={mockStyles.iosBlueBtnText}>Done</Text>
        </View>
      </View>
    </DarkFrame>
  )
}

const MOCKUP_MAP = {
  shareEmpty: ShareEmptyMockup,
  getStarted: GetStartedMockup,
  searchInstitution: SearchInstitutionMockup,
  shareAdded: ShareAddedMockup,
  permissions: PermissionsMockup,
  autoShare: AutoShareMockup,
} as const

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function HealthConnectScreen() {
  const router = useRouter()
  const { reconnect } = useLocalSearchParams<{ reconnect?: string }>()
  const isReconnect = reconnect === '1'
  const { refetch } = useProfile()
  const { markOnboarded } = useRecordsContext()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' })
  const [lastSyncedAt, setLastSyncedAtState] = useState<number | null>(null)
  const [, setNowMs] = useState(Date.now())
  const successScale = useSharedValue(0)

  useEffect(() => {
    const unsub = subscribeSyncState((s) => {
      setSyncState(s)
      if (s.status === 'success') setLastSyncedAtState(s.at)
    })
    getLastSyncedAt().then(setLastSyncedAtState)
    // Re-render every minute so the relative timestamp stays fresh.
    const interval = setInterval(() => setNowMs(Date.now()), 60_000)
    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [])

  const lastSyncedLabel = formatLastSynced(lastSyncedAt)
  const syncStatusLine: string | null = (() => {
    if (syncState.status === 'syncing') return 'Syncing…'
    if (syncState.status === 'retrying') return `Retrying (attempt ${syncState.attempt}/5)…`
    if (syncState.status === 'error') return syncState.userActionable ? syncState.message : 'Sync failed — will retry'
    if (lastSyncedAt) return `Last synced ${lastSyncedLabel}`
    return null
  })()

  const isLastStep = activeIndex === TUTORIAL_STEPS.length - 1

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x
    const index = Math.round(offsetX / SCREEN_WIDTH)
    setActiveIndex(Math.max(0, Math.min(index, TUTORIAL_STEPS.length - 1)))
  }, [])

  function goToStep(index: number) {
    scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * index, animated: true })
    setActiveIndex(index)
  }

  function handleNext() {
    if (activeIndex < TUTORIAL_STEPS.length - 1) {
      goToStep(activeIndex + 1)
    }
  }

  async function handleConnect() {
    setRequesting(true)
    // Hard timeout — if native bridge hangs (stale build, simulator quirk) we
    // still flip to the success state and let the user proceed.
    const hardTimeout = setTimeout(() => {
      console.warn('[HealthKit] connect hard-timeout')
      setPermissionGranted(true)
      successScale.value = withSpring(1, { damping: 10, stiffness: 150 })
      setTimeout(() => {
        if (isReconnect) {
          router.back()
        } else {
          markOnboarded()
          router.replace('/(tabs)')
        }
      }, 2000)
    }, 6000)
    try {
      const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
          ),
        ])

      try {
        await withTimeout(requestHealthKitPermissions(), 4000, 'requestAuthorization')
      } catch (err) {
        console.warn('[HealthKit] permission request timed out / failed:', err)
        // Proceed in __DEV__ so success screen + nav still work.
        if (!__DEV__) {
          clearTimeout(hardTimeout)
          setRequesting(false)
          return
        }
      }

      try {
        await withTimeout(requestWellnessPermissions(), 4000, 'requestWellnessAuthorization')
      } catch (err) {
        console.warn('[HealthKit] wellness permission timed out / failed:', err)
      }

      await markHealthKitConnected()

      try {
        await withTimeout(replaceHealthKitData(), 4000, 'replaceHealthKitData')
      } catch (err) {
        console.warn('[HealthKit] replace timed out / failed:', err)
      }

      void refetch().catch(() => {})
      void syncCalendar()

      clearTimeout(hardTimeout)
      setPermissionGranted(true)
      successScale.value = withSpring(1, { damping: 10, stiffness: 150 })
      setTimeout(() => {
        if (isReconnect) {
          router.back()
        } else {
          markOnboarded()
          router.replace('/(tabs)')
        }
      }, 2000)
    } catch (err) {
      clearTimeout(hardTimeout)
      console.warn('[HealthKit] connect failed:', err)
      setRequesting(false)
    }
  }

  async function syncCalendar() {
    try {
      const granted = await requestCalendarPermissions()
      if (!granted) return
      const { csrfToken } = await apiClient.csrfToken()
      await syncMedicalCalendarEvents(csrfToken)
    } catch (err) {
      console.warn('[Calendar] sync failed:', err)
    }
  }

  const successStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successScale.value,
  }))

  // Success overlay
  if (permissionGranted) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#05060F', '#0C0E1A', '#12143A', '#0C0E1A']}
          locations={[0, 0.3, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.successContainer}>
          <Animated.View style={[styles.successCircle, successStyle]}>
            <LinearGradient
              colors={['#6366F1', '#A78BFA']}
              style={styles.successGradient}
            >
              <Ionicons name="checkmark" size={60} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Animated.Text
            entering={FadeIn.duration(400).delay(300)}
            style={styles.successTitle}
          >
            Connected!
          </Animated.Text>
          <Animated.Text
            entering={FadeIn.duration(400).delay(500)}
            style={styles.successSubtitle}
          >
            {isReconnect ? 'Your health records have been re-synced' : 'Your health records will sync automatically'}
          </Animated.Text>
          {isReconnect && (
            <Animated.View entering={FadeIn.duration(400).delay(700)}>
              <Pressable
                onPress={() => Linking.openURL('x-apple-health://')}
                style={styles.openHealthBtn}
              >
                <Ionicons name="heart-circle-outline" size={16} color="#A78BFA" />
                <Text style={styles.openHealthText}>Open Apple Health to change data sources</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </View>
    )
  }

  const renderStep = (item: TutorialStep) => {
    const MockupComponent = MOCKUP_MAP[item.mockup]
    return (
      <View key={item.step} style={styles.stepPage}>
        <View style={styles.stepCard}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Step {item.step}</Text>
          </View>
          <View style={styles.mockupContainer}>
            <MockupComponent />
          </View>
          <Text style={styles.stepInstruction}>{item.instruction}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#05060F', '#0C0E1A', '#12143A', '#0C0E1A']}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow */}
      <View pointerEvents="none" style={styles.glowOrb1} />
      <View pointerEvents="none" style={styles.glowOrb2} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.closeButton}>
          <BlurView intensity={20} tint="dark" style={styles.closeBlur}>
            <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.7)" />
          </BlurView>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>Connect Health</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Title section */}
      <Animated.View entering={FadeIn.duration(400).delay(100)} style={styles.titleSection}>
        <View style={styles.titleIconWrap}>
          <LinearGradient
            colors={['rgba(99,102,241,0.2)', 'rgba(167,139,250,0.1)']}
            style={styles.titleIconBg}
          >
            <Ionicons name="heart-circle" size={32} color="#A78BFA" />
          </LinearGradient>
        </View>
        <Text style={styles.title}>Connect Your Health Records</Text>
        <Text style={styles.subtitle}>
          Follow these steps to link your health records from Apple Health
        </Text>
        {syncStatusLine ? (
          <View style={styles.syncStatusChip}>
            <View
              style={[
                styles.syncDot,
                syncState.status === 'syncing' && { backgroundColor: '#FBBF24' },
                syncState.status === 'retrying' && { backgroundColor: '#F59E0B' },
                syncState.status === 'error' && { backgroundColor: '#F87171' },
                syncState.status === 'success' && { backgroundColor: '#34D399' },
              ]}
            />
            <Text style={styles.syncStatusText}>{syncStatusLine}</Text>
          </View>
        ) : null}
      </Animated.View>

      {/* Swipeable tutorial */}
      <Animated.View entering={FadeInDown.duration(400).delay(200)} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {TUTORIAL_STEPS.map(renderStep)}
        </ScrollView>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {TUTORIAL_STEPS.map((_, i) => (
            <Pressable key={i} onPress={() => goToStep(i)}>
              <View
                style={[
                  styles.dot,
                  i === activeIndex && styles.dotActive,
                ]}
              />
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Bottom */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {isLastStep ? (
          <Pressable
            onPress={handleConnect}
            disabled={requesting}
            style={({ pressed }) => [
              styles.connectButton,
              pressed && !requesting && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <LinearGradient
              colors={['#6366F1', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.connectGradient}
            >
              <Ionicons name="heart" size={20} color="#fff" />
              <Text style={styles.connectText}>
                {requesting ? 'Requesting Access...' : 'Connect Health'}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.connectButton,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <LinearGradient
              colors={['#6366F1', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.connectGradient}
            >
              <Text style={styles.connectText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        )}

        <Pressable onPress={() => router.back()} style={styles.skipLink}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Phone mockup styles
// ---------------------------------------------------------------------------

const mockStyles = StyleSheet.create({
  // ── shared frame ──────────────────────────────────────────────────────────
  phone: {
    width: CARD_WIDTH * 0.65,
    height: CARD_WIDTH * 0.95,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  statusTime: { color: '#fff', fontSize: 11, fontWeight: '600' },
  statusRight: { flexDirection: 'row', gap: 4 },

  // ── dark nav bar (steps 1, 4, 5, 6) ─────────────────────────────────────
  darkNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  darkNavBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkNavCounter: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },

  // ── dark-mode shared content ──────────────────────────────────────────────
  iosTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  iosSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 10, lineHeight: 14, marginBottom: 10 },
  emptyPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyPillText: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  iosBottomBtn: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  iosBlueBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  iosBlueBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // ── dark list (steps 4, 5, 6) ─────────────────────────────────────────────
  darkList: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  darkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  darkRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  darkRowText: { color: '#fff', fontSize: 11, flex: 1 },

  // step 4 — institution row
  institutionAvatarDark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAccountText: { color: '#fff', fontSize: 11, fontWeight: '500' },

  // step 5 — permission toggles
  sectionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleLabel: { color: '#fff', fontSize: 10, flex: 1 },
  toggleOn: {
    width: 26,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', alignSelf: 'flex-end' },

  // step 6 — auto-share note
  autoShareNote: { color: 'rgba(255,255,255,0.35)', fontSize: 9, lineHeight: 13, marginTop: 6 },

  // ── light-mode nav (steps 2, 3) ───────────────────────────────────────────
  lightNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  lightNavTitle: { color: '#000', fontSize: 13, fontWeight: '600' },
  lightNavCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // step 2 — "Get Started" card
  lightCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  healthRecordsIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightCardTitle: { color: '#000', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  lightCardBody: { color: '#666', fontSize: 9, lineHeight: 13 },
  lightCardLink: { color: '#007AFF', fontSize: 9, marginTop: 6, marginBottom: 8 },
  getStartedBtn: { backgroundColor: '#007AFF', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  getStartedBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  // step 3 — search screen
  lightSearchNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  lightCloseBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsLabel: { color: '#8E8E93', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  lightList: { backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden' },
  lightRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, gap: 8 },
  lightRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA' },
  institutionAvatar: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  institutionAvatarText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  institutionName: { color: '#000', fontSize: 10, fontWeight: '500' },
  institutionSub: { color: '#8E8E93', fontSize: 8 },
  lightSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    marginHorizontal: 10,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  lightSearchPlaceholder: { color: '#8E8E93', fontSize: 9 },
})

// ---------------------------------------------------------------------------
// Screen styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C0E1A' },
  glowOrb1: {
    position: 'absolute',
    top: '15%',
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
  glowOrb2: {
    position: 'absolute',
    bottom: '25%',
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(167,139,250,0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButton: { width: 36, height: 36 },
  closeBlur: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: { alignItems: 'center' },
  headerLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: 28,
    marginBottom: 16,
  },
  titleIconWrap: {
    marginBottom: 12,
  },
  titleIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  syncStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  syncStatusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  stepPage: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 28,
  },
  stepCard: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    alignItems: 'center',
  },
  stepBadge: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 16,
  },
  stepBadgeText: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mockupContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  stepInstruction: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    backgroundColor: '#6366F1',
    width: 24,
  },
  bottom: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  connectButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  connectGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  connectText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: 'rgba(167,139,250,0.85)',
    fontSize: 13,
  },
  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 28,
  },
  successGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  successSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  openHealthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  openHealthText: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '500',
  },
})
