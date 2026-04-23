// apps/mobile/app/(tabs)/care.tsx
import React, { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
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
import { useTheme } from '../../src/theme'
import { GlassCard } from '../../src/components/GlassCard'
import { hapticMedTaken, hapticAbnormalLabEntrance } from '../../src/utils/haptics'
import { useStaggerEntrance } from '../../src/hooks/useStaggerEntrance'
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
import { TabFadeWrapper } from './_layout'
import { useProfile } from '../../src/context/ProfileContext'
import { createApiClient } from '@carecompanion/api'

const apiClient = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org',
  getToken: () => SecureStore.getItemAsync('cc-session-token'),
})

type MedStatus = 'taken' | 'upcoming' | 'overdue'
type CareTab = 'meds' | 'appts' | 'labs' | 'journal' | 'team'

const TAB_CONFIG: { key: CareTab; label: string }[] = [
  { key: 'meds', label: 'Meds' },
  { key: 'appts', label: 'Appts' },
  { key: 'labs', label: 'Labs' },
  { key: 'journal', label: 'Journal' },
  { key: 'team', label: 'Team' },
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
    hapticMedTaken()
    rowOpacity.value = withTiming(0.5, { duration: 300 })
    checkScale.value = withSpring(1, { damping: 8, stiffness: 300 })
    onTake(med.logId, med.id)
  }

  return (
    <Animated.View style={rowStyle}>
      <GlassCard style={styles.medCard}>
        <View style={styles.medRow}>
          <BreathingDot status={med.status} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.medName, { color: theme.text, textDecorationLine: taken ? 'line-through' : 'none' }]}>
              {med.name} {med.dose}
            </Text>
            <Text style={[styles.medTime, { color: theme.textMuted }]}>{med.time}</Text>
          </View>
          <Pressable onPress={canTake ? handleTake : undefined} style={[styles.checkBtn, disabled && { opacity: 0.4 }]}>
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
    <GlassCard style={styles.labCard}>
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
    <GlassCard style={styles.apptCard}>
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

export default function CareScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { profile, csrfToken } = useProfile()
  const [tab, setTab] = useState<CareTab>('meds')
  const [meds, setMeds] = useState<Med[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [takingId, setTakingId] = useState<string | null>(null)

  const stagger = useStaggerEntrance(3)
  const { parallaxStyle } = useGyroParallax(0.3)

  useEffect(() => {
    if (!profile?.careProfileId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      apiClient.medications.list(profile.careProfileId),
      apiClient.labResults.list(profile.careProfileId),
      apiClient.appointments.list(profile.careProfileId).catch(() => []),
    ]).then(([medsData, labsData, apptsData]) => {
      // Map API medications to the Med interface
      const mappedMeds: Med[] = (medsData as any[]).map((m: any) => ({
        id: m.id,
        logId: m.logId || m.reminderLogId || undefined,
        name: m.name,
        dose: m.dose || '',
        time: m.frequency || '',
        status: (m.status === 'taken' || m.status === 'overdue' ? m.status : 'upcoming') as MedStatus,
      }))
      setMeds(mappedMeds)

      // Map API labs to the Lab interface
      const mappedLabs: Lab[] = (labsData as any).labs?.map((l: any) => ({
        id: l.id,
        name: l.testName,
        value: String(l.value),
        range: l.referenceRange || '',
        date: l.dateTaken ? new Date(l.dateTaken).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        status: l.status === 'abnormal' ? 'abnormal' : l.status === 'borderline' ? 'borderline' : 'normal',
      })) || []
      setLabs(mappedLabs)

      // Map API appointments, sorted by date
      const mappedAppts = (Array.isArray(apptsData) ? apptsData : [])
        .sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
      setAppointments(mappedAppts)
    }).catch(err => {
      console.error('Failed to load care data:', err)
    }).finally(() => {
      setLoading(false)
    })
  }, [profile?.careProfileId])

  async function markAsTaken(logId: string, medId: string) {
    if (takingId) return // double-tap guard
    setTakingId(medId)

    try {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'
      const isSecure = baseUrl.startsWith('https://')
      const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'

      const res = await fetch(`${baseUrl}/api/reminders/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '',
          'Cookie': `${cookieName}=${token}; cc-csrf-token=${csrfToken}`,
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
      console.error('Failed to mark as taken:', err)
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

    switch (tab) {
      case 'meds':
        return meds.length > 0
          ? meds.map((m) => <MedRow key={m.id} med={m} onTake={markAsTaken} disabled={takingId === m.id} />)
          : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No medications yet</Text>
            </View>
          )

      case 'appts':
        return appointments.length > 0
          ? appointments.map((a: any, i: number) => <AppointmentRow key={a.id || i} appointment={a} />)
          : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No appointments scheduled</Text>
              <Text style={[styles.emptyCta, { color: theme.accent }]}>Add an appointment</Text>
            </View>
          )

      case 'labs':
        return labs.length > 0
          ? labs.map((l) => <LabRow key={l.id} lab={l} />)
          : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No lab results yet</Text>
            </View>
          )

      case 'journal':
        return (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyEmoji]}>📝</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>How are you feeling today?</Text>
            <Text style={[styles.emptyCta, { color: '#fbbf24' }]}>Start your first entry</Text>
          </View>
        )

      case 'team':
        return (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyEmoji]}>👥</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No care team members yet</Text>
            <Text style={[styles.emptyCta, { color: '#a78bfa' }]}>Add your doctor</Text>
          </View>
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
})
