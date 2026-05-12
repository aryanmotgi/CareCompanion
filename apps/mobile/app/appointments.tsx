import React, { useEffect, useMemo, useState } from 'react'
import {
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
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../src/theme'
import { useProfile } from '../src/context/ProfileContext'

type AppointmentRow = {
  id: string
  doctorName: string | null
  specialty: string | null
  dateTime: string // ISO
  purpose: string | null
  location: string | null
  isDemo?: boolean
}

// 10 demo appointments: 7 in the past, 3 upcoming (tomorrow, next week, next month).
// REMINDER: replace these with real provider data once the appointments import
// path (EventKit / FHIR) is wired up.
function makeDemoAppointments(): AppointmentRow[] {
  const now = new Date()
  function offsetDays(days: number, hour = 10, minute = 0): string {
    const d = new Date(now)
    d.setDate(d.getDate() + days)
    d.setHours(hour, minute, 0, 0)
    return d.toISOString()
  }
  return [
    // ── Past (7) ─────────────────────────────────────────────────────────
    {
      id: 'demo-appt-1',
      doctorName: 'Dr. Sarah Chen',
      specialty: 'Medical Oncology',
      dateTime: offsetDays(-180, 9, 30),
      purpose: 'Initial Oncology Consult',
      location: 'Memorial Sloan Kettering — 1275 York Ave',
      isDemo: true,
    },
    {
      id: 'demo-appt-2',
      doctorName: 'Dr. Sarah Chen',
      specialty: 'Medical Oncology',
      dateTime: offsetDays(-150, 11, 0),
      purpose: 'Chemo Cycle 1',
      location: 'MSK Infusion Center',
      isDemo: true,
    },
    {
      id: 'demo-appt-3',
      doctorName: 'Dr. Lin Park',
      specialty: 'Radiology',
      dateTime: offsetDays(-120, 14, 15),
      purpose: 'Mid-treatment MRI',
      location: 'MSK Imaging Center',
      isDemo: true,
    },
    {
      id: 'demo-appt-4',
      doctorName: 'Dr. Sarah Chen',
      specialty: 'Medical Oncology',
      dateTime: offsetDays(-90, 9, 0),
      purpose: 'Lab follow-up',
      location: 'MSK — 1275 York Ave',
      isDemo: true,
    },
    {
      id: 'demo-appt-5',
      doctorName: 'Dr. Marcus Patel',
      specialty: 'Surgical Oncology',
      dateTime: offsetDays(-60, 13, 30),
      purpose: 'Surgery consult',
      location: 'MSK Surgical Suite',
      isDemo: true,
    },
    {
      id: 'demo-appt-6',
      doctorName: 'Dr. Marcus Patel',
      specialty: 'Surgical Oncology',
      dateTime: offsetDays(-42, 7, 30),
      purpose: 'Lumpectomy',
      location: 'MSK Surgical Suite — OR 4',
      isDemo: true,
    },
    {
      id: 'demo-appt-7',
      doctorName: 'Dr. Marcus Patel',
      specialty: 'Surgical Oncology',
      dateTime: offsetDays(-21, 10, 0),
      purpose: 'Post-op follow-up',
      location: 'MSK — 1275 York Ave',
      isDemo: true,
    },
    // ── Upcoming (3) ─────────────────────────────────────────────────────
    {
      id: 'demo-appt-8',
      doctorName: 'Dr. Sarah Chen',
      specialty: 'Medical Oncology',
      dateTime: offsetDays(1, 14, 0),
      purpose: 'Chemo Cycle 4',
      location: 'MSK Infusion Center',
      isDemo: true,
    },
    {
      id: 'demo-appt-9',
      doctorName: 'Dr. Lin Park',
      specialty: 'Radiology',
      dateTime: offsetDays(7, 10, 30),
      purpose: 'Imaging Scan',
      location: 'MSK Imaging Center',
      isDemo: true,
    },
    {
      id: 'demo-appt-10',
      doctorName: 'Dr. Sarah Chen',
      specialty: 'Medical Oncology',
      dateTime: offsetDays(30, 9, 30),
      purpose: 'Follow-up Oncology',
      location: 'MSK — 1275 York Ave',
      isDemo: true,
    },
  ]
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function AppointmentsScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { profile, csrfToken, apiClient } = useProfile()

  const [demoList, setDemoList] = useState<AppointmentRow[]>(() => makeDemoAppointments())
  const [realList, setRealList] = useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(true)

  // Load real appointments from API
  useEffect(() => {
    if (!profile?.careProfileId) {
      setLoading(false)
      return
    }
    let cancelled = false
    apiClient.appointments
      .list(profile.careProfileId)
      .then((raw) => {
        if (cancelled) return
        const arr = Array.isArray(raw) ? raw : ((raw as any)?.data ?? [])
        setRealList(
          arr.map((a: any) => ({
            id: a.id,
            doctorName: a.doctorName ?? a.doctor_name ?? null,
            specialty: a.specialty ?? null,
            dateTime: a.dateTime ?? a.date_time ?? '',
            purpose: a.purpose ?? null,
            location: a.location ?? null,
          })),
        )
      })
      .catch(() => {
        // Fail open — show only demo data.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile?.careProfileId, apiClient])

  const { upcoming, past } = useMemo(() => {
    const all = [...realList, ...demoList]
    const nowMs = Date.now()
    const sortedByDate = all.sort(
      (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
    )
    return {
      upcoming: sortedByDate.filter((a) => new Date(a.dateTime).getTime() >= nowMs),
      past: sortedByDate
        .filter((a) => new Date(a.dateTime).getTime() < nowMs)
        .reverse(),
    }
  }, [realList, demoList])

  // ── Add appointment modal ──────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    doctorName: '',
    specialty: '',
    dateISO: '',
    timeHHmm: '10:00',
    purpose: '',
    location: '',
  })

  async function handleAdd() {
    if (!form.doctorName.trim() && !form.purpose.trim()) {
      Alert.alert('Add at least a doctor or a purpose.')
      return
    }
    if (!form.dateISO.trim()) {
      Alert.alert('Date required', 'Enter a date in YYYY-MM-DD format.')
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
    const datePart = form.dateISO.trim()
    const timePart = form.timeHHmm.trim() || '00:00'
    const dateTime = new Date(`${datePart}T${timePart}:00`)
    if (Number.isNaN(dateTime.getTime())) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD for date and HH:MM for time.')
      return
    }
    setSubmitting(true)
    try {
      const created = await apiClient.appointments.create(
        {
          doctor_name: form.doctorName.trim() || null,
          specialty: form.specialty.trim() || null,
          date_time: dateTime.toISOString(),
          purpose: form.purpose.trim() || null,
          location: form.location.trim() || null,
          care_profile_id: profile.careProfileId,
        },
        csrfToken,
      )
      const data = (created as any)?.data ?? created
      const newRow: AppointmentRow = {
        id: data?.id ?? `local-${Date.now()}`,
        doctorName: data?.doctorName ?? form.doctorName ?? null,
        specialty: data?.specialty ?? form.specialty ?? null,
        dateTime: data?.dateTime ?? dateTime.toISOString(),
        purpose: data?.purpose ?? form.purpose ?? null,
        location: data?.location ?? form.location ?? null,
      }
      setRealList((prev) => [newRow, ...prev])
      setForm({
        doctorName: '',
        specialty: '',
        dateISO: '',
        timeHHmm: '10:00',
        purpose: '',
        location: '',
      })
      setAddOpen(false)
    } catch (err: any) {
      Alert.alert('Could not add appointment', err?.message || 'Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleDelete(row: AppointmentRow) {
    Alert.alert(
      `Delete ${row.purpose || row.doctorName || 'appointment'}?`,
      row.isDemo
        ? 'This is demo data — it will be removed from view only.'
        : 'This removes the appointment from your care profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (row.isDemo) {
              setDemoList((prev) => prev.filter((a) => a.id !== row.id))
              return
            }
            if (!csrfToken) {
              Alert.alert('Session not ready', 'Restart the app and try again.')
              return
            }
            try {
              await apiClient.appointments.delete(row.id, csrfToken)
              setRealList((prev) => prev.filter((a) => a.id !== row.id))
            } catch (err: any) {
              Alert.alert('Could not delete', err?.message || 'Try again.')
            }
          },
        },
      ],
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ flex: 1, color: theme.text, fontSize: 20, fontWeight: '800' }}>
          Appointments
        </Text>
        <Pressable
          onPress={() => setAddOpen(true)}
          hitSlop={10}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            opacity: pressed ? 0.6 : 1,
            paddingHorizontal: 8,
            paddingVertical: 4,
          })}
          accessibilityLabel="Add appointment"
        >
          <Ionicons name="add-circle" size={22} color={theme.accent} />
          <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '700' }}>Add</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}
      >
        {loading && (
          <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
            Loading…
          </Text>
        )}

        <Section
          label={`UPCOMING (${upcoming.length})`}
          theme={theme}
          empty={upcoming.length === 0}
          emptyText="No upcoming appointments."
        >
          {upcoming.map((a) => (
            <AppointmentCard key={a.id} appt={a} onDelete={() => handleDelete(a)} theme={theme} />
          ))}
        </Section>

        <Section
          label={`PAST (${past.length})`}
          theme={theme}
          empty={past.length === 0}
          emptyText="No past appointments."
        >
          {past.map((a) => (
            <AppointmentCard
              key={a.id}
              appt={a}
              onDelete={() => handleDelete(a)}
              theme={theme}
              muted
            />
          ))}
        </Section>
      </ScrollView>

      {/* Add modal */}
      <Modal
        visible={addOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: theme.bg }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.border,
            }}
          >
            <Pressable
              onPress={() => setAddOpen(false)}
              hitSlop={12}
              style={({ pressed }) => ({
                opacity: pressed ? 0.5 : 1,
                paddingVertical: 6,
                paddingHorizontal: 4,
              })}
            >
              <Text style={{ color: theme.textMuted, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
              Add appointment
            </Text>
            <View style={{ width: 56 }} />
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <Field
              label="Doctor name"
              value={form.doctorName}
              onChangeText={(t) => setForm((f) => ({ ...f, doctorName: t }))}
              placeholder="e.g. Dr. Sarah Chen"
              theme={theme}
              autoFocus
            />
            <Field
              label="Specialty"
              value={form.specialty}
              onChangeText={(t) => setForm((f) => ({ ...f, specialty: t }))}
              placeholder="e.g. Medical Oncology"
              theme={theme}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 2 }}>
                <Field
                  label="Date (YYYY-MM-DD)"
                  value={form.dateISO}
                  onChangeText={(t) => setForm((f) => ({ ...f, dateISO: t }))}
                  placeholder="2026-06-04"
                  theme={theme}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Time (HH:MM)"
                  value={form.timeHHmm}
                  onChangeText={(t) => setForm((f) => ({ ...f, timeHHmm: t }))}
                  placeholder="10:00"
                  theme={theme}
                />
              </View>
            </View>
            <Field
              label="Purpose"
              value={form.purpose}
              onChangeText={(t) => setForm((f) => ({ ...f, purpose: t }))}
              placeholder="e.g. Chemo cycle 5"
              theme={theme}
            />
            <Field
              label="Location"
              value={form.location}
              onChangeText={(t) => setForm((f) => ({ ...f, location: t }))}
              placeholder="e.g. MSK — 1275 York Ave"
              theme={theme}
            />
          </ScrollView>
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + 16,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.border,
            }}
          >
            <Pressable
              onPress={handleAdd}
              style={({ pressed }) => ({
                backgroundColor: theme.accent,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
              accessibilityRole="button"
              accessibilityState={{ busy: submitting }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                {submitting ? 'Saving…' : 'Save appointment'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

function Section({
  label,
  children,
  theme,
  empty,
  emptyText,
}: {
  label: string
  children: React.ReactNode
  theme: ReturnType<typeof useTheme>
  empty: boolean
  emptyText: string
}) {
  return (
    <View>
      <Text
        style={{
          color: theme.textMuted,
          fontSize: 11,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          fontWeight: '700',
          marginBottom: 10,
        }}
      >
        {label}
      </Text>
      {empty ? (
        <Text style={{ color: theme.textMuted, fontSize: 13, paddingVertical: 8 }}>
          {emptyText}
        </Text>
      ) : (
        <View style={{ gap: 10 }}>{children}</View>
      )}
    </View>
  )
}

function AppointmentCard({
  appt,
  onDelete,
  theme,
  muted,
}: {
  appt: AppointmentRow
  onDelete: () => void
  theme: ReturnType<typeof useTheme>
  muted?: boolean
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 14,
        padding: 14,
        backgroundColor: muted ? 'rgba(255,255,255,0.02)' : 'rgba(99,102,241,0.06)',
        opacity: muted ? 0.85 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>
              {appt.purpose || appt.doctorName || 'Appointment'}
            </Text>
            {appt.isDemo && (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: 'rgba(167,139,250,0.2)',
                }}
              >
                <Text
                  style={{
                    color: '#A78BFA',
                    fontSize: 9,
                    fontWeight: '800',
                    letterSpacing: 0.5,
                  }}
                >
                  DEMO
                </Text>
              </View>
            )}
          </View>
          {appt.doctorName && appt.doctorName !== appt.purpose && (
            <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>
              {appt.doctorName}
              {appt.specialty ? ` · ${appt.specialty}` : ''}
            </Text>
          )}
          <Text
            style={{
              color: theme.lavender,
              fontSize: 13,
              fontWeight: '600',
              marginTop: 6,
            }}
          >
            {fmtDate(appt.dateTime)}
            {' · '}
            {fmtTime(appt.dateTime)}
          </Text>
          {appt.location && (
            <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
              {appt.location}
            </Text>
          )}
        </View>
        <Pressable
          onPress={onDelete}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
          accessibilityLabel="Delete appointment"
        >
          <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
        </Pressable>
      </View>
    </View>
  )
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  theme,
  autoFocus,
}: {
  label: string
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
  theme: ReturnType<typeof useTheme>
  autoFocus?: boolean
}) {
  return (
    <View>
      <Text
        style={{
          color: theme.textMuted,
          fontSize: 11,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          fontWeight: '600',
          marginBottom: 6,
        }}
      >
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
