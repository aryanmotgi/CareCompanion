// apps/mobile/src/components/care/CareGroupTab.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Share,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../theme'
import { GlassCard } from '../GlassCard'
import type { ApiClient } from '@carecompanion/api'

type Step =
  | 'loading'
  | 'already-member'
  | 'pick'
  | 'create-form'
  | 'join-form'
  | 'invite'
  | 'joined'
  | 'connected'

type Member = {
  id: string
  userId: string
  role: string
  email: string | null
  display_name: string
  joinedAt: string | null
}

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 10 * 60 * 1_000

type Props = {
  apiClient: ApiClient
  csrfToken: string | null
}

export function CareGroupTab({ apiClient, csrfToken }: Props) {
  const theme = useTheme()
  const [step, setStep] = useState<Step>('loading')
  const [groupName, setGroupName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [careGroupId, setCareGroupId] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [connectedName, setConnectedName] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [partnerJoined, setPartnerJoined] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    apiClient.careTeam.list()
      .then(raw => {
        const data = raw as { members: Member[]; role: string | null }
        if (data.role !== null) {
          setMembers((data.members ?? []).filter(m => m.role !== 'owner'))
          setStep('already-member')
        } else {
          setStep('pick')
        }
      })
      .catch(() => setStep('pick'))
  }, [apiClient])

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
    }
  }, [])

  function startPolling(groupId: string) {
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)

    pollingRef.current = setInterval(async () => {
      try {
        const data = await apiClient.careGroup.status(groupId)
        if (data.joined) {
          clearInterval(pollingRef.current!)
          clearTimeout(pollTimeoutRef.current!)
          pollingRef.current = null
          pollTimeoutRef.current = null
          setConnectedName(data.name ?? 'Your care partner')
          setPartnerJoined(true)
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setStep('connected')
        }
      } catch {
        // transient polling error — keep trying
      }
    }, POLL_INTERVAL_MS)

    pollTimeoutRef.current = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = null
      // Don't kick out — just stop polling. User can still share the link manually.
      setPartnerJoined(false)
    }, POLL_TIMEOUT_MS)
  }

  async function handleCreate() {
    if (!csrfToken) { setError('Session expired — please restart the app.'); return }
    const name = groupName.trim()
    if (!name || password.length < 4) return
    setError('')
    setSubmitting(true)
    try {
      const data = await apiClient.careGroup.create(name, password, csrfToken)
      setCareGroupId(data.id)
      // Generate invite link
      try {
        const invite = await apiClient.careGroup.invite(data.id, csrfToken)
        setInviteUrl(invite.url)
      } catch {
        setInviteUrl(null)
      }
      setStep('invite')
      startPolling(data.id)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(msg.includes('409') || msg.includes('already')
        ? 'A group with this name and password already exists. Try a different name or password.'
        : 'Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleJoin() {
    if (!csrfToken) { setError('Session expired — please restart the app.'); return }
    const name = groupName.trim()
    if (!name || !password) return
    setError('')
    setSubmitting(true)
    try {
      const data = await apiClient.careGroup.join(name, password, csrfToken)
      setCareGroupId(data.id)
      setConnectedName(data.name)
      setStep('joined')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(msg.includes('404') || msg.includes('not found')
        ? "We couldn't find that group. Double-check the name and password with whoever created it."
        : msg.includes('already')
        ? 'You are already a member of this Care Group.'
        : 'Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleShareInvite() {
    const url = inviteUrl ?? `https://carecompanionai.org`
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await Share.share({
      title: 'Join my Care Group',
      message: `Join my Care Group on CareCompanion: ${url}`,
      url,
    })
  }

  async function handleRegenerateInvite() {
    if (!careGroupId || !csrfToken) return
    try {
      const invite = await apiClient.careGroup.invite(careGroupId, csrfToken)
      setInviteUrl(invite.url)
      void handleShareInvite()
    } catch {
      // silent fail
    }
  }

  const passwordValid = password.length >= 4
  const isCreateMode = step === 'create-form'

  // ── Loading ──────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  // ── Already a member ─────────────────────────────────────────────────────
  if (step === 'already-member') {
    return (
      <View style={styles.container}>
        <GlassCard style={styles.alreadyCard}>
          <View style={styles.alreadyHeader}>
            <Text style={styles.alreadyEmoji}>💜</Text>
            <View>
              <Text style={[styles.alreadyTitle, { color: theme.text }]}>Your Care Group</Text>
              <Text style={[styles.alreadySub, { color: theme.textMuted }]}>
                {members.length > 0 ? `${members.length} member${members.length !== 1 ? 's' : ''}` : 'Just you so far'}
              </Text>
            </View>
          </View>
        </GlassCard>

        {members.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>MEMBERS</Text>
            {members.map(m => {
              const name = m.display_name || m.email || 'Member'
              const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
              return (
                <GlassCard key={m.id} style={styles.memberCard}>
                  <View style={styles.memberRow}>
                    <View style={[styles.avatar, { backgroundColor: 'rgba(99,102,241,0.18)' }]}>
                      <Text style={[styles.avatarText, { color: '#fff' }]}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.memberName, { color: theme.text }]}>{name}</Text>
                      <Text style={[styles.memberRole, { color: theme.accentHover }]}>
                        {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              )
            })}
          </View>
        )}

        {members.length === 0 && (
          <GlassCard style={{ ...styles.inviteCard, alignItems: 'center' }}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>📨</Text>
            <Text style={[styles.inviteTitle, { color: theme.text }]}>Invite a care partner</Text>
            <Text style={[styles.inviteSub, { color: theme.textMuted }]}>
              Share the group name and password with them so they can join.
            </Text>
          </GlassCard>
        )}
      </View>
    )
  }

  // ── Connected celebration ────────────────────────────────────────────────
  if (step === 'connected') {
    return (
      <View style={styles.centered}>
        <Text style={styles.celebEmoji}>🎉</Text>
        <Text style={[styles.celebTitle, { color: theme.text }]}>You're connected!</Text>
        <Text style={[styles.celebSub, { color: theme.textMuted }]}>
          {connectedName} has joined your Care Group.
        </Text>
        <Pressable
          onPress={() => { setStep('already-member'); void apiClient.careTeam.list().then(raw => { const d = raw as { members: Member[] }; setMembers((d.members ?? []).filter(m => m.role !== 'owner')) }) }}
          style={[styles.primaryBtn, { backgroundColor: theme.accent, marginTop: 24 }]}
        >
          <Text style={styles.primaryBtnText}>View group →</Text>
        </Pressable>
      </View>
    )
  }

  // ── Joined success ───────────────────────────────────────────────────────
  if (step === 'joined') {
    return (
      <View style={styles.centered}>
        <Text style={styles.celebEmoji}>💜</Text>
        <Text style={[styles.celebTitle, { color: theme.text }]}>You've joined!</Text>
        <Text style={[styles.celebSub, { color: theme.textMuted }]}>
          You're now part of the "{connectedName}" Care Group.
        </Text>
        <Pressable
          onPress={() => { setStep('already-member') }}
          style={[styles.primaryBtn, { backgroundColor: theme.accent, marginTop: 24 }]}
        >
          <Text style={styles.primaryBtnText}>View group →</Text>
        </Pressable>
      </View>
    )
  }

  // ── Invite / waiting ─────────────────────────────────────────────────────
  if (step === 'invite') {
    return (
      <View style={styles.container}>
        <GlassCard style={styles.inviteCard}>
          <Text style={[styles.inviteTitle, { color: theme.text }]}>Share your invite link</Text>
          <Text style={[styles.inviteSub, { color: theme.textMuted }]}>
            Your care partner can join by clicking this link. It expires in 7 days.
          </Text>
          {inviteUrl ? (
            <Pressable
              onPress={() => void handleShareInvite()}
              style={[styles.shareBtn, { backgroundColor: theme.accent }]}
            >
              <Ionicons name="share-outline" size={16} color="#fff" />
              <Text style={styles.shareBtnText}>Share invite link</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void handleRegenerateInvite()}
              style={[styles.shareBtn, { backgroundColor: 'rgba(99,102,241,0.3)', borderColor: theme.border, borderWidth: 1 }]}
            >
              <Text style={[styles.shareBtnText, { color: theme.accentHover }]}>Generate invite link</Text>
            </Pressable>
          )}
        </GlassCard>

        <View style={[styles.waitingRow, { backgroundColor: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.2)' }]}>
          <View style={[styles.pulsingDot, { backgroundColor: theme.accent }]} />
          <Text style={[styles.waitingText, { color: theme.textSub }]}>
            {partnerJoined ? 'Partner joined!' : 'Waiting for them to join…'}
          </Text>
        </View>

        <Pressable
          onPress={() => setStep('already-member')}
          style={styles.skipBtn}
        >
          <Text style={[styles.skipText, { color: theme.textMuted }]}>
            Continue without waiting — I'll invite them later
          </Text>
        </Pressable>
      </View>
    )
  }

  // ── Form steps ───────────────────────────────────────────────────────────
  const isFormStep = step === 'create-form' || step === 'join-form'

  return (
    <View style={styles.container}>
      {/* Title */}
      <View style={styles.titleBlock}>
        <Text style={[styles.screenTitle, { color: theme.text }]}>Your Care Group 💜</Text>
        <Text style={[styles.screenSub, { color: theme.textMuted }]}>
          {step === 'pick'
            ? 'Connect with family or a caregiver to coordinate care together.'
            : isCreateMode
            ? "Choose a group name and shared password, then invite your care partner."
            : "Enter the group name and password shared with you."}
        </Text>
      </View>

      {/* Pick step */}
      {step === 'pick' && (
        <View style={styles.pickGroup}>
          <GlassCard
            onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep('create-form') }}
            style={styles.pickCard}
          >
            <Text style={[styles.pickTitle, { color: theme.text }]}>✨ Create a Care Group</Text>
            <Text style={[styles.pickSub, { color: theme.textMuted }]}>
              You're first. Choose a name and password, then invite your care partner.
            </Text>
          </GlassCard>
          <GlassCard
            onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep('join-form') }}
            style={styles.pickCard}
          >
            <Text style={[styles.pickTitle, { color: theme.text }]}>🔗 Join an existing group</Text>
            <Text style={[styles.pickSub, { color: theme.textMuted }]}>
              Someone already set one up. Enter the name and password they shared with you.
            </Text>
          </GlassCard>
        </View>
      )}

      {/* Form step */}
      {isFormStep && (
        <View style={styles.formGroup}>
          <Pressable
            onPress={() => { setStep('pick'); setError(''); setGroupName(''); setPassword('') }}
            style={styles.backRow}
          >
            <Ionicons name="chevron-back" size={14} color={theme.textMuted} />
            <Text style={[styles.backText, { color: theme.textMuted }]}>Back</Text>
          </Pressable>

          {/* Group name */}
          <View style={[styles.inputWrap, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.lavender }]}>Group name</Text>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="e.g. The Smith Family"
              placeholderTextColor={theme.textMuted}
              style={[styles.inputField, { color: theme.text }]}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={[styles.inputWrap, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.lavender }]}>
              {isCreateMode ? 'Choose a shared password' : 'Group password'}
            </Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="At least 4 characters"
                placeholderTextColor={theme.textMuted}
                style={[styles.inputField, { color: theme.text, flex: 1 }]}
                autoComplete={isCreateMode ? 'new-password' : 'current-password'}
                returnKeyType="done"
                onSubmitEditing={() => { if (isCreateMode) void handleCreate(); else void handleJoin() }}
              />
              <Pressable onPress={() => setShowPassword(v => !v)} style={{ padding: 4 }}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={theme.textMuted}
                />
              </Pressable>
            </View>
            {isCreateMode && password.length > 0 && (
              <View style={styles.passwordStrength}>
                <View style={[styles.strengthDot, { backgroundColor: passwordValid ? theme.green : theme.textMuted }]} />
                <Text style={[styles.strengthText, { color: passwordValid ? theme.green : theme.textMuted }]}>
                  {passwordValid
                    ? 'Good — share this with your care partner'
                    : `${4 - password.length} more character${4 - password.length !== 1 ? 's' : ''} needed`}
                </Text>
              </View>
            )}
            {isCreateMode && password.length === 0 && (
              <Text style={[styles.strengthHint, { color: theme.textMuted }]}>
                At least 4 characters. Share this with your care partner so they can join.
              </Text>
            )}
          </View>

          {/* Error */}
          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }]}>
              <Ionicons name="warning-outline" size={14} color="#F87171" style={{ marginTop: 1 }} />
              <Text style={[styles.errorText, { color: '#F87171' }]}>{error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <Pressable
            onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); if (isCreateMode) void handleCreate(); else void handleJoin() }}
            disabled={submitting || !groupName.trim() || !password || (isCreateMode && !passwordValid)}
            style={[
              styles.submitBtn,
              (submitting || !groupName.trim() || !password || (isCreateMode && !passwordValid)) && { opacity: 0.4 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isCreateMode ? 'Create Group' : 'Join Group'}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  centered: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 16 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4, marginLeft: 2 },

  alreadyCard: { padding: 16 },
  alreadyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alreadyEmoji: { fontSize: 28 },
  alreadyTitle: { fontSize: 16, fontWeight: '700' },
  alreadySub: { fontSize: 12, marginTop: 2 },

  memberCard: { marginBottom: 0 },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  memberName: { fontSize: 15, fontWeight: '600' },
  memberRole: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  celebEmoji: { fontSize: 52, marginBottom: 16 },
  celebTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  celebSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  inviteCard: { gap: 10 },
  inviteTitle: { fontSize: 15, fontWeight: '600' },
  inviteSub: { fontSize: 13, lineHeight: 18 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12, alignSelf: 'flex-start' },
  shareBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  pulsingDot: { width: 8, height: 8, borderRadius: 4 },
  waitingText: { fontSize: 12 },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: { fontSize: 12, textAlign: 'center' },

  titleBlock: { gap: 4, marginBottom: 4 },
  screenTitle: { fontSize: 18, fontWeight: '700' },
  screenSub: { fontSize: 13, lineHeight: 18 },

  pickGroup: { gap: 10 },
  pickCard: { gap: 4 },
  pickTitle: { fontSize: 14, fontWeight: '600' },
  pickSub: { fontSize: 12, lineHeight: 17 },

  formGroup: { gap: 12 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { fontSize: 13 },

  inputWrap: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  inputLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4, marginBottom: 4 },
  inputField: { fontSize: 14, padding: 0 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passwordStrength: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  strengthDot: { width: 6, height: 6, borderRadius: 3 },
  strengthText: { fontSize: 10 },
  strengthHint: { fontSize: 10, marginTop: 4, lineHeight: 14 },

  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  errorText: { fontSize: 12, flex: 1, lineHeight: 17 },

  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#6366F1' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  primaryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
