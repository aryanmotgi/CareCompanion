// apps/mobile/app/(tabs)/settings.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, View, Text, Pressable, StyleSheet, Alert, Linking, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'
import { useTheme, useThemeOverride, setThemeOverride, ThemeOverride } from '../../src/theme'
import { useProfile } from '../../src/context/ProfileContext'
import { signOut as authSignOut } from '../../src/services/auth'
import {
  useTokenContext,
  useWelcomeContext,
  useRecordsContext,
  useUserTypeContext,
  useCaregiverJoinedContext,
} from '../_layout'
import { GlassCard } from '../../src/components/GlassCard'
import { LinearGradient } from 'expo-linear-gradient'
import Animated from 'react-native-reanimated'
import { useStaggerEntrance } from '../../src/hooks/useStaggerEntrance'
import { RoleBadge } from '../../src/components/RoleBadge'
import { TabFadeWrapper } from './_layout'

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0'
const BUILD_NUMBER = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode?.toString() ?? '1'

type MemoryItem = { id: string; category: string; content: string; updatedAt?: string | null }
type MemoryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; items: MemoryItem[]; updatedAt: string | null }
  | { status: 'error'; message: string }
  | { status: 'unavailable' }

const CATEGORY_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  medications: { label: 'Medications', icon: 'medkit-outline', color: '#818CF8' },
  conditions:  { label: 'Conditions', icon: 'medical-outline', color: '#F472B6' },
  allergies:   { label: 'Allergies', icon: 'warning-outline', color: '#FCD34D' },
  insurance:   { label: 'Insurance', icon: 'card-outline', color: '#FBBF24' },
  preferences: { label: 'Preferences', icon: 'options-outline', color: '#A78BFA' },
  providers:   { label: 'Providers', icon: 'people-outline', color: '#60A5FA' },
}
const CATEGORY_ORDER = ['medications', 'conditions', 'allergies', 'insurance', 'preferences', 'providers']

function useMemories(careProfileId: string | null | undefined, apiClient: ReturnType<typeof useProfile>['apiClient']): MemoryState {
  const [state, setState] = useState<MemoryState>({ status: 'idle' })
  useEffect(() => {
    if (!careProfileId) return
    let cancelled = false
    setState({ status: 'loading' })
    apiClient.memories
      .list(careProfileId)
      .then((res) => {
        if (cancelled) return
        const raw = (res?.data ?? res?.memories ?? []) as MemoryItem[]
        if (!Array.isArray(raw)) {
          setState({ status: 'unavailable' })
          return
        }
        setState({ status: 'ready', items: raw, updatedAt: res?.updatedAt ?? null })
      })
      .catch((err: Error) => {
        if (cancelled) return
        const msg = err?.message ?? ''
        // 404 or 501 means the endpoint isn't wired up server-side yet — treat as
        // graceful "no memory entries" rather than a hard error so settings still renders.
        if (msg.includes('404') || msg.includes('501')) {
          setState({ status: 'unavailable' })
          return
        }
        setState({ status: 'error', message: msg || 'Could not load memory' })
      })
    return () => { cancelled = true }
  }, [careProfileId, apiClient])
  return state
}

function formatRelative(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function AiMemorySection({ careProfileId }: { careProfileId: string | null | undefined }) {
  const theme = useTheme()
  const router = useRouter()
  const { apiClient } = useProfile()
  const state = useMemories(careProfileId, apiClient)

  const grouped = useMemo(() => {
    if (state.status !== 'ready') return [] as { key: string; items: MemoryItem[] }[]
    const buckets = new Map<string, MemoryItem[]>()
    for (const item of state.items) {
      const key = (item.category || 'preferences').toLowerCase()
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(item)
    }
    return CATEGORY_ORDER
      .filter((k) => buckets.has(k))
      .concat([...buckets.keys()].filter((k) => !CATEGORY_ORDER.includes(k)))
      .map((key) => ({ key, items: buckets.get(key) ?? [] }))
  }, [state])

  const lastUpdated = state.status === 'ready'
    ? (state.updatedAt ?? state.items.reduce<string | null>((acc, it) => {
        if (!it.updatedAt) return acc
        if (!acc) return it.updatedAt
        return new Date(it.updatedAt).getTime() > new Date(acc).getTime() ? it.updatedAt : acc
      }, null))
    : null

  return (
    <View>
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>YOUR AI MEMORY</Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 16,
          padding: 14,
          backgroundColor: 'rgba(167,139,250,0.06)',
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(167,139,250,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="sparkles-outline" size={18} color="#A78BFA" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>
              What Claude knows about you
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
              The AI uses these facts to personalize answers. Update or delete anytime.
            </Text>
          </View>
        </View>

        {state.status === 'loading' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
            <ActivityIndicator color={theme.accent} />
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>Loading memory…</Text>
          </View>
        )}

        {state.status === 'error' && (
          <Text style={{ color: theme.rose, fontSize: 12 }}>{state.message}</Text>
        )}

        {state.status === 'unavailable' && (
          <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 18 }}>
            No memory entries yet. As you chat and confirm details, the AI will save what it
            learns here so you don't have to repeat yourself.
          </Text>
        )}

        {state.status === 'ready' && grouped.length === 0 && (
          <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 18 }}>
            No memory entries yet — chat with the AI and confirm key facts to fill this in.
          </Text>
        )}

        {state.status === 'ready' && grouped.length > 0 && (
          <View style={{ gap: 12 }}>
            {grouped.map(({ key, items }) => {
              const meta = CATEGORY_META[key] ?? { label: key.charAt(0).toUpperCase() + key.slice(1), icon: 'document-text-outline', color: '#A78BFA' }
              return (
                <View key={key} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={meta.icon} size={14} color={meta.color} />
                    <Text
                      style={{
                        color: meta.color,
                        fontSize: 11,
                        letterSpacing: 0.8,
                        textTransform: 'uppercase',
                        fontWeight: '700',
                      }}
                    >
                      {meta.label}
                    </Text>
                  </View>
                  {items.map((it) => (
                    <View
                      key={it.id}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: theme.border,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                      }}
                    >
                      <Text style={{ color: theme.text, fontSize: 13, lineHeight: 19 }}>
                        {it.content}
                      </Text>
                    </View>
                  ))}
                </View>
              )
            })}
          </View>
        )}

        {lastUpdated && (
          <Text style={{ color: theme.textMuted, fontSize: 11 }}>
            Last updated {formatRelative(lastUpdated)}
          </Text>
        )}

        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(tabs)/chat',
              params: { prefill: 'What do you currently remember about me? Walk me through what you know.' },
            } as any)
          }
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(167,139,250,0.4)',
            backgroundColor: pressed ? 'rgba(167,139,250,0.22)' : 'rgba(167,139,250,0.10)',
          })}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={14} color="#A78BFA" />
          <Text style={{ color: '#A78BFA', fontSize: 12, fontWeight: '700' }}>
            Ask Claude to review
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

export default function SettingsScreen() {
  const theme = useTheme()
  const activeTheme = useThemeOverride()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const stagger = useStaggerEntrance(12)
  const { profile, clear: clearProfile } = useProfile()
  const { markSignedOut } = useTokenContext()
  const { reset: resetWelcome } = useWelcomeContext()
  const { reset: resetRecords } = useRecordsContext()
  const { reset: resetUserType } = useUserTypeContext()
  const { reset: resetCaregiverJoined } = useCaregiverJoinedContext()

  function changeTheme(value: ThemeOverride) {
    void setThemeOverride(value)
  }

  async function signOut() {
    Alert.alert('Sign out?', "You'll need to log in again to access your care data.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await authSignOut().catch(() => {})
          markSignedOut()
          clearProfile()
          resetWelcome()
          resetRecords()
          resetUserType()
          resetCaregiverJoined()
          router.replace('/welcome' as any)
        },
      },
    ])
  }

  function deleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('cc-session-token')
              if (!token) return
              const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'
              const res = await fetch(`${baseUrl}/api/auth/delete-account`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              })
              if (!res.ok) throw new Error('Delete failed')
              await authSignOut().catch(() => {})
              router.replace('/welcome' as any)
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again or contact support.')
            }
          },
        },
      ],
    )
  }

  return (
    <TabFadeWrapper>
      <View style={styles.root}>
        <LinearGradient
          colors={theme.gradientAMuted as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 140 }}
        >
        <Animated.View style={stagger[0]}>
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        </Animated.View>

        {/* Profile card */}
        <Animated.View style={stagger[1]}>
          <View style={styles.section}>
            <View style={styles.profileRow}>
              <LinearGradient colors={['#6366F1', '#A78BFA']} style={styles.avatar}>
                <Text style={styles.avatarText}>{(profile?.displayName || 'U')[0].toUpperCase()}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.text }]}>{profile?.displayName || profile?.patientName || 'User'}</Text>
                <Text style={[styles.role, { color: theme.textMuted }]}>
                  {profile?.role === 'caregiver'
                    ? `Caregiver${profile?.caregiverForName ? ` for ${profile.caregiverForName}` : ''}`
                    : 'Patient'}
                </Text>
                <RoleBadge style={{ marginTop: 6 }} />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Care Group */}
        <Animated.View style={stagger[2]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>CARE GROUP</Text>
          <View style={styles.section}>
            <Pressable
              style={[styles.saveRoleBtn, { backgroundColor: theme.accent }]}
              onPress={() => router.push('/edit-care-group' as any)}
            >
              <Text style={styles.saveRoleBtnText}>Edit Care Group</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Your AI Memory */}
        <Animated.View style={stagger[3]}>
          <AiMemorySection careProfileId={profile?.careProfileId} />
        </Animated.View>

        {/* Edit Profile & Preferences */}
        <Animated.View style={stagger[3]}>
          <Pressable onPress={() => Linking.openURL('https://carecompanionai.org/onboarding')}>
            <View style={styles.section}>
              <View style={styles.editProfileRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editProfileLabel, { color: theme.text }]}>Edit Profile & Preferences</Text>
                  <Text style={[styles.editProfileSub, { color: theme.textMuted }]}>Update cancer type, treatment phase, and priorities</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* Connect Health Records */}
        <Animated.View style={stagger[3]}>
          <Pressable onPress={() => router.push('/health-connect' as any)}>
            <View style={styles.section}>
              <View style={styles.editProfileRow}>
                <Ionicons name="medkit-outline" size={20} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editProfileLabel, { color: theme.text }]}>Connect Health Records</Text>
                  <Text style={[styles.editProfileSub, { color: theme.textMuted }]}>Sync medications, labs, and conditions from Apple Health</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* Appearance */}
        <Animated.View style={stagger[4]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>APPEARANCE</Text>
          <View style={styles.section}>
            <View style={[styles.segmentRow, { backgroundColor: theme.bgElevated }]}>
              {(['light', 'dark', 'system'] as ThemeOverride[]).map((t) => (
                <Pressable
                  key={t}
                  style={[
                    styles.segBtn,
                    activeTheme === t && { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 8 },
                  ]}
                  onPress={() => changeTheme(t)}
                >
                  <Text style={[styles.segLabel, { color: activeTheme === t ? theme.accentHover : theme.textMuted }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Notifications */}
        <Animated.View style={stagger[5]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>NOTIFICATIONS</Text>
          <View style={styles.section}>
            <Pressable style={styles.linkRow} onPress={() => router.push('/notification-settings' as any)}>
              <Ionicons name="notifications-outline" size={18} color={theme.textMuted} />
              <Text style={[styles.linkLabel, { color: theme.text }]}>Notifications</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Documents */}
        <Animated.View style={stagger[5]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>DOCUMENTS</Text>
          <View style={styles.section}>
            <Pressable style={styles.linkRow} onPress={() => router.push('/scanned-docs' as any)}>
              <Ionicons name="scan-outline" size={18} color={theme.textMuted} />
              <Text style={[styles.linkLabel, { color: theme.text }]}>Scanned Documents</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Legal & Support */}
        <Animated.View style={stagger[8]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>LEGAL & SUPPORT</Text>
          <View style={styles.section}>
            <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://carecompanionai.org/privacy')}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.textMuted} />
              <Text style={[styles.linkLabel, { color: theme.text }]}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
            <View style={styles.toggleRowBorder} />
            <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://carecompanionai.org/terms')}>
              <Ionicons name="document-text-outline" size={18} color={theme.textMuted} />
              <Text style={[styles.linkLabel, { color: theme.text }]}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
            <View style={styles.toggleRowBorder} />
            <Pressable style={styles.linkRow} onPress={() => Linking.openURL('mailto:support@carecompanionai.org')}>
              <Ionicons name="help-circle-outline" size={18} color={theme.textMuted} />
              <Text style={[styles.linkLabel, { color: theme.text }]}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Delete Account */}
        <Animated.View style={stagger[9]}>
          <Pressable onPress={deleteAccount}>
            <View style={styles.section}>
              <View style={styles.linkRow}>
                <Ionicons name="trash-outline" size={18} color={theme.rose} />
                <Text style={[styles.linkLabel, { color: theme.rose }]}>Delete Account</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.rose} />
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* Test Tools (staging only) */}
        {process.env.EXPO_PUBLIC_TEST_MODE === 'true' && (
          <Animated.View style={stagger[10]}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>TEST TOOLS</Text>
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Reset Test Data',
                  'This will restore your account to the initial seed state. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: async () => {
                        const token = await SecureStore.getItemAsync('cc-session-token')
                        if (!token) return
                        try {
                          const res = await fetch(
                            `${process.env.EXPO_PUBLIC_API_URL ?? 'https://carecompanionai.org'}/api/test/reset`,
                            {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${token}` },
                            }
                          )
                          if (!res.ok) throw new Error('Reset failed')
                          Alert.alert('Done', 'Test data has been reset.')
                          router.replace('/(tabs)')
                        } catch {
                          Alert.alert('Error', 'Failed to reset test data. Please try again.')
                        }
                      },
                    },
                  ]
                )
              }}
            >
              <View style={styles.section}>
                <Text style={[styles.signOut, { color: '#f59e0b' }]}>Reset Test Data</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Sign out */}
        <Animated.View style={stagger[11]}>
          <Pressable onPress={signOut}>
            <View style={styles.section}>
              <Text style={[styles.signOut, { color: theme.rose }]}>Sign Out</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* App version — non-interactive footer */}
        <Text style={[styles.versionFooter, { color: theme.textMuted }]} accessible={false}>
          Version {APP_VERSION} ({BUILD_NUMBER})
        </Text>
        </ScrollView>
      </View>
    </TabFadeWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700' },
  role: { fontSize: 13, marginTop: 2 },
  segmentRow: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  segLabel: { fontSize: 14, fontWeight: '600' },
  signOut: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  versionFooter: { fontSize: 12, textAlign: 'center', opacity: 0.5, marginTop: 16, marginBottom: 8 },
  editProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editProfileLabel: { fontSize: 15, fontWeight: '600' },
  editProfileSub: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 18, fontWeight: '600' },
  toggleRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.2)' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  linkLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  saveRoleBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveRoleBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
})
