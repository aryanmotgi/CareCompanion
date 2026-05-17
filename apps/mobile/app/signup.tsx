import React, { useEffect, useRef, useState } from 'react'
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
  Linking,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { signInWithCredentials } from '../src/services/auth'
import { signInWithApple, isAppleSignInAvailable } from '../src/services/apple-auth'
import { signInWithGoogle } from '../src/services/google-auth'
import { RippleButton } from '../src/components/RippleButton'
import { useTokenContext } from './_layout'
import {
  AuroraBackground,
  FloatingGlyphs,
  LogoBeam,
  FloatingInput,
  PasswordStrength,
  ConfirmMatch,
  SuccessOverlay,
  useDeviceTilt,
  useCapsHint,
  scorePassword,
} from '../src/components/auth/AuthAtoms'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

export default function SignupScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ role?: string; type?: string }>()
  const { markSignedIn } = useTokenContext()
  const role: 'caregiver' | 'patient' | 'self' =
    params.role === 'caregiver' || params.role === 'patient' ? params.role : 'self'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'apple' | 'google' | null>(null)
  const [appleAvailable, setAppleAvailable] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailExists, setEmailExists] = useState(false)
  const [emailChecking, setEmailChecking] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const emailRef = useRef<TextInput | null>(null)
  const passwordRef = useRef<TextInput | null>(null)
  const confirmRef = useRef<TextInput | null>(null)

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const emailValid = email.trim().length > 0 && emailRe.test(email.trim())
  const pwScore = scorePassword(password).score
  const passwordValid = pwScore >= 1
  const confirmValid = confirmPassword.length > 0 && password === confirmPassword
  const nameValid = displayName.trim().length > 0
  const formValid = nameValid && emailValid && !emailExists && passwordValid && confirmValid && consent
  const capsHint = useCapsHint(password)

  const { tx, ty } = useDeviceTilt()
  const cardTilt = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value * 6 },
      { translateY: ty.value * 6 },
    ],
  }))
  const logoTilt = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value * 14 },
      { translateY: ty.value * 14 },
    ],
  }))

  useEffect(() => {
    if (Platform.OS === 'ios') {
      isAppleSignInAvailable().then(setAppleAvailable)
    }
  }, [])

  // Debounced email-exists check (best-effort; silently ignores 404).
  useEffect(() => {
    if (!emailValid) { setEmailExists(false); return }
    setEmailChecking(true)
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/check-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        })
        if (res.ok) {
          const data = await res.json().catch(() => ({})) as { exists?: boolean }
          setEmailExists(!!data.exists)
        }
      } catch {
        // ignore — endpoint may not exist
      } finally {
        setEmailChecking(false)
      }
    }, 600)
    return () => { clearTimeout(id); setEmailChecking(false) }
  }, [email, emailValid])

  async function handleAppleSignIn() {
    try {
      setSocialLoading('apple')
      await signInWithApple()
      markSignedIn()
      router.replace('/care-type' as any)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Apple Sign-In failed'
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
      markSignedIn()
      router.replace('/care-type' as any)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Google Sign-In failed'
      Alert.alert('Google Sign-In Failed', msg)
    } finally {
      setSocialLoading(null)
    }
  }

  // Entry animations
  const logoOpacity = useSharedValue(0)
  const logoY = useSharedValue(20)
  const cardOpacity = useSharedValue(0)
  const cardY = useSharedValue(20)
  const fieldStagger = useSharedValue(0)
  const ctaShimmer = useSharedValue(0)

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
    logoY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) })
    cardOpacity.value = withDelay(150, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }))
    cardY.value = withDelay(150, withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) }))
    fieldStagger.value = withDelay(400, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }))
    ctaShimmer.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: 0 }),
          withDelay(2400, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    )
  }, [logoOpacity, logoY, cardOpacity, cardY, fieldStagger, ctaShimmer])

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoY.value }],
  }))
  const cardStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value, transform: [{ translateY: cardY.value }] }))
  const ctaShimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ctaShimmer.value, [0, 0.3, 0.7, 1], [0, 0.6, 0.6, 0]),
    transform: [{ translateX: interpolate(ctaShimmer.value, [0, 1], [-180, 280]) }],
  }))

  function useStaggeredField(index: number) {
    return useAnimatedStyle(() => {
      const start = index * 0.18
      const end = start + 0.35
      const t = Math.max(0, Math.min(1, (fieldStagger.value - start) / (end - start)))
      return {
        opacity: t,
        transform: [{ translateY: interpolate(t, [0, 1], [16, 0]) }],
      }
    })
  }
  const f0 = useStaggeredField(0)
  const f1 = useStaggeredField(1)
  const f2 = useStaggeredField(2)
  const f3 = useStaggeredField(3)

  async function handleSignup() {
    if (!displayName.trim()) {
      Alert.alert('Missing field', 'Please enter your name.')
      return
    }
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    if (!emailRe.test(email.trim())) {
      setEmailError('Invalid email format')
      return
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords don't match", 'Please make sure both password fields are the same.')
      return
    }
    if (!consent) {
      Alert.alert('Consent required', 'Please accept the Terms and Privacy Policy to continue.')
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          displayName: displayName.trim(),
          hipaaConsent: true,
          role,
        }),
      })

      if (!res.ok) {
        const data: any = await res.json().catch(() => ({}))
        const errStr =
          typeof data === 'string'
            ? data
            : typeof data?.error === 'string'
              ? data.error
              : typeof data?.error?.message === 'string'
                ? data.error.message
                : typeof data?.message === 'string'
                  ? data.message
                  : null
        throw new Error(errStr ?? 'Registration failed. Please try again.')
      }

      if (displayName.trim()) {
        await AsyncStorage.setItem('cc-display-name', displayName.trim()).catch(() => {})
      }
      await AsyncStorage.setItem('cc-tos-accepted', '1').catch(() => {})

      try {
        await signInWithCredentials(email.trim().toLowerCase(), password)
        // Don't markSignedIn() yet — doing it before navigation triggers AuthGate's
        // needsCareTypePick redirect immediately, which races with the explicit
        // router.replace below and causes a double-navigate glitch on care-type.
      } catch {
        // Auto-login best effort
      }

      // Success overlay before redirect — markSignedIn() fires with the navigate
      // so that when AuthGate re-renders with tokenState='present' we're already
      // on /care-type (where needsCareTypePick has its !onCareType guard).
      setShowSuccess(true)
      setTimeout(() => {
        router.replace('/care-type' as any)
        markSignedIn()
      }, 950)
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
      <AuroraBackground />
      <FloatingGlyphs />

      <Pressable
        onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/welcome' as any) }}
        hitSlop={16}
        style={{ position: 'absolute', left: 12, top: insets.top + 8, padding: 8, zIndex: 10 }}
      >
        <Ionicons name="chevron-back" size={28} color="white" />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.logoSection, logoStyle, logoTilt]}>
          <LogoBeam size={64} />
          <Text style={styles.appName}>CareCompanion</Text>
          <Text style={styles.tagline}>Create your account</Text>
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle, cardTilt]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['transparent', 'rgba(99,102,241,0.6)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.glowLine}
          />

          <Text style={styles.heading}>Sign Up</Text>

          {appleAvailable && (
            <Pressable
              style={styles.appleButton}
              onPress={handleAppleSignIn}
              disabled={socialLoading !== null || loading}
            >
              <Text style={styles.appleIcon}>{''}</Text>
              <Text style={styles.appleButtonText}>
                {socialLoading === 'apple' ? 'Signing up...' : 'Continue with Apple'}
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
              {socialLoading === 'google' ? 'Signing up...' : 'Continue with Google'}
            </Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Animated.View style={f0}>
            <FloatingInput
              label="Name"
              icon="person-outline"
              placeholder="Your name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              valid={nameValid}
            />
          </Animated.View>

          <Animated.View style={f1}>
            <FloatingInput
              label="Email"
              icon="mail-outline"
              placeholder="you@example.com"
              value={email}
              onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(null); if (emailExists) setEmailExists(false) }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              onBlur={() => { if (email.trim() && !emailValid) setEmailError('Invalid email format') }}
              valid={emailValid && !emailExists}
              error={emailError}
              inputRef={emailRef as React.MutableRefObject<unknown>}
              rightSlot={emailChecking ? (
                <Ionicons name="ellipsis-horizontal" size={16} color="rgba(255,255,255,0.4)" style={{ marginLeft: 4 }} />
              ) : null}
            />
            {emailExists && (
              <Pressable onPress={() => router.replace('/login' as any)} style={styles.emailExistsRow}>
                <Ionicons name="information-circle" size={14} color="#FCD34D" />
                <Text style={styles.emailExistsText}>
                  Already registered.{' '}
                  <Text style={styles.emailExistsLink}>Sign in instead</Text>
                </Text>
              </Pressable>
            )}
          </Animated.View>

          <Animated.View style={f2}>
            <FloatingInput
              label="Password"
              icon="lock-closed-outline"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              showSecureToggle
              autoComplete="new-password"
              textContentType="newPassword"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              inputRef={passwordRef as React.MutableRefObject<unknown>}
            />
            <PasswordStrength password={password} />
            {capsHint && (
              <View style={styles.capsRow}>
                <Ionicons name="arrow-up-circle" size={12} color="#FCD34D" />
                <Text style={styles.capsText}>Caps Lock seems on</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View style={f3}>
            <FloatingInput
              label="Confirm Password"
              icon="lock-closed-outline"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              showSecureToggle
              autoComplete="new-password"
              textContentType="newPassword"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSignup}
              error={confirmPassword.length > 0 && !confirmValid && password.length > 0 ? "Passwords don't match" : null}
              inputRef={confirmRef as React.MutableRefObject<unknown>}
            />
            <ConfirmMatch matched={confirmValid} />
          </Animated.View>

          <Pressable style={styles.consentRow} onPress={() => setConsent(!consent)}>
            <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
              {consent && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.consentText}>
              I agree to the{' '}
              <Text
                style={styles.consentLink}
                onPress={() => Linking.openURL('https://carecompanionai.org/terms')}
              >
                Terms of Service
              </Text>
              {' '}and Privacy Policy, and I understand CareCompanion will access and process my health information.
            </Text>
          </Pressable>

          <View style={styles.ctaWrap}>
            <RippleButton onPress={handleSignup} disabled={loading || !formValid}>
              <Text style={styles.signInText}>
                {loading ? 'Creating account…' : 'Create Account'}
              </Text>
            </RippleButton>
            <Animated.View pointerEvents="none" style={[styles.ctaShimmer, ctaShimmerStyle]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.45)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          <Pressable onPress={() => router.push('/login')}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkHighlight}>Sign in</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <SuccessOverlay visible={showSuccess} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#03040C' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 32,
  },
  logoSection: { alignItems: 'center', gap: 12, marginTop: 36 },
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
    color: 'rgba(255,255,255,0.45)',
  },
  consentLink: {
    color: '#A78BFA',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  ctaWrap: { position: 'relative', overflow: 'hidden', borderRadius: 12 },
  ctaShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
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
  emailExistsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginLeft: 4,
  },
  emailExistsText: {
    color: '#FCD34D',
    fontSize: 11,
  },
  emailExistsLink: {
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  capsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginLeft: 4,
  },
  capsText: {
    color: '#FCD34D',
    fontSize: 11,
  },
})
