// apps/mobile/app/edit-care-group.tsx
//
// Two-level care setup:
//   Care type: self-care | assisted
//     If assisted → role: patient | caregiver
//
// Role still goes to the backend via /api/records/profile.
// careType is local-only (SecureStore key `cc-care-type`) until the
// backend gets a schema column for it.

import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import { useTheme } from '../src/theme'
import { useProfile } from '../src/context/ProfileContext'

type CareType = 'self' | 'assisted'
type Role = 'patient' | 'caregiver'

const CARE_TYPE_KEY = 'cc-care-type'

export default function EditCareGroupScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, csrfToken, refetch } = useProfile()

  // Default careType: if profile.role is caregiver, must be assisted.
  // Otherwise we don't know the user's intent — default to self-care.
  const [careType, setCareType] = useState<CareType>('self')
  const [role, setRole] = useState<Role>((profile?.role as Role) || 'patient')
  const [caregiverName, setCaregiverName] = useState(profile?.caregiverForName || '')
  const [saving, setSaving] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const toastOpacity = useSharedValue(0)
  const toastY = useSharedValue(20)
  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: toastY.value }],
  }))

  function showSavedToast(onDone: () => void) {
    setToastVisible(true)
    toastOpacity.value = withTiming(1, { duration: 180 })
    toastY.value = withTiming(0, { duration: 180 })
    setTimeout(() => {
      toastOpacity.value = withTiming(0, { duration: 220 }, (finished) => {
        if (finished) {
          runOnJS(setToastVisible)(false)
          runOnJS(onDone)()
        }
      })
      toastY.value = withTiming(20, { duration: 220 })
    }, 1400)
  }

  // Hydrate careType from SecureStore on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stored = await SecureStore.getItemAsync(CARE_TYPE_KEY)
        if (cancelled) return
        if (stored === 'self' || stored === 'assisted') {
          setCareType(stored)
        } else if (profile?.role === 'caregiver') {
          // Caregivers always imply assisted-care (they help someone else).
          setCareType('assisted')
        }
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => { cancelled = true }
  }, [profile?.role])

  // Sync role + caregiverName when profile changes
  useEffect(() => {
    if (profile) {
      setRole((profile.role as Role) || 'patient')
      setCaregiverName(profile.caregiverForName || '')
    }
  }, [profile?.role, profile?.caregiverForName])

  // Switching to self-care implies role=patient (the user is the patient).
  function selectCareType(next: CareType) {
    setCareType(next)
    if (next === 'self') {
      setRole('patient')
      setCaregiverName('')
    }
  }

  async function save() {
    if (careType === 'assisted' && role === 'caregiver' && !caregiverName.trim()) {
      Alert.alert('Name Required', 'Please enter the name of the person you are caring for.')
      return
    }
    setSaving(true)
    try {
      // Persist careType locally (no schema column for it yet)
      await SecureStore.setItemAsync(CARE_TYPE_KEY, careType)

      // Persist role + caregiverName to backend
      const token = await SecureStore.getItemAsync('cc-session-token')
      if (!token) return
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'
      const isSecure = baseUrl.startsWith('https://')
      const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'
      const effectiveRole: Role = careType === 'self' ? 'patient' : role
      const effectiveCaregiverName =
        careType === 'assisted' && effectiveRole === 'caregiver' ? caregiverName.trim() : null

      const res = await fetch(`${baseUrl}/api/records/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `${cookieName}=${token}; cc-csrf-token=${csrfToken}`,
          'x-csrf-token': csrfToken || '',
        },
        body: JSON.stringify({
          role: effectiveRole,
          caregiver_for_name: effectiveCaregiverName,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      await refetch()
      showSavedToast(() => router.back())
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!hydrated) {
    return (
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <LinearGradient
          colors={theme.gradientAMuted as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={theme.gradientAMuted as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: theme.bgElevated }]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.textMuted }]}>Edit Care Group</Text>
          <View style={{ width: 36 }} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>How will you use CareCompanion?</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Self-care gives you a streamlined view focused on your own treatment. Assisted care unlocks the full set of tools for managing care alongside someone else.
        </Text>

        {/* Care type segment */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>CARE TYPE</Text>
        <View style={[styles.segmentRow, { backgroundColor: theme.bgElevated }]}>
          <Pressable
            style={[
              styles.segBtn,
              careType === 'self' && { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 8 },
            ]}
            onPress={() => selectCareType('self')}
          >
            <Text style={[styles.segLabel, { color: careType === 'self' ? theme.accentHover : theme.textMuted }]}>
              Self-care
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segBtn,
              careType === 'assisted' && { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 8 },
            ]}
            onPress={() => selectCareType('assisted')}
          >
            <Text style={[styles.segLabel, { color: careType === 'assisted' ? theme.accentHover : theme.textMuted }]}>
              Assisted care
            </Text>
          </Pressable>
        </View>

        {/* Role segment — only when assisted */}
        {careType === 'assisted' && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 8 }]}>ROLE</Text>
            <View style={[styles.segmentRow, { backgroundColor: theme.bgElevated }]}>
              <Pressable
                style={[
                  styles.segBtn,
                  role === 'patient' && { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 8 },
                ]}
                onPress={() => setRole('patient')}
              >
                <Text style={[styles.segLabel, { color: role === 'patient' ? theme.accentHover : theme.textMuted }]}>
                  I am the patient
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.segBtn,
                  role === 'caregiver' && { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 8 },
                ]}
                onPress={() => setRole('caregiver')}
              >
                <Text style={[styles.segLabel, { color: role === 'caregiver' ? theme.accentHover : theme.textMuted }]}>
                  I am a caregiver
                </Text>
              </Pressable>
            </View>

            {role === 'caregiver' && (
              <TextInput
                style={[
                  styles.caregiverInput,
                  {
                    backgroundColor: theme.bgCard,
                    borderColor: theme.bgCardBorder,
                    color: theme.text,
                  },
                ]}
                value={caregiverName}
                onChangeText={setCaregiverName}
                placeholder="Who are you caring for? (e.g. Mom, Dad, Sarah)"
                placeholderTextColor={theme.textMuted}
              />
            )}
          </>
        )}

        <Pressable
          style={[styles.saveBtn, { backgroundColor: theme.accent, opacity: saving ? 0.6 : 1 }]}
          onPress={save}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </Pressable>
      </ScrollView>

      {toastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            { bottom: insets.bottom + 32, backgroundColor: theme.isDark ? 'rgba(16,185,129,0.95)' : '#10B981' },
            toastStyle,
          ]}
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.toastText}>Profile saved</Text>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 8, lineHeight: 32 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  segmentRow: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 16 },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segLabel: { fontSize: 14, fontWeight: '600' },
  caregiverInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 16 },
  saveBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
