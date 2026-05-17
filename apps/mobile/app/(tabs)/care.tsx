// apps/mobile/app/(tabs)/care.tsx
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTheme } from '../../src/theme'
import { GlassCard } from '../../src/components/GlassCard'
import { hapticMedTaken } from '../../src/utils/haptics'
import { useStaggerEntrance } from '../../src/hooks/useStaggerEntrance'
import { TabFadeWrapper } from './_layout'
import { useProfile } from '../../src/context/ProfileContext'
import { DEV_STORE_MEDS_KEY, DEV_STORE_LABS_KEY } from '../../src/services/healthkit'
import { CareGroupTab } from '../../src/components/care/CareGroupTab'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

// ─── Types ────────────────────────────────────────────────────────────────────

type MedStatus = 'taken' | 'upcoming' | 'overdue'

interface Med {
  id: string
  logId?: string
  name: string
  dose: string
  time: string
  status: MedStatus
  isAsNeeded: boolean
  refillDueInDays?: number
}

interface Lab {
  id: string
  name: string
  value: string
  range: string
  date: string
  status: 'normal' | 'borderline' | 'abnormal'
}

interface Appointment {
  id: string
  doctorName: string | null
  specialty: string | null
  date?: string
  dateTime?: string
  location: string | null
  purpose: string | null
  notes?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function isChemoAppointment(appt: Appointment): boolean {
  const keywords = ['chemo', 'infusion', 'herceptin', 'perjeta', 'taxotere', 'oncol', 'carboplatin', 'taxol', 'cytoxan']
  const text = [appt.specialty, appt.purpose, appt.notes, appt.doctorName]
    .filter(Boolean).join(' ').toLowerCase()
  return keywords.some(k => text.includes(k))
}

function isNadirPeriod(labs: Lab[]): boolean {
  return labs.some(l => {
    const n = l.name.toLowerCase()
    return (n.includes('wbc') || n.includes('neutrophil') || n === 'anc' || n.startsWith('anc ')) &&
      l.status === 'abnormal'
  })
}

// ─── ChemoCountdownBanner ─────────────────────────────────────────────────────

function ChemoCountdownBanner({ appointments, onPrep }: {
  appointments: Appointment[]
  onPrep: () => void
}) {
  const theme = useTheme()
  const chemo = appointments
    .filter(a => {
      const ds = a.date || a.dateTime
      if (!ds) return false
      const d = daysUntil(ds)
      return d >= 0 && d <= 7 && isChemoAppointment(a)
    })
    .sort((a, b) =>
      new Date(a.date || a.dateTime || 0).getTime() - new Date(b.date || b.dateTime || 0).getTime()
    )

  if (chemo.length === 0) return null

  const next = chemo[0]
  const days = daysUntil(next.date || next.dateTime!)
  const urgent = days <= 3
  const accentColor = urgent ? '#FBBF24' : '#818CF8'
  const bg = urgent ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)'
  const border = urgent ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'
  const dayLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`
  const detail = [next.purpose, next.specialty].filter(Boolean).join(' · ')

  return (
    <View style={[styles.chemoBanner, { backgroundColor: bg, borderColor: border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.chemoTitle, { color: accentColor }]}>
          {urgent ? '⚠️ ' : '💊 '}Chemo {dayLabel}
        </Text>
        {!!detail && (
          <Text style={[styles.chemoDetail, { color: theme.textMuted }]} numberOfLines={1}>{detail}</Text>
        )}
        {!!next.location && (
          <Text style={[styles.chemoDetail, { color: theme.textMuted }]} numberOfLines={1}>📍 {next.location}</Text>
        )}
      </View>
      <Pressable
        style={[styles.chemoPrepBtn, { backgroundColor: accentColor + '22', borderColor: accentColor + '55' }]}
        onPress={onPrep}
      >
        <Text style={[styles.chemoPrepText, { color: accentColor }]}>Prep checklist →</Text>
      </Pressable>
    </View>
  )
}

// ─── ClinicalAlertsSection ────────────────────────────────────────────────────

function ClinicalAlertsSection({ labs, meds }: { labs: Lab[]; meds: Med[] }) {
  const theme = useTheme()
  type Alert = { key: string; color: string; bg: string; border: string; text: string; sub?: string }
  const alerts: Alert[] = []

  if (isNadirPeriod(labs)) {
    alerts.push({
      key: 'nadir',
      color: '#FCA5A5',
      bg: 'rgba(239,68,68,0.08)',
      border: 'rgba(239,68,68,0.25)',
      text: '⚠️ Nadir period — fever above 100.4°F requires immediate ER visit',
    })
  }

  meds.filter(m => m.refillDueInDays != null && (m.refillDueInDays as number) <= 3).forEach(m => {
    alerts.push({
      key: `refill-${m.id}`,
      color: '#FBBF24',
      bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.25)',
      text: `Refill needed · ${m.name}`,
      sub: m.refillDueInDays === 0 ? 'Due today' : `Due in ${m.refillDueInDays} day${m.refillDueInDays === 1 ? '' : 's'}`,
    })
  })

  if (alerts.length === 0) return null

  return (
    <View style={{ gap: 8 }}>
      {alerts.map(a => (
        <View key={a.key} style={[styles.alertBanner, { backgroundColor: a.bg, borderColor: a.border }]}>
          <View style={[styles.alertDot, { backgroundColor: a.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertText, { color: theme.text }]}>{a.text}</Text>
            {!!a.sub && <Text style={[styles.alertSub, { color: theme.textMuted }]}>{a.sub}</Text>}
          </View>
        </View>
      ))}
    </View>
  )
}

// ─── BreathingDot ─────────────────────────────────────────────────────────────

function BreathingDot({ status }: { status: MedStatus }) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.6)

  const config: Record<MedStatus, { maxScale: number; period: number; color: string }> = {
    taken: { maxScale: 1.2, period: 3000, color: theme.green },
    upcoming: { maxScale: 1.3, period: 1500, color: theme.amber },
    overdue: { maxScale: 1.4, period: 800, color: theme.rose },
  }
  const { maxScale, period, color } = config[status]

  useEffect(() => {
    if (reduceMotion) return
    scale.value = withRepeat(
      withSequence(
        withTiming(maxScale, { duration: period / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    )
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: period / 2 }),
        withTiming(0.6, { duration: period / 2 }),
      ), -1, false,
    )
  }, [reduceMotion, scale, opacity, maxScale, period])

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={[{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: color }, dotStyle]} />
  )
}

// ─── TodayMedsSection ─────────────────────────────────────────────────────────

function MedStatusRow({ med, onTake, onDelete, disabled }: {
  med: Med
  onTake: (logId: string, medId: string) => void
  onDelete?: (med: Med) => void
  disabled?: boolean
}) {
  const theme = useTheme()
  const taken = med.status === 'taken'
  const rowOpacity = useSharedValue(taken ? 0.55 : 1)
  const checkScale = useSharedValue(taken ? 1 : 0)

  const rowStyle = useAnimatedStyle(() => ({ opacity: rowOpacity.value }))
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }))

  const canTake = !taken && !disabled && !!med.logId

  function handleTake() {
    if (!canTake || !med.logId) return
    rowOpacity.value = withTiming(0.55, { duration: 300 })
    checkScale.value = withSpring(1, { damping: 8, stiffness: 300 })
    onTake(med.logId, med.id)
  }

  return (
    <Animated.View style={[styles.medRow, rowStyle]}>
      <BreathingDot status={med.status} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.medName, { color: theme.text, textDecorationLine: taken ? 'line-through' : 'none' }]}>
            {med.name}{med.dose ? ` ${med.dose}` : ''}
          </Text>
          {med.refillDueInDays != null && (med.refillDueInDays as number) <= 3 && (
            <View style={[styles.refillBadge, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)' }]}>
              <Text style={{ fontSize: 9, color: '#FBBF24', fontWeight: '700' }}>REFILL</Text>
            </View>
          )}
        </View>
        {!!med.time && (
          <Text style={[styles.medTime, { color: theme.textMuted }]}>{med.time}</Text>
        )}
      </View>
      <Pressable
        onPress={canTake ? handleTake : undefined}
        style={[styles.checkBtn, !canTake && !taken && { opacity: 0.35 }]}
        accessibilityLabel={taken ? 'Taken' : 'Mark as taken'}
      >
        <Animated.View style={[
          styles.checkInner,
          { borderColor: taken ? theme.accent : theme.border },
          taken && { backgroundColor: theme.accent },
          checkStyle,
        ]}>
          {taken && <Text style={styles.checkMark}>✓</Text>}
        </Animated.View>
      </Pressable>
      {onDelete && (
        <Pressable
          onPress={() => onDelete(med)}
          hitSlop={10}
          accessibilityLabel={`Delete ${med.name}`}
          style={{ marginLeft: 6, padding: 4 }}
        >
          <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
        </Pressable>
      )}
    </Animated.View>
  )
}

function TodayMedsSection({ meds, onTake, takingId, onAdd, onDelete }: {
  meds: Med[]
  onTake: (logId: string, medId: string) => void
  takingId: string | null
  onAdd?: () => void
  onDelete?: (med: Med) => void
}) {
  const theme = useTheme()

  const dueNow = meds.filter(m => !m.isAsNeeded && (m.status === 'upcoming' || m.status === 'overdue'))
  const takenToday = meds.filter(m => !m.isAsNeeded && m.status === 'taken')
  const asNeeded = meds.filter(m => m.isAsNeeded)

  function Group({ label, items, color }: { label: string; items: Med[]; color: string }) {
    if (items.length === 0) return null
    return (
      <View style={{ marginBottom: 14 }}>
        <Text style={[styles.medGroupLabel, { color }]}>{label}</Text>
        {items.map(m => (
          <MedStatusRow key={m.id} med={m} onTake={onTake} onDelete={onDelete} disabled={takingId === m.id} />
        ))}
      </View>
    )
  }

  return (
    <GlassCard style={styles.sectionCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={[styles.sectionLabel, { color: theme.textMuted, marginBottom: 0 }]}>TODAY'S MEDICATIONS</Text>
        {onAdd && (
          <Pressable
            onPress={onAdd}
            hitSlop={10}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            accessibilityLabel="Add medication"
          >
            <Ionicons name="add-circle" size={20} color={theme.accent} />
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>Add</Text>
          </Pressable>
        )}
      </View>
      {meds.length === 0 ? (
        <Text style={{ color: theme.textMuted, fontSize: 14, lineHeight: 19 }}>
          No medications yet — tap Add to start.
        </Text>
      ) : (
        <>
          <Group label="DUE NOW" items={dueNow} color={theme.rose} />
          <Group label="TAKEN TODAY" items={takenToday} color={theme.green} />
          <Group label="AS NEEDED" items={asNeeded} color={theme.textMuted} />
        </>
      )}
    </GlassCard>
  )
}

// ─── UpcomingSection ──────────────────────────────────────────────────────────

function UpcomingSection({ appointments, onPrep }: {
  appointments: Appointment[]
  onPrep: () => void
}) {
  const theme = useTheme()
  const upcoming = appointments
    .filter(a => {
      const ds = a.date || a.dateTime
      return !!ds && daysUntil(ds) >= 0
    })
    .sort((a, b) =>
      new Date(a.date || a.dateTime || 0).getTime() - new Date(b.date || b.dateTime || 0).getTime()
    )
    .slice(0, 4)

  if (upcoming.length === 0) return null

  return (
    <GlassCard style={styles.sectionCard}>
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>UPCOMING</Text>
      {upcoming.map((appt, i) => {
        const ds = appt.date || appt.dateTime
        const d = ds ? new Date(ds) : null
        const days = ds ? daysUntil(ds) : null
        const within48h = days != null && days <= 2
        const dateLabel = d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
        const timeLabel = d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''

        return (
          <View
            key={appt.id || i}
            style={[
              styles.apptItem,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: 12, marginTop: 12 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.apptDoctor, { color: theme.text }]} numberOfLines={1}>
                {appt.doctorName || 'Appointment'}
              </Text>
              {!!appt.specialty && (
                <Text style={[styles.apptMeta, { color: theme.accentHover }]}>{appt.specialty}</Text>
              )}
              <Text style={[styles.apptMeta, { color: theme.textMuted }]}>
                {[dateLabel, timeLabel, appt.location].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {within48h && (
              <Pressable
                style={[styles.prepBtn, { backgroundColor: 'rgba(99,102,241,0.13)', borderColor: 'rgba(99,102,241,0.3)' }]}
                onPress={onPrep}
              >
                <Text style={[styles.prepBtnText, { color: '#818CF8' }]}>Prep ✓</Text>
              </Pressable>
            )}
          </View>
        )
      })}
    </GlassCard>
  )
}

// ─── InviteFamilyBanner ───────────────────────────────────────────────────────

function InviteFamilyBanner({ onPress }: { onPress: () => void }) {
  const theme = useTheme()
  return (
    <Pressable
      style={[styles.inviteBanner, { backgroundColor: 'rgba(99,102,241,0.07)', borderColor: 'rgba(99,102,241,0.18)' }]}
      onPress={onPress}
    >
      <Ionicons name="people-outline" size={14} color="#818CF8" />
      <Text style={[styles.inviteText, { color: theme.textMuted }]}>Invite family to help coordinate care</Text>
      <Ionicons name="chevron-forward" size={12} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
    </Pressable>
  )
}

// ─── CareGroupSection ─────────────────────────────────────────────────────────

function CareGroupSection({ apiClient, csrfToken }: { apiClient: any; csrfToken: string }) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)

  return (
    <GlassCard style={styles.sectionCard}>
      <Pressable style={styles.sectionHeader} onPress={() => setExpanded(e => !e)}>
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>CARE GROUP</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textMuted} />
      </Pressable>
      {expanded && (
        <CareGroupTab apiClient={apiClient} csrfToken={csrfToken} />
      )}
    </GlassCard>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CareScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { profile, csrfToken, apiClient } = useProfile()
  const router = useRouter()

  const [meds, setMeds] = useState<Med[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [hasGroup, setHasGroup] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [focusKey, setFocusKey] = useState(0)
  const [takingId, setTakingId] = useState<string | null>(null)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', dose: '', frequency: '', prescribingDoctor: '' })
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [inviteModalVisible, setInviteModalVisible] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer')
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  const patientLabel = profile?.patientName ?? 'your loved one'
  const patientFirstName = patientLabel.split(' ')[0]
  const stagger = useStaggerEntrance(3)

  useEffect(() => {
    if (!profile?.careProfileId) {
      if (__DEV__) {
        Promise.all([
          AsyncStorage.getItem(DEV_STORE_MEDS_KEY).then((v) => (v ? JSON.parse(v) : [])).catch(() => []),
          AsyncStorage.getItem(DEV_STORE_LABS_KEY).then((v) => (v ? JSON.parse(v) : [])).catch(() => []),
        ]).then(([devMeds, devLabs]) => {
          setMeds((devMeds as any[]).map((m) => ({
            id: m.id,
            logId: undefined,
            name: m.name,
            dose: m.dose || '',
            time: m.frequency || '',
            status: 'upcoming' as MedStatus,
            isAsNeeded: false,
            refillDueInDays: undefined,
          })))
          setLabs((devLabs as any[]).map((l) => ({
            id: l.id,
            name: l.testName,
            value: String(l.value ?? ''),
            range: l.referenceRange || '',
            date: l.dateTaken
              ? new Date(l.dateTaken).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '',
            status: (l.isAbnormal ? 'abnormal' : 'normal') as 'normal' | 'abnormal',
          })))
        }).catch(() => {}).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
      return
    }
    const careProfileId = profile.careProfileId
    setLoading(true)

    const fetchAll = async () => {
      try {
        const token = await SecureStore.getItemAsync('cc-session-token')
        const [medsRaw, labsRaw, apptsRaw, teamRaw] = await Promise.all([
          apiClient.medications.list(careProfileId).catch(() => []),
          apiClient.labResults.list(careProfileId).catch(() => ({ labs: [] })),
          apiClient.appointments.list(careProfileId).catch(() => []),
          apiClient.careTeam.list().catch(() => ({ members: [], invites: [], role: null })),
        ])

        const medsData: any[] = Array.isArray(medsRaw) ? medsRaw : ((medsRaw as any)?.data ?? [])
        setMeds(medsData.map((m: any) => ({
          id: m.id,
          logId: m.logId || m.reminderLogId || undefined,
          name: m.name,
          dose: m.dose || '',
          time: m.frequency || '',
          status: (m.status === 'taken' || m.status === 'overdue' ? m.status : 'upcoming') as MedStatus,
          isAsNeeded: !!(m.isAsNeeded || m.frequency?.toLowerCase().includes('as needed')),
          refillDueInDays: m.refillDueInDays ?? undefined,
        })))

        const labsData: any[] = Array.isArray(labsRaw)
          ? labsRaw
          : ((labsRaw as any)?.data ?? (labsRaw as any)?.labs ?? [])
        const labsList: any[] = Array.isArray(labsData) ? labsData : ((labsData as any)?.labs ?? [])
        setLabs(labsList.map((l: any) => ({
          id: l.id,
          name: l.testName,
          value: String(l.value),
          range: l.referenceRange || '',
          date: l.dateTaken ? new Date(l.dateTaken).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
          status: l.isAbnormal ? 'abnormal' : 'normal',
        })))

        const apptsData: any[] = Array.isArray(apptsRaw) ? apptsRaw : ((apptsRaw as any)?.data ?? [])
        setAppointments(apptsData.sort((a: any, b: any) =>
          new Date(a.date || a.dateTime || 0).getTime() - new Date(b.date || b.dateTime || 0).getTime()
        ))

        const members: any[] = (teamRaw as any)?.members ?? []
        setHasGroup(members.filter((m: any) => m.role !== 'owner').length > 0)

        setError(null)
      } catch (err: any) {
        setError(`Failed to load: ${err?.message || 'Unknown error'}`)
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [profile?.careProfileId, retryCount, focusKey])

  // Reload when the tab is focused — catches post-HealthKit-connect navigation
  // and any other scenario where tabs were already mounted.
  useFocusEffect(
    useCallback(() => {
      setFocusKey(k => k + 1)
    }, []),
  )

  async function markAsTaken(logId: string, medId: string) {
    if (takingId) return
    setTakingId(medId)
    try {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const res = await fetch(`${API_BASE}/api/reminders/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ log_id: logId, status: 'taken' }),
      })
      if (res.ok) {
        setMeds(prev => prev.map(m => m.id === medId ? { ...m, status: 'taken' as MedStatus } : m))
        hapticMedTaken()
      }
    } catch {
      // silent — no status change signals the action didn't register
    } finally {
      setTakingId(null)
    }
  }

  async function handleAddMed() {
    const name = addForm.name.trim()
    if (!name) {
      Alert.alert('Name required', 'Enter a medication name.')
      return
    }
    if (!profile?.careProfileId) {
      Alert.alert('Care profile not loaded', 'Try again in a moment.')
      return
    }
    if (!csrfToken) {
      Alert.alert('Session not ready', 'Restart the app and try again.')
      return
    }
    setAddSubmitting(true)
    try {
      // Backend expects snake_case keys (see apps/web/src/app/api/records/medications/route.ts).
      const created = await apiClient.medications.create(
        {
          name,
          dose: addForm.dose.trim() || null,
          frequency: addForm.frequency.trim() || null,
          prescribing_doctor: addForm.prescribingDoctor.trim() || null,
          care_profile_id: profile.careProfileId,
        } as any,
        csrfToken,
      )
      // Server may return raw object or { ok, data } depending on the wrapper.
      const data = (created as any)?.data ?? created
      const newMed: Med = {
        id: data?.id ?? `local-${Date.now()}`,
        name: data?.name ?? name,
        dose: data?.dose || addForm.dose || '',
        time: data?.frequency || addForm.frequency || '',
        status: 'upcoming',
        isAsNeeded: !!((data?.frequency ?? addForm.frequency).toLowerCase?.().includes('as needed')),
      }
      setMeds(prev => [newMed, ...prev])
      setAddForm({ name: '', dose: '', frequency: '', prescribingDoctor: '' })
      setAddModalVisible(false)
    } catch (err: any) {
      Alert.alert('Could not add medication', err?.message || 'Try again.')
    } finally {
      setAddSubmitting(false)
    }
  }

  function handleDeleteMed(med: Med) {
    Alert.alert(
      `Delete ${med.name}?`,
      'This removes the medication from your care profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.medications.delete(med.id, csrfToken || '')
              setMeds(prev => prev.filter(m => m.id !== med.id))
            } catch (err: any) {
              Alert.alert('Could not delete', err?.message || 'Try again.')
            }
          },
        },
      ],
    )
  }

  return (
    <TabFadeWrapper>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Animated.View style={stagger[0]}>
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Care</Text>
                <Text style={[styles.headerSub, { color: theme.textMuted }]}>Caring for {patientLabel}</Text>
              </View>
              <Pressable
                onPress={() => { setError(null); setRetryCount(c => c + 1) }}
                style={[styles.refreshBtn, { backgroundColor: theme.bgElevated }]}
                hitSlop={8}
              >
                <Ionicons name="refresh-outline" size={15} color={theme.textMuted} />
              </Pressable>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[stagger[1], { flex: 1 }]}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          ) : error ? (
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
              <GlassCard style={{ padding: 32, alignItems: 'center' }}>
                <Ionicons name="alert-circle-outline" size={40} color={theme.rose} style={{ marginBottom: 12 }} />
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>Something went wrong</Text>
                <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>{error}</Text>
                <Pressable
                  onPress={() => { setError(null); setRetryCount(c => c + 1) }}
                  style={{ backgroundColor: theme.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
                </Pressable>
              </GlassCard>
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={[stagger[2], { gap: 12 }]}>
                <ChemoCountdownBanner
                  appointments={appointments}
                  onPrep={() => router.push('/visit-prep')}
                />

                <ClinicalAlertsSection labs={labs} meds={meds} />

                <TodayMedsSection
                  meds={meds}
                  onTake={markAsTaken}
                  takingId={takingId}
                  onAdd={() => setAddModalVisible(true)}
                  onDelete={handleDeleteMed}
                />

                <UpcomingSection
                  appointments={appointments}
                  onPrep={() => router.push('/visit-prep')}
                />

                <InviteFamilyBanner onPress={() => {
                  setInviteError(null)
                  setInviteSuccess(null)
                  setInviteEmail('')
                  setInviteRole('viewer')
                  setInviteModalVisible(true)
                }} />

                <CareGroupSection apiClient={apiClient} csrfToken={csrfToken ?? ''} />
              </Animated.View>
            </ScrollView>
          )}
        </Animated.View>
      </View>

      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: theme.bg }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
            <Pressable
              onPress={() => setAddModalVisible(false)}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingVertical: 6, paddingHorizontal: 4 })}
            >
              <Text style={{ color: theme.textMuted, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Add medication</Text>
            <View style={{ width: 56 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <FormField
              label="Name"
              value={addForm.name}
              onChangeText={(t: string) => setAddForm(f => ({ ...f, name: t }))}
              placeholder="e.g. Tamoxifen"
              autoFocus
              theme={theme}
            />
            <FormField
              label="Dose"
              value={addForm.dose}
              onChangeText={(t: string) => setAddForm(f => ({ ...f, dose: t }))}
              placeholder="e.g. 20 mg"
              theme={theme}
            />
            <FormField
              label="Frequency"
              value={addForm.frequency}
              onChangeText={(t: string) => setAddForm(f => ({ ...f, frequency: t }))}
              placeholder="e.g. Once daily"
              theme={theme}
            />
            <FormField
              label="Prescribing doctor"
              value={addForm.prescribingDoctor}
              onChangeText={(t: string) => setAddForm(f => ({ ...f, prescribingDoctor: t }))}
              placeholder="Optional"
              theme={theme}
            />
          </ScrollView>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }}>
            <Pressable
              onPress={handleAddMed}
              style={({ pressed }) => ({
                backgroundColor: theme.accent,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
              accessibilityRole="button"
              accessibilityState={{ busy: addSubmitting }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                {addSubmitting ? 'Saving…' : 'Save medication'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Invite to care team */}
      <Modal
        visible={inviteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: theme.bg }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
            <Pressable
              onPress={() => setInviteModalVisible(false)}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingVertical: 6, paddingHorizontal: 4 })}
            >
              <Text style={{ color: theme.textMuted, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Invite to care team</Text>
            <View style={{ width: 56 }} />
          </View>

          <View style={{ padding: 20, gap: 14 }}>
            <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 18 }}>
              We'll email them an invite. They'll be able to see check-ins, meds, and labs.
            </Text>

            <FormField
              label="Email"
              value={inviteEmail}
              onChangeText={(t) => { setInviteEmail(t); setInviteError(null); setInviteSuccess(null) }}
              placeholder="family@example.com"
              autoFocus
              theme={theme}
            />

            <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 4 }}>ROLE</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['viewer', 'editor'] as const).map((r) => {
                const active = inviteRole === r
                return (
                  <Pressable
                    key={r}
                    onPress={() => setInviteRole(r)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? '#A78BFA' : theme.border,
                      backgroundColor: active ? 'rgba(167,139,250,0.12)' : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: active ? '#A78BFA' : theme.text, fontWeight: '700', fontSize: 14 }}>
                      {r === 'viewer' ? 'Viewer' : 'Editor'}
                    </Text>
                    <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 3 }}>
                      {r === 'viewer' ? 'Read-only' : 'Can add/edit'}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {inviteError && (
              <Text style={{ color: '#F87171', fontSize: 13 }}>{inviteError}</Text>
            )}
            {inviteSuccess && (
              <Text style={{ color: '#34D399', fontSize: 13 }}>{inviteSuccess}</Text>
            )}

            <Pressable
              disabled={inviteSubmitting || !inviteEmail.trim() || !csrfToken}
              onPress={async () => {
                if (!csrfToken) {
                  setInviteError('Still loading your account. Try again in a moment.')
                  return
                }
                setInviteSubmitting(true)
                setInviteError(null)
                setInviteSuccess(null)
                try {
                  await apiClient.careTeam.invite(inviteEmail.trim(), inviteRole, csrfToken)
                  setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}.`)
                  setInviteEmail('')
                } catch (err) {
                  setInviteError(err instanceof Error ? err.message : 'Could not send invite')
                } finally {
                  setInviteSubmitting(false)
                }
              }}
              style={({ pressed }) => ({
                marginTop: 12,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: '#A78BFA',
                alignItems: 'center',
                opacity: pressed || inviteSubmitting || !inviteEmail.trim() || !csrfToken ? 0.6 : 1,
              })}
            >
              <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>
                {inviteSubmitting ? 'Sending…' : 'Send invite'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </TabFadeWrapper>
  )
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus,
  theme,
}: {
  label: string
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
  autoFocus?: boolean
  theme: ReturnType<typeof useTheme>
}) {
  return (
    <View>
      <Text style={{ color: theme.textMuted, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '600', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        autoFocus={autoFocus}
        style={{
          color: theme.text,
          fontSize: 16,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: 'rgba(255,255,255,0.04)',
        }}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  headerSub: { fontSize: 13, marginTop: 2 },
  refreshBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  // Chemo banner
  chemoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  chemoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  chemoDetail: { fontSize: 12, marginTop: 1 },
  chemoPrepBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chemoPrepText: { fontSize: 11, fontWeight: '700' },

  // Alerts
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  alertDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 4, flexShrink: 0 },
  alertText: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  alertSub: { fontSize: 11, marginTop: 2 },

  // Radar
  radarCard: { overflow: 'hidden' },
  radarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  radarTimestamp: { fontSize: 10, fontWeight: '500' },
  orbsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  orbContainer: { alignItems: 'center', gap: 8 },
  orb: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbValue: { fontSize: 13, fontWeight: '800' },
  orbLabel: { fontSize: 11, fontWeight: '500' },
  sparkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sparkLabel: { fontSize: 10, width: 50 },
  noCheckinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    paddingTop: 12,
    gap: 10,
  },
  noCheckinText: { fontSize: 12, flex: 1 },
  remindBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  remindBtnText: { fontSize: 12, fontWeight: '600' },

  // Meds
  sectionCard: { marginBottom: 0 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  medGroupLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  medRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  medName: { fontSize: 14, fontWeight: '600' },
  medTime: { fontSize: 12, marginTop: 2 },
  refillBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  checkBtn: { padding: 4 },
  checkInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyHint: { fontSize: 12 },

  // Appointments
  apptItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  apptDoctor: { fontSize: 14, fontWeight: '600' },
  apptMeta: { fontSize: 12, marginTop: 2 },
  prepBtn: {
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  prepBtnText: { fontSize: 11, fontWeight: '700' },

  // AI Insights
  insightRow: { flexDirection: 'row', gap: 10, padding: 10, borderRadius: 10, alignItems: 'flex-start' },
  insightDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  insightTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  insightBody: { fontSize: 11, lineHeight: 16 },

  // Activity
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  activityAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(99,102,241,0.14)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  activityAvatarText: { fontSize: 10, fontWeight: '700', color: '#A78BFA' },
  activityText: { fontSize: 12 },
  activityTime: { fontSize: 10, marginTop: 2 },

  // Wellbeing
  wellbeingTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  wellbeingBody: { fontSize: 12, lineHeight: 18 },
  wellbeingStreak: { fontSize: 12, fontWeight: '600', marginTop: 8 },

  // Invite banner
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inviteText: { fontSize: 12, fontWeight: '500', flex: 1 },
})
