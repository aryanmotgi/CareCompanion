/**
 * Patient's Care Group management screen.
 *   - Show the active 5-char code (or "Generate" if none)
 *   - Share via Messages (iMessage prefilled)
 *   - Rotate the code (revoke + new)
 *   - Revoke the code
 *   - List pending join requests (caregiver-first email fallback)
 *   - Approve / deny pending requests
 *   - List current members (placeholder; full member-row UI in follow-up)
 *
 * Plan: ~/.gstack/projects/aryanmotgi-CareCompanion/ceo-plans/2026-05-12-patient-caregiver-onboarding.md
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
  ScrollView,
  Linking,
  Platform,
  RefreshControl,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '../src/services/api'
import { useProfile } from '../src/context/ProfileContext'

const ACCENT = '#818CF8'

type CodeState = {
  code: string | null
  expiresAt?: string
  useCount?: number
  maxUses?: number
}

type PendingRequest = {
  id: string
  createdAt: string
  caregiverUserId: string
  caregiverDisplayName: string | null
  caregiverEmail: string
}

export default function CareGroupSettingsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, csrfToken } = useProfile()

  const [careGroupId, setCareGroupId] = useState<string | null>(null)
  const [codeState, setCodeState] = useState<CodeState>({ code: null })
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'generate' | 'rotate' | 'revoke' | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // The patient's care group ID lives on their profile somewhere — without a
  // direct field, find the group they own (created_by = them) as a stand-in.
  // The proper place is profile.careGroupId; if not exposed yet, this is the
  // honest TODO surface.
  // FIXME(care-group): expose care_group_id on /api/records/profile so we
  // don't need this owner-of-group fallback.
  const loadAll = useCallback(async () => {
    if (!profile?.userId) return
    setLoading(true)
    try {
      // TODO: replace with profile.careGroupId once exposed.
      // For now, no-op until we have the ID — the screen renders an empty state.
      const groupId = (profile as { careGroupId?: string }).careGroupId ?? null
      setCareGroupId(groupId)

      if (groupId) {
        const [current, pending] = await Promise.all([
          apiClient.careGroup.codeCurrent(groupId).catch(() => ({ code: null as string | null })),
          apiClient.careGroup.pendingRequests().catch(() => ({ requests: [] })),
        ])
        setCodeState(current as CodeState)
        setRequests(pending.requests)
      }
    } finally {
      setLoading(false)
    }
  }, [profile?.userId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleGenerate = useCallback(async () => {
    if (!csrfToken || !careGroupId) return
    setBusy('generate')
    try {
      const result = await apiClient.careGroup.codeGenerate(careGroupId, csrfToken)
      setCodeState(result)
    } catch (err) {
      Alert.alert('Could not generate code', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }, [careGroupId, csrfToken])

  const handleRotate = useCallback(() => {
    Alert.alert(
      'Rotate code?',
      'This invalidates your current code and creates a new one. Anyone who has the old code will need a fresh one to join.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rotate',
          style: 'destructive',
          onPress: async () => {
            if (!csrfToken || !careGroupId) return
            setBusy('rotate')
            try {
              const result = await apiClient.careGroup.codeRotate(careGroupId, csrfToken)
              setCodeState(result)
            } catch (err) {
              Alert.alert('Could not rotate code', err instanceof Error ? err.message : String(err))
            } finally {
              setBusy(null)
            }
          },
        },
      ]
    )
  }, [careGroupId, csrfToken])

  const handleRevoke = useCallback(() => {
    Alert.alert(
      'Revoke code?',
      "Anyone who hasn't already joined won't be able to use this code. Current members of your circle are unaffected. You can generate a new code anytime.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            if (!csrfToken || !careGroupId) return
            setBusy('revoke')
            try {
              await apiClient.careGroup.codeRevoke(careGroupId, csrfToken)
              setCodeState({ code: null })
            } catch (err) {
              Alert.alert('Could not revoke code', err instanceof Error ? err.message : String(err))
            } finally {
              setBusy(null)
            }
          },
        },
      ]
    )
  }, [careGroupId, csrfToken])

  const handleShare = useCallback(async () => {
    if (!codeState.code) return
    const display = formatCodeDisplay(codeState.code)
    const body = `Here's my CareCompanion invite code: ${display}\n\nDownload the app and choose "I'm a caregiver" → enter this code to join my care circle.`
    if (Platform.OS === 'ios') {
      // iMessage deep link — opens Messages prefilled. Falls back to Share sheet
      // if the user doesn't have Messages or denies the URL.
      const smsUrl = `sms:&body=${encodeURIComponent(body)}`
      const supported = await Linking.canOpenURL(smsUrl).catch(() => false)
      if (supported) {
        await Linking.openURL(smsUrl)
        return
      }
    }
    await Share.share({ message: body })
  }, [codeState.code])

  const handleApprove = useCallback(async (req: PendingRequest) => {
    if (!csrfToken || !careGroupId) return
    // For approval we need the patient to pick the relationship for the
    // caregiver. Quick prompt; a full sheet UI is a follow-up.
    Alert.prompt(
      `How is ${req.caregiverDisplayName ?? req.caregiverEmail} related to you?`,
      'spouse / parent / child / sibling / friend / other',
      async (relationship) => {
        const valid = ['spouse', 'parent', 'child', 'sibling', 'friend', 'other'].includes(relationship?.trim().toLowerCase() ?? '')
        if (!valid) {
          Alert.alert('Try again', 'Please type one of: spouse, parent, child, sibling, friend, other')
          return
        }
        try {
          await apiClient.careGroup.approveRequest(req.id, relationship!.trim().toLowerCase(), careGroupId, csrfToken)
          setRequests((prev) => prev.filter((r) => r.id !== req.id))
        } catch (err) {
          Alert.alert('Could not approve', err instanceof Error ? err.message : String(err))
        }
      }
    )
  }, [careGroupId, csrfToken])

  const handleDeny = useCallback(async (req: PendingRequest) => {
    if (!csrfToken) return
    try {
      await apiClient.careGroup.denyRequest(req.id, csrfToken)
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
    } catch (err) {
      Alert.alert('Could not deny', err instanceof Error ? err.message : String(err))
    }
  }, [csrfToken])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }, [loadAll])

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#05060F', '#0F1130', '#05060F']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <Pressable
        onPress={() => router.back()}
        hitSlop={16}
        style={[styles.backBtn, { top: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={28} color="white" />
      </Pressable>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        <Text style={styles.title}>Care Group</Text>
        <Text style={styles.subtitle}>
          Invite caregivers with a short code, see who's in your circle, and manage who has access.
        </Text>

        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
        ) : !careGroupId ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={32} color={ACCENT} />
            <Text style={styles.emptyTitle}>No care group yet</Text>
            <Text style={styles.emptyBody}>
              Create a care group from Settings to start inviting caregivers.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.codeCard}>
              <Text style={styles.cardLabel}>Your invite code</Text>
              {codeState.code ? (
                <>
                  <Text style={styles.codeBig}>{formatCodeDisplay(codeState.code)}</Text>
                  <Text style={styles.codeMeta}>
                    Used {codeState.useCount ?? 0} of {codeState.maxUses ?? 5} times
                    {codeState.expiresAt && ` • expires ${new Date(codeState.expiresAt).toLocaleDateString()}`}
                  </Text>

                  <Pressable
                    onPress={handleShare}
                    style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}
                  >
                    <LinearGradient
                      colors={['#A78BFA', '#818CF8']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Ionicons name="chatbubble-ellipses" size={18} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.shareBtnText}>Share via Messages</Text>
                  </Pressable>

                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={handleRotate}
                      disabled={busy !== null}
                      style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
                    >
                      {busy === 'rotate' ? <ActivityIndicator color={ACCENT} /> : (
                        <>
                          <Ionicons name="refresh" size={16} color={ACCENT} />
                          <Text style={styles.secondaryBtnText}>Rotate</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={handleRevoke}
                      disabled={busy !== null}
                      style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
                    >
                      {busy === 'revoke' ? <ActivityIndicator color={ACCENT} /> : (
                        <>
                          <Ionicons name="close-circle" size={16} color="#F87171" />
                          <Text style={[styles.secondaryBtnText, { color: '#F87171' }]}>Revoke</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={handleGenerate}
                  disabled={busy !== null}
                  style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}
                >
                  <LinearGradient
                    colors={['#A78BFA', '#818CF8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  {busy === 'generate' ? <ActivityIndicator color="white" /> : (
                    <Text style={styles.shareBtnText}>Generate code</Text>
                  )}
                </Pressable>
              )}
            </View>

            {requests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pending requests</Text>
                {requests.map((req) => (
                  <View key={req.id} style={styles.requestCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.requestName}>
                        {req.caregiverDisplayName ?? req.caregiverEmail}
                      </Text>
                      <Text style={styles.requestEmail}>{req.caregiverEmail}</Text>
                      <Text style={styles.requestTime}>
                        Requested {new Date(req.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable onPress={() => handleDeny(req)} style={styles.denyBtn}>
                        <Ionicons name="close" size={18} color="#F87171" />
                      </Pressable>
                      <Pressable onPress={() => handleApprove(req)} style={styles.approveBtn}>
                        <Ionicons name="checkmark" size={18} color="white" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function formatCodeDisplay(code: string): string {
  if (code.length !== 5) return code
  return `${code.slice(0, 2)}-${code.slice(2)}`
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  backBtn: { position: 'absolute', left: 12, zIndex: 10, padding: 8 },
  content: { paddingHorizontal: 24 },
  title: { color: 'white', fontSize: 28, fontWeight: '800', letterSpacing: -0.7, marginBottom: 8 },
  subtitle: { color: '#FFFFFFAA', fontSize: 15, lineHeight: 22, marginBottom: 24 },
  emptyCard: {
    alignItems: 'center', gap: 10, padding: 24,
    backgroundColor: '#FFFFFF06', borderRadius: 14,
    borderWidth: 1, borderColor: '#FFFFFF14',
  },
  emptyTitle: { color: 'white', fontSize: 16, fontWeight: '700' },
  emptyBody: { color: '#FFFFFFAA', fontSize: 13, textAlign: 'center' },
  codeCard: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1, borderColor: ACCENT + '44',
    backgroundColor: '#FFFFFF06',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardLabel: { color: '#FFFFFFAA', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  codeBig: { color: 'white', fontSize: 44, fontWeight: '800', letterSpacing: 6, marginBottom: 8 },
  codeMeta: { color: '#FFFFFF80', fontSize: 12, marginBottom: 20 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 12, minHeight: 48, minWidth: 220,
    overflow: 'hidden',
  },
  shareBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#FFFFFF0A',
    borderWidth: 1, borderColor: '#FFFFFF1A',
  },
  secondaryBtnText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
  section: { marginTop: 8 },
  sectionTitle: { color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  requestCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12,
    backgroundColor: '#FFFFFF06', borderWidth: 1, borderColor: '#FFFFFF14',
    marginBottom: 10,
  },
  requestName: { color: 'white', fontSize: 15, fontWeight: '700' },
  requestEmail: { color: '#FFFFFFAA', fontSize: 12, marginTop: 2 },
  requestTime: { color: '#FFFFFF60', fontSize: 11, marginTop: 4 },
  approveBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#34D399',
  },
  denyBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF0A', borderWidth: 1, borderColor: '#F8717155',
  },
})
