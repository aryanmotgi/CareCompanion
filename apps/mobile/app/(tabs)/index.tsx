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
import { syncHealthKitData } from '../../src/services/healthkit'
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
import { ShimmerSkeleton } from '../../src/components/ShimmerSkeleton'
import { TabFadeWrapper } from './_layout'
import { useProfile } from '../../src/context/ProfileContext'
import { useOnboardingState } from '../../src/hooks/useOnboardingState'
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

function AnimatedBorderCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const rotation = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) return
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [rotation, reduceMotion])

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: 1.5 }],
  }))

  return (
    <View style={[styles.borderCardOuter, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.borderCardGradientWrap, rotateStyle]}>
        <LinearGradient
          colors={[theme.accent, theme.lavender, theme.cyan, theme.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={[styles.borderCardInner, { backgroundColor: theme.isDark ? '#0C0E1A' : '#FAFAFA' }]}>
        {children}
      </View>
    </View>
  )
}

export default function HomeScreen() {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)

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
    ]).then(([medsData, apptsData]) => {
      setMeds((medsData as any[]) || [])
      setAppointments((apptsData as any[]) || [])
    }).catch(() => {
      // API may not be deployed yet or user not authenticated — fail silently
      // Data stays empty, empty states will render
    }).finally(() => {
      setDataLoading(false)
    })
  }, [profile?.careProfileId])

  const displayName = profile?.patientName?.trim() || profile?.displayName?.trim() || 'there'
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
    syncHealthKitData().catch(console.error)
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
          {/* Header */}
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

          {/* Cards at 0.6x parallax */}
          <Animated.View style={cardParallaxStyle}>
            {/* Medications card */}
            {!loaded || dataLoading ? (
              <Animated.View style={card1Style}>
                <GlassCard style={styles.card}>
                  <ShimmerSkeleton width="60%" height={12} style={{ marginBottom: 12 }} />
                  <ShimmerSkeleton width="100%" height={16} style={{ marginBottom: 8 }} />
                  <ShimmerSkeleton width="100%" height={16} style={{ marginBottom: 8 }} />
                  <ShimmerSkeleton width="80%" height={16} />
                </GlassCard>
              </Animated.View>
            ) : (
              <Animated.View style={card1Style}>
                <GlassCard style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardLabel, { color: theme.textMuted }]}>
                      TODAY'S MEDICATIONS
                    </Text>
                    <View style={[styles.badge, { backgroundColor: 'rgba(99,102,241,0.2)' }]}>
                      <AnimatedCounter
                        value={medCount}
                        style={{ ...styles.badgeText, color: theme.accent }}
                        suffix={medCount === 1 ? ' med' : ' meds'}
                      />
                    </View>
                  </View>
                  {meds.length === 0 ? (
                    <Text style={[styles.medName, { color: theme.textMuted }]}>No medications yet</Text>
                  ) : (
                    meds.map((med) => (
                      <View key={med.id} style={styles.medRow}>
                        <View style={[styles.dot, { backgroundColor: theme.amber }]} />
                        <Text style={[styles.medName, { color: theme.text }]}>
                          {med.name}{med.dose ? ` ${med.dose}` : ''}
                        </Text>
                        <Text style={[styles.medTime, { color: theme.textMuted }]}>
                          {med.frequency || ''}
                        </Text>
                      </View>
                    ))
                  )}
                </GlassCard>
              </Animated.View>
            )}

            {/* Profile completion card */}
            {showProfileCard && (
              <GlassCard style={styles.card}>
                <View style={styles.profileCardHeader}>
                  <View style={styles.profileCardTop}>
                    <View style={styles.profileRing}>
                      <Text style={[styles.profileRingText, { color: theme.accent }]}>
                        {profilePercent}%
                      </Text>
                    </View>
                    <View style={styles.profileCardInfo}>
                      <Text style={[styles.profileCardTitle, { color: theme.text }]}>
                        Complete your profile
                      </Text>
                      <Text style={[styles.profileCardSub, { color: theme.textMuted }]}>
                        {profileRemaining.length} item{profileRemaining.length !== 1 ? 's' : ''} remaining for a full profile
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={handleDismissProfile} hitSlop={12}>
                    <Text style={[styles.profileDismiss, { color: theme.textMuted }]}>✕</Text>
                  </Pressable>
                </View>
                {profileRemaining.slice(0, 3).map((item) => (
                  <Pressable
                    key={item.key}
                    style={styles.profileRow}
                    onPress={() => Linking.openURL('https://carecompanionai.org/onboarding')}
                  >
                    <Text style={[styles.profileRowText, { color: theme.text }]}>{item.label}</Text>
                    <Text style={[styles.profileChevron, { color: theme.textMuted }]}>›</Text>
                  </Pressable>
                ))}
              </GlassCard>
            )}

            {/* Appointment card */}
            <Animated.View style={card2Style}>
              {dataLoading ? (
                <AnimatedBorderCard>
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
                  <AnimatedBorderCard>
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

            {/* AI CTA card */}
            <View style={theme.shadowGlowViolet}>
              <Animated.View style={card3Style}>
                <Pressable onPress={() => router.push('/(tabs)/chat')}>
                  <AnimatedBorderCard>
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
                </Pressable>
              </Animated.View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Floating onboarding nudge */}
        <OnboardingNudge />

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

/** Floating 3D pill that nudges user to complete onboarding */
function OnboardingNudge() {
  const theme = useTheme()
  const onboarding = useOnboardingState()
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const pulseAnim = useSharedValue(0)
  const expandAnim = useSharedValue(0)

  useEffect(() => {
    // Gentle pulse glow
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [pulseAnim])

  useEffect(() => {
    expandAnim.value = withSpring(expanded ? 1 : 0, { damping: 15, stiffness: 150 })
  }, [expanded, expandAnim])

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + pulseAnim.value * 0.03 },
      { perspective: 800 },
      { rotateX: `${pulseAnim.value * 2}deg` },
    ],
    shadowOpacity: 0.3 + pulseAnim.value * 0.2,
  }))

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: expandAnim.value,
    maxHeight: expandAnim.value * 300,
    transform: [{ translateY: (1 - expandAnim.value) * 20 }],
  }))

  if (onboarding.isComplete || dismissed) return null

  const progress = onboarding.completedCount / onboarding.totalCount
  const nextStep = onboarding.steps.find(s => !s.completed)

  const stepRoutes: Record<string, string> = {
    medications: '/(tabs)/chat',
    insurance: '/(tabs)/scan',
    careTeam: '/(tabs)/settings',
    cancerType: '/(tabs)/settings',
    treatmentPhase: '/(tabs)/settings',
    firstChat: '/(tabs)/chat',
    healthSummary: '/(tabs)/chat',
  }

  return (
    <Animated.View style={[styles.nudgeContainer, pillStyle]}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <LinearGradient
          colors={['rgba(99,102,241,0.9)', 'rgba(167,139,250,0.9)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.nudgePill}
        >
          {/* Progress ring */}
          <View style={styles.nudgeRing}>
            <Text style={styles.nudgeRingText}>
              {onboarding.completedCount}/{onboarding.totalCount}
            </Text>
          </View>
          <View style={styles.nudgeTextWrap}>
            <Text style={styles.nudgeTitle}>Finish setup</Text>
            <Text style={styles.nudgeSub}>
              {Math.round(progress * 100)}% complete
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-up'}
            size={16}
            color="rgba(255,255,255,0.7)"
          />
        </LinearGradient>
      </Pressable>

      {/* Expanded panel */}
      <Animated.View style={[styles.nudgeExpanded, expandedStyle]}>
        {expanded && nextStep && (
          <View style={styles.nudgePanel}>
            <Text style={[styles.nudgeStepTitle, { color: theme.text }]}>
              Next: {nextStep.title}
            </Text>
            <Text style={[styles.nudgeStepDesc, { color: theme.textMuted }]}>
              {nextStep.description}
            </Text>
            <Pressable
              style={styles.nudgeAction}
              onPress={() => {
                setExpanded(false)
                const route = stepRoutes[nextStep.key] || '/(tabs)/care'
                router.push(route as any)
              }}
            >
              <Text style={styles.nudgeActionText}>Start</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => setDismissed(true)}
              style={styles.nudgeDismiss}
            >
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>Dismiss</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
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
  borderCardOuter: { borderRadius: 15, overflow: 'hidden', marginBottom: 12 },
  borderCardGradientWrap: { alignItems: 'center', justifyContent: 'center' },
  borderCardInner: { margin: 1.5, borderRadius: 14, overflow: 'hidden' },
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
  nudgeContainer: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    right: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    shadowOpacity: 0.4,
    elevation: 12,
    zIndex: 100,
  },
  nudgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  nudgeRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  nudgeRingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  nudgeTextWrap: {
    flex: 1,
  },
  nudgeTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  nudgeSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 1,
  },
  nudgeExpanded: {
    overflow: 'hidden',
  },
  nudgePanel: {
    backgroundColor: 'rgba(12,14,26,0.97)',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
    backdropFilter: 'blur(20px)',
  },
  nudgeStepTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  nudgeStepDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  nudgeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 8,
  },
  nudgeActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  nudgeDismiss: {
    alignItems: 'center',
    paddingVertical: 4,
  },
})
