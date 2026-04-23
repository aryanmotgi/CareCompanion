import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
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
import { signInWithCredentials } from '../src/services/auth'

export default function SignupScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)

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

  async function handleSignup() {
    if (!displayName.trim()) {
      Alert.alert('Missing field', 'Please enter your display name.')
      return
    }
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.')
      return
    }
    if (!consent) {
      Alert.alert('Consent required', 'Please accept the Terms and Privacy Policy to continue.')
      return
    }

    try {
      setLoading(true)

      const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanion.app'
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          displayName: displayName.trim(),
          hipaaConsent: true,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Registration failed')
      }

      // Auto-login after registration
      await signInWithCredentials(email.trim().toLowerCase(), password)
      router.replace('/(tabs)')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-up failed'
      Alert.alert('Sign Up Failed', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={['#05060F', '#0C0E1A', '#05060F']} style={StyleSheet.absoluteFill} />
      <View style={[styles.orb, { top: -100, left: -80, backgroundColor: 'rgba(99,102,241,0.12)', width: 300, height: 300 }]} />
      <View style={[styles.orb, { bottom: 0, right: -80, backgroundColor: 'rgba(167,139,250,0.08)', width: 280, height: 280 }]} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.logoSection, logoStyle]}>
          <LinearGradient colors={['#6366F1', '#A78BFA']} style={styles.logoCube}>
            <View style={styles.logoHighlight} />
            <Text style={styles.logoHeart}>♥</Text>
          </LinearGradient>
          <Text style={styles.appName}>CareCompanion</Text>
          <Text style={styles.tagline}>Create your account</Text>
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['transparent', 'rgba(99,102,241,0.6)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.glowLine}
          />

          <Text style={styles.heading}>Sign Up</Text>

          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            returnKeyType="next"
          />

          <TextInput
            style={styles.input}
            placeholder="Password (min. 8 characters)"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignup}
          />

          {/* Consent checkbox */}
          <Pressable style={styles.consentRow} onPress={() => setConsent(!consent)}>
            <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
              {consent && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.consentText}>
              I agree to the Terms and Privacy Policy, and I understand CareCompanion will access and process my health information.
            </Text>
          </Pressable>

          <Pressable
            style={[styles.signInBtn, loading && { opacity: 0.6 }]}
            onPress={handleSignup}
            disabled={loading}
          >
            <LinearGradient
              colors={['#6366F1', '#A78BFA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signInGradient}
            >
              <Text style={styles.signInText}>
                {loading ? 'Creating account…' : 'Create Account'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => router.replace('/login')}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkHighlight}>Sign in</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  orb: { position: 'absolute', borderRadius: 9999 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
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
    gap: 14,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 60,
    elevation: 12,
  },
  glowLine: { height: 1, marginHorizontal: -24, marginTop: -24, marginBottom: 4 },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EDE9FE',
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    color: '#EDE9FE',
    fontSize: 15,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  consentText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.35)',
  },
  signInBtn: { borderRadius: 12, overflow: 'hidden' },
  signInGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  linkText: {
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  linkHighlight: {
    color: 'rgba(167,139,250,0.7)',
    textDecorationLine: 'underline',
  },
})
