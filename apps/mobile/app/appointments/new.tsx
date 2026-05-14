import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../../src/theme'
import { useProfile } from '../../src/context/ProfileContext'
import { apiClient } from '../../src/services/api'
import { AuroraBackground } from '../../src/components/auth/AuthAtoms'

const SPECIALTIES = [
  'Oncology',
  'Primary Care',
  'Radiology',
  'Surgery',
  'Cardiology',
  'Lab Work',
  'Follow-up',
  'Other',
]

export default function NewAppointmentScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, csrfToken, refetch } = useProfile()

  const [doctorName, setDoctorName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [dateStr, setDateStr] = useState('') // YYYY-MM-DD
  const [timeStr, setTimeStr] = useState('') // HH:MM
  const [location, setLocation] = useState('')
  const [purpose, setPurpose] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedDate = parseDate(dateStr, timeStr)
  const canSubmit = doctorName.trim().length > 0 && !!parsedDate && !submitting

  async function handleSubmit() {
    if (!canSubmit || !csrfToken || !parsedDate) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    setSubmitting(true)
    setError(null)
    try {
      await apiClient.appointments.create(
        {
          doctorName: doctorName.trim(),
          specialty: specialty.trim() || undefined,
          dateTime: parsedDate.toISOString(),
          location: location.trim() || undefined,
          purpose: purpose.trim() || undefined,
          careProfileId: profile?.careProfileId ?? undefined,
        },
        csrfToken,
      )
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      await refetch().catch(() => {})
      router.back()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    } finally {
      setSubmitting(false)
    }
  }

  function confirmCancel() {
    if (!doctorName && !specialty && !dateStr && !timeStr && !location && !purpose) {
      router.back()
      return
    }
    Alert.alert('Discard appointment?', "You haven't saved this yet.", [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ])
  }

  const previewLabel = parsedDate
    ? parsedDate.toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : null

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={confirmCancel} hitSlop={16} style={styles.headerBtn}>
            <Ionicons name="close" size={26} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>New appointment</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 120,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Field label="Doctor name" required>
            <TextInput
              value={doctorName}
              onChangeText={setDoctorName}
              placeholder="e.g. Dr. Patel"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              autoCapitalize="words"
            />
          </Field>

          <Field label="Specialty">
            <View style={styles.chipRow}>
              {SPECIALTIES.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setSpecialty(opt) }}
                  style={[
                    styles.chip,
                    {
                      borderColor: specialty === opt ? theme.accent : theme.border,
                      backgroundColor: specialty === opt ? theme.accent + '22' : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: specialty === opt ? theme.accent : theme.textMuted }]}>
                    {opt}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="When" required>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={dateStr}
                onChangeText={setDateStr}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.border }]}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                value={timeStr}
                onChangeText={setTimeStr}
                placeholder="HH:MM"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.border }]}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {previewLabel ? (
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600', marginTop: 8 }}>
                ✓ {previewLabel}
              </Text>
            ) : (dateStr || timeStr) ? (
              <Text style={{ color: '#FCD34D', fontSize: 12, marginTop: 8 }}>
                Use format YYYY-MM-DD and 24-hour HH:MM (e.g. 2026-05-20 and 14:30)
              </Text>
            ) : null}
          </Field>

          <Field label="Location">
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Memorial Sloan Kettering"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
          </Field>

          <Field label="Purpose / notes">
            <TextInput
              value={purpose}
              onChangeText={setPurpose}
              placeholder="What's this visit about?"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, minHeight: 90, textAlignVertical: 'top' },
              ]}
              multiline
            />
          </Field>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.cta,
              { opacity: pressed || !canSubmit ? 0.6 : 1 },
            ]}
          >
            <LinearGradient
              colors={['#A78BFA', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.ctaText}>Save appointment</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

function parseDate(d: string, t: string): Date | null {
  const dMatch = d.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!dMatch) return null
  const tMatch = (t.trim() || '09:00').match(/^(\d{1,2}):(\d{2})$/)
  if (!tMatch) return null
  const y = Number(dMatch[1]), mo = Number(dMatch[2]) - 1, da = Number(dMatch[3])
  const h = Number(tMatch[1]), mi = Number(tMatch[2])
  if (mo < 0 || mo > 11 || da < 1 || da > 31 || h < 0 || h > 23 || mi < 0 || mi > 59) return null
  const dt = new Date(y, mo, da, h, mi, 0, 0)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.fieldLabel}>
        {label.toUpperCase()}
        {required ? <Text style={{ color: '#F87171' }}> *</Text> : null}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  fieldLabel: {
    color: '#FFFFFF80',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  dateBtnText: { fontSize: 14, fontWeight: '600' },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  error: { color: '#F87171', fontSize: 13, marginTop: 8, textAlign: 'center' },
  ctaBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: 'rgba(5,6,15,0.85)',
  },
  cta: {
    overflow: 'hidden',
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: 'white', fontSize: 16, fontWeight: '700' },
})
