// apps/mobile/src/components/WellnessCard.tsx
//
// Compact wellness vitals card showing daily steps, heart rate, and sleep.
// Fetches data from the WellnessVitals native module on mount.

import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme'
import { GlassCard } from './GlassCard'
import {
  fetchWellnessVitals,
  type WellnessVitalsData,
} from '../services/healthkit-vitals'

function formatSteps(steps: number): string {
  if (steps >= 1000) {
    const k = steps / 1000
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`
  }
  return String(Math.round(steps))
}

function formatSleep(hours: number | null): string {
  if (hours == null) return '--'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatHeartRate(bpm: number | null): string {
  if (bpm == null) return '--'
  return String(Math.round(bpm))
}

interface MetricProps {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  value: string
  unit?: string
  label: string
}

function Metric({ icon, iconColor, value, unit, label }: MetricProps) {
  const theme = useTheme()
  return (
    <View style={metricStyles.container}>
      <View style={[metricStyles.iconCircle, { backgroundColor: `${iconColor}15` }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={metricStyles.valueRow}>
        <Text style={[metricStyles.value, { color: theme.text }]}>{value}</Text>
        {unit ? (
          <Text style={[metricStyles.unit, { color: theme.textMuted }]}>{unit}</Text>
        ) : null}
      </View>
      <Text style={[metricStyles.label, { color: theme.textMuted }]}>{label}</Text>
    </View>
  )
}

const metricStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
  },
  unit: {
    fontSize: 11,
    fontWeight: '500',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.3,
  },
})

export function WellnessCard() {
  const theme = useTheme()
  const [vitals, setVitals] = useState<WellnessVitalsData | null>(null)

  useEffect(() => {
    fetchWellnessVitals().then((data) => {
      if (data) setVitals(data)
    })
  }, [])

  const steps = vitals ? formatSteps(vitals.steps) : '--'
  const heartRate = vitals ? formatHeartRate(vitals.heartRate) : '--'
  const sleep = vitals ? formatSleep(vitals.sleepHours) : '--'

  return (
    <GlassCard style={styles.card}>
      <Text style={[styles.label, { color: theme.textMuted }]}>
        TODAY'S WELLNESS
      </Text>
      <View style={styles.metricsRow}>
        <Metric
          icon="walk-outline"
          iconColor={theme.green}
          value={steps}
          label="Steps"
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Metric
          icon="heart-outline"
          iconColor={theme.rose}
          value={heartRate}
          unit={heartRate !== '--' ? 'bpm' : undefined}
          label="Heart Rate"
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Metric
          icon="moon-outline"
          iconColor={theme.lavender}
          value={sleep}
          label="Sleep"
        />
      </View>
    </GlassCard>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    marginHorizontal: 4,
  },
})
