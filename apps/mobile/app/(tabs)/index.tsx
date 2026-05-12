// apps/mobile/app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  ViewStyle,
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
import { syncHealthKitData, isHealthKitConnected } from '../../src/services/healthkit'
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
import { ShimmerSkeleton } from '../../src/components/ShimmerSkeleton'
import { DailyAlertsCard } from '../../src/components/DailyAlertsCard'
import { TodaysMedicationsCard } from '../../src/components/TodaysMedicationsCard'
import { HomeTabPills, type HomeTab } from '../../src/components/home/HomeTabPills'
import { MyCarePanel } from '../../src/components/home/MyCarePanel'
import { HealthDataPanel } from '../../src/components/home/HealthDataPanel'
import { TabFadeWrapper } from './_layout'
import { useProfile } from '../../src/context/ProfileContext'
import { apiClient } from '../../src/services/api'

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
  const [activeTab, setActiveTab] = useState<HomeTab>('today')

  // --- Real data from API ---
  const { profile, loading: profileLoading } = useProfile()
  const [meds, setMeds] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!profile?.careProfileId) {
      setDataLoading(false)
      return
    }
    setDataLoading(true)
    Promise.all([
      apiClient.medications.list(profile.careProfileId),
      apiClient.appointments.list(profile.careProfileId),
    ]).then(([medsRaw, apptsRaw]) => {
      const medsData = Array.isArray(medsRaw) ? medsRaw : ((medsRaw as any)?.data ?? [])
      const apptsData = Array.isArray(apptsRaw) ? apptsRaw : ((apptsRaw as any)?.data ?? [])
      setMeds(medsData)
      setAppointments(apptsData)
    }).catch(() => {
      // API may not be deployed yet or user not authenticated — fail silently
      // Data stays empty, empty states will render
    }).finally(() => {
      setDataLoading(false)
    })
  }, [profile?.careProfileId])

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

  useEffect(() => {
    isHealthKitConnected().then((connected) => {
      if (connected) syncHealthKitData().catch(console.error)
    })
  }, [])

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
        >
          {/* Greeting */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: theme.textMuted }]}>
                {getGreeting().toUpperCase()}
              </Text>
              <Text style={[styles.name, { color: theme.text }]}>{displayName}</Text>
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

          {/* Today / My Care / Health Data segmented control */}
          <HomeTabPills active={activeTab} onChange={setActiveTab} todayCount={5} />

          {activeTab === 'myCare' && <MyCarePanel />}
          {activeTab === 'healthData' && <HealthDataPanel />}

          {/* Today panel — existing home content at 0.6x parallax */}
          {activeTab === 'today' && (
          <Animated.View style={cardParallaxStyle}>
            <Animated.View style={card1Style}>
              <DailyAlertsCard careProfileId={profile?.careProfileId} />
              <TodaysMedicationsCard meds={!loaded || dataLoading ? null : meds} />
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
                  <AnimatedBorderCard onPress={() => router.push('/appointments' as any)}>
                    <View style={{ padding: 16 }}>
                      <Text style={[styles.cardLabel, { color: theme.textMuted }]}>NEXT APPOINTMENT</Text>
                      {!nextAppt ? (
                        <Text style={[styles.apptName, { color: theme.textMuted }]}>No upcoming appointments</Text>
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

            {/* Timeline shortcut */}
            <Animated.View style={card3Style}>
              <GlassCard style={styles.card} onPress={() => router.push('/timeline' as any)}>
                <View style={styles.timelineRow}>
                  <View style={[styles.timelineIcon, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                    <Ionicons name="time-outline" size={20} color="#A78BFA" />
                  </View>
                  <View style={styles.timelineText}>
                    <Text style={[styles.ctaTitle, { color: theme.text, fontSize: 14 }]}>Care Timeline</Text>
                    <Text style={[styles.ctaSub, { color: theme.textMuted, fontSize: 12 }]}>
                      Medications, appointments & milestones
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </View>
              </GlassCard>
            </Animated.View>

            {/* Care Hub Radar shortcut */}
            <Animated.View style={card3Style}>
              <GlassCard style={styles.card} onPress={() => router.push('/care-hub' as any)}>
                <View style={styles.timelineRow}>
                  <View style={[styles.timelineIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                    <Ionicons name="pulse-outline" size={20} color="#6EE7B7" />
                  </View>
                  <View style={styles.timelineText}>
                    <Text style={[styles.ctaTitle, { color: theme.text, fontSize: 14 }]}>Care Hub Radar</Text>
                    <Text style={[styles.ctaSub, { color: theme.textMuted, fontSize: 12 }]}>
                      Symptom trends, insights & activity
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </View>
              </GlassCard>
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
          )}
        </ScrollView>

        <Drawer
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          userName={displayName}
          userRole="Patient"
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
})
