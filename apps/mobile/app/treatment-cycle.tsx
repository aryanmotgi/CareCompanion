// stub: iOS parity for Treatment Cycle Tracker — replace with real impl
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as SecureStore from 'expo-secure-store'
import { useTheme } from '../src/theme'
import { GlassCard } from '../src/components/GlassCard'
import { AmbientOrbs } from '../src/components/AmbientOrbs'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

interface Medication {
  id: string
  name: string
  frequency: string | null
  notes: string | null
}

interface CycleInfo {
  phase: 'infusion' | 'rest' | 'recovery'
  dayInCycle: number
  cycleLengthDays: number
  currentCycle: number
  totalCycles: number
}

const PHASE_COLORS: Record<CycleInfo['phase'], string> = {
  infusion: '#FCA5A5',
  rest: '#6EE7B7',
  recovery: '#FCD34D',
}

const PHASE_ICONS: Record<CycleInfo['phase'], string> = {
  infusion: 'medical',
  rest: 'bed',
  recovery: 'sunny',
}

function parseCycleInfo(med: Medication): CycleInfo | null {
  const notes = (med.notes ?? '').toLowerCase()
  const freq = (med.frequency ?? '').toLowerCase()

  const cycleMatch = notes.match(/cycle\s*(\d+)\s*of\s*(\d+)/)
  const dayMatch = notes.match(/day\s*(\d+)/)
  const lenMatch = freq.match(/every\s*(\d+)\s*day/)

  if (!cycleMatch) return null

  const currentCycle = parseInt(cycleMatch[1], 10)
  const totalCycles = parseInt(cycleMatch[2], 10)
  const dayInCycle = dayMatch ? parseInt(dayMatch[1], 10) : 1
  const cycleLengthDays = lenMatch ? parseInt(lenMatch[1], 10) : 21

  let phase: CycleInfo['phase'] = 'rest'
  if (dayInCycle <= 3) phase = 'infusion'
  else if (dayInCycle <= cycleLengthDays - 5) phase = 'recovery'

  return { phase, dayInCycle, cycleLengthDays, currentCycle, totalCycles }
}

export default function TreatmentCycleScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMeds() {
      try {
        const token = await SecureStore.getItemAsync('authToken')
        const res = await fetch(`${API_BASE}/api/medications`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) throw new Error('Failed to load medications')
        const data = await res.json()
        setMedications(data.data?.medications ?? [])
      } catch {
        setError('Could not load treatment data')
      } finally {
        setLoading(false)
      }
    }
    void fetchMeds()
  }, [])

  const cycleInfo = medications.reduce<CycleInfo | null>((found, med) => {
    return found ?? parseCycleInfo(med)
  }, null)

  const progressPercent = cycleInfo
    ? (cycleInfo.dayInCycle / cycleInfo.cycleLengthDays) * 100
    : 0

  const overallPercent = cycleInfo
    ? ((cycleInfo.currentCycle - 1 + cycleInfo.dayInCycle / cycleInfo.cycleLengthDays) / cycleInfo.totalCycles) * 100
    : 0

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
          <Text style={[styles.title, { color: theme.text }]}>Treatment Cycle</Text>
          <View style={styles.backBtn} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading && <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />}

        {!loading && error && (
          <GlassCard>
            <Text style={[styles.errorText, { color: theme.rose }]}>{error}</Text>
          </GlassCard>
        )}

        {!loading && !error && !cycleInfo && (
          <GlassCard>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No active treatment cycle found. Add a chemo medication with cycle info in its notes (e.g. "Cycle 2 of 6, Day 5") to track your progress here.
            </Text>
          </GlassCard>
        )}

        {!loading && cycleInfo && (
          <>
            {/* Current phase */}
            <GlassCard style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>CURRENT PHASE</Text>
              <View style={styles.phaseRow}>
                <View style={[styles.phaseIcon, { backgroundColor: PHASE_COLORS[cycleInfo.phase] + '22' }]}>
                  <Ionicons
                    name={PHASE_ICONS[cycleInfo.phase] as 'medical' | 'bed' | 'sunny'}
                    size={28}
                    color={PHASE_COLORS[cycleInfo.phase]}
                  />
                </View>
                <View style={styles.phaseInfo}>
                  <Text style={[styles.phaseLabel, { color: PHASE_COLORS[cycleInfo.phase] }]}>
                    {cycleInfo.phase.charAt(0).toUpperCase() + cycleInfo.phase.slice(1)}
                  </Text>
                  <Text style={[styles.phaseDetail, { color: theme.textSub }]}>
                    Day {cycleInfo.dayInCycle} of {cycleInfo.cycleLengthDays}
                  </Text>
                </View>
                <Text style={[styles.cycleCount, { color: theme.textMuted }]}>
                  Cycle {cycleInfo.currentCycle}/{cycleInfo.totalCycles}
                </Text>
              </View>
            </GlassCard>

            {/* Cycle progress bar */}
            <GlassCard style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>CYCLE PROGRESS</Text>
              <View style={[styles.progressTrack, { backgroundColor: theme.bgElevated }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPercent}%` as `${number}%`,
                      backgroundColor: PHASE_COLORS[cycleInfo.phase],
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressLabel, { color: theme.textSub }]}>
                {Math.round(progressPercent)}% through current cycle
              </Text>
            </GlassCard>

            {/* Overall treatment progress */}
            <GlassCard style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>OVERALL TREATMENT</Text>
              <View style={[styles.progressTrack, { backgroundColor: theme.bgElevated }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${overallPercent}%` as `${number}%`,
                      backgroundColor: theme.accent,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressLabel, { color: theme.textSub }]}>
                {Math.round(overallPercent)}% of total treatment complete
              </Text>
            </GlassCard>

            {/* Phase timeline — TODO: render actual phase segments */}
            <GlassCard style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PHASE TIMELINE</Text>
              <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
                Phase segment bar coming soon
              </Text>
            </GlassCard>
          </>
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
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  phaseIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  phaseInfo: { flex: 1 },
  phaseLabel: { fontSize: 18, fontWeight: '700' },
  phaseDetail: { fontSize: 13 },
  cycleCount: { fontSize: 13 },
  progressTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  progressLabel: { fontSize: 12 },
  placeholderText: { fontSize: 13, fontStyle: 'italic' },
  emptyText: { fontSize: 14, lineHeight: 20 },
  errorText: { fontSize: 14 },
})
