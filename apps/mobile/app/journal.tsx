// stub: iOS parity for Symptom Journal — replace with real impl
import React, { useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../src/theme'
import { GlassCard } from '../src/components/GlassCard'
import { AmbientOrbs } from '../src/components/AmbientOrbs'

const SYMPTOM_TAGS = [
  'nausea', 'fatigue', 'pain', 'headache', 'dizziness',
  'appetite loss', 'insomnia', 'anxiety', 'brain fog', 'shortness of breath',
]

const MOOD_OPTIONS = [
  { label: '😔', value: 'low' },
  { label: '😐', value: 'okay' },
  { label: '🙂', value: 'good' },
  { label: '😄', value: 'great' },
]

const PAIN_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function JournalScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [painLevel, setPainLevel] = useState<number | null>(null)
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  function toggleSymptom(tag: string) {
    setSelectedSymptoms(prev =>
      prev.includes(tag) ? prev.filter(s => s !== tag) : [...prev, tag]
    )
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
      <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>Symptom Journal</Text>
          <View style={styles.backBtn} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Mood Section */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>HOW ARE YOU FEELING?</Text>
          <View style={styles.moodRow}>
            {MOOD_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                onPress={() => setSelectedMood(opt.value)}
                style={[
                  styles.moodBtn,
                  {
                    backgroundColor: selectedMood === opt.value
                      ? theme.accent + '33'
                      : theme.bgElevated,
                    borderColor: selectedMood === opt.value
                      ? theme.accent
                      : theme.border,
                  },
                ]}
              >
                <Text style={styles.moodEmoji}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>

        {/* Pain Level */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PAIN LEVEL</Text>
          <View style={styles.painRow}>
            {PAIN_LEVELS.map(n => (
              <Pressable
                key={n}
                onPress={() => setPainLevel(n)}
                style={[
                  styles.painBtn,
                  {
                    backgroundColor: painLevel === n
                      ? theme.rose + 'CC'
                      : theme.bgElevated,
                    borderColor: painLevel === n ? theme.rose : theme.border,
                  },
                ]}
              >
                <Text style={[styles.painLabel, { color: theme.text }]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>

        {/* Symptoms */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>SYMPTOMS TODAY</Text>
          <View style={styles.tagWrap}>
            {SYMPTOM_TAGS.map(tag => (
              <Pressable
                key={tag}
                onPress={() => toggleSymptom(tag)}
                style={[
                  styles.tag,
                  {
                    backgroundColor: selectedSymptoms.includes(tag)
                      ? theme.lavender + '33'
                      : theme.bgElevated,
                    borderColor: selectedSymptoms.includes(tag)
                      ? theme.lavender
                      : theme.border,
                  },
                ]}
              >
                <Text style={[styles.tagLabel, { color: theme.text }]}>{tag}</Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>

        {/* Notes */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>NOTES</Text>
          <TextInput
            multiline
            numberOfLines={4}
            placeholder="Any additional observations..."
            placeholderTextColor={theme.textMuted}
            value={notes}
            onChangeText={setNotes}
            style={[styles.notesInput, { color: theme.text, borderColor: theme.border }]}
          />
        </GlassCard>

        {/* Save Button — TODO: wire to /api/checkins */}
        <Pressable
          style={[styles.saveBtn, { backgroundColor: theme.accent }]}
          onPress={() => {
            // TODO: POST to /api/checkins with { mood: selectedMood, pain: painLevel, symptoms: selectedSymptoms, notes }
            router.back()
          }}
        >
          <Text style={styles.saveBtnLabel}>Save Entry</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  headerWrap: { paddingBottom: 10 },
  headerRow: {
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
  title: { fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  section: { gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  moodRow: { flexDirection: 'row', gap: 10 },
  moodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  moodEmoji: { fontSize: 24 },
  painRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  painBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  painLabel: { fontSize: 13, fontWeight: '600' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagLabel: { fontSize: 13 },
  notesInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
