import React, { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme'
import { GlassCard } from './GlassCard'
import { ShimmerSkeleton } from './ShimmerSkeleton'
import { useProfile } from '../context/ProfileContext'
import { apiClient } from '../services/api'

type Severity = 'info' | 'warning' | 'danger'

type Alert = {
  id: string
  severity: Severity
  title: string
  detail: string
  source: 'interaction' | 'lab'
}

// Reference range strings from HealthKit (e.g. "4.0–11.0") may use en-dash or
// ASCII hyphen depending on provider. Accept either.
function parseRange(rangeStr: string | null | undefined): [number, number] | null {
  if (!rangeStr) return null
  const match = rangeStr.match(/^\s*([\d.]+)\s*[–-]\s*([\d.]+)\s*$/)
  if (!match) return null
  const low = parseFloat(match[1]!)
  const high = parseFloat(match[2]!)
  if (Number.isNaN(low) || Number.isNaN(high)) return null
  return [low, high]
}

function severityToColor(s: Severity): string {
  if (s === 'danger') return '#EF4444'
  if (s === 'warning') return '#FCD34D'
  return '#A78BFA'
}

function severityToIcon(s: Severity): keyof typeof Ionicons.glyphMap {
  if (s === 'danger') return 'alert-circle'
  if (s === 'warning') return 'warning'
  return 'information-circle'
}

interface Props {
  careProfileId: string | null | undefined
}

export function DailyAlertsCard({ careProfileId }: Props) {
  const theme = useTheme()
  const { csrfToken } = useProfile()
  const [alerts, setAlerts] = useState<Alert[] | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const collected: Alert[] = []

      // 1) Drug interactions — best-effort, skip if no CSRF token or no profile.
      if (careProfileId && csrfToken) {
        try {
          const res = await apiClient.interactions.checkAll(csrfToken)
          const data = res?.data
          if (data) {
            for (const i of data.interactions ?? []) {
              collected.push({
                id: `interact-${i.drug_a}-${i.drug_b}`,
                severity: i.severity === 'major' ? 'danger' : i.severity === 'moderate' ? 'warning' : 'info',
                title: `${i.drug_a} + ${i.drug_b} interaction`,
                detail: i.recommendation || i.description,
                source: 'interaction',
              })
            }
            for (const w of data.allergy_warnings ?? []) {
              collected.push({
                id: `allergy-${w.medication}-${w.allergy}`,
                severity: 'danger',
                title: `${w.medication} flagged for ${w.allergy}`,
                detail: w.risk,
                source: 'interaction',
              })
            }
          }
        } catch {
          // Endpoint not reachable / 403 / etc — degrade silently.
        }
      }

      // 2) Lab values out of reference range — purely client-side.
      if (careProfileId) {
        try {
          const labsRaw = await apiClient.labResults.list(careProfileId)
          const labs = Array.isArray(labsRaw) ? labsRaw : ((labsRaw as any)?.labs ?? [])
          for (const lab of labs as Array<Record<string, any>>) {
            const range = parseRange(lab.referenceRange)
            if (!range) continue
            const val = parseFloat(lab.value)
            if (Number.isNaN(val)) continue
            if (val < range[0] || val > range[1]) {
              collected.push({
                id: `lab-${lab.id ?? lab.testName}`,
                severity: 'danger',
                title: `${lab.testName} out of range`,
                detail: `${lab.value}${lab.unit ? ` ${lab.unit}` : ''} (ref: ${range[0]}–${range[1]})`,
                source: 'lab',
              })
            }
          }
        } catch {
          // Lab fetch failed — skip the lab section.
        }
      }

      if (!cancelled) setAlerts(collected)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [careProfileId, csrfToken])

  if (alerts === null) {
    return (
      <GlassCard style={{ marginBottom: 12 }}>
        <View style={{ padding: 16 }}>
          <ShimmerSkeleton width="50%" height={12} style={{ marginBottom: 14 }} />
          <ShimmerSkeleton width="100%" height={16} style={{ marginBottom: 8 }} />
          <ShimmerSkeleton width="90%" height={16} />
        </View>
      </GlassCard>
    )
  }

  const visible = alerts.slice(0, 3)
  const overflow = alerts.length - visible.length

  return (
    <GlassCard style={{ marginBottom: 12 }}>
      <View style={{ padding: 16 }}>
        <Text
          style={{
            color: theme.textMuted,
            fontSize: 11,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            fontWeight: '600',
            marginBottom: 12,
          }}
        >
          DAILY ALERTS
        </Text>

        {alerts.length === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="checkmark-circle" size={18} color={theme.lavender} />
            <Text style={{ color: theme.textMuted, fontSize: 14 }}>
              All clear — no alerts today.
            </Text>
          </View>
        ) : (
          <>
            {visible.map((a) => (
              <AlertRow key={a.id} alert={a} textColor={theme.text} mutedColor={theme.textMuted} />
            ))}
            {overflow > 0 && (
              <Text
                style={{
                  color: theme.textMuted,
                  fontSize: 12,
                  marginTop: 4,
                  fontWeight: '500',
                }}
              >
                + {overflow} more
              </Text>
            )}
          </>
        )}
      </View>
    </GlassCard>
  )
}

function AlertRow({
  alert,
  textColor,
  mutedColor,
}: {
  alert: Alert
  textColor: string
  mutedColor: string
}) {
  const color = severityToColor(alert.severity)
  const icon = severityToIcon(alert.severity)
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 10,
      }}
    >
      <Ionicons name={icon} size={18} color={color} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 2,
          }}
        >
          <Text
            style={{ color: textColor, fontSize: 13, fontWeight: '700', flex: 1 }}
            numberOfLines={1}
          >
            {alert.title}
          </Text>
        </View>
        <Text style={{ color: mutedColor, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
          {alert.detail}
        </Text>
      </View>
    </View>
  )
}
