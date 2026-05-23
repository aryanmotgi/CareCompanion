// stub: iOS parity for Voice Check-in — replace with real impl
import React, { useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, Redirect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../src/theme'
import { GlassCard } from '../src/components/GlassCard'
import { AmbientOrbs } from '../src/components/AmbientOrbs'

// TODO: import { Audio } from 'expo-av' once expo-av is confirmed in package.json

type RecordingState = 'idle' | 'recording' | 'processing' | 'done' | 'error'

interface ExtractedCheckin {
  pain: number | null
  mood: string | null
  energy: string | null
  notes: string | null
}

const VOICE_CHECKIN_ENABLED = process.env.EXPO_PUBLIC_VOICE_CHECKIN_ENABLED === 'true'

export default function VoiceCheckinScreen() {
  if (!VOICE_CHECKIN_ENABLED) {
    return <Redirect href="/" />
  }
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [state, setState] = useState<RecordingState>('idle')
  const [extracted, setExtracted] = useState<ExtractedCheckin | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleRecord() {
    if (state === 'recording') {
      // TODO: stop recording, get audioBlob, POST to /api/checkins/voice-extract
      // const { recording } = await Audio.Recording.createAsync(...)
      // await recording.stopAndUnloadAsync()
      // const uri = recording.getURI()
      // const formData = new FormData(); formData.append('audio', { uri, type: 'audio/m4a', name: 'checkin.m4a' })
      // const res = await fetch(`${API_BASE}/api/checkins/voice-extract`, { method: 'POST', body: formData })
      // const data = await res.json()
      // setExtracted(data.extracted)
      setState('done')
      setExtracted({ pain: 4, mood: 'okay', energy: 'moderate', notes: 'Voice stub placeholder' })
      return
    }

    if (state === 'idle') {
      // TODO: request Audio.requestPermissionsAsync()
      // TODO: await Audio.setAudioModeAsync({ allowsRecordingIOS: true })
      // TODO: const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      setState('recording')
    }
  }

  async function handleSave() {
    if (!extracted) return
    // TODO: POST extracted data to /api/checkins to persist
    router.back()
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
          <Text style={[styles.title, { color: theme.text }]}>Voice Check-in</Text>
          <View style={styles.backBtn} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Instructions */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>HOW IT WORKS</Text>
          <Text style={[styles.bodyText, { color: theme.textSub }]}>
            Tap the mic and describe how you're feeling today — mention your pain level, mood, and energy. Our AI will extract the details for you.
          </Text>
        </GlassCard>

        {/* Mic button */}
        <GlassCard style={[styles.section, styles.micSection]}>
          <Pressable
            onPress={handleRecord}
            style={[
              styles.micBtn,
              {
                backgroundColor: state === 'recording'
                  ? theme.rose + '33'
                  : theme.accent + '22',
                borderColor: state === 'recording' ? theme.rose : theme.accent,
              },
            ]}
          >
            <Ionicons
              name={state === 'recording' ? 'stop-circle' : 'mic'}
              size={40}
              color={state === 'recording' ? theme.rose : theme.accent}
            />
          </Pressable>
          <Text style={[styles.micStatus, { color: theme.textSub }]}>
            {state === 'idle' && 'Tap to start recording'}
            {state === 'recording' && 'Recording… tap to stop'}
            {state === 'processing' && 'Extracting your check-in…'}
            {state === 'done' && 'Check-in extracted!'}
            {state === 'error' && (errorMsg ?? 'Something went wrong')}
          </Text>
        </GlassCard>

        {/* Extracted preview */}
        {extracted && (
          <GlassCard style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>EXTRACTED DATA</Text>
            <View style={styles.extractedRow}>
              <Text style={[styles.extractedKey, { color: theme.textSub }]}>Pain</Text>
              <Text style={[styles.extractedVal, { color: theme.text }]}>
                {extracted.pain ?? '—'}/10
              </Text>
            </View>
            <View style={styles.extractedRow}>
              <Text style={[styles.extractedKey, { color: theme.textSub }]}>Mood</Text>
              <Text style={[styles.extractedVal, { color: theme.text }]}>
                {extracted.mood ?? '—'}
              </Text>
            </View>
            <View style={styles.extractedRow}>
              <Text style={[styles.extractedKey, { color: theme.textSub }]}>Energy</Text>
              <Text style={[styles.extractedVal, { color: theme.text }]}>
                {extracted.energy ?? '—'}
              </Text>
            </View>
            {extracted.notes && (
              <Text style={[styles.notesText, { color: theme.textSub }]}>
                "{extracted.notes}"
              </Text>
            )}
          </GlassCard>
        )}

        {/* Save */}
        {extracted && (
          <Pressable
            style={[styles.saveBtn, { backgroundColor: theme.accent }]}
            onPress={handleSave}
          >
            <Text style={styles.saveBtnLabel}>Save Check-in</Text>
          </Pressable>
        )}
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
  section: { gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  bodyText: { fontSize: 14, lineHeight: 20 },
  micSection: { alignItems: 'center', paddingVertical: 24 },
  micBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micStatus: { fontSize: 14, marginTop: 12 },
  extractedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  extractedKey: { fontSize: 14 },
  extractedVal: { fontSize: 14, fontWeight: '600' },
  notesText: { fontSize: 13, fontStyle: 'italic', marginTop: 6 },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
