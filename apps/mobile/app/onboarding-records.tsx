import React, { useState } from 'react'
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
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  requestHealthKitPermissions,
  markHealthKitConnected,
  syncHealthKitData,
} from '../src/services/healthkit'
import { useRecordsContext } from './_layout'

const ACCENT = '#818CF8'

export default function OnboardingRecordsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { markOnboarded } = useRecordsContext()
  const [requesting, setRequesting] = useState(false)

  async function handleConnect() {
    if (requesting) return
    setRequesting(true)
    try {
      // Apple's requestAuthorization returns success=true whenever iOS shows
      // the picker, regardless of what the user actually chose — Apple
      // deliberately hides clinical-record auth decisions for privacy. So
      // `granted` only tells us the dialog wasn't blocked by an error; it
      // does NOT tell us whether the user picked a provider.
      const granted = await requestHealthKitPermissions()
      if (!granted) return

      // Proxy for "did the user actually connect a provider": try to sync
      // clinical records. If any flow back, they picked a provider. Zero =
      // they cancelled the picker (or haven't completed provider sign-in
      // yet) and we keep them on this screen. No back door to /(tabs)
      // without real records.
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
      console.warn('[onboarding-records] HealthKit connect failed:', err)
      Alert.alert(
        'Could not connect Apple Health',
        'Please try again. If the problem persists, restart the app.'
      )
    } finally {
      setRequesting(false)
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#05060F', '#0F1130', '#05060F']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.orb, { top: -120, left: -100, backgroundColor: ACCENT, opacity: 0.18 }]} />
      <View style={[styles.orb, { bottom: -100, right: -80, backgroundColor: '#22D3EE', opacity: 0.1 }]} />

      <Pressable
        onPress={() => router.replace('/signup')}
        hitSlop={16}
        style={[styles.backBtn, { top: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={28} color="white" />
      </Pressable>

      <View style={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 16 }]}>
        <Animated.View entering={undefined} style={styles.iconBubble}>
          <LinearGradient
            colors={['#A78BFA', '#818CF8', '#22D3EE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="heart" size={40} color="white" />
        </Animated.View>

        <Text style={styles.title}>Connect your health records</Text>
        <Text style={styles.subtitle}>
          CareCompanion pulls medications, lab results, conditions, and care-team
          info directly from Apple Health so you don't have to enter them by hand.
        </Text>

        <View style={styles.bulletList}>
          <Bullet text="End-to-end encrypted on device" />
          <Bullet text="Never shared without your consent" />
          <Bullet text="Granular per-category permissions" />
        </View>

        <View style={styles.actions}>
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
        </View>
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
  orb: {
    position: 'absolute',
    width: 360, height: 360, borderRadius: 180,
  },
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
  iconBubble: {
    width: 96, height: 96, borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
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
  bulletList: { gap: 10, marginBottom: 40, alignSelf: 'stretch' },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulletDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: ACCENT + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  bulletText: { color: 'white', fontSize: 14, flex: 1 },

  actions: { width: '100%', gap: 14, alignSelf: 'stretch' },
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
})
