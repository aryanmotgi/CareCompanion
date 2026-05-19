// Reviewed-by-required: Shreyash (apps/mobile ownership)
import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import * as SecureStore from 'expo-secure-store'
import { useTheme } from '../src/theme'
import { GlassCard } from '../src/components/GlassCard'
import { AmbientOrbs } from '../src/components/AmbientOrbs'
import { useProfile } from '../src/context/ProfileContext'
import { apiClient } from '../src/services/api'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

const COMMON_SYMPTOMS = [
  'Nausea', 'Vomiting', 'Fatigue', 'Mouth sores', 'Neuropathy', 'Chemo brain',
  'Hair loss', 'Loss of appetite', 'Constipation', 'Diarrhea', 'Bone pain',
  'Skin changes', 'Hand-foot syndrome', 'Shortness of breath', 'Anxiety', 'Fever/chills',
]

const MOOD_OPTIONS = [
  { key: 'great', label: 'Great', color: '#34D399' },
  { key: 'good', label: 'Good', color: '#60A5FA' },
  { key: 'okay', label: 'Okay', color: '#FCD34D' },
  { key: 'bad', label: 'Bad', color: '#FB923C' },
  { key: 'terrible', label: 'Terrible', color: '#F87171' },
]

const ENERGY_OPTIONS = [
  { key: 'high', label: 'High' },
  { key: 'normal', label: 'Normal' },
  { key: 'low', label: 'Low' },
  { key: 'very_low', label: 'Very Low' },
]

const SLEEP_OPTIONS = [
  { key: 'great', label: 'Great' },
  { key: 'good', label: 'Good' },
  { key: 'fair', label: 'Fair' },
  { key: 'poor', label: 'Poor' },
  { key: 'terrible', label: 'Bad' },
]

const APPETITE_OPTIONS = [
  { key: 'normal', label: 'Normal' },
  { key: 'increased', label: 'More' },
  { key: 'decreased', label: 'Less' },
  { key: 'none', label: 'None' },
]

const MOOD_COLORS: Record<string, string> = {
  great: '#34D399', good: '#60A5FA', okay: '#FCD34D', bad: '#FB923C', terrible: '#F87171',
}
const MOOD_LABELS: Record<string, string> = {
  great: 'Great', good: 'Good', okay: 'Okay', bad: 'Bad', terrible: 'Terrible',
}

type JournalEntry = {
  id: string
  date: string
  mood: string | null
  energy: string | null
  painLevel: number | null
  sleepHours: string | null
  symptoms: string[]
  notes: string | null
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export default function JournalScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { csrfToken } = useProfile()

  const today = new Date().toISOString().split('T')[0]

  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [entriesError, setEntriesError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [painLevel, setPainLevel] = useState(0)
  const [nauseaLevel, setNauseaLevel] = useState(0)
  const [fatigueLevel, setFatigueLevel] = useState(0)
  const [mood, setMood] = useState('')
  const [energy, setEnergy] = useState('')
  const [sleepQuality, setSleepQuality] = useState('')
  const [sleepHours, setSleepHours] = useState('')
  const [appetite, setAppetite] = useState('')
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  const todayEntry = entries.find((e) => e.date === today)

  const fetchEntries = useCallback(async () => {
    setLoadingEntries(true)
    setEntriesError(null)
    try {
      const res = await apiClient.journal.list(30) as unknown as {
        data?: { entries: JournalEntry[] }
        entries?: JournalEntry[]
      }
      setEntries(res?.data?.entries ?? res?.entries ?? [])
    } catch (err) {
      setEntriesError(err instanceof Error ? err.message : 'Failed to load entries')
    } finally {
      setLoadingEntries(false)
    }
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  function openForm() {
    if (todayEntry) {
      setPainLevel(todayEntry.painLevel ?? 0)
      setMood(todayEntry.mood ?? '')
      setEnergy(todayEntry.energy ?? '')
      setSleepHours(todayEntry.sleepHours ?? '')
      setSymptoms(todayEntry.symptoms ?? [])
      setNotes(todayEntry.notes ?? '')
    }
    setSaveError(null)
    setShowForm(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }

  function resetForm() {
    setPainLevel(0)
    setNauseaLevel(0)
    setFatigueLevel(0)
    setMood('')
    setEnergy('')
    setSleepQuality('')
    setSleepHours('')
    setAppetite('')
    setSymptoms([])
    setNotes('')
  }

  function toggleSymptom(s: string) {
    Haptics.selectionAsync().catch(() => {})
    setSymptoms((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  async function handleSave() {
    if (saving || !csrfToken) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    setSaving(true)
    setSaveError(null)
    try {
      const extraNotes: string[] = []
      if (nauseaLevel > 0) extraNotes.push(`Nausea: ${nauseaLevel}/10`)
      if (fatigueLevel > 0) extraNotes.push(`Fatigue: ${fatigueLevel}/10`)
      const fullNotes = [...extraNotes, notes.trim()].filter(Boolean).join(' | ')

      const payload: Record<string, unknown> = {}
      if (painLevel > 0) payload.pain = painLevel
      if (mood) payload.mood = mood
      if (energy) payload.energy = energy
      if (sleepQuality) payload.sleepQuality = sleepQuality
      if (sleepHours) payload.sleep_hours = parseFloat(sleepHours)
      if (appetite) payload.appetite = appetite
      if (symptoms.length) payload.symptoms = symptoms
      if (fullNotes) payload.notes = fullNotes

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      }
      if (Platform.OS !== 'web') {
        const token = await SecureStore.getItemAsync('cc-session-token')
        if (token) headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch(`${API_BASE}/api/journal`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)

      const data = await res.json() as { data?: { entry: JournalEntry }; entry?: JournalEntry }
      const saved = data?.data?.entry ?? data?.entry
      if (saved) {
        setEntries((prev) => [saved, ...prev.filter((e) => e.date !== today)])
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      resetForm()
      setShowForm(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save entry')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <LinearGradient
        colors={theme.gradientA as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <AmbientOrbs speedMultiplier={0.2} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Treatment Journal</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <Pressable
          onPress={showForm ? () => { resetForm(); setShowForm(false) } : openForm}
          style={styles.logBtn}
        >
          <LinearGradient
            colors={['#6366F1', '#A78BFA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.logBtnText}>
            {showForm ? 'Cancel' : todayEntry ? 'Update' : 'Log Today'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Entry form */}
          {showForm && (
            <GlassCard style={styles.formCard}>
              <FormSection label="Pain Level">
                <SeverityRow value={painLevel} onChange={setPainLevel} theme={theme} />
              </FormSection>

              <FormSection label="Nausea Level">
                <SeverityRow value={nauseaLevel} onChange={setNauseaLevel} theme={theme} />
              </FormSection>

              <FormSection label="Fatigue Level">
                <SeverityRow value={fatigueLevel} onChange={setFatigueLevel} theme={theme} />
              </FormSection>

              <FormSection label="Mood">
                <View style={styles.pillRow}>
                  {MOOD_OPTIONS.map(({ key, label, color }) => (
                    <Pressable
                      key={key}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setMood(mood === key ? '' : key) }}
                      style={[styles.pill, {
                        backgroundColor: mood === key ? color + '22' : 'rgba(255,255,255,0.04)',
                        borderColor: mood === key ? color : theme.border,
                      }]}
                    >
                      <Text style={[styles.pillText, { color: mood === key ? color : theme.textMuted }]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </FormSection>

              <FormSection label="Energy">
                <View style={styles.pillRow}>
                  {ENERGY_OPTIONS.map(({ key, label }) => (
                    <Pressable
                      key={key}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setEnergy(energy === key ? '' : key) }}
                      style={[styles.pill, {
                        backgroundColor: energy === key ? theme.accent + '22' : 'rgba(255,255,255,0.04)',
                        borderColor: energy === key ? theme.accent : theme.border,
                      }]}
                    >
                      <Text style={[styles.pillText, { color: energy === key ? theme.accent : theme.textMuted }]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </FormSection>

              <FormSection label="Sleep Quality">
                <View style={styles.pillRow}>
                  {SLEEP_OPTIONS.map(({ key, label }) => (
                    <Pressable
                      key={key}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setSleepQuality(sleepQuality === key ? '' : key) }}
                      style={[styles.pill, {
                        backgroundColor: sleepQuality === key ? '#60A5FA22' : 'rgba(255,255,255,0.04)',
                        borderColor: sleepQuality === key ? '#60A5FA' : theme.border,
                      }]}
                    >
                      <Text style={[styles.pillText, { color: sleepQuality === key ? '#60A5FA' : theme.textMuted }]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={sleepHours}
                  onChangeText={setSleepHours}
                  placeholder="Hours slept (e.g. 7.5)"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="decimal-pad"
                  style={[styles.textInput, { color: theme.text, borderColor: theme.border, marginTop: 10 }]}
                />
              </FormSection>

              <FormSection label="Appetite">
                <View style={styles.pillRow}>
                  {APPETITE_OPTIONS.map(({ key, label }) => (
                    <Pressable
                      key={key}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setAppetite(appetite === key ? '' : key) }}
                      style={[styles.pill, {
                        backgroundColor: appetite === key ? theme.lavender + '22' : 'rgba(255,255,255,0.04)',
                        borderColor: appetite === key ? theme.lavender : theme.border,
                      }]}
                    >
                      <Text style={[styles.pillText, { color: appetite === key ? theme.lavender : theme.textMuted }]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </FormSection>

              <FormSection label="Treatment Side Effects">
                <View style={styles.chipGrid}>
                  {COMMON_SYMPTOMS.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => toggleSymptom(s)}
                      style={[styles.chip, {
                        backgroundColor: symptoms.includes(s) ? '#F8717120' : 'rgba(255,255,255,0.04)',
                        borderColor: symptoms.includes(s) ? '#F87171' : theme.border,
                      }]}
                    >
                      <Text style={[styles.chipText, { color: symptoms.includes(s) ? '#F87171' : theme.textSub }]}>
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </FormSection>

              <FormSection label="Side Effects & Notes">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. numbness in fingers, metallic taste..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={3}
                  style={[styles.textInput, styles.textArea, { color: theme.text, borderColor: theme.border }]}
                />
              </FormSection>

              {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [styles.saveBtn, { opacity: pressed || saving ? 0.7 : 1 }]}
              >
                <LinearGradient
                  colors={['#6366F1', '#A78BFA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                {saving
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.saveBtnText}>Save Entry</Text>
                }
              </Pressable>
            </GlassCard>
          )}

          {/* Recent entries */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Recent Entries</Text>

            {loadingEntries ? (
              <View style={styles.stateContainer}>
                <ActivityIndicator color={theme.accent} />
                <Text style={[styles.stateText, { color: theme.textMuted }]}>Loading entries…</Text>
              </View>
            ) : entriesError ? (
              <View style={styles.stateContainer}>
                <Ionicons name="alert-circle-outline" size={32} color={theme.rose} />
                <Text style={[styles.stateText, { color: theme.rose }]}>{entriesError}</Text>
                <Pressable onPress={fetchEntries} style={{ marginTop: 4 }}>
                  <Text style={[styles.retryText, { color: theme.accent }]}>Retry</Text>
                </Pressable>
              </View>
            ) : entries.length === 0 ? (
              <View style={styles.stateContainer}>
                <Ionicons name="journal-outline" size={40} color={theme.textMuted} />
                <Text style={[styles.stateText, { color: theme.textMuted }]}>No entries yet.</Text>
                <Text style={[styles.stateSubText, { color: theme.textMuted }]}>
                  Tap "Log Today" to start tracking.
                </Text>
              </View>
            ) : (
              entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} theme={theme} />
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.formLabel}>{label.toUpperCase()}</Text>
      {children}
    </View>
  )
}

function SeverityRow({
  value,
  onChange,
  theme,
}: {
  value: number
  onChange: (n: number) => void
  theme: ReturnType<typeof useTheme>
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.numRow}>
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const color = n === 0 ? theme.textMuted : n <= 3 ? theme.green : n <= 6 ? theme.amber : theme.rose
          const selected = value === n
          return (
            <Pressable
              key={n}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(n) }}
              style={[styles.numPill, {
                backgroundColor: selected ? color + '28' : 'rgba(255,255,255,0.04)',
                borderColor: selected ? color : theme.border,
              }]}
            >
              <Text style={[styles.numPillText, { color: selected ? color : theme.textMuted, fontWeight: selected ? '700' : '400' }]}>
                {n}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}

function EntryCard({ entry, theme }: { entry: JournalEntry; theme: ReturnType<typeof useTheme> }) {
  const cardStyle: ViewStyle = {
    borderRadius: 14,
    overflow: 'hidden',
    padding: 14,
    marginBottom: 10,
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : theme.bgCard,
    ...(theme.isDark
      ? { borderWidth: 1, borderColor: 'rgba(139,92,246,0.18)' }
      : theme.shadowCard),
  }

  return (
    <View style={cardStyle}>
      <View style={styles.entryHeader}>
        <Text style={[styles.entryDate, { color: theme.text }]}>
          {formatDate(entry.date)}
        </Text>
        <View style={styles.entryBadges}>
          {entry.mood ? (
            <View style={[styles.badge, { backgroundColor: (MOOD_COLORS[entry.mood] ?? theme.accent) + '22' }]}>
              <Text style={[styles.badgeText, { color: MOOD_COLORS[entry.mood] ?? theme.accent }]}>
                {MOOD_LABELS[entry.mood] ?? entry.mood}
              </Text>
            </View>
          ) : null}
          {entry.painLevel !== null && entry.painLevel > 0 ? (
            <View style={[styles.badge, {
              backgroundColor: entry.painLevel <= 3
                ? theme.green + '22'
                : entry.painLevel <= 6
                  ? theme.amber + '22'
                  : theme.rose + '22',
            }]}>
              <Text style={[styles.badgeText, {
                color: entry.painLevel <= 3
                  ? theme.green
                  : entry.painLevel <= 6
                    ? theme.amber
                    : theme.rose,
              }]}>
                Pain {entry.painLevel}/10
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {entry.symptoms && entry.symptoms.length > 0 ? (
        <View style={[styles.chipGrid, { marginBottom: 6 }]}>
          {entry.symptoms.map((s) => (
            <View key={s} style={[styles.chip, { backgroundColor: theme.rose + '15', borderColor: theme.rose + '40' }]}>
              <Text style={[styles.chipText, { color: theme.rose }]}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {entry.notes ? (
        <Text style={[styles.entryNotes, { color: theme.textMuted }]} numberOfLines={2}>
          {entry.notes}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.1)',
  },
  headerCenter: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  headerSub: { fontSize: 11, marginTop: 2 },
  logBtn: {
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  formCard: { marginBottom: 20 },
  formSection: { marginBottom: 20 },
  formLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 10,
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: '600' },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12 },

  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  textArea: { minHeight: 76, textAlignVertical: 'top' },

  saveBtn: {
    overflow: 'hidden',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#F87171', fontSize: 13, textAlign: 'center', marginBottom: 10 },

  numRow: { flexDirection: 'row', gap: 6 },
  numPill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numPillText: { fontSize: 13 },

  section: { marginTop: 4 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  stateContainer: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  stateText: { fontSize: 15, fontWeight: '500' },
  stateSubText: { fontSize: 13 },
  retryText: { fontSize: 14, fontWeight: '700' },

  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  entryDate: { fontSize: 14, fontWeight: '600' },
  entryBadges: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  entryNotes: { fontSize: 12, lineHeight: 17 },
})
