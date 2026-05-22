// stub: iOS parity for Caregiver Burnout Card — replace with real impl
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

type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'

interface BurnoutAssessment {
  riskLevel: RiskLevel
  score: number
  factors: string[]
  suggestions: string[]
}

const RISK_CONFIG: Record<RiskLevel, { color: string; label: string; icon: string }> = {
  low: { color: '#6EE7B7', label: 'Low Risk', icon: 'checkmark-circle' },
  moderate: { color: '#FCD34D', label: 'Moderate Risk', icon: 'warning' },
  high: { color: '#FCA5A5', label: 'High Risk', icon: 'alert-circle' },
  critical: { color: '#F87171', label: 'Critical', icon: 'alert-circle' },
}

export default function CaregiverBurnoutScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [assessment, setAssessment] = useState<BurnoutAssessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAssessment() {
      try {
        const token = await SecureStore.getItemAsync('authToken')
        const res = await fetch(`${API_BASE}/api/caregiver-burnout`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) throw new Error('Failed to load assessment')
        const data = await res.json()
        setAssessment(data.data?.assessment ?? null)
      } catch {
        setError('Could not load burnout assessment')
      } finally {
        setLoading(false)
      }
    }
    void fetchAssessment()
  }, [])

  const config = assessment ? RISK_CONFIG[assessment.riskLevel] : null

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
          <Text style={[styles.title, { color: theme.text }]}>Caregiver Wellness</Text>
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

        {!loading && !assessment && !error && (
          <GlassCard>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No burnout assessment available yet. Complete a few caregiver check-ins first.
            </Text>
          </GlassCard>
        )}

        {!loading && assessment && config && (
          <>
            {/* Risk badge */}
            <GlassCard style={styles.section}>
              <View style={styles.riskRow}>
                <View style={[styles.riskIcon, { backgroundColor: config.color + '22' }]}>
                  <Ionicons
                    name={config.icon as 'checkmark-circle' | 'warning' | 'alert-circle'}
                    size={32}
                    color={config.color}
                  />
                </View>
                <View style={styles.riskInfo}>
                  <Text style={[styles.riskLabel, { color: config.color }]}>{config.label}</Text>
                  <Text style={[styles.riskScore, { color: theme.textSub }]}>
                    Score: {assessment.score}/100
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Contributing factors */}
            {assessment.factors.length > 0 && (
              <GlassCard style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>CONTRIBUTING FACTORS</Text>
                {assessment.factors.map((factor) => (
                  <View key={factor} style={styles.bulletRow}>
                    <View style={[styles.bullet, { backgroundColor: theme.rose }]} />
                    <Text style={[styles.bulletText, { color: theme.textSub }]}>{factor}</Text>
                  </View>
                ))}
              </GlassCard>
            )}

            {/* Suggestions */}
            {assessment.suggestions.length > 0 && (
              <GlassCard style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>WHAT TO DO</Text>
                {assessment.suggestions.map((s, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={[styles.bullet, { backgroundColor: theme.green }]} />
                    <Text style={[styles.bulletText, { color: theme.textSub }]}>{s}</Text>
                  </View>
                ))}
              </GlassCard>
            )}

            {/* Chat CTA — open AI chat with burnout context */}
            <Pressable
              style={[styles.ctaBtn, { backgroundColor: theme.accent }]}
              onPress={() => router.push('/chat')}
            >
              <Text style={styles.ctaBtnLabel}>Talk to your Care Companion</Text>
            </Pressable>
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
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  riskIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  riskInfo: { flex: 1 },
  riskLabel: { fontSize: 20, fontWeight: '700' },
  riskScore: { fontSize: 13 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20 },
  emptyText: { fontSize: 14, lineHeight: 20 },
  errorText: { fontSize: 14 },
  ctaBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaBtnLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
