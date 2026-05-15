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
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { signInWithCredentials, signInWithCareGroup } from '../src/services/auth'
import { signInWithApple, isAppleSignInAvailable } from '../src/services/apple-auth'
import { signInWithGoogle } from '../src/services/google-auth'
import { RippleButton } from '../src/components/RippleButton'
import { useTokenContext } from './_layout'
import {
  AuroraBackground,
  FloatingGlyphs,
  LogoBeam,
  FloatingInput,
  SuccessOverlay,
  useDeviceTilt,
  useCapsHint,
} from '../src/components/auth/AuthAtoms'

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { markSignedIn } = useTokenContext()
  const [tab, setTab] = useState<'email' | 'care-group'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupPassword, setGroupPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'apple' | 'google' | null>(null)
  const [appleAvailable, setAppleAvailable] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [consent, setConsent] = useState(false)

  // Auto-check the consent box if the user has previously accepted (during
  // signup or a prior login). Keeps return users from re-tapping every visit.
  useEffect(() => {
    AsyncStorage.getItem('cc-tos-accepted')
      .then((v) => { if (v === '1') setConsent(true) })
      .catch(() => {})
  }, [])

  const passwordRef = useRef<TextInput | null>(null)
  const groupPwRef = useRef<TextInput | null>(null)

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const emailValid = email.trim().length > 0 && emailRe.test(email.trim())
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

  function handleSocialError(provider: 'Apple' | 'Google', e: unknown) {
    const err = e as Error & { code?: string; existingProvider?: string }
    const msg = err?.message ?? `${provider} Sign-In failed`
    if (msg === 'ERR_REQUEST_CANCELED') return
    if (err?.code === 'PASSWORD_ACCOUNT_EXISTS') {
      Alert.alert(
        'Use your password',
        'This email already has a password account. Sign in with your password, then link ' + provider + ' from settings.',
      )
      return
    }
    if (err?.code === 'PROVIDER_MISMATCH') {
      const other = err.existingProvider ?? 'a different provider'
      Alert.alert(
        'Use a different sign-in',
        `This email is already linked to ${other}. Use that to sign in instead.`,
      )
      return
    }
    Alert.alert(`${provider} Sign-In Failed`, msg)
  }

  async function handleAppleSignIn() {
    if (!consent) {
      Alert.alert('Accept the Terms', 'Please accept the Terms of Service to continue.')
      return
    }
    try {
      setSocialLoading('apple')
      await AsyncStorage.setItem('cc-tos-accepted', '1').catch(() => {})
      await signInWithApple()
      markSignedIn()
      router.replace('/care-type' as never)
    } catch (e: unknown) {
      handleSocialError('Apple', e)
    } finally {
      setSocialLoading(null)
    }
  }

  async function handleGoogleSignIn() {
    if (!consent) {
      Alert.alert('Accept the Terms', 'Please accept the Terms of Service to continue.')
      return
    }
    try {
      setSocialLoading('google')
      await AsyncStorage.setItem('cc-tos-accepted', '1').catch(() => {})
      await signInWithGoogle()
      markSignedIn()
      router.replace('/care-type' as never)
    } catch (e: unknown) {
      handleSocialError('Google', e)
    } finally {
      setSocialLoading(null)
    }
  }

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
    fieldStagger.value = withDelay(400, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }))
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
      const start = index * 0.2
      const end = start + 0.4
      const t = Math.max(0, Math.min(1, (fieldStagger.value - start) / (end - start)))
      return {
        opacity: t,
        transform: [{ translateY: interpolate(t, [0, 1], [16, 0]) }],
      }
    })
  }
  const f0 = useStaggeredField(0)
  const f1 = useStaggeredField(1)

  async function handleSignIn() {
    setError('')
    if (!consent) {
      setError('Please accept the Terms of Service to continue')
      return
    }
    try {
      setLoading(true)
      await AsyncStorage.setItem('cc-tos-accepted', '1').catch(() => {})
      if (tab === 'care-group') {
        if (!groupName.trim() || !groupPassword) {
          setError('Enter your Care Group name and password')
          return
        }
        await signInWithCareGroup(groupName, groupPassword)
        markSignedIn()
        setShowSuccess(true)
        setTimeout(() => router.replace('/(tabs)'), 800)
      } else {
        if (!email.trim() || !password) {
          setEmailError(!email.trim() ? 'Email required' : null)
          if (!password) setError('Password required')
          return
        }
        if (!emailValid) {
          setEmailError('Invalid email format')
          return
        }
        await signInWithCredentials(email.trim().toLowerCase(), password)
        markSignedIn()
        setShowSuccess(true)
        setTimeout(() => router.replace('/(tabs)'), 800)
      }
    } catch (e: unknown) {
      const err = e as Error & { code?: string; provider?: string }
      const msg = err?.message ?? 'Sign-in failed'
      if (tab === 'care-group') {
        setError(msg)
      } else if (err?.code === 'SOCIAL_ONLY') {
        const prov = err.provider
        const label = prov === 'apple' ? 'Apple' : prov === 'google' ? 'Google' : prov ?? 'a social provider'
        Alert.alert(
          `Use ${label} to sign in`,
          `This account uses ${label}. Use the "Continue with ${label}" button above instead.`,
        )
      } else {
        Alert.alert('Sign In Failed', msg)
      }
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

      {router.canGoBack() && (
        <Pressable
          onPress={() => router.back()}
          hitSlop={16}
          style={{ position: 'absolute', left: 12, top: insets.top + 8, padding: 8, zIndex: 10 }}
        >
          <Ionicons name="chevron-back" size={28} color="white" />
        </Pressable>
      )}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.logoSection, logoStyle, logoTilt]}>
          <LogoBeam size={64} />
          <Text style={styles.appName}>CareCompanion</Text>
          <Text style={styles.tagline}>AI Cancer Care</Text>
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle, cardTilt]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['transparent', 'rgba(99,102,241,0.6)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.glowLine}
          />

          <Text style={styles.heading}>Sign In</Text>

          <View style={styles.tabRow}>
            {(['email', 'care-group'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => { setTab(t); setError(''); setEmailError(null) }}
                style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'email' ? 'Email' : 'Care Group'}
                </Text>
              </Pressable>
            ))}
          </View>

          {appleAvailable && (
            <Pressable
              style={styles.appleButton}
              onPress={handleAppleSignIn}
              disabled={socialLoading !== null || loading}
            >
              <Text style={styles.appleIcon}>{''}</Text>
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

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {tab === 'email' ? (
            <>
              <Animated.View style={f0}>
                <FloatingInput
                  label="Email"
                  icon="mail-outline"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(null) }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  onBlur={() => { if (email.trim() && !emailValid) setEmailError('Invalid email format') }}
                  valid={emailValid}
                  error={emailError}
                />
              </Animated.View>

              <Animated.View style={f1}>
                <FloatingInput
                  label="Password"
                  icon="lock-closed-outline"
                  placeholder="Your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  showSecureToggle
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                  inputRef={passwordRef as React.MutableRefObject<unknown>}
                />
                {capsHint && (
                  <View style={styles.capsRow}>
                    <Ionicons name="arrow-up-circle" size={12} color="#FCD34D" />
                    <Text style={styles.capsText}>Caps Lock seems on</Text>
                  </View>
                )}
              </Animated.View>
            </>
          ) : (
            <>
              <Animated.View style={f0}>
                <FloatingInput
                  label="Care Group Name"
                  icon="people-outline"
                  placeholder="e.g. Smith Family"
                  value={groupName}
                  onChangeText={setGroupName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => groupPwRef.current?.focus()}
                />
              </Animated.View>

              <Animated.View style={f1}>
                <FloatingInput
                  label="Group Password"
                  icon="key-outline"
                  placeholder="Shared family password"
                  value={groupPassword}
                  onChangeText={setGroupPassword}
                  secureTextEntry
                  showSecureToggle
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                  error={error || null}
                  inputRef={groupPwRef as React.MutableRefObject<unknown>}
                />
              </Animated.View>
            </>
          )}

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
              .
            </Text>
          </Pressable>

          <View style={styles.ctaWrap}>
            <RippleButton onPress={handleSignIn} disabled={loading || !consent}>
              <Text style={styles.signInText}>
                {loading ? 'Signing in…' : 'Sign In'}
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

          <Pressable onPress={() => router.push('/signup' as never)}>
            <Text style={styles.createAccountText}>
              Don't have an account? <Text style={styles.createAccountLink}>Create one</Text>
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
  tabRow: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabBtnActive: { backgroundColor: '#7c3aed' },
  tabText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  tabTextActive: { color: '#fff' },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#A78BFA',
    borderColor: '#A78BFA',
  },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  consentText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.55)',
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
