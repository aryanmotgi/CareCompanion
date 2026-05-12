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
      // Triggers Apple Health's full "Share Health Records" flow (Add Account →
      // provider portal). Works fully on real devices. On simulator the user
      // can dismiss/cancel and we still proceed — that's the only way to test
      // without a real hospital portal account.
      const granted = await requestHealthKitPermissions()
      if (granted) {
        await markHealthKitConnected().catch(() => {})
      }
      // Mark onboarded whether granted or not — they've been through the flow.
      markOnboarded()
      router.replace('/(tabs)')
    } catch (err) {
      console.warn('[onboarding-records] HealthKit request failed:', err)
      // Still let them through so they aren't stuck.
      markOnboarded()
      router.replace('/(tabs)')
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
