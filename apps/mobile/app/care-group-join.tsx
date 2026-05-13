/**
 * Caregiver joins a patient's care group by 5-char code, OR falls back to
 * entering the patient's email to request join (in-app approval).
 *
 * Flow:
 *   /signup?type=caregiver → /care-group-join → /care-relationship → /(tabs)
 *
 * Plan: ~/.gstack/projects/aryanmotgi-CareCompanion/ceo-plans/2026-05-12-patient-caregiver-onboarding.md
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  AppState,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  interpolate,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '../src/services/api'
import { useProfile } from '../src/context/ProfileContext'
import { useCaregiverJoinedContext } from './_layout'
import { AuroraBackground, FloatingGlyphs, useDeviceTilt } from '../src/components/auth/AuthAtoms'

const ACCENT = '#818CF8'
const SAFE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'

type Mode = 'code' | 'email'

export default function CareGroupJoinScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { csrfToken, refetch } = useProfile()
  const { markJoined } = useCaregiverJoinedContext()

  const [mode, setMode] = useState<Mode>('code')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [wrongAttempts, setWrongAttempts] = useState(0)

  // Critical-gap fix part 1: refresh-on-foreground. If the patient approves
  // a pending join request while the app is backgrounded, we want to see
  // that on resume rather than leaving the caregiver stuck on this screen.
  // Polling /api/care-profiles on foreground tells AuthGate to re-evaluate.
  const appState = useRef(AppState.currentState)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        // Critical-gap fix: when the app comes back to foreground, refetch
        // the profile so AuthGate sees any server-side care-group state
        // change (patient approved a join request, code rotated, etc.).
        refetch().catch(() => {})
      }
      appState.current = next
    })
    return () => sub.remove()
  }, [refetch])

  const onChangeCode = useCallback((text: string) => {
    // Strip everything except safe-alphabet characters; uppercase as we go.
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const filtered = cleaned.split('').filter((c) => SAFE_ALPHABET.includes(c)).join('')
    setCode(filtered.slice(0, 5))
    setError(null)
  }, [])

  const handleSubmitCode = useCallback(async () => {
    if (!csrfToken || submitting || code.length !== 5) return
    setSubmitting(true)
    setError(null)
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
      const result = await apiClient.careGroup.joinByCode(code, 'other', csrfToken)
      // Push to /care-relationship for photo-verify + relationship picker.
      router.replace({
        pathname: '/care-relationship',
        params: {
          careGroupId: result.careGroupId,
          patientName: result.patientName ?? '',
        },
      } as any)
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      const msg = err instanceof Error ? err.message : String(err)
      setWrongAttempts((n) => n + 1)
      setError(msg.includes('didn') ? "That code didn't work. Double-check with the patient." : msg)
    } finally {
      setSubmitting(false)
    }
  }, [code, csrfToken, submitting, router])

  const handleSubmitEmail = useCallback(async () => {
    if (!csrfToken || submitting || !email.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await apiClient.careGroup.requestJoinByEmail(email.trim(), csrfToken)
      setEmailSent(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }, [email, csrfToken, submitting])

  // Entry animations
  const iconScale = useSharedValue(0.6)
  const iconPulse = useSharedValue(0)
  const titleOp = useSharedValue(0)
  const titleY = useSharedValue(16)
  const formOp = useSharedValue(0)
  const formY = useSharedValue(20)
  const { tx, ty } = useDeviceTilt()

  useEffect(() => {
    iconScale.value = withSpring(1, { damping: 10, stiffness: 140 })
    iconPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    )
    titleOp.value = withDelay(200, withTiming(1, { duration: 500 }))
    titleY.value = withDelay(200, withTiming(0, { duration: 500 }))
    formOp.value = withDelay(400, withTiming(1, { duration: 500 }))
    formY.value = withDelay(400, withTiming(0, { duration: 500 }))
    return () => { cancelAnimation(iconScale); cancelAnimation(iconPulse); cancelAnimation(titleOp); cancelAnimation(titleY); cancelAnimation(formOp); cancelAnimation(formY) }
  }, [iconScale, iconPulse, titleOp, titleY, formOp, formY])

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { translateX: tx.value * 8 },
      { translateY: ty.value * 8 },
    ],
  }))
  const iconRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(iconPulse.value, [0, 1], [0.6, 0]),
    transform: [{ scale: interpolate(iconPulse.value, [0, 1], [1, 1.4]) }],
  }))
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOp.value,
    transform: [{ translateY: titleY.value }],
  }))
  const formStyle = useAnimatedStyle(() => ({
    opacity: formOp.value,
    transform: [{ translateY: formY.value }],
  }))

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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.iconBubble, iconStyle]}>
            <Animated.View style={[styles.iconRing, iconRingStyle]} />
            <LinearGradient
              colors={['#A78BFA', '#818CF8', '#22D3EE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="people" size={36} color="white" />
          </Animated.View>

          <Animated.View style={titleStyle}>
            <Text style={styles.title}>Join your patient's care circle</Text>
            <Text style={styles.subtitle}>
              {mode === 'code'
                ? "Enter the 5-character code the patient shared with you."
                : "Enter the patient's email. They'll approve your request from their app."}
            </Text>
          </Animated.View>

          <Animated.View style={[{ width: '100%' }, formStyle]}>
          {mode === 'code' ? (
            <>
              <TextInput
                value={formatCodeDisplay(code)}
                onChangeText={onChangeCode}
                placeholder="AK-7QM"
                placeholderTextColor="#FFFFFF55"
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                style={styles.codeInput}
                maxLength={6} // "XX-XXX" = 6 chars including hyphen
              />

              {error && <Text style={styles.error}>{error}</Text>}

              {wrongAttempts >= 3 && (
                <View style={styles.hintCard}>
                  <Ionicons name="information-circle" size={18} color={ACCENT} />
                  <Text style={styles.hintText}>
                    Stuck? Ask the patient to open Settings → Care Group → Rotate Code to send you a fresh one.
                  </Text>
                </View>
              )}

              <Pressable
                onPress={handleSubmitCode}
                disabled={submitting || code.length !== 5}
                style={({ pressed }) => [
                  styles.cta,
                  { opacity: pressed || submitting || code.length !== 5 ? 0.6 : 1 },
                ]}
              >
                <LinearGradient
                  colors={['#A78BFA', '#818CF8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.ctaText}>Continue</Text>}
              </Pressable>

              <Pressable onPress={() => { setMode('email'); setError(null) }} style={styles.altLink}>
                <Text style={styles.altLinkText}>Don't have a code? <Text style={styles.altLinkBold}>Use patient's email instead</Text></Text>
              </Pressable>
            </>
          ) : emailSent ? (
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={48} color="#34D399" />
              <Text style={styles.successTitle}>Request sent</Text>
              <Text style={styles.successBody}>
                If that email matches a CareCompanion patient, they'll see your request and can approve it from their Settings.
                Pull down to refresh or come back later — we'll show you their care circle the moment they approve.
              </Text>
              <Pressable onPress={() => { setMode('code'); setEmailSent(false) }} style={styles.altLink}>
                <Text style={styles.altLinkText}>Got a code now? <Text style={styles.altLinkBold}>Enter code instead</Text></Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                value={email}
                onChangeText={(t) => { setEmail(t); setError(null) }}
                placeholder="patient@example.com"
                placeholderTextColor="#FFFFFF55"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.emailInput}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                onPress={handleSubmitEmail}
                disabled={submitting || !email.trim()}
                style={({ pressed }) => [
                  styles.cta,
                  { opacity: pressed || submitting || !email.trim() ? 0.6 : 1 },
                ]}
              >
                <LinearGradient
                  colors={['#A78BFA', '#818CF8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.ctaText}>Request to join</Text>}
              </Pressable>

              <Pressable onPress={() => { setMode('code'); setError(null) }} style={styles.altLink}>
                <Text style={styles.altLinkText}>Have a code? <Text style={styles.altLinkBold}>Enter code instead</Text></Text>
              </Pressable>
            </>
          )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

function formatCodeDisplay(code: string): string {
  if (code.length <= 2) return code
  return `${code.slice(0, 2)}-${code.slice(2)}`
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  backBtn: { position: 'absolute', left: 12, zIndex: 10, padding: 8 },
  content: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'center' },
  iconBubble: {
    width: 88, height: 88, borderRadius: 24,
    overflow: 'visible',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  iconRing: {
    position: 'absolute',
    width: 88, height: 88, borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#A78BFA',
  },
  title: {
    color: 'white', fontSize: 26, fontWeight: '800',
    letterSpacing: -0.6, textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    color: '#FFFFFFB0', fontSize: 15, lineHeight: 22,
    textAlign: 'center', marginBottom: 28,
  },
  codeInput: {
    width: '100%',
    height: 76,
    backgroundColor: '#FFFFFF0A',
    borderWidth: 1,
    borderColor: ACCENT + '55',
    borderRadius: 18,
    color: 'white',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 16,
  },
  emailInput: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF0A',
    borderWidth: 1,
    borderColor: ACCENT + '55',
    borderRadius: 14,
    color: 'white',
    fontSize: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  error: { color: '#F87171', fontSize: 14, marginBottom: 14, textAlign: 'center' },
  hintCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: ACCENT + '15',
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  hintText: { flex: 1, color: '#FFFFFFD0', fontSize: 13, lineHeight: 18 },
  cta: {
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  ctaText: { color: 'white', fontSize: 16, fontWeight: '700' },
  altLink: { marginTop: 18, paddingVertical: 10 },
  altLinkText: { color: '#FFFFFFAA', fontSize: 14, textAlign: 'center' },
  altLinkBold: { color: ACCENT, fontWeight: '700' },
  successCard: { alignItems: 'center', gap: 14 },
  successTitle: { color: 'white', fontSize: 22, fontWeight: '800' },
  successBody: { color: '#FFFFFFB0', fontSize: 14, lineHeight: 22, textAlign: 'center', paddingHorizontal: 8 },
})
