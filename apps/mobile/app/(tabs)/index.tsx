// apps/mobile/app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ViewStyle,
} from 'react-native'
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
import { useTheme } from '../../src/theme'
import { GlassCard } from '../../src/components/GlassCard'
import { AmbientOrbs } from '../../src/components/AmbientOrbs'
import { AnimatedCounter } from '../../src/components/AnimatedCounter'
import { Drawer } from '../../src/components/Drawer'
import { syncHealthKitData } from '../../src/services/healthkit'
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
import { ShimmerSkeleton } from '../../src/components/ShimmerSkeleton'
import { TabFadeWrapper } from './_layout'

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

  const medCount = 3
  const medTaken = 1
  const medRemaining = medCount - medTaken

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
              <Text style={[styles.name, { color: theme.text }]}>Aryan</Text>
            </View>
            <Pressable onPress={() => setDrawerOpen(true)}>
              <LinearGradient colors={['#6366F1', '#A78BFA']} style={styles.avatar}>
                <Text style={styles.avatarText}>A</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Cards at 0.6x parallax */}
          <Animated.View style={cardParallaxStyle}>
            {/* Medications card */}
            {!loaded ? (
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
                        value={medRemaining}
                        style={{ ...styles.badgeText, color: theme.accent }}
                        suffix=" left"
                      />
                    </View>
                  </View>
                  <View style={styles.medRow}>
                    <View style={[styles.dot, { backgroundColor: theme.green }]} />
                    <Text style={[styles.medName, { color: theme.text }]}>Tamoxifen 20mg</Text>
                    <Text style={[styles.medTime, { color: theme.textMuted }]}>8:00 AM ✓</Text>
                  </View>
                  <View style={styles.medRow}>
                    <View style={[styles.dot, { backgroundColor: theme.amber }]} />
                    <Text style={[styles.medName, { color: theme.text }]}>Ondansetron 4mg</Text>
                    <Text style={[styles.medTime, { color: theme.textMuted }]}>2:00 PM</Text>
                  </View>
                  <View style={styles.medRow}>
                    <View style={[styles.dot, { backgroundColor: theme.amber }]} />
                    <Text style={[styles.medName, { color: theme.text }]}>Dexamethasone 4mg</Text>
                    <Text style={[styles.medTime, { color: theme.textMuted }]}>8:00 PM</Text>
                  </View>
                </GlassCard>
              </Animated.View>
            )}

            {/* Appointment card */}
            <Animated.View style={card2Style}>
              <AnimatedBorderCard>
                <View style={{ padding: 16 }}>
                  <Text style={[styles.cardLabel, { color: theme.textMuted }]}>NEXT APPOINTMENT</Text>
                  <Text style={[styles.apptName, { color: theme.text }]}>Oncology Follow-up</Text>
                  <Text style={[styles.apptDoctor, { color: theme.textSub }]}>Dr. Sarah Chen</Text>
                  <Text style={[styles.apptTime, { color: theme.lavender }]}>Monday · 10:00 AM</Text>
                  <Text style={[styles.apptLocation, { color: theme.textMuted }]}>
                    UCSF Medical Center · Room 4B
                  </Text>
                </View>
              </AnimatedBorderCard>
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

        <Drawer
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          userName="Aryan"
          userRole="Patient"
        />
      </View>
    </TabFadeWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
})
