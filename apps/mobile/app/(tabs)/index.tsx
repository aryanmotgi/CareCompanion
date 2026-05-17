// apps/mobile/app/(tabs)/index.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  AppState,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  ViewStyle,
  RefreshControl,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withRepeat,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolateColor,
  runOnJS,
  useReducedMotion,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../src/theme'
import { GlassCard } from '../../src/components/GlassCard'
import { AmbientOrbs } from '../../src/components/AmbientOrbs'
import { AnimatedCounter } from '../../src/components/AnimatedCounter'
import { Drawer } from '../../src/components/Drawer'
import { RoleBadge } from '../../src/components/RoleBadge'
import { syncHealthKitData, isHealthKitConnected, DEV_STORE_MEDS_KEY, DEV_STORE_LABS_KEY } from '../../src/services/healthkit'
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
import { ShimmerSkeleton } from '../../src/components/ShimmerSkeleton'
import { DailyAlertsCard } from '../../src/components/DailyAlertsCard'
import { TodaysMedicationsCard } from '../../src/components/TodaysMedicationsCard'
import { CheckInModal } from '../../src/components/home/CheckInModal'
import { DiagnosisPill } from '../../src/components/DiagnosisPill'
import { TabFadeWrapper } from './_layout'
import { useProfile } from '../../src/context/ProfileContext'
import { apiClient } from '../../src/services/api'

const NEW_LABS_KEY = 'cc-new-labs-count'
const LAST_CHECKIN_KEY = 'cc-last-checkin-date'

type NudgeType = 'appointment' | 'abnormal_lab' | 'refill' | 'checkin'
type Nudge = {
  type: NudgeType
  title: string
  body: string
  cta: string
  prefill?: string
  action?: 'open_checkin'
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nudgeKey(type: NudgeType): string {
  return `cc-nudge-dismissed-${type}-${todayKey()}`
}

interface Profile {
  patientName?: string
  displayName?: string
  cancerType?: string
  cancerStage?: string
  treatmentPhase?: string
  allergies?: string
  conditions?: string
  emergencyContactName?: string
  careProfileId?: string
  [key: string]: unknown
}

function computeCompletion(profile: Profile | null) {
  if (!profile) return { percent: 0, remaining: [] as { key: string; label: string; done: boolean }[] }
  const items = [
    { key: 'patientName', label: 'Set patient name', done: !!profile.patientName },
    { key: 'cancerType', label: 'Set cancer type', done: !!profile.cancerType },
    { key: 'cancerStage', label: 'Set cancer stage', done: !!profile.cancerStage },
    { key: 'treatmentPhase', label: 'Set treatment phase', done: !!profile.treatmentPhase },
    { key: 'allergies', label: 'Add allergies', done: !!profile.allergies },
    { key: 'conditions', label: 'Add conditions', done: !!profile.conditions },
    { key: 'emergencyContact', label: 'Set emergency contact', done: !!profile.emergencyContactName },
  ]
  const done = items.filter(i => i.done).length
  const percent = Math.round((done / items.length) * 100)
  const remaining = items.filter(i => !i.done)
  return { percent, remaining }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function AnimatedBorderCard({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const theme = useTheme()
  const pressed = useSharedValue(0)

  const glowStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(pressed.value, [0, 1], ['rgba(139,92,246,0.22)', 'rgba(139,92,246,0.8)']),
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: pressed.value * 14,
    shadowOpacity: pressed.value * 0.65,
  }))

  function onPressIn() {
    pressed.value = withTiming(1, { duration: 120 })
  }

  function onPressOut() {
    pressed.value = withTiming(0, { duration: 280 })
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.borderCardOuter, glowStyle, style]}>
        <View style={[styles.borderCardInner, { backgroundColor: theme.isDark ? '#0C0E1A' : '#FAFAFA' }]}>
          {children}
        </View>
      </Animated.View>
    </Pressable>
  )
}

export default function HomeScreen() {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  // --- Real data from API ---
  const { profile, loading: profileLoading, refetch } = useProfile()
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true)
    try { await refetch() } catch {/* swallow */}
    setRefreshing(false)
  }, [refetch])
  const [meds, setMeds] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [labs, setLabs] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [recordsVersion, setRecordsVersion] = useState(0)
  const [newLabsCount, setNewLabsCount] = useState(0)
  const [labBannerDismissed, setLabBannerDismissed] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [activeNudge, setActiveNudge] = useState<Nudge | null>(null)
  const [hkConnected, setHkConnected] = useState<boolean | null>(null)
  const [inviteBannerVisible, setInviteBannerVisible] = useState(false)

  const conditions = useMemo(() => {
    try { return JSON.parse(profile?.conditions ?? '[]') as { display: string }[] }
    catch { return [] }
  }, [profile?.conditions])

  useEffect(() => {
    if (!profile?.careProfileId) {
      if (__DEV__) {
        // No care profile yet — load from the local DEV store populated by
        // syncHealthKitData/replaceHealthKitData so the UI shows mock data.
        Promise.all([
          AsyncStorage.getItem(DEV_STORE_MEDS_KEY).then((v) => (v ? JSON.parse(v) : [])).catch(() => []),
          AsyncStorage.getItem(DEV_STORE_LABS_KEY).then((v) => (v ? JSON.parse(v) : [])).catch(() => []),
        ]).then(([devMeds, devLabs]) => {
          setMeds(devMeds)
          setLabs(devLabs)
        }).catch(() => {}).finally(() => setDataLoading(false))
      } else {
        setDataLoading(false)
      }
      return
    }
    let cancelled = false
    setDataLoading(true)
    Promise.all([
      apiClient.medications.list(profile.careProfileId),
      apiClient.appointments.list(profile.careProfileId),
      apiClient.labResults.list(profile.careProfileId).catch(() => [] as any),
    ]).then(([medsRaw, apptsRaw, labsRaw]) => {
      if (cancelled) return
      const medsData = Array.isArray(medsRaw) ? medsRaw : ((medsRaw as any)?.data ?? [])
      const apptsData = Array.isArray(apptsRaw) ? apptsRaw : ((apptsRaw as any)?.data ?? [])
      const labsData = Array.isArray(labsRaw) ? labsRaw : ((labsRaw as any)?.labs ?? (labsRaw as any)?.data ?? [])
      setMeds(medsData)
      setAppointments(apptsData)
      setLabs(labsData)
    }).catch(() => {
      // API may not be deployed yet or user not authenticated — fail silently
    }).finally(() => {
      if (!cancelled) setDataLoading(false)
    })
    return () => { cancelled = true }
  }, [profile?.careProfileId, recordsVersion])

  const handleRecordsSynced = React.useCallback(() => {
    setRecordsVersion((v) => v + 1)
  }, [])

  // Read persisted lab badge count for banner.
  useEffect(() => {
    AsyncStorage.getItem(NEW_LABS_KEY)
      .then((v) => {
        const n = v ? parseInt(v, 10) : 0
        setNewLabsCount(Number.isFinite(n) && n > 0 ? n : 0)
      })
      .catch(() => {})
  }, [recordsVersion])

  const [localDisplayName, setLocalDisplayName] = useState<string | null>(null)
  useEffect(() => {
    AsyncStorage.getItem('cc-display-name')
      .then((v) => { if (v) setLocalDisplayName(v) })
      .catch(() => {})
  }, [])
  const displayName =
    profile?.patientName?.trim() ||
    profile?.displayName?.trim() ||
    localDisplayName?.trim() ||
    'there'
  const medCount = meds.length

  // --- Profile completion tracker ---
  const { percent: profilePercent, remaining: profileRemaining } = computeCompletion(profile as Profile | null)
  const [profileDismissed, setProfileDismissed] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('cc-profile-completion-dismissed').then(v => {
      if (v === 'true') setProfileDismissed(true)
    })
  }, [])

  const showProfileCard = !!profile && profilePercent < 100 && !profileDismissed

  const handleDismissProfile = () => {
    setProfileDismissed(true)
    AsyncStorage.setItem('cc-profile-completion-dismissed', 'true')
  }

  // --- Shimmer loading ---
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 400)
    return () => clearTimeout(t)
  }, [])

  // --- Gradient mesh ---
  const [gradientColors, setGradientColors] = useState<string[]>(theme.gradientA)
  const gradientProgress = useSharedValue(0)
  const lastGradientP = useSharedValue(-1)

  useEffect(() => {
    if (reduceMotion) return
    gradientProgress.value = withRepeat(
      withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [gradientProgress, reduceMotion])

  useAnimatedReaction(
    () => gradientProgress.value,
    (p) => {
      if (Math.abs(p - lastGradientP.value) < 0.008) return  // throttle to ~10fps
      lastGradientP.value = p
      const c0 = interpolateColor(p, [0, 1], [theme.gradientA[0], theme.gradientB[0]])
      const c1 = interpolateColor(p, [0, 1], [theme.gradientA[1], theme.gradientB[1]])
      const c2 = interpolateColor(p, [0, 1], [theme.gradientA[2], theme.gradientB[2]])
      const c3 = interpolateColor(p, [0, 1], [theme.gradientA[3], theme.gradientB[3]])
      runOnJS(setGradientColors)([c0, c1, c2, c3])
    },
  )

  // --- Gyroscope parallax for cards at 0.6x ---
  const { parallaxStyle: cardParallaxStyle } = useGyroParallax(0.6)

  // --- Card stagger entrance ---
  const card1Opacity = useSharedValue(0)
  const card1Y = useSharedValue(24)
  const card2Opacity = useSharedValue(0)
  const card2Y = useSharedValue(24)
  const card3Opacity = useSharedValue(0)
  const card3Y = useSharedValue(24)

  useEffect(() => {
    if (reduceMotion) {
      card1Opacity.value = 1
      card1Y.value = 0
      card2Opacity.value = 1
      card2Y.value = 0
      card3Opacity.value = 1
      card3Y.value = 0
      return
    }
    card1Opacity.value = withDelay(100, withSpring(1))
    card1Y.value = withDelay(100, withSpring(0))
    card2Opacity.value = withDelay(250, withSpring(1))
    card2Y.value = withDelay(250, withSpring(0))
    card3Opacity.value = withDelay(400, withSpring(1))
    card3Y.value = withDelay(400, withSpring(0))
  }, [card1Opacity, card1Y, card2Opacity, card2Y, card3Opacity, card3Y, reduceMotion])

  const card1Style = useAnimatedStyle(() => ({
    opacity: card1Opacity.value,
    transform: [{ translateY: card1Y.value }],
  }))
  const card2Style = useAnimatedStyle(() => ({
    opacity: card2Opacity.value,
    transform: [{ translateY: card2Y.value }],
  }))
  const card3Style = useAnimatedStyle(() => ({
    opacity: card3Opacity.value,
    transform: [{ translateY: card3Y.value }],
  }))

  // Track whether the user has connected Apple Health. Drives the persistent
  // "Connect Apple Health" banner — surfaced until cc-healthkit-connected is
  // set in AsyncStorage by /health-connect or syncHealthKitData().
  useEffect(() => {
    let cancelled = false
    const read = async () => {
      const v = await AsyncStorage.getItem('cc-healthkit-connected').catch(() => null)
      if (!cancelled) setHkConnected(v === '1')
    }
    void read()
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void read()
    })
    return () => { cancelled = true; sub.remove() }
  }, [recordsVersion, refreshing])

  // Surface an invite-your-family banner for users who own a care group but
  // haven't tapped through the share step yet (mostly returning users whose
  // onboarding completed before /share-invite shipped). Hidden once they
  // either dismiss explicitly OR finish the share flow (which sets
  // cc-invite-shown=1 itself).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const shown = await AsyncStorage.getItem('cc-invite-shown').catch(() => null)
      if (cancelled) return
      if (shown === '1') { setInviteBannerVisible(false); return }
      try {
        const { groups } = await apiClient.careGroup.mine()
        if (cancelled) return
        const owned = groups.find((g) => g.isOwner)
        setInviteBannerVisible(!!owned)
      } catch {
        if (!cancelled) setInviteBannerVisible(false)
      }
    })()
    return () => { cancelled = true }
  }, [recordsVersion])

  // Sync HealthKit on mount and diff labs to surface "new results" banner + tab
  // badge. We snapshot lab IDs before the sync, run the sync, refetch labs, and
  // count IDs we hadn't seen before.
  useEffect(() => {
    let cancelled = false
    isHealthKitConnected().then(async (connected) => {
      if (!connected || !profile?.careProfileId) return
      const cpid = profile.careProfileId
      let beforeIds = new Set<string>()
      try {
        const raw = await apiClient.labResults.list(cpid)
        const arr = Array.isArray(raw) ? raw : ((raw as any)?.labs ?? (raw as any)?.data ?? [])
        beforeIds = new Set(arr.map((l: any) => String(l.healthkitFhirId ?? l.healthkit_fhir_id ?? l.id)))
      } catch {/* swallow */}

      try {
        await syncHealthKitData()
      } catch (err) {
        console.error(err)
        return
      }

      try {
        const rawAfter = await apiClient.labResults.list(cpid)
        const afterArr = Array.isArray(rawAfter) ? rawAfter : ((rawAfter as any)?.labs ?? (rawAfter as any)?.data ?? [])
        const newCount = afterArr.filter((l: any) => {
          const id = String(l.healthkitFhirId ?? l.healthkit_fhir_id ?? l.id)
          return !beforeIds.has(id)
        }).length
        if (cancelled) return
        if (newCount > 0) {
          await AsyncStorage.setItem(NEW_LABS_KEY, String(newCount)).catch(() => {})
          setNewLabsCount(newCount)
          setLabBannerDismissed(false)
        }
        setRecordsVersion((v) => v + 1)
      } catch {/* swallow */}
    })
    return () => { cancelled = true }
  }, [profile?.careProfileId])

  // ── Proactive nudge evaluation ─────────────────────────────────────────────
  // Re-runs whenever home data changes or app foregrounds. Picks the
  // highest-priority nudge that hasn't been dismissed today.
  const evaluateNudges = React.useCallback(async () => {
    const nowMs = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    type Candidate = { type: NudgeType; build: () => Nudge }
    const candidates: Candidate[] = []

    // 1. Appointment within 24h
    const upcomingAppt = appointments
      .filter((a: any) => a?.dateTime)
      .map((a: any) => ({ ...a, ts: new Date(a.dateTime).getTime() }))
      .filter((a: any) => a.ts >= nowMs && a.ts <= nowMs + dayMs)
      .sort((a: any, b: any) => a.ts - b.ts)[0]
    if (upcomingAppt) {
      candidates.push({
        type: 'appointment',
        build: () => ({
          type: 'appointment',
          title: 'Appointment tomorrow',
          body: `${upcomingAppt.purpose || upcomingAppt.specialty || 'Your visit'} with ${upcomingAppt.doctorName ?? 'your provider'}. Want me to prep questions?`,
          cta: 'Prep with AI',
          prefill: `Help me prepare for my appointment ${upcomingAppt.doctorName ? 'with ' + upcomingAppt.doctorName : ''}. The visit is for ${upcomingAppt.purpose || upcomingAppt.specialty || 'follow-up'}.`,
        }),
      })
    }

    // 2. Abnormal lab
    const abnormalLab = labs.find((l: any) => (l?.isAbnormal ?? l?.is_abnormal))
    if (abnormalLab) {
      candidates.push({
        type: 'abnormal_lab',
        build: () => ({
          type: 'abnormal_lab',
          title: 'Abnormal lab result',
          body: `${abnormalLab.testName ?? abnormalLab.test_name ?? 'A lab'} came back outside the normal range. Want me to explain it?`,
          cta: 'Explain it',
          prefill: `Explain my recent ${abnormalLab.testName ?? abnormalLab.test_name} result of ${abnormalLab.value ?? ''}${abnormalLab.unit ? ' ' + abnormalLab.unit : ''} in plain language. Reference range: ${abnormalLab.referenceRange ?? abnormalLab.reference_range ?? 'unknown'}.`,
        }),
      })
    }

    // 3. Refill within 3 days
    const refillingMed = meds.find((m: any) => {
      const r = m?.refillDate ?? m?.refill_date
      if (!r) return false
      const ts = new Date(r.length === 10 ? r + 'T00:00:00' : r).getTime()
      return Number.isFinite(ts) && ts - nowMs <= 3 * dayMs && ts - nowMs >= -dayMs
    })
    if (refillingMed) {
      candidates.push({
        type: 'refill',
        build: () => ({
          type: 'refill',
          title: 'Refill coming up',
          body: `${refillingMed.name} needs refilling soon. Want help requesting it?`,
          cta: 'Help me refill',
          prefill: `Help me request a refill for ${refillingMed.name}${refillingMed.dose ? ' (' + refillingMed.dose + ')' : ''}. What should I say to the pharmacy or my doctor?`,
        }),
      })
    }

    // 4. No check-in today
    const lastCheckin = await AsyncStorage.getItem(LAST_CHECKIN_KEY).catch(() => null)
    if (lastCheckin !== todayKey()) {
      candidates.push({
        type: 'checkin',
        build: () => ({
          type: 'checkin',
          title: 'Daily check-in',
          body: 'How are you feeling today? A quick check-in keeps the AI in tune with your trends.',
          cta: 'Check in',
          action: 'open_checkin',
        }),
      })
    }

    // Pick the first that hasn't been dismissed today.
    for (const c of candidates) {
      const dismissed = await AsyncStorage.getItem(nudgeKey(c.type)).catch(() => null)
      if (dismissed !== '1') {
        setActiveNudge(c.build())
        return
      }
    }
    setActiveNudge(null)
  }, [appointments, labs, meds])

  useEffect(() => {
    if (dataLoading) return
    void evaluateNudges()
  }, [evaluateNudges, dataLoading])

  // Re-evaluate on app foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void evaluateNudges()
    })
    return () => sub.remove()
  }, [evaluateNudges])

  const dismissNudge = React.useCallback((nudge: Nudge) => {
    AsyncStorage.setItem(nudgeKey(nudge.type), '1').catch(() => {})
    setActiveNudge(null)
  }, [])

  const handleNudgeAction = React.useCallback((nudge: Nudge) => {
    if (nudge.action === 'open_checkin') {
      setCheckInOpen(true)
      return
    }
    if (nudge.prefill) {
      router.push({ pathname: '/(tabs)/chat', params: { prefill: nudge.prefill } } as any)
    }
  }, [router])

  return (
    <TabFadeWrapper>
      <View style={styles.root}>
        {/* Animated gradient mesh */}
        <LinearGradient
          colors={gradientColors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Background orbs — 0.3x parallax */}
        <AmbientOrbs speedMultiplier={0.3} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 16, paddingBottom: 120 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
        >
          {/* Greeting */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: theme.textMuted }]}>
                {getGreeting().toUpperCase()}
              </Text>
              <Text style={[styles.name, { color: theme.text }]}>{displayName}</Text>
              <RoleBadge style={{ marginTop: 4 }} />
              {conditions.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {conditions.slice(0, 2).map((c) => (
                    <DiagnosisPill key={c.display} label={c.display} />
                  ))}
                  {conditions.length > 2 && <DiagnosisPill label={`+${conditions.length - 2}`} />}
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              <Pressable onPress={() => router.push('/search')} hitSlop={8} style={styles.bellButton}>
                <Ionicons name="search-outline" size={22} color={theme.text} />
              </Pressable>
              <Pressable onPress={() => router.push('/notifications')} style={styles.bellButton}>
                <Ionicons name="notifications-outline" size={22} color={theme.text} />
              </Pressable>
              <Pressable onPress={() => setDrawerOpen(true)}>
                <LinearGradient colors={['#6366F1', '#A78BFA']} style={styles.avatar}>
                  <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          {/* New labs banner */}
          {newLabsCount > 0 && !labBannerDismissed && (
            <View style={styles.newLabsBanner}>
              <View style={styles.newLabsIconWrap}>
                <Ionicons name="pulse" size={20} color="#A78BFA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.newLabsTitle, { color: theme.text }]}>
                  {newLabsCount} new lab result{newLabsCount === 1 ? '' : 's'} from Apple Health
                </Text>
                <Text style={[styles.newLabsSub, { color: theme.textMuted }]}>
                  Review what synced from your provider.
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  AsyncStorage.removeItem(NEW_LABS_KEY).catch(() => {})
                  setNewLabsCount(0)
                  router.push('/(tabs)/labs' as any)
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: theme.accent,
                  opacity: pressed ? 0.8 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel="Review new lab results"
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Review</Text>
              </Pressable>
              <Pressable
                onPress={() => setLabBannerDismissed(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Dismiss new labs banner"
              >
                <Ionicons name="close" size={18} color={theme.textMuted} />
              </Pressable>
            </View>
          )}

          {/* Invite-your-care-circle banner — surfaced for owners who haven't
              completed the share step yet. */}
          {inviteBannerVisible && (
            <View style={styles.inviteHomeBanner}>
              <View style={styles.inviteHomeIconWrap}>
                <Ionicons name="people" size={20} color="#C084FC" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inviteHomeTitle, { color: theme.text }]}>
                  Invite your care circle
                </Text>
                <Text style={[styles.inviteHomeSub, { color: theme.textMuted }]}>
                  Share your code so family can join.
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/share-invite' as never)}
                style={({ pressed }) => [styles.inviteHomeBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.inviteHomeBtnText}>Share</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  AsyncStorage.setItem('cc-invite-shown', '1').catch(() => {})
                  setInviteBannerVisible(false)
                }}
                hitSlop={10}
                style={{ paddingHorizontal: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
              >
                <Ionicons name="close" size={16} color={theme.textMuted} />
              </Pressable>
            </View>
          )}

          {/* HealthKit connect banner (persistent until connected) */}
          {hkConnected === false && (
            <View style={styles.hkBanner}>
              <View style={styles.hkBannerIconWrap}>
                <Ionicons name="heart" size={20} color="#A78BFA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.hkBannerTitle, { color: theme.text }]}>
                  Connect Apple Health to sync your records
                </Text>
                <Text style={[styles.hkBannerSub, { color: theme.textMuted }]}>
                  Meds, labs, and vitals — auto-imported.
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/health-consent' as never)}
                style={({ pressed }) => [styles.hkConnectBtn, { opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Connect Apple Health"
              >
                <Text style={styles.hkConnectText}>Connect</Text>
              </Pressable>
            </View>
          )}

          {/* Proactive AI nudge */}
          {activeNudge && (
            <Pressable
              onPress={() => handleNudgeAction(activeNudge)}
              style={({ pressed }) => [styles.nudgeCard, { opacity: pressed ? 0.85 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={`${activeNudge.title}. ${activeNudge.body}`}
            >
              <View style={styles.nudgeIconWrap}>
                <Ionicons name="sparkles" size={18} color="#A78BFA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.nudgeTitle, { color: theme.text }]}>
                  {activeNudge.title}
                </Text>
                <Text style={[styles.nudgeBody, { color: theme.textMuted }]} numberOfLines={3}>
                  {activeNudge.body}
                </Text>
                <Text style={[styles.nudgeCta, { color: theme.accent }]}>
                  {activeNudge.cta} →
                </Text>
              </View>
              <Pressable
                onPress={(e) => { e.stopPropagation?.(); dismissNudge(activeNudge) }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Dismiss suggestion"
              >
                <Ionicons name="close" size={18} color={theme.textMuted} />
              </Pressable>
            </Pressable>
          )}

          {/* Today panel */}
          <Animated.View style={cardParallaxStyle}>
            <Animated.View style={card1Style}>
              <DailyAlertsCard careProfileId={profile?.careProfileId} />
              <TodaysMedicationsCard meds={!loaded || dataLoading ? null : meds} onSynced={handleRecordsSynced} />
            </Animated.View>

            {/* Appointment card */}
            <Animated.View style={card2Style}>
              {dataLoading ? (
                <AnimatedBorderCard onPress={() => router.push('/appointments' as any)}>
                  <View style={{ padding: 16 }}>
                    <ShimmerSkeleton width="50%" height={12} style={{ marginBottom: 12 }} />
                    <ShimmerSkeleton width="80%" height={16} style={{ marginBottom: 8 }} />
                    <ShimmerSkeleton width="60%" height={14} style={{ marginBottom: 8 }} />
                    <ShimmerSkeleton width="70%" height={14} />
                  </View>
                </AnimatedBorderCard>
              ) : (() => {
                const nextAppt = appointments
                  .filter((a) => a.dateTime)
                  .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
                  .find((a) => new Date(a.dateTime).getTime() >= Date.now()) || appointments[0]
                return (
                  <AnimatedBorderCard
                    onPress={() => {
                      if (nextAppt) {
                        router.push('/appointments' as any)
                      } else {
                        router.push({
                          pathname: '/(tabs)/chat',
                          params: { prefill: 'Help me prepare for my next oncology appointment — what questions should I bring?' },
                        } as any)
                      }
                    }}
                  >
                    <View style={{ padding: 16 }}>
                      <Text style={[styles.cardLabel, { color: theme.textMuted }]}>NEXT APPOINTMENT</Text>
                      {!nextAppt ? (
                        <View style={{ marginTop: 8 }}>
                          <Text style={[styles.apptName, { color: theme.text, marginBottom: 4 }]}>
                            Nothing scheduled yet
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <Ionicons name="sparkles-outline" size={14} color="#A78BFA" />
                            <Text style={{ color: '#A78BFA', fontSize: 13, fontWeight: '600' }}>
                              Ask AI: prep questions for your next visit
                            </Text>
                          </View>
                          <Pressable
                            onPress={(e) => { e.stopPropagation?.(); router.push('/appointments/new' as any) }}
                            hitSlop={8}
                            style={{ marginTop: 8, alignSelf: 'flex-start' }}
                          >
                            <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '600' }}>
                              Or add manually
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          <Text style={[styles.apptName, { color: theme.text }]}>
                            {nextAppt.purpose || nextAppt.specialty || 'Appointment'}
                          </Text>
                          {nextAppt.doctorName ? (
                            <Text style={[styles.apptDoctor, { color: theme.textSub }]}>{nextAppt.doctorName}</Text>
                          ) : null}
                          {nextAppt.dateTime ? (
                            <Text style={[styles.apptTime, { color: theme.lavender }]}>
                              {new Date(nextAppt.dateTime).toLocaleDateString(undefined, { weekday: 'long' })} · {new Date(nextAppt.dateTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                            </Text>
                          ) : null}
                          {nextAppt.location ? (
                            <Text style={[styles.apptLocation, { color: theme.textMuted }]}>
                              {nextAppt.location}
                            </Text>
                          ) : null}
                        </>
                      )}
                    </View>
                  </AnimatedBorderCard>
                )
              })()}
            </Animated.View>

            {/* AI CTA card */}
            <View style={theme.shadowGlowViolet}>
              <Animated.View style={card3Style}>
                <AnimatedBorderCard onPress={() => router.push('/(tabs)/chat')}>
                  <View style={{ padding: 16 }}>
                    <View style={styles.ctaRow}>
                      <Text style={styles.ctaIcon}>✨</Text>
                      <View style={styles.ctaText}>
                        <Text style={[styles.ctaTitle, { color: theme.text }]}>Ask your AI companion</Text>
                        <Text style={[styles.ctaSub, { color: theme.textMuted }]}>
                          Side effects, dosing questions, what to expect…
                        </Text>
                      </View>
                    </View>
                  </View>
                </AnimatedBorderCard>
              </Animated.View>
            </View>
          </Animated.View>
        </ScrollView>

        <Drawer
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          userName={displayName}
        />

        <CheckInModal
          visible={checkInOpen}
          onClose={() => setCheckInOpen(false)}
          onSubmit={() => {
            AsyncStorage.setItem(LAST_CHECKIN_KEY, todayKey()).catch(() => {})
            setActiveNudge((n) => (n?.type === 'checkin' ? null : n))
          }}
        />
      </View>
    </TabFadeWrapper>
  )
}

/**
 * "Care 18,246,731 Companion" — live cancer patient count embedded in the brand name.
 * Based on ~18.1M cancer survivors in the US (ACS 2024). Ticks up ~1 every 3 seconds
 * (roughly 2M new diagnoses per year ÷ 365 days ÷ 24 hours ÷ 1200 seconds).
 */
function LiveCancerCounter() {
  const theme = useTheme()
  // Base: ~18.1M US cancer survivors (American Cancer Society, 2024)
  // We start from a base and increment slowly to show it's "live"
  const BASE_COUNT = 18_246_731
  const [count, setCount] = useState(BASE_COUNT)

  useEffect(() => {
    // Increment by 1 every ~3 seconds (realistic: ~2M new cases/year)
    const interval = setInterval(() => {
      setCount(prev => prev + 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const formatted = count.toLocaleString()

  return (
    <View style={styles.counterContainer}>
      <Text style={styles.counterText}>
        <Text style={styles.counterBrand}>Care</Text>
        <Text style={styles.counterNumber}> {formatted} </Text>
        <Text style={styles.counterBrand}>Companion</Text>
      </Text>
      <Text style={styles.counterSub}>people living with cancer right now</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  counterContainer: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  counterText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    textAlign: 'center',
  },
  counterBrand: {
    fontSize: 15,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  counterNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#A78BFA',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'] as any,
  },
  counterSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  root: { flex: 1, overflow: 'hidden' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.1)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  card: { marginBottom: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  medName: { flex: 1, fontSize: 14, fontWeight: '600' },
  medTime: { fontSize: 12 },
  apptName: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 2 },
  apptDoctor: { fontSize: 14, marginBottom: 4 },
  apptTime: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  apptLocation: { fontSize: 12 },
  ctaRow: { flexDirection: 'row', alignItems: 'center' },
  ctaIcon: { fontSize: 24, marginRight: 12 },
  ctaText: { flex: 1 },
  ctaTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  ctaSub: { fontSize: 13, lineHeight: 18 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timelineIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  timelineText: { flex: 1 },
  borderCardOuter: { borderRadius: 15, marginBottom: 12, borderWidth: 1 },
  borderCardInner: { borderRadius: 14, overflow: 'hidden' },
  profileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  profileCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'rgba(99,102,241,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileRingText: {
    fontSize: 13,
    fontWeight: '700',
  },
  profileCardInfo: {
    flex: 1,
  },
  profileCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileCardSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  profileDismiss: {
    fontSize: 18,
    fontWeight: '600',
    paddingLeft: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  profileRowText: {
    fontSize: 14,
    fontWeight: '500',
  },
  profileChevron: {
    fontSize: 20,
    fontWeight: '600',
  },
  newLabsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.45)',
    backgroundColor: 'rgba(167,139,250,0.10)',
    marginBottom: 12,
  },
  newLabsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(167,139,250,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newLabsTitle: { fontSize: 14, fontWeight: '700' },
  newLabsSub: { fontSize: 12, marginTop: 2 },
  hkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.45)',
    backgroundColor: 'rgba(167,139,250,0.08)',
    marginBottom: 12,
  },
  hkBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(167,139,250,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hkBannerTitle: { fontSize: 14, fontWeight: '700' },
  hkBannerSub: { fontSize: 12, marginTop: 2 },
  hkConnectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#A78BFA',
  },
  hkConnectText: { color: 'white', fontSize: 13, fontWeight: '700' },
  inviteHomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.45)',
    backgroundColor: 'rgba(192,132,252,0.08)',
    marginBottom: 12,
  },
  inviteHomeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(192,132,252,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteHomeTitle: { fontSize: 14, fontWeight: '700' },
  inviteHomeSub: { fontSize: 12, marginTop: 2 },
  inviteHomeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#C084FC',
  },
  inviteHomeBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.4)',
    backgroundColor: 'rgba(99,102,241,0.08)',
    marginBottom: 12,
  },
  nudgeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(167,139,250,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeTitle: { fontSize: 14, fontWeight: '700' },
  nudgeBody: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  nudgeCta: { fontSize: 13, fontWeight: '700', marginTop: 8 },
})
