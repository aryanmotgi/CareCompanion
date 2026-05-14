/**
 * After the caregiver redeems a 5-char code (or has a request approved),
 * they see this screen:
 *   1. Photo-verify the patient ("Are you joining Margaret's care circle?")
 *   2. Pick their relationship (spouse / parent / child / sibling / friend / other)
 *   3. Tap Continue → land in /(tabs)
 *
 * The patient's name/photo arrives as route params (set by /care-group-join's
 * router.replace). Photo URL is null today (user-profile photos not yet wired)
 * — we render initials in a gradient bubble as the fallback identity signal.
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '../src/services/api'
import { useProfile } from '../src/context/ProfileContext'
import { useCaregiverJoinedContext } from './_layout'
import { AuroraBackground, FloatingGlyphs } from '../src/components/auth/AuthAtoms'

const ACCENT = '#818CF8'

type Relationship = 'spouse' | 'parent' | 'child' | 'sibling' | 'friend' | 'other'

const RELATIONSHIPS: Array<{ id: Relationship; label: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap }> = [
  { id: 'spouse',  label: 'Spouse / partner', icon: 'heart-outline' },
  { id: 'parent',  label: 'Parent',           icon: 'person-outline' },
  { id: 'child',   label: 'Child',            icon: 'happy-outline' },
  { id: 'sibling', label: 'Sibling',          icon: 'people-outline' },
  { id: 'friend',  label: 'Friend',           icon: 'people-circle-outline' },
  { id: 'other',   label: 'Other',            icon: 'ellipsis-horizontal' },
]

export default function CareRelationshipScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ careGroupId?: string; patientName?: string }>()
  const { csrfToken, refetch } = useProfile()
  const { markJoined } = useCaregiverJoinedContext()

  const [selected, setSelected] = useState<Relationship | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const patientName = (params.patientName as string) || 'your patient'

  // Guard: this screen is meaningless without a careGroupId. If a caregiver
  // lands here directly (cold launch, deep link, manual nav), send them back
  // to /care-group-join to redeem a code first.
  useEffect(() => {
    if (!params.careGroupId) {
      router.replace('/care-group-join' as never)
    }
  }, [params.careGroupId, router])

  const handleContinue = useCallback(async () => {
    if (!csrfToken || !selected || submitting) return
    const careGroupId = params.careGroupId as string | undefined
    if (!careGroupId) {
      setError('Missing care group context. Please try again.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // The caregiver row was created in /care-group-join with
      // relationship='other'. Update it to the real value now.
      await apiClient.careGroup.updateRelationship(careGroupId, selected, csrfToken)
      markJoined()
      await refetch()
      router.replace('/(tabs)' as any)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }, [csrfToken, selected, submitting, router, refetch, params.careGroupId, markJoined])

  // Step 1: photo verify
  if (!confirmed) {
    return (
      <View style={styles.root}>
        <AuroraBackground />
        <FloatingGlyphs />
        <View style={[styles.content, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.iconBubble}>
            <LinearGradient
              colors={['#A78BFA', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.initials}>{initialsFor(patientName)}</Text>
          </View>

          <Text style={styles.title}>Are you joining {patientName}'s care circle?</Text>
          <Text style={styles.subtitle}>
            Check the name above. If this doesn't look right, go back and try a different code.
          </Text>

          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setConfirmed(true) }}
            style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient
              colors={['#A78BFA', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.ctaText}>Yes, that's the right person</Text>
          </Pressable>

          <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/care-group-join' as any) }} style={styles.altLink}>
            <Text style={styles.altLinkText}>That's not who I'm caring for</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  // Step 2: relationship picker
  return (
    <View style={styles.root}>
      <AuroraBackground />
      <FloatingGlyphs />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}
      >
        <Text style={styles.title}>How are you related to {patientName}?</Text>
        <Text style={styles.subtitle}>
          This helps us personalize what you see — and lets {patientName} know who's in their circle.
        </Text>

        <View style={styles.options}>
          {RELATIONSHIPS.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setSelected(r.id) }}
              style={({ pressed }) => [
                styles.option,
                selected === r.id && styles.optionSelected,
                pressed && { transform: [{ scale: 0.99 }] },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: ACCENT + (selected === r.id ? '44' : '22') }]}>
                <Ionicons name={r.icon} size={20} color={ACCENT} />
              </View>
              <Text style={styles.optionLabel}>{r.label}</Text>
              {selected === r.id && (
                <Ionicons name="checkmark-circle" size={22} color={ACCENT} />
              )}
            </Pressable>
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); handleContinue() }}
          disabled={!selected || submitting}
          style={({ pressed }) => [
            styles.cta,
            { opacity: pressed || !selected || submitting ? 0.6 : 1, marginTop: 28 },
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
      </ScrollView>
    </View>
  )
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  content: { flex: 1, paddingHorizontal: 24, alignItems: 'center' },
  iconBubble: {
    width: 96, height: 96, borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  initials: { color: 'white', fontSize: 36, fontWeight: '800', letterSpacing: 1 },
  title: {
    color: 'white', fontSize: 26, fontWeight: '800',
    letterSpacing: -0.6, textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    color: '#FFFFFFB0', fontSize: 15, lineHeight: 22,
    textAlign: 'center', marginBottom: 28, paddingHorizontal: 4,
  },
  options: { width: '100%', gap: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: '#FFFFFF14',
    backgroundColor: '#FFFFFF06',
  },
  optionSelected: { borderColor: ACCENT + '88', backgroundColor: ACCENT + '15' },
  optionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { flex: 1, color: 'white', fontSize: 15, fontWeight: '600' },
  cta: {
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { color: 'white', fontSize: 16, fontWeight: '700' },
  altLink: { marginTop: 16, paddingVertical: 10 },
  altLinkText: { color: '#FFFFFFAA', fontSize: 14 },
  error: { color: '#F87171', fontSize: 14, textAlign: 'center', marginTop: 12 },
})
