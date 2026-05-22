/**
 * Post-onboarding share-invite step. Patient/self users land here after the
 * setup wizard completes — surfaces their 5-char invite code so they can
 * share it with family/caregivers right away (the biggest discoverability
 * gap pre this screen: code was buried in Settings → Care Group).
 *
 * Flow:
 *   /setup → /share-invite → /(tabs)
 *
 * Skipping persists 'cc-invite-shown' so the user is never bounced back.
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiClient } from '../src/services/api'
import { useProfile } from '../src/context/ProfileContext'
import { requestPermissions, scheduleDailyCheckin } from '../src/services/notifications'
import { OnboardingStepIndicator } from '../src/components/OnboardingStepIndicator'

const ACCENT = '#818CF8'
const INVITE_SHOWN_KEY = 'cc-invite-shown'

function formatCode(code: string): string {
  return code.length > 2 ? `${code.slice(0, 2)}-${code.slice(2)}` : code
}

export default function ShareInviteScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { csrfToken } = useProfile()

  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState<string | null>(null)
  const [careGroupId, setCareGroupId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const continueToTabs = useCallback(async () => {
    await AsyncStorage.setItem(INVITE_SHOWN_KEY, '1').catch(() => {})
    router.replace('/(tabs)' as never)
  }, [router])

  const loadCode = useCallback(async () => {
    setError(null)
    try {
      const { groups } = await apiClient.careGroup.mine()
      const owned = groups.find((g) => g.isOwner) ?? groups[0]
      if (!owned) {
        // No care group exists yet — nothing to share. Skip past silently
        // so we don't trap users who chose "skip" during /setup.
        await continueToTabs()
        return
      }
      setCareGroupId(owned.id)

      const current = await apiClient.careGroup.codeCurrent(owned.id).catch(() => ({ code: null as string | null }))
      if (current.code) {
        setCode(current.code)
        return
      }
      if (!csrfToken) {
        setError('Could not load your invite code. Try again from Settings.')
        return
      }
      const generated = await apiClient.careGroup.codeGenerate(owned.id, csrfToken)
      setCode(generated.code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [csrfToken, continueToTabs])

  useEffect(() => {
    void loadCode()
  }, [loadCode])

  // First-arrival nudge: ask for notification permission so the 8pm daily
  // check-in can actually fire. Tied to a one-shot AsyncStorage flag so we
  // don't re-prompt every time the user lands here.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const asked = await AsyncStorage.getItem('cc-notif-prompt-shown').catch(() => null)
      if (asked || cancelled) return
      const result = await requestPermissions()
      if (cancelled) return
      await AsyncStorage.setItem('cc-notif-prompt-shown', '1').catch(() => {})
      if (result === 'granted') {
        void scheduleDailyCheckin()
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleShare = useCallback(async () => {
    if (!code) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    const display = formatCode(code)
    const body = `Join my CareCompanion care circle. Download the app, choose "I'm a caregiver" and enter this code: ${display}`
    try {
      await Share.share({ message: body })
    } catch {
      // user dismissed sheet — ignore
    }
  }, [code])

  const handleRegenerate = useCallback(async () => {
    if (!careGroupId || !csrfToken) return
    Haptics.selectionAsync().catch(() => {})
    setLoading(true)
    try {
      const fresh = await apiClient.careGroup.codeRotate(careGroupId, csrfToken)
      setCode(fresh.code)
    } catch (err) {
      Alert.alert('Could not refresh', err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [careGroupId, csrfToken])

  const handleSkip = useCallback(() => {
    Alert.alert(
      'Share later?',
      'You can find your invite code any time under Settings → Care Group.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip for now', onPress: () => void continueToTabs() },
      ],
    )
  }, [continueToTabs])

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#05060F', '#0F1130', '#05060F']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.stepIndicatorWrap, { top: insets.top + 14 }]} pointerEvents="none">
        <OnboardingStepIndicator step={5} total={5} />
      </View>

      <View style={[styles.content, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.iconBubble}>
          <LinearGradient
            colors={['#A78BFA', '#818CF8', '#22D3EE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="people" size={36} color="white" />
        </View>

        <Text style={styles.title}>Invite your care circle</Text>
        <Text style={styles.subtitle}>
          Share this code with family or caregivers. They&apos;ll download the app, pick &quot;I&apos;m a caregiver,&quot; and join your circle.
        </Text>

        <View style={styles.codeCard}>
          {loading ? (
            <ActivityIndicator color={ACCENT} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : code ? (
            <>
              <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
              <Text style={styles.code}>{formatCode(code)}</Text>
              <Pressable onPress={handleRegenerate} hitSlop={12} style={styles.regen}>
                <Ionicons name="refresh" size={14} color="#FFFFFF80" />
                <Text style={styles.regenText}>Generate a new code</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.error}>No code available.</Text>
          )}
        </View>

        <Pressable
          onPress={handleShare}
          disabled={!code || loading}
          style={({ pressed }) => [
            styles.cta,
            { opacity: pressed || !code || loading ? 0.6 : 1 },
          ]}
        >
          <LinearGradient
            colors={['#A78BFA', '#818CF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="share-outline" size={18} color="white" />
          <Text style={styles.ctaText}>Share invite</Text>
        </Pressable>

        <Pressable onPress={() => void continueToTabs()} style={styles.continueBtn}>
          <Text style={styles.continueText}>I&apos;ve shared it — continue</Text>
        </Pressable>

        <Pressable onPress={handleSkip} style={styles.skipLink}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  stepIndicatorWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  content: { flex: 1, paddingHorizontal: 24, alignItems: 'center' },
  iconBubble: {
    width: 88, height: 88, borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    color: 'white', fontSize: 26, fontWeight: '800',
    letterSpacing: -0.6, textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    color: '#FFFFFFB0', fontSize: 15, lineHeight: 22,
    textAlign: 'center', marginBottom: 28, paddingHorizontal: 8,
  },
  codeCard: {
    width: '100%',
    minHeight: 140,
    backgroundColor: '#FFFFFF0A',
    borderWidth: 1,
    borderColor: ACCENT + '55',
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    padding: 18,
    marginBottom: 22,
  },
  codeLabel: {
    color: '#FFFFFF80', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, marginBottom: 6,
  },
  code: {
    color: 'white', fontSize: 38, fontWeight: '800',
    letterSpacing: 6, textAlign: 'center',
  },
  regen: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingVertical: 6, paddingHorizontal: 10,
  },
  regenText: { color: '#FFFFFF80', fontSize: 12, fontWeight: '500' },
  error: { color: '#F87171', fontSize: 14, textAlign: 'center' },
  cta: {
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ctaText: { color: 'white', fontSize: 16, fontWeight: '700' },
  continueBtn: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFFFFF22',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  continueText: { color: 'white', fontSize: 15, fontWeight: '600' },
  skipLink: { paddingVertical: 14 },
  skipText: { color: '#FFFFFF80', fontSize: 14, textDecorationLine: 'underline' },
})
