// apps/mobile/app/login.tsx
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { useRouter } from 'expo-router'
import { signInWithGoogle } from '../src/services/auth'

export default function LoginScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Stagger entrance animations
  const logoOpacity = useSharedValue(0)
  const logoY = useSharedValue(20)
  const cardOpacity = useSharedValue(0)
  const cardY = useSharedValue(20)

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
    logoY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) })
    cardOpacity.value = withDelay(150, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }))
    cardY.value = withDelay(150, withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) }))
  }, [logoOpacity, logoY, cardOpacity, cardY])

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value, transform: [{ translateY: logoY.value }] }))
  const cardStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value, transform: [{ translateY: cardY.value }] }))

  async function handleGoogle() {
    try {
      setLoading(true)
      await signInWithGoogle()
      router.replace('/(tabs)')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed'
      if (msg !== 'Sign-in cancelled') Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.root}>
      {/* Background */}
      <LinearGradient
        colors={['#05060F', '#0C0E1A', '#05060F']}
        style={StyleSheet.absoluteFill}
      />
      {/* Glow orbs */}
      <View style={[styles.orb, { top: -100, left: -80, backgroundColor: 'rgba(99,102,241,0.12)', width: 300, height: 300 }]} />
      <View style={[styles.orb, { bottom: 0, right: -80, backgroundColor: 'rgba(167,139,250,0.08)', width: 280, height: 280 }]} />

      <View style={styles.content}>
        {/* Logo */}
        <Animated.View style={[styles.logoSection, logoStyle]}>
          <LinearGradient
            colors={['#6366F1', '#A78BFA']}
            style={styles.logoCube}
          >
            <View style={styles.logoHighlight} />
            <Text style={styles.logoHeart}>♥</Text>
          </LinearGradient>
          <Text style={styles.appName}>CareCompanion</Text>
          <Text style={styles.tagline}>AI Cancer Care</Text>
        </Animated.View>

        {/* Glass card */}
        <Animated.View style={[styles.card, cardStyle]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          {/* Top glow line */}
          <LinearGradient
            colors={['transparent', 'rgba(99,102,241,0.6)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.glowLine}
          />

          <Text style={styles.continueWith}>CONTINUE WITH</Text>

          <Pressable
            style={styles.googleBtn}
            onPress={handleGoogle}
            disabled={loading}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleText}>
              {loading ? 'Signing in…' : 'Continue with Google'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  orb: { position: 'absolute', borderRadius: 9999 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },
  logoSection: { alignItems: 'center', gap: 12 },
  logoCube: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  logoHighlight: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  logoHeart: { fontSize: 28, color: '#fff' },
  appName: { fontSize: 30, fontWeight: '700', color: '#EDE9FE' },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    padding: 24,
    gap: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 60,
    elevation: 12,
  },
  glowLine: { height: 1, marginHorizontal: -24, marginTop: -24, marginBottom: 8 },
  continueWith: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 14,
  },
  googleIcon: { fontSize: 18, fontWeight: '700', color: '#fff' },
  googleText: { fontSize: 15, fontWeight: '600', color: '#EDE9FE' },
})
