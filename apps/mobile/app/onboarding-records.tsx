import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withDelay,
  withSequence,
  Easing,
  cancelAnimation,
  interpolate,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  requestHealthKitPermissions,
  markHealthKitConnected,
  syncHealthKitData,
} from '../src/services/healthkit'
import { useRecordsContext } from './_layout'
import { AuroraBackground, FloatingGlyphs } from '../src/components/auth/AuthAtoms'

const ACCENT = '#818CF8'

export default function OnboardingRecordsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { markOnboarded } = useRecordsContext()
  const [requesting, setRequesting] = useState(false)

  // Entry animations
  const iconScale = useSharedValue(0)
  const titleOpacity = useSharedValue(0)
  const subOpacity = useSharedValue(0)
  const bulletsOpacity = useSharedValue(0)
  const ctaOpacity = useSharedValue(0)
  const pulse = useSharedValue(0)

  useEffect(() => {
    iconScale.value = withDelay(80, withSpring(1, { damping: 11, stiffness: 110 }))
    titleOpacity.value = withDelay(240, withTiming(1, { duration: 500 }))
    subOpacity.value = withDelay(360, withTiming(1, { duration: 500 }))
    bulletsOpacity.value = withDelay(480, withTiming(1, { duration: 500 }))
    ctaOpacity.value = withDelay(620, withTiming(1, { duration: 500 }))
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    )
    return () => { cancelAnimation(pulse) }
  }, [iconScale, titleOpacity, subOpacity, bulletsOpacity, ctaOpacity, pulse])

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }))
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.2, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.9]) }],
  }))
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: interpolate(titleOpacity.value, [0, 1], [10, 0]) }],
  }))
  const subStyle = useAnimatedStyle(() => ({
    opacity: subOpacity.value,
    transform: [{ translateY: interpolate(subOpacity.value, [0, 1], [10, 0]) }],
  }))
  const bulletsStyle = useAnimatedStyle(() => ({
    opacity: bulletsOpacity.value,
    transform: [{ translateY: interpolate(bulletsOpacity.value, [0, 1], [10, 0]) }],
  }))
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: interpolate(ctaOpacity.value, [0, 1], [12, 0]) }],
  }))

  async function handleConnect() {
    if (requesting) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    setRequesting(true)
    try {
      const granted = await requestHealthKitPermissions()
      if (!granted) return

      const { synced } = await syncHealthKitData()
      if (synced === 0) {
        Alert.alert(
          'No health records found',
          __DEV__
            ? 'Simulator can\'t reach real provider portals. Use Skip (dev only) to bypass this screen for testing.'
            : 'Tap Connect Apple Health and select your healthcare provider. If you just added one, give it a moment to sync, then try again.',
          __DEV__
            ? [
                { text: 'Try Again', style: 'cancel' },
                {
                  text: 'Skip (dev only)',
                  onPress: () => {
                    markOnboarded()
                    router.replace('/(tabs)')
                  },
                },
              ]
            : [{ text: 'OK' }]
        )
        return
      }

      await markHealthKitConnected().catch(() => {})
      markOnboarded()
      router.replace('/(tabs)')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[onboarding-records] HealthKit connect failed:', msg, err)
      Alert.alert(
        'Could not connect Apple Health',
        __DEV__
          ? `Error: ${msg}\n\nSimulator usually can't reach real provider portals. Use Skip to bypass for testing.`
          : 'Please try again. If the problem persists, restart the app.',
        __DEV__
          ? [
              { text: 'Retry', style: 'cancel' },
              {
                text: 'Skip (dev only)',
                onPress: () => {
                  markOnboarded()
                  router.replace('/(tabs)')
                },
              },
            ]
          : [{ text: 'OK' }]
      )
    } finally {
      setRequesting(false)
    }
  }

  function handleSkip() {
    Alert.alert(
      'Skip for now?',
      'You can connect Apple Health any time from Settings. Some features (medication reminders, lab alerts) will be limited until then.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            Haptics.selectionAsync().catch(() => {})
            await AsyncStorage.setItem('cc-setup-skipped', '1').catch(() => {})
            markOnboarded()
            router.replace('/(tabs)')
          },
        },
      ],
    )
  }

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <FloatingGlyphs />

      <Pressable
        onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/care-type' as any) }}
        hitSlop={16}
        style={[styles.backBtn, { top: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={28} color="white" />
      </Pressable>

      <View style={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.pulseRing, pulseStyle]} />
          <Animated.View style={[styles.iconBubble, iconStyle]}>
            <LinearGradient
              colors={['#A78BFA', '#818CF8', '#22D3EE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="heart" size={40} color="white" />
          </Animated.View>
        </View>

        <Animated.Text style={[styles.title, titleStyle]}>Connect your health records</Animated.Text>
        <Animated.Text style={[styles.subtitle, subStyle]}>
          CareCompanion pulls medications, lab results, conditions, and care-team
          info directly from Apple Health so you don't have to enter them by hand.
        </Animated.Text>

        <Animated.View style={[styles.bulletList, bulletsStyle]}>
          <Bullet text="End-to-end encrypted on device" />
          <Bullet text="Never shared without your consent" />
          <Bullet text="Granular per-category permissions" />
        </Animated.View>

        <Animated.View style={[styles.actions, ctaStyle]}>
          <Pressable
            onPress={handleConnect}
            disabled={requesting}
            style={({ pressed }) => [
              styles.cta,
              { opacity: pressed || requesting ? 0.85 : 1 },
            ]}
          >
            <LinearGradient
              colors={['#A78BFA', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            {requesting ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="medkit" size={18} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.ctaText}>Connect Apple Health</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleSkip}
            disabled={requesting}
            style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot}>
        <Ionicons name="checkmark" size={12} color={ACCENT} />
      </View>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  backBtn: {
    position: 'absolute',
    left: 12,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: 96, height: 96,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  pulseRing: {
    position: 'absolute',
    width: 96, height: 96, borderRadius: 28,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  iconBubble: {
    width: 96, height: 96, borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#FFFFFFB0',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
  bulletList: { gap: 10, marginBottom: 32, alignSelf: 'stretch' },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulletDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: ACCENT + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  bulletText: { color: 'white', fontSize: 14, flex: 1 },

  actions: { width: '100%', gap: 10, alignSelf: 'stretch' },
  cta: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    minHeight: 54,
  },
  ctaText: { color: 'white', fontSize: 16, fontWeight: '700' },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  skipText: { color: '#FFFFFFAA', fontSize: 14, fontWeight: '600' },
})
