// apps/mobile/app/(tabs)/index.tsx
import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withRepeat,
  withTiming,
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
import { AmbientOrbs } from '../../src/components/AmbientOrbs'
import { Drawer } from '../../src/components/Drawer'
import { syncHealthKitData } from '../../src/services/healthkit'
import { Timeline } from '../../src/components/Timeline'
import { OnboardingJourney } from '../../src/components/OnboardingJourney'
import { useOnboardingState } from '../../src/hooks/useOnboardingState'
import { TabFadeWrapper } from './_layout'
import { useProfile } from '../../src/context/ProfileContext'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HomeScreen() {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [timelineEmpty, setTimelineEmpty] = useState(false)

  const { profile } = useProfile()
  const onboarding = useOnboardingState()

  const displayName = profile?.patientName?.trim() || profile?.displayName?.trim() || 'there'
  const isCaregiver = (profile as any)?.role === 'caregiver'
  const caregiverForName = (profile as any)?.caregiverForName?.trim() || null

  // Show onboarding when timeline is empty AND onboarding is not complete
  const showOnboarding = timelineEmpty && !onboarding.isComplete

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
      if (Math.abs(p - lastGradientP.value) < 0.008) return
      lastGradientP.value = p
      const c0 = interpolateColor(p, [0, 1], [theme.gradientA[0], theme.gradientB[0]])
      const c1 = interpolateColor(p, [0, 1], [theme.gradientA[1], theme.gradientB[1]])
      const c2 = interpolateColor(p, [0, 1], [theme.gradientA[2], theme.gradientB[2]])
      const c3 = interpolateColor(p, [0, 1], [theme.gradientA[3], theme.gradientB[3]])
      runOnJS(setGradientColors)([c0, c1, c2, c3])
    },
  )

  useEffect(() => {
    syncHealthKitData().catch(console.error)
  }, [])

  const handleTimelineEmpty = useCallback(() => {
    setTimelineEmpty(true)
  }, [])

  const handleTakeMedication = useCallback((item: any) => {
    // Navigate to care tab to mark medication as taken
    router.push('/(tabs)/care')
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

        {/* Background orbs */}
        <AmbientOrbs speedMultiplier={0.3} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 16, paddingBottom: 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with greeting */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.greeting, { color: theme.textMuted }]}>
                {getGreeting().toUpperCase()}
              </Text>
              <Text style={[styles.name, { color: theme.text }]}>
                {displayName}
                {isCaregiver && caregiverForName ? (
                  <Text style={[styles.caregiverSuffix, { color: theme.textMuted }]}>
                    {` \u2014 How is ${caregiverForName} doing?`}
                  </Text>
                ) : null}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Pressable onPress={() => router.push('/search')} hitSlop={8} style={styles.iconButton}>
                <Ionicons name="search-outline" size={22} color={theme.text} />
              </Pressable>
              <Pressable onPress={() => router.push('/notifications')} style={styles.iconButton}>
                <Ionicons name="notifications-outline" size={22} color={theme.text} />
              </Pressable>
              <Pressable onPress={() => setDrawerOpen(true)}>
                <LinearGradient colors={['#6366F1', '#A78BFA']} style={styles.avatar}>
                  <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          {/* Main content: Timeline or Onboarding */}
          {showOnboarding ? (
            <OnboardingJourney onboarding={onboarding} />
          ) : (
            <Timeline
              onEmpty={handleTimelineEmpty}
              onTakeMedication={handleTakeMedication}
            />
          )}
        </ScrollView>

        <Drawer
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          userName={displayName}
          userRole={isCaregiver ? 'Caregiver' : 'Patient'}
        />
      </View>
    </TabFadeWrapper>
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
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  greeting: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  caregiverSuffix: { fontSize: 15, fontWeight: '400' },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
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
})
