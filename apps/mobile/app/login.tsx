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
import { signInWithApple, isAppleSignInAvailable } from '../src/services/apple-auth'
import { signInWithGoogle } from '../src/services/google-auth'
import { RippleButton } from '../src/components/RippleButton'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'apple' | 'google' | null>(null)
  const [appleAvailable, setAppleAvailable] = useState(false)

  useEffect(() => {
    if (Platform.OS === 'ios') {
      isAppleSignInAvailable().then(setAppleAvailable)
    }
  }, [])

  async function handleAppleSignIn() {
    try {
      setSocialLoading('apple')
      await signInWithApple()
      router.replace('/(tabs)')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Apple Sign-In failed'
      // Don't show alert if user cancelled
      if (msg !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign-In Failed', msg)
      }
    } finally {
      setSocialLoading(null)
    }
  }

  async function handleGoogleSignIn() {
    try {
      setSocialLoading('google')
      await signInWithGoogle()
      router.replace('/(tabs)')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Google Sign-In failed'
      Alert.alert('Google Sign-In Failed', msg)
    } finally {
      setSocialLoading(null)
    }
  }

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

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    try {
      setLoading(true)
      await signInWithCredentials(email.trim().toLowerCase(), password)
      router.replace('/(tabs)')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed'
      Alert.alert('Sign In Failed', msg)
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

      <View style={styles.content}>
        <Animated.View style={[styles.logoSection, logoStyle]}>
          <LinearGradient colors={['#6366F1', '#A78BFA']} style={styles.logoCube}>
            <View style={styles.logoHighlight} />
            <Text style={styles.logoHeart}>♥</Text>
          </LinearGradient>
          <Text style={styles.appName}>CareCompanion</Text>
          <Text style={styles.tagline}>AI Cancer Care</Text>
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['transparent', 'rgba(99,102,241,0.6)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.glowLine}
          />

          <Text style={styles.heading}>Sign In</Text>

          {/* Social sign-in buttons */}
          {appleAvailable && (
            <Pressable
              style={styles.appleButton}
              onPress={handleAppleSignIn}
              disabled={socialLoading !== null || loading}
            >
              <Text style={styles.appleIcon}>{'\uF8FF'}</Text>
              <Text style={styles.appleButtonText}>
                {socialLoading === 'apple' ? 'Signing in...' : 'Continue with Apple'}
              </Text>
            </Pressable>
          )}

          <Pressable
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={socialLoading !== null || loading}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleButtonText}>
              {socialLoading === 'google' ? 'Signing in...' : 'Continue with Google'}
            </Text>
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

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
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
          />

          <RippleButton onPress={handleSignIn} disabled={loading}>
            <Text style={styles.signInText}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Text>
          </RippleButton>

          <Pressable onPress={() => router.replace('/signup')}>
            <Text style={styles.createAccountText}>
              Don't have an account? <Text style={styles.createAccountLink}>Create one</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
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
  signInText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  createAccountText: {
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  createAccountLink: {
    color: 'rgba(167,139,250,0.7)',
    textDecorationLine: 'underline',
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  appleIcon: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '600',
  },
  appleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    fontWeight: '500',
  },
})
