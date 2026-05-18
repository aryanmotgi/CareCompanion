// stub: iOS parity for Symptom Radar Card — replace with real impl
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

interface CheckinData {
  checkedInAt: string
  pain: number
  mood: number
  energy: string
}

interface OrbMetric {
  label: string
  value: string
  color: string
}

function getOrbColor(metric: 'pain' | 'mood' | 'energy', value: number): string {
  if (metric === 'pain') {
    if (value <= 3) return '#6EE7B7'
    if (value <= 6) return '#FBBF24'
    return '#FCA5A5'
  }
  if (metric === 'mood') {
    if (value >= 3) return '#6EE7B7'
    if (value >= 2) return '#FBBF24'
    return '#FCA5A5'
  }
  if (value >= 4) return '#6EE7B7'
  if (value >= 3) return '#FBBF24'
  return '#FCA5A5'
}

function energyToNum(e: string): number {
  const map: Record<string, number> = { low: 1, moderate: 2, 'moderate-high': 3, high: 4 }
  return map[e] ?? 2
}

export default function SymptomRadarScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [checkins, setCheckins] = useState<CheckinData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCheckins() {
      try {
        const token = await SecureStore.getItemAsync('authToken')
        const res = await fetch(`${API_BASE}/api/checkins?limit=14`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) throw new Error('Failed to load check-ins')
        const data = await res.json()
        setCheckins(data.data?.checkins ?? [])
      } catch (e) {
        setError('Could not load symptom data')
      } finally {
        setLoading(false)
      }
    }
    void fetchCheckins()
  }, [])

  const latest = checkins[0] ?? null

  const orbs: OrbMetric[] = latest
    ? [
        {
          label: 'Pain',
          value: `${latest.pain}/10`,
          color: getOrbColor('pain', latest.pain),
        },
        {
          label: 'Mood',
          value: `${latest.mood}/4`,
          color: getOrbColor('mood', latest.mood),
        },
        {
          label: 'Energy',
          value: latest.energy,
          color: getOrbColor('energy', energyToNum(latest.energy)),
        },
      ]
    : []

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
          <Text style={[styles.title, { color: theme.text }]}>Symptom Radar</Text>
          <View style={styles.backBtn} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
        )}

        {!loading && error && (
          <GlassCard>
            <Text style={[styles.errorText, { color: theme.rose }]}>{error}</Text>
          </GlassCard>
        )}

        {!loading && !error && (
          <>
            {/* Latest check-in orbs */}
            <GlassCard style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                LATEST CHECK-IN
              </Text>
              {latest ? (
                <>
                  <Text style={[styles.timestamp, { color: theme.textSub }]}>
                    {new Date(latest.checkedInAt).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    })}
                  </Text>
                  <View style={styles.orbsRow}>
                    {orbs.map(orb => (
                      <View key={orb.label} style={styles.orbWrap}>
                        <View style={[styles.orb, { backgroundColor: orb.color + '33', borderColor: orb.color }]}>
                          <View style={[styles.orbDot, { backgroundColor: orb.color }]} />
                        </View>
                        <Text style={[styles.orbValue, { color: theme.text }]}>{orb.value}</Text>
                        <Text style={[styles.orbLabel, { color: theme.textMuted }]}>{orb.label}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  No check-ins yet. Log today's symptoms to see your radar.
                </Text>
              )}
            </GlassCard>

            {/* 14-day history placeholder — TODO: render mini sparklines per metric */}
            <GlassCard style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>14-DAY TREND</Text>
              <Text style={[styles.placeholderText, { color: theme.textSub }]}>
                {checkins.length} check-ins logged
              </Text>
              {/* TODO: replace with Victory Native line charts for pain/mood/energy */}
              <View style={[styles.sparklinePlaceholder, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
                <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
                  Sparkline charts coming soon
                </Text>
              </View>
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
  timestamp: { fontSize: 13 },
  orbsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  orbWrap: { alignItems: 'center', gap: 6 },
  orb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbDot: { width: 24, height: 24, borderRadius: 12 },
  orbValue: { fontSize: 14, fontWeight: '700' },
  orbLabel: { fontSize: 11, letterSpacing: 0.5 },
  emptyText: { fontSize: 14, lineHeight: 20 },
  sparklinePlaceholder: {
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 13 },
  errorText: { fontSize: 14 },
})
