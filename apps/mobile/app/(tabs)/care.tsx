// apps/mobile/app/(tabs)/care.tsx
import React, { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
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
import * as SecureStore from 'expo-secure-store'
import { useRouter } from 'expo-router'
import { useTheme } from '../../src/theme'
import { GlassCard } from '../../src/components/GlassCard'
import { hapticMedTaken, hapticAbnormalLabEntrance } from '../../src/utils/haptics'
import { useStaggerEntrance } from '../../src/hooks/useStaggerEntrance'
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
import { TabFadeWrapper } from './_layout'
import { useProfile } from '../../src/context/ProfileContext'
import { CareGroupTab } from '../../src/components/care/CareGroupTab'
import { CareEmptyState } from '../../src/components/care/CareEmptyState'

type MedStatus = 'taken' | 'upcoming' | 'overdue'
type CareTab = 'meds' | 'appts' | 'labs' | 'journal' | 'team' | 'group'

interface JournalEntry {
  id: string
  date: string
  mood: string | null
  energy: string | null
  painLevel: number | null
  sleepHours: string | null
  symptoms: string[]
  notes: string | null
}

interface Doctor {
  id: string
  name: string
  specialty: string | null
  phone: string | null
  notes: string | null
}

interface TeamMember {
  id: string
  userId: string
  role: string
  email: string | null
  display_name: string
  joinedAt: string | null
}

const TAB_CONFIG: { key: CareTab; label: string }[] = [
  { key: 'meds', label: 'Meds' },
  { key: 'appts', label: 'Appts' },
  { key: 'labs', label: 'Labs' },
  { key: 'journal', label: 'Journal' },
  { key: 'team', label: 'Team' },
  { key: 'group', label: 'Group' },
]

interface Med {
  id: string
  logId?: string
  name: string
  dose: string
  time: string
  status: MedStatus
}

interface Lab {
  id: string
  name: string
  value: string
  range: string
  date: string
  status: 'normal' | 'borderline' | 'abnormal'
}

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
      ),
      -1,
      false,
    )
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: period / 2 }),
        withTiming(0.6, { duration: period / 2 }),
      ),
      -1,
      false,
    )
  }, [reduceMotion, scale, opacity, maxScale, period])

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, dotStyle]} />
  )
}

function MedRow({ med, onTake, disabled }: { med: Med; onTake: (logId: string, medId: string) => void; disabled?: boolean }) {
  const theme = useTheme()
  const taken = med.status === 'taken'
  const rowOpacity = useSharedValue(taken ? 0.5 : 1)
  const checkScale = useSharedValue(taken ? 1 : 0)

  const rowStyle = useAnimatedStyle(() => ({ opacity: rowOpacity.value }))
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }))

  const canTake = !taken && !disabled && !!med.logId

  function handleTake() {
    if (!canTake || !med.logId) return
    rowOpacity.value = withTiming(0.5, { duration: 300 })
    checkScale.value = withSpring(1, { damping: 8, stiffness: 300 })
    onTake(med.logId, med.id)
  }

  return (
    <Animated.View
      style={rowStyle}
      accessibilityLabel={`${med.name} ${med.dose}, ${med.status === 'taken' ? 'taken' : 'not yet taken'}`}
      accessibilityRole="button"
      accessibilityHint={canTake ? 'Double tap to mark as taken' : undefined}
    >
      <GlassCard style={styles.medCard}>
        <View style={styles.medRow}>
          <BreathingDot status={med.status} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.medName, { color: theme.text, textDecorationLine: taken ? 'line-through' : 'none' }]}>
              {med.name} {med.dose}
            </Text>
            <Text style={[styles.medTime, { color: theme.textMuted }]}>{med.time}</Text>
          </View>
          <Pressable
            onPress={canTake ? handleTake : undefined}
            accessibilityLabel={!med.logId && !taken ? 'No reminder set — tap to add one in Settings' : undefined}
            style={[styles.checkBtn, (!canTake && !taken) && { opacity: 0.35 }]}
          >
            <Animated.View
              style={[
                styles.checkInner,
                { borderColor: taken ? theme.accent : theme.border },
                taken && { backgroundColor: theme.accent, ...theme.shadowGlowEmerald },
                checkStyle,
              ]}
            >
              {taken && <Text style={styles.checkMark}>✓</Text>}
            </Animated.View>
          </Pressable>
        </View>
      </GlassCard>
    </Animated.View>
  )
}

function LabRow({ lab }: { lab: Lab }) {
  const theme = useTheme()
  const abnormalFired = useRef(false)
  const valueColor = lab.status === 'normal' ? theme.green : lab.status === 'borderline' ? theme.amber : theme.rose

  const glowStyle = lab.status === 'abnormal' ? theme.shadowGlowRose
    : lab.status === 'normal' ? theme.shadowGlowCyan
    : undefined

  useEffect(() => {
    if (lab.status === 'abnormal' && !abnormalFired.current) {
      abnormalFired.current = true
      hapticAbnormalLabEntrance()
    }
  }, [lab.status])

  return (
    <GlassCard
      style={styles.labCard}
    >
      <View style={styles.labRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.labName, { color: theme.text }]}>{lab.name}</Text>
          <Text style={[styles.labRange, { color: theme.textMuted }]}>Ref: {lab.range}</Text>
        </View>
        <View style={[{ alignItems: 'flex-end' }, glowStyle]}>
          <Text style={[styles.labValue, { color: valueColor }]}>{lab.value}</Text>
          <Text style={[styles.labDate, { color: theme.textMuted }]}>{lab.date}</Text>
        </View>
      </View>
    </GlassCard>
  )
}

function AppointmentRow({ appointment }: { appointment: any }) {
  const theme = useTheme()

  const dateStr = appointment.date
    ? new Date(appointment.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : ''
  const timeStr = appointment.date
    ? new Date(appointment.date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''

  return (
    <GlassCard
      style={styles.apptCard}
    >
      <View style={styles.apptRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.apptDoctor, { color: theme.text }]}>
            {appointment.doctorName || 'Doctor'}
          </Text>
          {appointment.specialty ? (
            <Text style={[styles.apptSpecialty, { color: theme.accentHover }]}>
              {appointment.specialty}
            </Text>
          ) : null}
          {appointment.location ? (
            <Text style={[styles.apptDetail, { color: theme.textMuted }]}>
              {appointment.location}
            </Text>
          ) : null}
          {appointment.purpose || appointment.notes ? (
            <Text style={[styles.apptDetail, { color: theme.textMuted }]} numberOfLines={2}>
              {appointment.purpose || appointment.notes}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.apptDate, { color: theme.accent }]}>{dateStr}</Text>
          <Text style={[styles.apptTime, { color: theme.textMuted }]}>{timeStr}</Text>
        </View>
      </View>
    </GlassCard>
  )
}

const MOOD_EMOJI: Record<string, string> = {
  great: '😊', good: '🙂', okay: '😐', poor: '😔', terrible: '😢',
}
const ENERGY_LABEL: Record<string, string> = {
  great: 'Great', good: 'Good', moderate: 'Moderate', low: 'Low', very_low: 'Very Low',
}
const ROLE_LABEL: Record<string, string> = {
  caregiver: 'Caregiver', viewer: 'Viewer', editor: 'Editor', admin: 'Admin',
}
const SPECIALTY_ICON: Record<string, string> = {
  'Medical Oncologist': '🎗️',
  'Breast Surgeon': '🏥',
  'Primary Care Physician': '👨‍⚕️',
  'Radiation Oncologist': '⚡',
}

function moodEmoji(mood: string | null): string {
  if (!mood) return '😐'
  const lower = mood.toLowerCase()
  if (MOOD_EMOJI[lower]) return MOOD_EMOJI[lower]
  const num = parseInt(mood)
  if (!isNaN(num)) {
    if (num >= 8) return '😊'
    if (num >= 6) return '🙂'
    if (num >= 4) return '😐'
    if (num >= 2) return '😔'
    return '😢'
  }
  return '😐'
}

function formatSymptom(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function JournalEntryCard({ entry }: { entry: JournalEntry }) {
  const theme = useTheme()
  const dateLabel = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
  const emoji = moodEmoji(entry.mood)

  return (
    <GlassCard style={styles.journalCard}>
      <View style={styles.journalHeader}>
        <Text style={[styles.journalDate, { color: theme.accent }]}>{dateLabel}</Text>
        <Text style={styles.journalMoodEmoji}>{emoji}</Text>
      </View>

      <View style={styles.journalMetrics}>
        {entry.sleepHours != null && (
          <View style={styles.metricPill}>
            <Text style={[styles.metricText, { color: theme.textMuted }]}>💤 {entry.sleepHours}h</Text>
          </View>
        )}
        {entry.energy && (
          <View style={styles.metricPill}>
            <Text style={[styles.metricText, { color: theme.textMuted }]}>⚡ {ENERGY_LABEL[entry.energy] ?? entry.energy}</Text>
          </View>
        )}
        {entry.painLevel != null && (
          <View style={styles.metricPill}>
            <Text style={[styles.metricText, { color: entry.painLevel >= 6 ? theme.rose : entry.painLevel >= 3 ? theme.amber : theme.green }]}>
              Pain {entry.painLevel}/10
            </Text>
          </View>
        )}
      </View>

      {entry.symptoms.length > 0 && (
        <View style={styles.symptomRow}>
          {entry.symptoms.map((s) => (
            <View key={s} style={[styles.symptomTag, { backgroundColor: 'rgba(99,102,241,0.12)', borderColor: 'rgba(99,102,241,0.25)' }]}>
              <Text style={[styles.symptomTagText, { color: theme.accentHover }]}>{formatSymptom(s)}</Text>
            </View>
          ))}
        </View>
      )}

      {entry.notes ? (
        <Text style={[styles.journalNotes, { color: theme.text }]} numberOfLines={3}>{entry.notes}</Text>
      ) : null}
    </GlassCard>
  )
}

function DoctorCard({ doctor }: { doctor: Doctor }) {
  const theme = useTheme()
  const icon = doctor.specialty ? (SPECIALTY_ICON[doctor.specialty] ?? '🩺') : '🩺'
  const initials = doctor.name.replace('Dr. ', '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <GlassCard style={styles.teamCard}>
      <View style={styles.teamRow}>
        <View style={[styles.avatar, { backgroundColor: 'rgba(99,102,241,0.18)' }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.teamName, { color: theme.text }]}>{doctor.name}</Text>
          {doctor.specialty && (
            <Text style={[styles.teamRole, { color: theme.accentHover }]}>{icon} {doctor.specialty}</Text>
          )}
          {doctor.phone && (
            <Text style={[styles.teamDetail, { color: theme.textMuted }]}>📞 {doctor.phone}</Text>
          )}
        </View>
      </View>
    </GlassCard>
  )
}

function TeamMemberCard({ member }: { member: TeamMember }) {
  const theme = useTheme()
  const name = member.display_name || member.email || 'Unknown'
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const roleLabel = ROLE_LABEL[member.role] ?? member.role
  const joinedDate = member.joinedAt
    ? new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  return (
    <GlassCard style={styles.teamCard}>
      <View style={styles.teamRow}>
        <View style={[styles.avatar, { backgroundColor: 'rgba(168,85,247,0.18)' }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.teamName, { color: theme.text }]}>{name}</Text>
          <Text style={[styles.teamRole, { color: '#a78bfa' }]}>{roleLabel}</Text>
          {joinedDate && (
            <Text style={[styles.teamDetail, { color: theme.textMuted }]}>Joined {joinedDate}</Text>
          )}
        </View>
      </View>
    </GlassCard>
  )
}

export default function CareScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { profile, csrfToken, apiClient } = useProfile()
  const router = useRouter()
  const [tab, setTab] = useState<CareTab>('meds')
  const [meds, setMeds] = useState<Med[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [journal, setJournal] = useState<JournalEntry[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [takingId, setTakingId] = useState<string | null>(null)

  const patientLabel = profile?.patientName ?? 'your loved one'

  const stagger = useStaggerEntrance(3)
  const { parallaxStyle } = useGyroParallax(0.3)

  useEffect(() => {
    if (!profile?.careProfileId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      apiClient.medications.list(profile.careProfileId).catch(() => []),
      apiClient.labResults.list(profile.careProfileId).catch(() => ({ labs: [] })),
      apiClient.appointments.list(profile.careProfileId).catch(() => []),
      apiClient.journal.list(30).catch(() => ({ data: { entries: [] } })),
      apiClient.doctors.list(profile.careProfileId).catch(() => ({ data: [] })),
      apiClient.careTeam.list().catch(() => ({ members: [], invites: [], role: null })),
    ]).then(([medsRaw, labsRaw, apptsRaw, journalRaw, doctorsRaw, teamRaw]) => {
      const medsData = Array.isArray(medsRaw) ? medsRaw : ((medsRaw as any)?.data ?? [])
      const labsData = Array.isArray(labsRaw) ? labsRaw : ((labsRaw as any)?.data ?? (labsRaw as any)?.labs ?? labsRaw)
      const apptsData = Array.isArray(apptsRaw) ? apptsRaw : ((apptsRaw as any)?.data ?? [])

      const mappedMeds: Med[] = (Array.isArray(medsData) ? medsData : []).map((m: any) => ({
        id: m.id,
        logId: m.logId || m.reminderLogId || undefined,
        name: m.name,
        dose: m.dose || '',
        time: m.frequency || '',
        status: (m.status === 'taken' || m.status === 'overdue' ? m.status : 'upcoming') as MedStatus,
      }))
      setMeds(mappedMeds)

      const labsList = Array.isArray(labsData) ? labsData : ((labsData as any)?.labs ?? [])
      const mappedLabs: Lab[] = labsList.map((l: any) => ({
        id: l.id,
        name: l.testName,
        value: String(l.value),
        range: l.referenceRange || '',
        date: l.dateTaken ? new Date(l.dateTaken).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        status: l.isAbnormal ? 'abnormal' : 'normal',
      })) || []
      setLabs(mappedLabs)

      const mappedAppts = (Array.isArray(apptsData) ? apptsData : [])
        .sort((a: any, b: any) => new Date(a.date || a.dateTime || 0).getTime() - new Date(b.date || b.dateTime || 0).getTime())
      setAppointments(mappedAppts)

      const journalEntries = (journalRaw as any)?.data?.entries ?? []
      setJournal(journalEntries)

      const doctorsList = (doctorsRaw as any)?.data ?? []
      setDoctors(Array.isArray(doctorsList) ? doctorsList : [])

      const teamData = teamRaw as any
      const members: TeamMember[] = (teamData?.members ?? []).filter((m: any) => m.role !== 'owner')
      setTeamMembers(members)
    }).catch(err => {
      console.error('[Care] Failed to load:', err?.message || err)
      setError(`Failed to load care data: ${err?.message || 'Unknown error'}`)
    }).finally(() => {
      setLoading(false)
    })
  }, [profile?.careProfileId, retryCount])

  async function markAsTaken(logId: string, medId: string) {
    if (takingId) return // double-tap guard
    setTakingId(medId)

    try {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

      const res = await fetch(`${baseUrl}/api/reminders/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ log_id: logId, status: 'taken' }),
      })

      if (res.ok) {
        setMeds(prev => prev.map(m =>
          m.id === medId ? { ...m, status: 'taken' as MedStatus } : m
        ))
        hapticMedTaken()
      }
    } catch (err) {
      // Silent fail — user sees no status change which signals the action didn't work
    } finally {
      setTakingId(null)
    }
  }

  function renderTabContent() {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )
    }

    if (error) return (
      <GlassCard style={{ padding: 32, alignItems: 'center' }}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.rose} style={{ marginBottom: 12 }} />
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>Something went wrong</Text>
        <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>{error}</Text>
        <Pressable onPress={() => { setError(null); setRetryCount(c => c + 1) }} style={{ backgroundColor: theme.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
        </Pressable>
      </GlassCard>
    )

    switch (tab) {
      case 'meds':
        return meds.length > 0
          ? meds.map((m) => <MedRow key={m.id} med={m} onTake={markAsTaken} disabled={takingId === m.id} />)
          : (
            <GlassCard>
              <CareEmptyState
                iconName="medkit-outline"
                heading="Track {name}'s medications here."
                body="Add one below — we'll remind you when it's time and track what's been taken."
                patientName={patientLabel}
              />
            </GlassCard>
          )

      case 'appts':
        return (
          <>
            <Pressable
              style={styles.apptPrepBanner}
              onPress={() => router.push('/visit-prep')}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Visit Prep</Text>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 }}>
                  AI-generated prep sheets for upcoming visits
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
            </Pressable>
            {appointments.length > 0
              ? appointments.map((a: any, i: number) => <AppointmentRow key={a.id || i} appointment={a} />)
              : (
                <GlassCard>
                  <CareEmptyState
                    iconName="calendar-outline"
                    heading="{name} has no appointments yet."
                    body="Add the next visit and we'll help you prepare the right questions together."
                    patientName={patientLabel}
                  />
                </GlassCard>
              )
            }
          </>
        )

      case 'labs':
        return labs.length > 0
          ? labs.map((l) => <LabRow key={l.id} lab={l} />)
          : (
            <GlassCard>
              <CareEmptyState
                iconName="flask-outline"
                heading="No lab results for {name} yet."
                body="Scan or import results — we'll flag anything worth discussing with the care team."
                patientName={patientLabel}
              />
            </GlassCard>
          )

      case 'journal':
        return journal.length > 0
          ? journal.map((entry) => <JournalEntryCard key={entry.id} entry={entry} />)
          : (
            <GlassCard>
              <CareEmptyState
                iconName="journal-outline"
                heading="How is {name} feeling today?"
                body="A quick check-in helps spot patterns and gives the care team real context."
                patientName={patientLabel}
              />
            </GlassCard>
          )

      case 'team':
        return (
          <>
            {doctors.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>MEDICAL TEAM</Text>
                {doctors.map((doc) => <DoctorCard key={doc.id} doctor={doc} />)}
              </>
            )}
            <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: doctors.length > 0 ? 20 : 0 }]}>CARE SUPPORTERS</Text>
            {teamMembers.length > 0
              ? teamMembers.map((m) => <TeamMemberCard key={m.id} member={m} />)
              : (
                <GlassCard>
                  <CareEmptyState
                    iconName="people-outline"
                    heading="{name}'s care circle is empty."
                    body="Invite family or a caregiver — they can view the schedule and help coordinate care."
                    patientName={patientLabel}
                  />
                </GlassCard>
              )
            }
          </>
        )

      case 'group':
        return (
          <CareGroupTab apiClient={apiClient} csrfToken={csrfToken} />
        )

      default:
        return null
    }
  }

  return (
    <TabFadeWrapper>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Animated.View style={stagger[0]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Care</Text>
          </Animated.View>

          {/* Segment control */}
          <Animated.View style={stagger[1]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.segmentScroll}
            >
              <View style={[styles.segment, { backgroundColor: theme.bgElevated }]}>
                {TAB_CONFIG.map(({ key, label }) => (
                  <Pressable
                    key={key}
                    style={[
                      styles.segBtn,
                      tab === key && { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 8 },
                    ]}
                    onPress={() => setTab(key)}
                  >
                    <Text style={[
                      styles.segLabel,
                      { color: tab === key ? theme.accentHover : theme.textMuted },
                    ]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        </View>

        <Animated.View style={[stagger[2], { flex: 1 }]}>
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: 120 }]}>
            <Animated.View style={parallaxStyle}>
              {renderTabContent()}
            </Animated.View>
          </ScrollView>
        </Animated.View>
      </View>
    </TabFadeWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  segmentScroll: { flexGrow: 1 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3, flex: 1, minWidth: '100%' },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', minWidth: 56 },
  segLabel: { fontSize: 12, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  medCard: { marginBottom: 10 },
  medRow: { flexDirection: 'row', alignItems: 'center' },
  medName: { fontSize: 15, fontWeight: '600' },
  medTime: { fontSize: 13, marginTop: 2 },
  checkBtn: { padding: 4 },
  checkInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  labCard: { marginBottom: 10 },
  labRow: { flexDirection: 'row', alignItems: 'center' },
  labName: { fontSize: 15, fontWeight: '600' },
  labRange: { fontSize: 12, marginTop: 2 },
  labValue: { fontSize: 18, fontWeight: '700' },
  labDate: { fontSize: 12, marginTop: 2 },
  apptCard: { marginBottom: 10 },
  apptPrepBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
  },
  apptRow: { flexDirection: 'row', alignItems: 'flex-start' },
  apptDoctor: { fontSize: 15, fontWeight: '600' },
  apptSpecialty: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  apptDetail: { fontSize: 12, marginTop: 2 },
  apptDate: { fontSize: 13, fontWeight: '600' },
  apptTime: { fontSize: 12, marginTop: 2 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 36, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  emptyCta: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8, marginLeft: 2 },
  journalCard: { marginBottom: 12 },
  journalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  journalDate: { fontSize: 14, fontWeight: '700' },
  journalMoodEmoji: { fontSize: 22 },
  journalMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metricPill: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  metricText: { fontSize: 12, fontWeight: '500' },
  symptomRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  symptomTag: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  symptomTagText: { fontSize: 11, fontWeight: '600' },
  journalNotes: { fontSize: 13, lineHeight: 19, opacity: 0.85 },
  teamCard: { marginBottom: 10 },
  teamRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  teamName: { fontSize: 15, fontWeight: '600' },
  teamRole: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  teamDetail: { fontSize: 12, marginTop: 2 },
})
